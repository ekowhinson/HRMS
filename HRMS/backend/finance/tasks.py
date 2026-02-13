"""Celery tasks for finance module - Payroll GL integration and asset depreciation."""

import logging
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

from celery import shared_task
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

logger = logging.getLogger('hrms')

# ---------------------------------------------------------------------------
# Default GL account code mapping used when a PayComponent has no gl_account
# ---------------------------------------------------------------------------
DEFAULT_ACCOUNT_CODES = {
    # Expense (debit) side - maps to Account.code (max 20 chars)
    'BASIC': '5110',
    'ALLOWANCE': '5120',
    'BONUS': '5130',
    'OVERTIME': '5140',
    'SHIFT': '5150',
    'EMPLOYER_SSNIT': '5160',
    'EMPLOYER_TIER2': '5170',
    'OTHER_EARNING': '5110',
    # Liability / payable (credit) side
    'PAYE_PAYABLE': '2130',
    'SSNIT_PAYABLE': '2140',
    'TIER2_PAYABLE': '2150',
    'NET_PAY_PAYABLE': '2160',
    'LOAN_PAYABLE': '2170',
    'DEDUCTION_PAYABLE': '2180',
    # Depreciation
    'DEPRECIATION_EXPENSE': '5280',
    'ACCUMULATED_DEPRECIATION': '1250',
}


def _lookup_account(code, tenant=None):
    """
    Look up an Account by its code.  Returns the Account instance or None.
    """
    from finance.models import Account
    try:
        qs = Account.all_objects.filter(code=code, is_active=True)
        if tenant:
            qs = qs.filter(tenant=tenant)
        return qs.first()
    except Exception:
        return None


def _resolve_account(component, side='expense', tenant=None):
    """
    Resolve the GL account for a payroll component.

    For earnings the *expense* account is on the debit side (component.gl_account).
    For employer contributions we prefer employer_gl_account, falling back to gl_account.
    For deductions (credit side) we use the component's gl_account (the liability).

    If the component has no gl_account configured, we fall back to
    DEFAULT_ACCOUNT_CODES based on the component's category/type.
    """
    from payroll.models import PayComponent

    # 1. Try explicit GL account on the component
    if side == 'employer' and component.employer_gl_account_id:
        return component.employer_gl_account
    if component.gl_account_id:
        return component.gl_account

    # 2. Fall back to default account codes
    category = component.category  # BASIC, ALLOWANCE, BONUS, etc.
    comp_type = component.component_type  # EARNING, DEDUCTION, EMPLOYER

    if comp_type == PayComponent.ComponentType.EMPLOYER_CONTRIBUTION:
        if 'SSNIT' in component.code.upper() or 'SSNIT' in component.name.upper():
            default_code = DEFAULT_ACCOUNT_CODES.get('EMPLOYER_SSNIT')
        elif 'TIER' in component.code.upper() or 'TIER' in component.name.upper():
            default_code = DEFAULT_ACCOUNT_CODES.get('EMPLOYER_TIER2')
        else:
            default_code = DEFAULT_ACCOUNT_CODES.get('EMPLOYER_SSNIT')
    elif comp_type == PayComponent.ComponentType.DEDUCTION:
        if 'PAYE' in component.code.upper() or 'TAX' in component.code.upper():
            default_code = DEFAULT_ACCOUNT_CODES.get('PAYE_PAYABLE')
        elif 'SSNIT' in component.code.upper():
            default_code = DEFAULT_ACCOUNT_CODES.get('SSNIT_PAYABLE')
        elif 'TIER' in component.code.upper():
            default_code = DEFAULT_ACCOUNT_CODES.get('TIER2_PAYABLE')
        elif category == PayComponent.ComponentCategory.LOAN:
            default_code = DEFAULT_ACCOUNT_CODES.get('LOAN_PAYABLE')
        else:
            default_code = DEFAULT_ACCOUNT_CODES.get('DEDUCTION_PAYABLE')
    else:
        # Earnings
        default_code = DEFAULT_ACCOUNT_CODES.get(category, DEFAULT_ACCOUNT_CODES['OTHER_EARNING'])

    if default_code:
        acct = _lookup_account(default_code, tenant=tenant)
        if acct:
            return acct

    return None


def _generate_entry_number(prefix, tenant=None):
    """Generate a unique journal entry number like JV-PAY-202602-001."""
    from finance.models import JournalEntry
    now = timezone.now()
    base = f"{prefix}-{now.year}{now.month:02d}"
    qs = JournalEntry.all_objects.filter(entry_number__startswith=base)
    if tenant:
        qs = qs.filter(tenant=tenant)
    last = qs.order_by('-entry_number').first()
    if last:
        try:
            seq = int(last.entry_number.rsplit('-', 1)[-1]) + 1
        except (ValueError, IndexError):
            seq = 1
    else:
        seq = 1
    return f"{base}-{seq:04d}"


# ========================================================================
#  TASK 1: Post Payroll Run to General Ledger
# ========================================================================

@shared_task(bind=True, queue='finance', max_retries=2, default_retry_delay=60)
def post_payroll_to_gl(self, payroll_run_id, tenant_id=None):
    """
    Create GL journal entries from a completed payroll run.

    For each PayrollItem in the run, details are grouped by the employee's
    cost_center.  For each cost-center group a single JournalEntry is
    created with:
        DEBIT lines  - salary expense accounts (basic, allowances, employer
                       contributions) keyed by PayComponent.gl_account
        CREDIT lines - liability / payable accounts (PAYE, SSNIT, net pay)
    """
    from finance.models import JournalEntry, JournalLine, Account, FiscalPeriod
    from payroll.models import PayrollRun, PayrollItem, PayrollItemDetail, PayComponent

    logger.info(f"Posting payroll run {payroll_run_id} to GL")

    try:
        payroll_run = PayrollRun.all_objects.get(pk=payroll_run_id)
    except PayrollRun.DoesNotExist:
        logger.error(f"PayrollRun {payroll_run_id} not found")
        return {'status': 'error', 'message': f'PayrollRun {payroll_run_id} not found'}

    tenant = payroll_run.tenant

    # -- Determine fiscal period -----------------------------------------
    payroll_period = payroll_run.payroll_period
    pay_date = payroll_period.end_date  # use the period end date

    fiscal_period = (
        FiscalPeriod.objects
        .filter(start_date__lte=pay_date, end_date__gte=pay_date, is_closed=False)
        .select_related('fiscal_year')
        .first()
    )
    if fiscal_period is None:
        # Try across all tenants as a fallback
        fiscal_period = (
            FiscalPeriod.all_objects
            .filter(start_date__lte=pay_date, end_date__gte=pay_date, is_closed=False)
            .select_related('fiscal_year')
            .first()
        )
    if fiscal_period is None:
        msg = f"No open FiscalPeriod found covering {pay_date}"
        logger.error(msg)
        return {'status': 'error', 'message': msg}

    # -- Fetch all payroll items with their details ----------------------
    items = (
        PayrollItem.all_objects
        .filter(payroll_run=payroll_run)
        .select_related('employee', 'employee__cost_center', 'employee__department')
        .prefetch_related('details__pay_component')
    )

    if not items.exists():
        logger.warning(f"No payroll items found for run {payroll_run_id}")
        return {'status': 'warning', 'message': 'No payroll items to post'}

    # -- Group detail lines by cost_center -------------------------------
    cost_center_groups = defaultdict(lambda: {
        'cost_center': None,
        'department': None,
        'debits': defaultdict(Decimal),
        'credits': defaultdict(Decimal),
        'debit_accounts': {},
        'credit_accounts': {},
        'net_pay': Decimal('0.00'),
    })

    net_pay_account = _lookup_account(DEFAULT_ACCOUNT_CODES['NET_PAY_PAYABLE'], tenant=tenant)
    paye_account = _lookup_account(DEFAULT_ACCOUNT_CODES['PAYE_PAYABLE'], tenant=tenant)
    ssnit_payable_account = _lookup_account(DEFAULT_ACCOUNT_CODES['SSNIT_PAYABLE'], tenant=tenant)
    tier2_payable_account = _lookup_account(DEFAULT_ACCOUNT_CODES['TIER2_PAYABLE'], tenant=tenant)

    skipped_components = set()

    for item in items:
        cc_id = item.employee.cost_center_id or 'NO_CC'
        group = cost_center_groups[cc_id]
        group['cost_center'] = item.employee.cost_center
        group['department'] = item.employee.department

        # Accumulate net pay for the credit side
        group['net_pay'] += item.net_salary

        for detail in item.details.all():
            component = detail.pay_component
            amount = detail.amount

            if amount == Decimal('0.00'):
                continue

            if component.component_type == PayComponent.ComponentType.EARNING:
                # DEBIT: salary expense
                account = _resolve_account(component, side='expense', tenant=tenant)
                if account is None:
                    skipped_components.add(component.code)
                    continue
                group['debits'][account.pk] += amount
                group['debit_accounts'][account.pk] = account

            elif component.component_type == PayComponent.ComponentType.EMPLOYER_CONTRIBUTION:
                # DEBIT: employer contribution expense
                account = _resolve_account(component, side='employer', tenant=tenant)
                if account is None:
                    skipped_components.add(component.code)
                    continue
                group['debits'][account.pk] += amount
                group['debit_accounts'][account.pk] = account

                # CREDIT: corresponding liability account
                liability_account = _resolve_account(component, side='expense', tenant=tenant)
                if liability_account is None:
                    if 'SSNIT' in component.code.upper():
                        liability_account = ssnit_payable_account
                    elif 'TIER' in component.code.upper():
                        liability_account = tier2_payable_account
                    else:
                        liability_account = ssnit_payable_account
                if liability_account:
                    group['credits'][liability_account.pk] += amount
                    group['credit_accounts'][liability_account.pk] = liability_account

            elif component.component_type == PayComponent.ComponentType.DEDUCTION:
                # CREDIT: deduction payable / liability
                account = _resolve_account(component, side='deduction', tenant=tenant)
                if account is None:
                    skipped_components.add(component.code)
                    continue
                group['credits'][account.pk] += amount
                group['credit_accounts'][account.pk] = account

    if skipped_components:
        logger.warning(
            f"Skipped components with no GL account configured: {', '.join(sorted(skipped_components))}"
        )

    # -- Create journal entries per cost-center --------------------------
    journal_entries_created = []

    with transaction.atomic():
        for cc_id, group in cost_center_groups.items():
            cost_center = group['cost_center']
            department = group['department']

            # Add net-pay credit line
            if net_pay_account and group['net_pay'] > Decimal('0.00'):
                group['credits'][net_pay_account.pk] += group['net_pay']
                group['credit_accounts'][net_pay_account.pk] = net_pay_account

            total_debit = sum(group['debits'].values())
            total_credit = sum(group['credits'].values())

            if total_debit == Decimal('0.00') and total_credit == Decimal('0.00'):
                continue

            # Round amounts
            total_debit = total_debit.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            total_credit = total_credit.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            cc_label = cost_center.name if cost_center else 'General'
            entry_number = _generate_entry_number('JV-PAY', tenant=tenant)

            journal_entry = JournalEntry(
                tenant=tenant,
                entry_number=entry_number,
                journal_date=pay_date,
                fiscal_period=fiscal_period,
                description=f"Payroll {payroll_run.run_number} - {cc_label}",
                source='PAYROLL',
                source_reference=payroll_run.run_number,
                status=JournalEntry.EntryStatus.POSTED,
                total_debit=total_debit,
                total_credit=total_credit,
                posted_at=timezone.now(),
            )
            journal_entry.save()

            # -- Create DEBIT lines (expenses) --
            lines_to_create = []
            for account_id, amount in group['debits'].items():
                account = group['debit_accounts'][account_id]
                rounded_amount = amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                if rounded_amount <= Decimal('0.00'):
                    continue
                lines_to_create.append(JournalLine(
                    tenant=tenant,
                    journal_entry=journal_entry,
                    account=account,
                    description=f"{account.name} - {payroll_run.run_number}",
                    debit_amount=rounded_amount,
                    credit_amount=Decimal('0.00'),
                    cost_center=cost_center,
                    department=department,
                ))

            # -- Create CREDIT lines (liabilities / payables) --
            for account_id, amount in group['credits'].items():
                account = group['credit_accounts'][account_id]
                rounded_amount = amount.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
                if rounded_amount <= Decimal('0.00'):
                    continue
                lines_to_create.append(JournalLine(
                    tenant=tenant,
                    journal_entry=journal_entry,
                    account=account,
                    description=f"{account.name} - {payroll_run.run_number}",
                    debit_amount=Decimal('0.00'),
                    credit_amount=rounded_amount,
                    cost_center=cost_center,
                    department=department,
                ))

            JournalLine.objects.bulk_create(lines_to_create)
            journal_entries_created.append(entry_number)

            logger.info(
                f"Created journal {entry_number}: DR {total_debit} / CR {total_credit} "
                f"for cost center '{cc_label}'"
            )

        # -- Update PayrollRun with journal reference --------------------
        journal_ref = ', '.join(journal_entries_created)
        payroll_run.notes = (
            f"{payroll_run.notes or ''}\n"
            f"GL Posted: {journal_ref} at {timezone.now().isoformat()}"
        ).strip()
        payroll_run.save(update_fields=['notes', 'updated_at'])

    logger.info(
        f"Successfully posted payroll run {payroll_run_id} to GL: "
        f"{len(journal_entries_created)} journal entries created"
    )

    return {
        'status': 'success',
        'payroll_run_id': str(payroll_run_id),
        'journal_entries': journal_entries_created,
        'entries_count': len(journal_entries_created),
        'skipped_components': list(skipped_components),
    }


# ========================================================================
#  TASK 2: Calculate Depreciation for Active Assets
# ========================================================================

def _calculate_syd_depreciation(acquisition_cost, salvage_value, useful_life_months, months_elapsed):
    """
    Sum-of-Years-Digits monthly depreciation.

    SYD uses years as the base:
        remaining_years = total_years - years_elapsed
        yearly_depreciation = (depreciable_base * remaining_years) / sum_of_years
        monthly = yearly / 12

    We convert months to years for the formula, computing the current year's
    monthly rate.
    """
    depreciable_base = acquisition_cost - salvage_value
    if depreciable_base <= Decimal('0.00'):
        return Decimal('0.00')

    useful_life_years = Decimal(useful_life_months) / Decimal('12')
    # Round to nearest whole year for SYD formula (standard practice)
    n = int(useful_life_years) if useful_life_years == int(useful_life_years) else int(useful_life_years) + 1
    if n <= 0:
        return Decimal('0.00')

    sum_of_years = Decimal(n * (n + 1)) / Decimal('2')

    # Determine which "year" we are in (1-based)
    current_year = int(months_elapsed / 12) + 1
    if current_year > n:
        return Decimal('0.00')

    remaining_years = n - current_year + 1
    yearly_depreciation = (depreciable_base * Decimal(remaining_years)) / sum_of_years
    monthly_depreciation = yearly_depreciation / Decimal('12')

    return monthly_depreciation.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


@shared_task(bind=True, queue='finance', max_retries=2, default_retry_delay=60)
def calculate_depreciation(self, fiscal_period_id, tenant_id=None):
    """
    Calculate monthly depreciation for all active assets and create
    corresponding journal entries.

    Depreciation methods supported:
        - STRAIGHT_LINE:     (cost - salvage) / useful_life_months
        - DECLINING_BALANCE: current_value * (2 / useful_life_months)  [double declining]
        - SUM_OF_YEARS:      standard SYD formula
    """
    from finance.models import JournalEntry, JournalLine, Account, FiscalPeriod
    from inventory.models import Asset, AssetDepreciation

    logger.info(f"Calculating depreciation for fiscal period {fiscal_period_id}")

    try:
        fiscal_period = FiscalPeriod.all_objects.select_related('fiscal_year').get(pk=fiscal_period_id)
    except FiscalPeriod.DoesNotExist:
        logger.error(f"FiscalPeriod {fiscal_period_id} not found")
        return {'status': 'error', 'message': f'FiscalPeriod {fiscal_period_id} not found'}

    if fiscal_period.is_closed:
        msg = f"FiscalPeriod {fiscal_period.name} is already closed"
        logger.error(msg)
        return {'status': 'error', 'message': msg}

    tenant = fiscal_period.tenant

    # -- Retrieve all active assets --------------------------------------
    assets_qs = Asset.all_objects.filter(status=Asset.Status.ACTIVE)
    if tenant:
        assets_qs = assets_qs.filter(tenant=tenant)
    assets = list(
        assets_qs.select_related('category', 'department')
    )

    if not assets:
        logger.info("No active assets found for depreciation")
        return {'status': 'success', 'assets_processed': 0, 'message': 'No active assets'}

    # -- Default GL accounts ---------------------------------------------
    depreciation_expense_account = _lookup_account(
        DEFAULT_ACCOUNT_CODES['DEPRECIATION_EXPENSE'], tenant=tenant
    )
    accumulated_depr_account = _lookup_account(
        DEFAULT_ACCOUNT_CODES['ACCUMULATED_DEPRECIATION'], tenant=tenant
    )

    if not depreciation_expense_account or not accumulated_depr_account:
        msg = (
            "Depreciation GL accounts not configured. "
            f"Need accounts with codes: {DEFAULT_ACCOUNT_CODES['DEPRECIATION_EXPENSE']}, "
            f"{DEFAULT_ACCOUNT_CODES['ACCUMULATED_DEPRECIATION']}"
        )
        logger.error(msg)
        return {'status': 'error', 'message': msg}

    # -- Calculate depreciation per asset --------------------------------
    processed = 0
    skipped = 0
    total_depreciation = Decimal('0.00')
    depreciation_records = []

    with transaction.atomic():
        for asset in assets:
            # Skip if already depreciated for this period
            if AssetDepreciation.all_objects.filter(asset=asset, fiscal_period=fiscal_period).exists():
                logger.debug(f"Asset {asset.asset_number} already depreciated for this period, skipping")
                skipped += 1
                continue

            # Skip fully depreciated assets
            depreciable_base = asset.acquisition_cost - asset.salvage_value
            if asset.current_value <= asset.salvage_value or depreciable_base <= Decimal('0.00'):
                skipped += 1
                continue

            # Determine months elapsed since acquisition
            acq_date = asset.acquisition_date
            period_start = fiscal_period.start_date
            months_elapsed = (
                (period_start.year - acq_date.year) * 12
                + (period_start.month - acq_date.month)
            )
            if months_elapsed < 0:
                # Asset acquired after this period - skip
                skipped += 1
                continue

            # -- Calculate depreciation amount based on method -----------
            method = asset.depreciation_method
            useful_life = asset.useful_life_months

            if useful_life <= 0:
                skipped += 1
                continue

            if method == Asset.DepreciationMethod.STRAIGHT_LINE:
                monthly_depr = (
                    (asset.acquisition_cost - asset.salvage_value)
                    / Decimal(useful_life)
                ).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            elif method == Asset.DepreciationMethod.DECLINING_BALANCE:
                # Double declining balance: rate = 2 / useful_life_months
                rate = Decimal('2') / Decimal(useful_life)
                monthly_depr = (asset.current_value * rate).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )

            elif method == Asset.DepreciationMethod.SUM_OF_YEARS:
                monthly_depr = _calculate_syd_depreciation(
                    asset.acquisition_cost,
                    asset.salvage_value,
                    useful_life,
                    months_elapsed,
                )

            else:
                # Unknown method - skip
                logger.warning(
                    f"Unsupported depreciation method '{method}' for asset {asset.asset_number}"
                )
                skipped += 1
                continue

            # Ensure we don't depreciate below salvage value
            max_depr = asset.current_value - asset.salvage_value
            if max_depr <= Decimal('0.00'):
                skipped += 1
                continue
            monthly_depr = min(monthly_depr, max_depr)

            if monthly_depr <= Decimal('0.00'):
                skipped += 1
                continue

            # -- Update asset values -------------------------------------
            new_accumulated = asset.accumulated_depreciation + monthly_depr
            new_book_value = asset.acquisition_cost - new_accumulated

            # -- Create AssetDepreciation record -------------------------
            depr_record = AssetDepreciation(
                tenant=tenant,
                asset=asset,
                fiscal_period=fiscal_period,
                depreciation_amount=monthly_depr,
                accumulated_depreciation=new_accumulated,
                book_value=new_book_value,
            )
            depreciation_records.append(depr_record)

            # Update asset fields
            asset.accumulated_depreciation = new_accumulated
            asset.current_value = new_book_value
            asset.save(update_fields=['accumulated_depreciation', 'current_value', 'updated_at'])

            total_depreciation += monthly_depr
            processed += 1

        # -- Bulk create depreciation records ----------------------------
        if depreciation_records:
            AssetDepreciation.objects.bulk_create(depreciation_records)

        # -- Create a single journal entry for all depreciation ----------
        if total_depreciation > Decimal('0.00'):
            entry_number = _generate_entry_number('JV-DEP', tenant=tenant)
            total_depr_rounded = total_depreciation.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            journal_entry = JournalEntry(
                tenant=tenant,
                entry_number=entry_number,
                journal_date=fiscal_period.end_date,
                fiscal_period=fiscal_period,
                description=f"Monthly depreciation - {fiscal_period.name}",
                source='DEPRECIATION',
                source_reference=f"DEP-{fiscal_period.name}",
                status=JournalEntry.EntryStatus.POSTED,
                total_debit=total_depr_rounded,
                total_credit=total_depr_rounded,
                posted_at=timezone.now(),
            )
            journal_entry.save()

            # DEBIT: Depreciation expense
            JournalLine.objects.create(
                tenant=tenant,
                journal_entry=journal_entry,
                account=depreciation_expense_account,
                description=f"Depreciation expense - {fiscal_period.name}",
                debit_amount=total_depr_rounded,
                credit_amount=Decimal('0.00'),
            )

            # CREDIT: Accumulated depreciation (contra-asset)
            JournalLine.objects.create(
                tenant=tenant,
                journal_entry=journal_entry,
                account=accumulated_depr_account,
                description=f"Accumulated depreciation - {fiscal_period.name}",
                debit_amount=Decimal('0.00'),
                credit_amount=total_depr_rounded,
            )

            # Link journal entry back to each depreciation record
            AssetDepreciation.all_objects.filter(
                pk__in=[r.pk for r in depreciation_records]
            ).update(journal_entry=journal_entry)

            logger.info(
                f"Created depreciation journal {entry_number}: "
                f"DR/CR {total_depr_rounded} for {processed} assets"
            )
        else:
            entry_number = None

    logger.info(
        f"Depreciation complete for period {fiscal_period.name}: "
        f"{processed} assets processed, {skipped} skipped, "
        f"total depreciation: {total_depreciation}"
    )

    return {
        'status': 'success',
        'fiscal_period_id': str(fiscal_period_id),
        'assets_processed': processed,
        'assets_skipped': skipped,
        'total_depreciation': str(total_depreciation),
        'journal_entry': entry_number,
    }


# ========================================================================
#  TASK 3: Generate Recurring Journal Entries
# ========================================================================

@shared_task(bind=True, queue='finance', max_retries=2, default_retry_delay=60)
def generate_recurring_journals(self, recurring_id=None):
    """
    Find due RecurringJournal entries and create new JournalEntries from their templates.
    If recurring_id is provided, only process that specific recurring journal.
    """
    from finance.models import RecurringJournal, JournalEntry, JournalLine, FiscalPeriod
    from dateutil.relativedelta import relativedelta

    today = timezone.now().date()
    logger.info(f"Generating recurring journals (as of {today})")

    qs = RecurringJournal.all_objects.filter(is_active=True, next_run_date__lte=today)
    if recurring_id:
        qs = qs.filter(pk=recurring_id)

    generated = []

    for rj in qs.select_related('source_entry'):
        tenant = rj.tenant
        # Check end date
        if rj.end_date and today > rj.end_date:
            rj.is_active = False
            rj.save(update_fields=['is_active', 'updated_at'])
            continue

        source = rj.source_entry
        source_lines = JournalLine.all_objects.filter(journal_entry=source)

        # Find fiscal period for the journal date
        fiscal_period = (
            FiscalPeriod.all_objects
            .filter(start_date__lte=rj.next_run_date, end_date__gte=rj.next_run_date, is_closed=False)
            .first()
        )
        if not fiscal_period:
            logger.warning(f"No open fiscal period for recurring journal {rj.template_name} on {rj.next_run_date}")
            continue

        with transaction.atomic():
            entry_number = _generate_entry_number('JV-REC', tenant=tenant)
            new_entry = JournalEntry(
                tenant=tenant,
                entry_number=entry_number,
                journal_date=rj.next_run_date,
                fiscal_period=fiscal_period,
                description=f"Recurring: {rj.template_name}",
                source='RECURRING',
                source_reference=rj.template_name,
                status=JournalEntry.EntryStatus.POSTED,
                total_debit=source.total_debit,
                total_credit=source.total_credit,
                posted_at=timezone.now(),
            )
            new_entry.save()

            new_lines = []
            for line in source_lines:
                new_lines.append(JournalLine(
                    tenant=tenant,
                    journal_entry=new_entry,
                    account=line.account,
                    description=line.description,
                    debit_amount=line.debit_amount,
                    credit_amount=line.credit_amount,
                    cost_center=line.cost_center,
                    department=line.department,
                    project=line.project,
                ))
            JournalLine.objects.bulk_create(new_lines)

            # Advance next_run_date
            freq = rj.frequency
            if freq == RecurringJournal.Frequency.MONTHLY:
                rj.next_run_date += relativedelta(months=1)
            elif freq == RecurringJournal.Frequency.QUARTERLY:
                rj.next_run_date += relativedelta(months=3)
            elif freq == RecurringJournal.Frequency.SEMI_ANNUAL:
                rj.next_run_date += relativedelta(months=6)
            elif freq == RecurringJournal.Frequency.ANNUAL:
                rj.next_run_date += relativedelta(years=1)

            rj.last_generated = timezone.now()
            rj.save(update_fields=['next_run_date', 'last_generated', 'updated_at'])
            generated.append(entry_number)

    logger.info(f"Generated {len(generated)} recurring journal entries")
    return {'status': 'success', 'generated': generated, 'count': len(generated)}


# ========================================================================
#  TASK 4: GL Integration Tasks for Other Modules
# ========================================================================

@shared_task(bind=True, queue='finance', max_retries=2, default_retry_delay=60)
def post_loan_disbursement_to_gl(self, loan_id, tenant_id=None):
    """Debit Loan Receivable, Credit Bank/Cash on loan disbursement."""
    from finance.models import JournalEntry, JournalLine, FiscalPeriod
    from benefits.models import Loan

    loan = Loan.all_objects.get(pk=loan_id)
    tenant = loan.tenant

    today = timezone.now().date()
    fiscal_period = FiscalPeriod.all_objects.filter(
        start_date__lte=today, end_date__gte=today, is_closed=False
    ).first()
    if not fiscal_period:
        return {'status': 'error', 'message': 'No open fiscal period'}

    loan_receivable = _lookup_account('1260', tenant=tenant)  # Loan Receivable
    bank_account = _lookup_account('1100', tenant=tenant)  # Bank/Cash

    if not loan_receivable or not bank_account:
        return {'status': 'error', 'message': 'GL accounts not configured for loans'}

    with transaction.atomic():
        entry_number = _generate_entry_number('JV-LN', tenant=tenant)
        entry = JournalEntry(
            tenant=tenant, entry_number=entry_number, journal_date=today,
            fiscal_period=fiscal_period,
            description=f"Loan disbursement - {loan.employee if hasattr(loan, 'employee') else loan_id}",
            source='LOAN', source_reference=str(loan_id),
            status=JournalEntry.EntryStatus.POSTED,
            total_debit=loan.amount, total_credit=loan.amount,
            posted_at=timezone.now(),
        )
        entry.save()
        JournalLine.objects.bulk_create([
            JournalLine(tenant=tenant, journal_entry=entry, account=loan_receivable,
                        description='Loan receivable', debit_amount=loan.amount, credit_amount=Decimal('0.00')),
            JournalLine(tenant=tenant, journal_entry=entry, account=bank_account,
                        description='Bank disbursement', debit_amount=Decimal('0.00'), credit_amount=loan.amount),
        ])

    return {'status': 'success', 'journal_entry': entry_number}


@shared_task(bind=True, queue='finance', max_retries=2, default_retry_delay=60)
def post_benefit_claim_to_gl(self, claim_id, tenant_id=None):
    """Debit Benefit Expense, Credit AP/Bank on benefit claim."""
    from finance.models import JournalEntry, JournalLine, FiscalPeriod
    from benefits.models import BenefitClaim

    claim = BenefitClaim.all_objects.get(pk=claim_id)
    tenant = claim.tenant

    today = timezone.now().date()
    fiscal_period = FiscalPeriod.all_objects.filter(
        start_date__lte=today, end_date__gte=today, is_closed=False
    ).first()
    if not fiscal_period:
        return {'status': 'error', 'message': 'No open fiscal period'}

    benefit_expense = _lookup_account('5200', tenant=tenant)
    ap_account = _lookup_account('2100', tenant=tenant)

    if not benefit_expense or not ap_account:
        return {'status': 'error', 'message': 'GL accounts not configured for benefits'}

    with transaction.atomic():
        entry_number = _generate_entry_number('JV-BEN', tenant=tenant)
        entry = JournalEntry(
            tenant=tenant, entry_number=entry_number, journal_date=today,
            fiscal_period=fiscal_period,
            description=f"Benefit claim - {claim_id}",
            source='BENEFIT', source_reference=str(claim_id),
            status=JournalEntry.EntryStatus.POSTED,
            total_debit=claim.amount, total_credit=claim.amount,
            posted_at=timezone.now(),
        )
        entry.save()
        JournalLine.objects.bulk_create([
            JournalLine(tenant=tenant, journal_entry=entry, account=benefit_expense,
                        description='Benefit expense', debit_amount=claim.amount, credit_amount=Decimal('0.00')),
            JournalLine(tenant=tenant, journal_entry=entry, account=ap_account,
                        description='Accounts payable', debit_amount=Decimal('0.00'), credit_amount=claim.amount),
        ])

    return {'status': 'success', 'journal_entry': entry_number}


@shared_task(bind=True, queue='finance', max_retries=2, default_retry_delay=60)
def post_inventory_movement_to_gl(self, stock_entry_id, tenant_id=None):
    """Debit/Credit Inventory + COGS accounts based on stock entry type."""
    from finance.models import JournalEntry, JournalLine, FiscalPeriod
    from inventory.models import StockEntry

    entry = StockEntry.all_objects.get(pk=stock_entry_id)
    tenant = entry.tenant

    today = timezone.now().date()
    fiscal_period = FiscalPeriod.all_objects.filter(
        start_date__lte=today, end_date__gte=today, is_closed=False
    ).first()
    if not fiscal_period:
        return {'status': 'error', 'message': 'No open fiscal period'}

    inventory_account = _lookup_account('1200', tenant=tenant)
    cogs_account = _lookup_account('5300', tenant=tenant)

    if not inventory_account or not cogs_account:
        return {'status': 'error', 'message': 'GL accounts not configured for inventory'}

    amount = entry.total_cost or (entry.quantity * (entry.unit_cost or Decimal('0.00')))

    with transaction.atomic():
        je_number = _generate_entry_number('JV-INV', tenant=tenant)
        je = JournalEntry(
            tenant=tenant, entry_number=je_number, journal_date=today,
            fiscal_period=fiscal_period,
            description=f"Stock {entry.entry_type} - {entry.reference_number or stock_entry_id}",
            source='INVENTORY', source_reference=str(stock_entry_id),
            status=JournalEntry.EntryStatus.POSTED,
            total_debit=amount, total_credit=amount,
            posted_at=timezone.now(),
        )
        je.save()

        if entry.entry_type == StockEntry.EntryType.RECEIPT:
            # Debit Inventory, Credit AP/GRN clearing
            JournalLine.objects.bulk_create([
                JournalLine(tenant=tenant, journal_entry=je, account=inventory_account,
                            description='Inventory receipt', debit_amount=amount, credit_amount=Decimal('0.00')),
                JournalLine(tenant=tenant, journal_entry=je, account=cogs_account,
                            description='GRN clearing', debit_amount=Decimal('0.00'), credit_amount=amount),
            ])
        elif entry.entry_type == StockEntry.EntryType.ISSUE:
            # Debit COGS, Credit Inventory
            JournalLine.objects.bulk_create([
                JournalLine(tenant=tenant, journal_entry=je, account=cogs_account,
                            description='Cost of goods issued', debit_amount=amount, credit_amount=Decimal('0.00')),
                JournalLine(tenant=tenant, journal_entry=je, account=inventory_account,
                            description='Inventory issue', debit_amount=Decimal('0.00'), credit_amount=amount),
            ])
        else:
            # TRANSFER/ADJUSTMENT — debit and credit inventory at same account
            JournalLine.objects.bulk_create([
                JournalLine(tenant=tenant, journal_entry=je, account=inventory_account,
                            description=f'Stock {entry.entry_type}', debit_amount=amount, credit_amount=Decimal('0.00')),
                JournalLine(tenant=tenant, journal_entry=je, account=inventory_account,
                            description=f'Stock {entry.entry_type}', debit_amount=Decimal('0.00'), credit_amount=amount),
            ])

    return {'status': 'success', 'journal_entry': je_number}


@shared_task(bind=True, queue='finance', max_retries=2, default_retry_delay=60)
def post_asset_disposal_to_gl(self, asset_disposal_id, tenant_id=None):
    """Post asset disposal to GL — Debit Bank/Loss, Credit Asset + Accumulated Depr."""
    from finance.models import JournalEntry, JournalLine, FiscalPeriod
    from inventory.models import AssetDisposal

    disposal = AssetDisposal.all_objects.select_related('asset').get(pk=asset_disposal_id)
    tenant = disposal.tenant
    asset = disposal.asset

    today = timezone.now().date()
    fiscal_period = FiscalPeriod.all_objects.filter(
        start_date__lte=today, end_date__gte=today, is_closed=False
    ).first()
    if not fiscal_period:
        return {'status': 'error', 'message': 'No open fiscal period'}

    asset_account = _lookup_account('1200', tenant=tenant)
    accum_depr_account = _lookup_account(DEFAULT_ACCOUNT_CODES['ACCUMULATED_DEPRECIATION'], tenant=tenant)
    bank_account = _lookup_account('1100', tenant=tenant)
    gain_loss_account = _lookup_account('4900', tenant=tenant) or _lookup_account('5900', tenant=tenant)

    if not asset_account or not accum_depr_account:
        return {'status': 'error', 'message': 'GL accounts not configured for asset disposal'}

    proceeds = disposal.proceeds or Decimal('0.00')
    book_value = disposal.book_value_at_disposal
    gain_loss = proceeds - book_value

    with transaction.atomic():
        je_number = _generate_entry_number('JV-DSP', tenant=tenant)
        total = asset.acquisition_cost
        je = JournalEntry(
            tenant=tenant, entry_number=je_number, journal_date=today,
            fiscal_period=fiscal_period,
            description=f"Asset disposal - {asset.asset_number}",
            source='ASSET_DISPOSAL', source_reference=str(asset_disposal_id),
            status=JournalEntry.EntryStatus.POSTED,
            total_debit=total, total_credit=total,
            posted_at=timezone.now(),
        )
        je.save()

        lines = []
        # Credit: Remove asset at cost
        lines.append(JournalLine(
            tenant=tenant, journal_entry=je, account=asset_account,
            description=f'Remove asset {asset.asset_number}',
            debit_amount=Decimal('0.00'), credit_amount=asset.acquisition_cost,
        ))
        # Debit: Remove accumulated depreciation
        lines.append(JournalLine(
            tenant=tenant, journal_entry=je, account=accum_depr_account,
            description=f'Remove accumulated depreciation',
            debit_amount=asset.accumulated_depreciation, credit_amount=Decimal('0.00'),
        ))
        # Debit: Proceeds received
        if proceeds > Decimal('0.00') and bank_account:
            lines.append(JournalLine(
                tenant=tenant, journal_entry=je, account=bank_account,
                description=f'Disposal proceeds',
                debit_amount=proceeds, credit_amount=Decimal('0.00'),
            ))
        # Gain/Loss
        if gain_loss_account and gain_loss != Decimal('0.00'):
            if gain_loss > Decimal('0.00'):
                lines.append(JournalLine(
                    tenant=tenant, journal_entry=je, account=gain_loss_account,
                    description='Gain on disposal',
                    debit_amount=Decimal('0.00'), credit_amount=gain_loss,
                ))
            else:
                lines.append(JournalLine(
                    tenant=tenant, journal_entry=je, account=gain_loss_account,
                    description='Loss on disposal',
                    debit_amount=abs(gain_loss), credit_amount=Decimal('0.00'),
                ))

        JournalLine.objects.bulk_create(lines)

        # Recalculate totals
        total_debit = sum(l.debit_amount for l in lines)
        total_credit = sum(l.credit_amount for l in lines)
        je.total_debit = total_debit
        je.total_credit = total_credit
        je.save(update_fields=['total_debit', 'total_credit'])

        disposal.journal_entry = je
        disposal.save(update_fields=['journal_entry', 'updated_at'])

    return {'status': 'success', 'journal_entry': je_number}


@shared_task(bind=True, queue='finance', max_retries=2, default_retry_delay=60)
def post_project_costs_to_gl(self, project_id, period_id=None, tenant_id=None):
    """Debit WIP/Project Expense, Credit Accrued Payroll/AP."""
    from finance.models import JournalEntry, JournalLine, FiscalPeriod
    from projects.models import Project

    project = Project.all_objects.get(pk=project_id)
    tenant = project.tenant
    amount = project.actual_cost or Decimal('0.00')

    if amount <= Decimal('0.00'):
        return {'status': 'skipped', 'message': 'No actual costs to post'}

    today = timezone.now().date()
    fiscal_period = FiscalPeriod.all_objects.filter(
        start_date__lte=today, end_date__gte=today, is_closed=False
    ).first()
    if not fiscal_period:
        return {'status': 'error', 'message': 'No open fiscal period'}

    wip_account = _lookup_account('1300', tenant=tenant)
    accrued_account = _lookup_account('2200', tenant=tenant)

    if not wip_account or not accrued_account:
        return {'status': 'error', 'message': 'GL accounts not configured for project costs'}

    with transaction.atomic():
        je_number = _generate_entry_number('JV-PRJ', tenant=tenant)
        je = JournalEntry(
            tenant=tenant, entry_number=je_number, journal_date=today,
            fiscal_period=fiscal_period,
            description=f"Project costs - {project.code}",
            source='PROJECT', source_reference=project.code,
            status=JournalEntry.EntryStatus.POSTED,
            total_debit=amount, total_credit=amount,
            posted_at=timezone.now(),
        )
        je.save()
        JournalLine.objects.bulk_create([
            JournalLine(tenant=tenant, journal_entry=je, account=wip_account,
                        description=f'WIP - {project.code}', debit_amount=amount, credit_amount=Decimal('0.00'),
                        project=project),
            JournalLine(tenant=tenant, journal_entry=je, account=accrued_account,
                        description=f'Accrued costs - {project.code}', debit_amount=Decimal('0.00'), credit_amount=amount,
                        project=project),
        ])

    return {'status': 'success', 'journal_entry': je_number}


@shared_task(bind=True, queue='finance', max_retries=2, default_retry_delay=60)
def post_production_to_gl(self, work_order_id, tenant_id=None):
    """Post manufacturing production cost to GL — Debit FG Inventory, Credit WIP."""
    from finance.models import JournalEntry, JournalLine, FiscalPeriod

    # Lazy import to avoid circular dependency
    from manufacturing.models import WorkOrder

    wo = WorkOrder.all_objects.get(pk=work_order_id)
    tenant = wo.tenant
    amount = wo.actual_cost or Decimal('0.00')

    if amount <= Decimal('0.00'):
        return {'status': 'skipped', 'message': 'No production cost to post'}

    today = timezone.now().date()
    fiscal_period = FiscalPeriod.all_objects.filter(
        start_date__lte=today, end_date__gte=today, is_closed=False
    ).first()
    if not fiscal_period:
        return {'status': 'error', 'message': 'No open fiscal period'}

    fg_inventory = _lookup_account('1210', tenant=tenant)  # Finished Goods
    wip_account = _lookup_account('1300', tenant=tenant)  # WIP

    if not fg_inventory or not wip_account:
        return {'status': 'error', 'message': 'GL accounts not configured for manufacturing'}

    with transaction.atomic():
        je_number = _generate_entry_number('JV-MFG', tenant=tenant)
        je = JournalEntry(
            tenant=tenant, entry_number=je_number, journal_date=today,
            fiscal_period=fiscal_period,
            description=f"Production cost - {wo.work_order_number}",
            source='MANUFACTURING', source_reference=wo.work_order_number,
            status=JournalEntry.EntryStatus.POSTED,
            total_debit=amount, total_credit=amount,
            posted_at=timezone.now(),
        )
        je.save()
        JournalLine.objects.bulk_create([
            JournalLine(tenant=tenant, journal_entry=je, account=fg_inventory,
                        description=f'Finished goods - {wo.work_order_number}',
                        debit_amount=amount, credit_amount=Decimal('0.00')),
            JournalLine(tenant=tenant, journal_entry=je, account=wip_account,
                        description=f'WIP relief - {wo.work_order_number}',
                        debit_amount=Decimal('0.00'), credit_amount=amount),
        ])

    return {'status': 'success', 'journal_entry': je_number}
