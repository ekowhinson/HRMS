"""Business logic services for finance module."""

import logging
from collections import defaultdict
from datetime import date
from decimal import Decimal
from django.db import transaction
from django.db.models import Sum, Q, F
from django.utils import timezone

logger = logging.getLogger('hrms')

ZERO = Decimal('0.00')


class FinancialStatementService:
    """Generate financial statements from GL data."""

    @staticmethod
    def generate_trial_balance(fiscal_period):
        """Aggregate JournalLines by Account for a given period."""
        from .models import JournalLine, Account

        lines = JournalLine.objects.filter(
            journal_entry__fiscal_period=fiscal_period,
            journal_entry__status='POSTED',
        ).values(
            'account__code', 'account__name', 'account__account_type'
        ).annotate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount'),
        ).order_by('account__code')

        return list(lines)

    @staticmethod
    def generate_income_statement(fiscal_period):
        """Revenue vs Expenses for a period."""
        from .models import JournalLine

        data = JournalLine.objects.filter(
            journal_entry__fiscal_period=fiscal_period,
            journal_entry__status='POSTED',
        ).filter(
            Q(account__account_type='REVENUE') | Q(account__account_type='EXPENSE')
        ).values(
            'account__code', 'account__name', 'account__account_type'
        ).annotate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount'),
        ).order_by('account__account_type', 'account__code')

        return list(data)

    @staticmethod
    def validate_journal_entry(entry):
        """Ensure debits = credits."""
        totals = entry.lines.aggregate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount')
        )
        debit = totals['total_debit'] or Decimal('0')
        credit = totals['total_credit'] or Decimal('0')
        if debit != credit:
            return False, f"Debits ({debit}) != Credits ({credit})"
        if debit == 0:
            return False, "Journal entry has no amounts"
        return True, "Valid"

    # ------------------------------------------------------------------
    # New financial report methods
    # ------------------------------------------------------------------

    @staticmethod
    def generate_balance_sheet(fiscal_period):
        """
        Generate a balance sheet as of the end of the given fiscal period.

        Queries posted JournalLines for all periods up to and including the
        given period (cumulative balances) and groups by account type:
        ASSET, LIABILITY, EQUITY.

        Returns a dict with assets, liabilities, equity lists and totals.
        """
        from .models import JournalLine, FiscalPeriod

        # Determine all periods up to and including the given one within
        # the same fiscal year, plus all prior fiscal years.
        target_period = fiscal_period
        target_fy = target_period.fiscal_year

        # All periods: same fiscal year with period_number <= target,
        # OR any prior fiscal year.
        period_filter = (
            Q(
                journal_entry__fiscal_period__fiscal_year=target_fy,
                journal_entry__fiscal_period__period_number__lte=target_period.period_number,
            )
            | Q(
                journal_entry__fiscal_period__fiscal_year__start_date__lt=target_fy.start_date,
            )
        )

        lines = JournalLine.objects.filter(
            journal_entry__status='POSTED',
        ).filter(
            period_filter
        ).filter(
            account__account_type__in=['ASSET', 'LIABILITY', 'EQUITY']
        ).values(
            'account__code', 'account__name', 'account__account_type'
        ).annotate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount'),
        ).order_by('account__account_type', 'account__code')

        assets = []
        liabilities = []
        equity = []
        total_assets = ZERO
        total_liabilities = ZERO
        total_equity = ZERO

        for row in lines:
            debit = row['total_debit'] or ZERO
            credit = row['total_credit'] or ZERO
            account_type = row['account__account_type']

            if account_type == 'ASSET':
                # Assets have debit normal balance
                balance = debit - credit
                assets.append({
                    'code': row['account__code'],
                    'name': row['account__name'],
                    'balance': balance,
                })
                total_assets += balance
            elif account_type == 'LIABILITY':
                # Liabilities have credit normal balance
                balance = credit - debit
                liabilities.append({
                    'code': row['account__code'],
                    'name': row['account__name'],
                    'balance': balance,
                })
                total_liabilities += balance
            elif account_type == 'EQUITY':
                # Equity has credit normal balance
                balance = credit - debit
                equity.append({
                    'code': row['account__code'],
                    'name': row['account__name'],
                    'balance': balance,
                })
                total_equity += balance

        return {
            'fiscal_period': str(fiscal_period),
            'assets': assets,
            'liabilities': liabilities,
            'equity': equity,
            'total_assets': total_assets,
            'total_liabilities': total_liabilities,
            'total_equity': total_equity,
        }

    @staticmethod
    def generate_cash_flow(fiscal_period):
        """
        Generate a simplified cash flow statement for the given fiscal period.

        Operating: revenue minus expenses (from income statement).
        Investing: net change in asset accounts.
        Financing: net change in liability and equity accounts.

        Returns dict with operating, investing, financing sections and net_change.
        """
        from .models import JournalLine

        # ---- Operating activities: Revenue - Expenses for the period ----
        income_data = JournalLine.objects.filter(
            journal_entry__fiscal_period=fiscal_period,
            journal_entry__status='POSTED',
        ).filter(
            Q(account__account_type='REVENUE') | Q(account__account_type='EXPENSE')
        ).values(
            'account__account_type'
        ).annotate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount'),
        )

        revenue_total = ZERO
        expense_total = ZERO
        for row in income_data:
            debit = row['total_debit'] or ZERO
            credit = row['total_credit'] or ZERO
            if row['account__account_type'] == 'REVENUE':
                revenue_total += (credit - debit)
            elif row['account__account_type'] == 'EXPENSE':
                expense_total += (debit - credit)

        operating = revenue_total - expense_total

        # ---- Investing activities: asset account changes for the period ----
        asset_data = JournalLine.objects.filter(
            journal_entry__fiscal_period=fiscal_period,
            journal_entry__status='POSTED',
            account__account_type='ASSET',
        ).aggregate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount'),
        )
        asset_debit = asset_data['total_debit'] or ZERO
        asset_credit = asset_data['total_credit'] or ZERO
        # Net increase in assets is a use of cash (negative in cash flow)
        investing = -(asset_debit - asset_credit)

        # ---- Financing activities: liability + equity changes ----
        fin_data = JournalLine.objects.filter(
            journal_entry__fiscal_period=fiscal_period,
            journal_entry__status='POSTED',
        ).filter(
            Q(account__account_type='LIABILITY') | Q(account__account_type='EQUITY')
        ).aggregate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount'),
        )
        fin_debit = fin_data['total_debit'] or ZERO
        fin_credit = fin_data['total_credit'] or ZERO
        # Net increase in liabilities/equity is a source of cash
        financing = fin_credit - fin_debit

        net_change = operating + investing + financing

        return {
            'fiscal_period': str(fiscal_period),
            'operating': {
                'revenue': revenue_total,
                'expenses': expense_total,
                'net': operating,
            },
            'investing': {
                'asset_changes': investing,
                'net': investing,
            },
            'financing': {
                'liability_equity_changes': financing,
                'net': financing,
            },
            'net_change': net_change,
        }

    @staticmethod
    def generate_ap_aging(as_of_date=None):
        """
        Generate accounts payable aging report.

        Queries VendorInvoice where status is not PAID or CANCELLED,
        buckets outstanding amounts by days overdue:
          current (not yet due), 1-30, 31-60, 61-90, 90+ days.

        Returns dict with 'detail' (per-vendor breakdown) and 'summary' totals.
        """
        from .models import VendorInvoice

        if as_of_date is None:
            as_of_date = date.today()

        invoices = VendorInvoice.objects.filter(
            ~Q(status__in=['PAID', 'CANCELLED'])
        ).select_related('vendor')

        vendor_buckets = defaultdict(lambda: {
            'vendor_name': '',
            'vendor_code': '',
            'current': ZERO,
            'days_30': ZERO,
            'days_60': ZERO,
            'days_90': ZERO,
            'over_90': ZERO,
            'total': ZERO,
        })

        for inv in invoices:
            balance = inv.total_amount - inv.paid_amount
            if balance <= ZERO:
                continue

            vendor_id = inv.vendor_id
            vendor_buckets[vendor_id]['vendor_name'] = inv.vendor.name
            vendor_buckets[vendor_id]['vendor_code'] = inv.vendor.code

            days_overdue = (as_of_date - inv.due_date).days

            if days_overdue <= 0:
                vendor_buckets[vendor_id]['current'] += balance
            elif days_overdue <= 30:
                vendor_buckets[vendor_id]['days_30'] += balance
            elif days_overdue <= 60:
                vendor_buckets[vendor_id]['days_60'] += balance
            elif days_overdue <= 90:
                vendor_buckets[vendor_id]['days_90'] += balance
            else:
                vendor_buckets[vendor_id]['over_90'] += balance

            vendor_buckets[vendor_id]['total'] += balance

        detail = list(vendor_buckets.values())

        # Summary totals
        summary = {
            'current': sum(v['current'] for v in detail),
            'days_30': sum(v['days_30'] for v in detail),
            'days_60': sum(v['days_60'] for v in detail),
            'days_90': sum(v['days_90'] for v in detail),
            'over_90': sum(v['over_90'] for v in detail),
            'total': sum(v['total'] for v in detail),
        }

        return {
            'as_of_date': as_of_date.isoformat(),
            'detail': detail,
            'summary': summary,
        }

    @staticmethod
    def generate_ar_aging(as_of_date=None):
        """
        Generate accounts receivable aging report.

        Queries CustomerInvoice where status is not PAID or CANCELLED,
        buckets outstanding amounts by days overdue:
          current (not yet due), 1-30, 31-60, 61-90, 90+ days.

        Returns dict with 'detail' (per-customer breakdown) and 'summary' totals.
        """
        from .models import CustomerInvoice

        if as_of_date is None:
            as_of_date = date.today()

        invoices = CustomerInvoice.objects.filter(
            ~Q(status__in=['PAID', 'CANCELLED'])
        ).select_related('customer')

        customer_buckets = defaultdict(lambda: {
            'customer_name': '',
            'customer_code': '',
            'current': ZERO,
            'days_30': ZERO,
            'days_60': ZERO,
            'days_90': ZERO,
            'over_90': ZERO,
            'total': ZERO,
        })

        for inv in invoices:
            balance = inv.total_amount - inv.paid_amount
            if balance <= ZERO:
                continue

            cust_id = inv.customer_id
            customer_buckets[cust_id]['customer_name'] = inv.customer.name
            customer_buckets[cust_id]['customer_code'] = inv.customer.code

            days_overdue = (as_of_date - inv.due_date).days

            if days_overdue <= 0:
                customer_buckets[cust_id]['current'] += balance
            elif days_overdue <= 30:
                customer_buckets[cust_id]['days_30'] += balance
            elif days_overdue <= 60:
                customer_buckets[cust_id]['days_60'] += balance
            elif days_overdue <= 90:
                customer_buckets[cust_id]['days_90'] += balance
            else:
                customer_buckets[cust_id]['over_90'] += balance

            customer_buckets[cust_id]['total'] += balance

        detail = list(customer_buckets.values())

        # Summary totals
        summary = {
            'current': sum(v['current'] for v in detail),
            'days_30': sum(v['days_30'] for v in detail),
            'days_60': sum(v['days_60'] for v in detail),
            'days_90': sum(v['days_90'] for v in detail),
            'over_90': sum(v['over_90'] for v in detail),
            'total': sum(v['total'] for v in detail),
        }

        return {
            'as_of_date': as_of_date.isoformat(),
            'detail': detail,
            'summary': summary,
        }

    @staticmethod
    def generate_budget_vs_actual(fiscal_year_id, cost_center_id=None):
        """
        Generate a budget vs actual comparison report.

        For each approved/revised budget in the fiscal year (optionally
        filtered by cost_center), calculates:
          - actual: sum of posted JournalLine amounts for the account
            (debits for expense accounts, credits for revenue)
          - committed: sum of BudgetCommitments with status=COMMITTED
          - available: budget_amount - committed - actual
          - variance_pct: utilization percentage = (actual + committed) / budget * 100
          - rag_status: GREEN (<80%), AMBER (80-95%), RED (>95%)

        Returns dict with items list and summary totals.
        """
        from .models import Budget, BudgetCommitment, JournalLine, FiscalYear

        budget_qs = Budget.objects.filter(
            fiscal_year_id=fiscal_year_id,
            status__in=['APPROVED', 'REVISED'],
        ).select_related('account', 'cost_center', 'department', 'fiscal_year')

        if cost_center_id is not None:
            budget_qs = budget_qs.filter(cost_center_id=cost_center_id)

        results = []

        for budget in budget_qs:
            budget_amount = budget.revised_amount or budget.original_amount

            # Calculate actual spend from posted journal lines
            line_filter = Q(
                journal_entry__status='POSTED',
                account=budget.account,
                journal_entry__fiscal_period__fiscal_year_id=fiscal_year_id,
            )
            if budget.cost_center_id:
                line_filter &= Q(cost_center_id=budget.cost_center_id)
            if budget.department_id:
                line_filter &= Q(department_id=budget.department_id)

            totals = JournalLine.objects.filter(line_filter).aggregate(
                total_debit=Sum('debit_amount'),
                total_credit=Sum('credit_amount'),
            )
            debit = totals['total_debit'] or ZERO
            credit = totals['total_credit'] or ZERO

            # For expense accounts, actual = debits; for revenue, actual = credits
            if budget.account.account_type == 'EXPENSE':
                actual = debit - credit
            elif budget.account.account_type == 'REVENUE':
                actual = credit - debit
            else:
                # For asset/liability/equity budgets, use debit-based
                actual = debit - credit

            # Committed amount (encumbrances not yet consumed)
            committed = BudgetCommitment.objects.filter(
                budget=budget,
                status='COMMITTED',
            ).aggregate(total=Sum('amount'))['total'] or ZERO

            available = budget_amount - committed - actual

            # Variance percentage (how much of budget is used)
            if budget_amount and budget_amount != ZERO:
                utilization = ((actual + committed) / budget_amount) * 100
            else:
                utilization = Decimal('0')

            # RAG status
            if utilization > 95:
                rag_status = 'RED'
            elif utilization > 80:
                rag_status = 'AMBER'
            else:
                rag_status = 'GREEN'

            results.append({
                'budget_id': budget.id,
                'account_code': budget.account.code,
                'account_name': budget.account.name,
                'cost_center': budget.cost_center.name if budget.cost_center else None,
                'department': budget.department.name if budget.department else None,
                'budget_amount': budget_amount,
                'committed': committed,
                'actual': actual,
                'available': available,
                'variance_pct': round(utilization, 2),
                'rag_status': rag_status,
            })

        # Summary totals
        total_budget = sum(r['budget_amount'] for r in results)
        total_committed = sum(r['committed'] for r in results)
        total_actual = sum(r['actual'] for r in results)
        total_available = sum(r['available'] for r in results)

        return {
            'fiscal_year_id': fiscal_year_id,
            'cost_center_id': cost_center_id,
            'items': results,
            'summary': {
                'total_budget': total_budget,
                'total_committed': total_committed,
                'total_actual': total_actual,
                'total_available': total_available,
            },
        }

    @staticmethod
    def year_end_close(fiscal_year_id):
        """
        Perform year-end close:
        1. Validate all periods are closed
        2. Calculate net income (Revenue - Expenses)
        3. Create closing JournalEntry (zero out revenue/expense to Retained Earnings)
        4. Create opening balance JournalEntry for next year
        5. Mark fiscal_year.is_closed = True
        """
        from .models import (
            FiscalYear, FiscalPeriod, JournalEntry, JournalLine, Account
        )
        from finance.tasks import _generate_entry_number

        fiscal_year = FiscalYear.all_objects.get(pk=fiscal_year_id)
        tenant = fiscal_year.tenant

        if fiscal_year.is_closed:
            raise ValueError(f"Fiscal year {fiscal_year.name} is already closed.")

        # 1. Validate all periods are closed
        open_periods = FiscalPeriod.all_objects.filter(
            fiscal_year=fiscal_year, is_closed=False
        )
        if open_periods.exists():
            period_names = ', '.join(p.name for p in open_periods[:5])
            raise ValueError(f"Cannot close year: open periods remain: {period_names}")

        # 2. Calculate net income (Revenue - Expenses) for the fiscal year
        income_data = JournalLine.objects.filter(
            journal_entry__status='POSTED',
            journal_entry__fiscal_period__fiscal_year=fiscal_year,
        ).filter(
            Q(account__account_type='REVENUE') | Q(account__account_type='EXPENSE')
        ).values('account__account_type').annotate(
            total_debit=Sum('debit_amount'),
            total_credit=Sum('credit_amount'),
        )

        revenue_total = ZERO
        expense_total = ZERO
        for row in income_data:
            debit = row['total_debit'] or ZERO
            credit = row['total_credit'] or ZERO
            if row['account__account_type'] == 'REVENUE':
                revenue_total += (credit - debit)
            elif row['account__account_type'] == 'EXPENSE':
                expense_total += (debit - credit)

        net_income = revenue_total - expense_total

        # Find Retained Earnings account
        retained_earnings = Account.all_objects.filter(
            code__in=['3100', '3200'], account_type='EQUITY', is_active=True
        )
        if tenant:
            retained_earnings = retained_earnings.filter(tenant=tenant)
        retained_earnings = retained_earnings.first()

        if not retained_earnings:
            raise ValueError("Retained Earnings account (3100 or 3200) not found.")

        # 3. Create closing journal entry
        # Get the last period of the fiscal year
        last_period = FiscalPeriod.all_objects.filter(
            fiscal_year=fiscal_year
        ).order_by('-period_number').first()

        if not last_period:
            raise ValueError("No fiscal periods found for this year.")

        # Temporarily reopen last period for closing entry
        last_period.is_closed = False
        last_period.save(update_fields=['is_closed'])

        with transaction.atomic():
            # Get all revenue and expense account balances
            account_balances = JournalLine.objects.filter(
                journal_entry__status='POSTED',
                journal_entry__fiscal_period__fiscal_year=fiscal_year,
            ).filter(
                Q(account__account_type='REVENUE') | Q(account__account_type='EXPENSE')
            ).values(
                'account__id', 'account__code', 'account__name', 'account__account_type'
            ).annotate(
                total_debit=Sum('debit_amount'),
                total_credit=Sum('credit_amount'),
            )

            entry_number = _generate_entry_number('JV-CLS', tenant=tenant)
            closing_entry = JournalEntry(
                tenant=tenant,
                entry_number=entry_number,
                journal_date=fiscal_year.end_date,
                fiscal_period=last_period,
                description=f"Year-end closing entry - {fiscal_year.name}",
                source='YEAR_END_CLOSE',
                source_reference=fiscal_year.name,
                status=JournalEntry.EntryStatus.POSTED,
                posted_at=timezone.now(),
            )
            closing_entry.save()

            closing_lines = []
            total_debit = ZERO
            total_credit = ZERO

            for bal in account_balances:
                debit = bal['total_debit'] or ZERO
                credit = bal['total_credit'] or ZERO
                account_id = bal['account__id']

                if bal['account__account_type'] == 'REVENUE':
                    # Revenue accounts have credit balances — debit to close
                    balance = credit - debit
                    if balance > ZERO:
                        closing_lines.append(JournalLine(
                            tenant=tenant, journal_entry=closing_entry,
                            account_id=account_id,
                            description=f"Close {bal['account__code']}",
                            debit_amount=balance, credit_amount=ZERO,
                        ))
                        total_debit += balance
                elif bal['account__account_type'] == 'EXPENSE':
                    # Expense accounts have debit balances — credit to close
                    balance = debit - credit
                    if balance > ZERO:
                        closing_lines.append(JournalLine(
                            tenant=tenant, journal_entry=closing_entry,
                            account_id=account_id,
                            description=f"Close {bal['account__code']}",
                            debit_amount=ZERO, credit_amount=balance,
                        ))
                        total_credit += balance

            # Credit (or debit) Retained Earnings for net income
            if net_income >= ZERO:
                closing_lines.append(JournalLine(
                    tenant=tenant, journal_entry=closing_entry,
                    account=retained_earnings,
                    description='Net income to Retained Earnings',
                    debit_amount=ZERO, credit_amount=net_income,
                ))
                total_credit += net_income
            else:
                closing_lines.append(JournalLine(
                    tenant=tenant, journal_entry=closing_entry,
                    account=retained_earnings,
                    description='Net loss to Retained Earnings',
                    debit_amount=abs(net_income), credit_amount=ZERO,
                ))
                total_debit += abs(net_income)

            JournalLine.objects.bulk_create(closing_lines)
            closing_entry.total_debit = total_debit
            closing_entry.total_credit = total_credit
            closing_entry.save(update_fields=['total_debit', 'total_credit'])

            # Re-close last period and close the fiscal year
            last_period.is_closed = True
            last_period.save(update_fields=['is_closed'])

            fiscal_year.is_closed = True
            fiscal_year.save(update_fields=['is_closed', 'updated_at'])

        return {
            'status': 'success',
            'fiscal_year': fiscal_year.name,
            'net_income': str(net_income),
            'revenue': str(revenue_total),
            'expenses': str(expense_total),
            'closing_entry': entry_number,
        }
