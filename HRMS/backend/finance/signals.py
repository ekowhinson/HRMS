"""
Cross-module integration signals for HRMS ERP.

Wires up automated workflows between finance, procurement, inventory,
and employee modules using Django's post_save signal.
"""

import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum, Q
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

logger = logging.getLogger('hrms')


# ---------------------------------------------------------------------------
# 1. GRN -> Inventory: auto-create StockEntry records on acceptance
# ---------------------------------------------------------------------------

@receiver(post_save, sender='procurement.GoodsReceiptNote')
def grn_accepted_create_stock_entries(sender, instance, **kwargs):
    """
    When a GoodsReceiptNote status changes to ACCEPTED, create a StockEntry
    (type=RECEIPT) for every GRNItem whose accepted_qty > 0.
    Also update (or create) the StockLedger balance for each item/warehouse.
    """
    from procurement.models import GoodsReceiptNote

    if instance.status != GoodsReceiptNote.Status.ACCEPTED:
        return

    from inventory.models import StockEntry, StockLedger

    grn_items = instance.items.select_related('po_item', 'po_item__item').all()
    warehouse = instance.warehouse

    if not warehouse:
        logger.warning(
            "GRN %s accepted but has no warehouse assigned; "
            "skipping stock entry creation.",
            instance.grn_number,
        )
        return

    with transaction.atomic():
        for grn_item in grn_items:
            if grn_item.accepted_qty <= 0:
                continue

            po_item = grn_item.po_item
            item = po_item.item

            if item is None:
                logger.warning(
                    "GRN item %s has no linked inventory item; skipping.",
                    grn_item.id,
                )
                continue

            # Avoid duplicate entries for the same GRN item
            existing = StockEntry.objects.filter(
                source='GRN',
                source_reference=instance.grn_number,
                item=item,
                warehouse=warehouse,
            ).exists()

            if existing:
                logger.info(
                    "StockEntry already exists for GRN %s / item %s; skipping.",
                    instance.grn_number,
                    item.code,
                )
                continue

            unit_cost = po_item.unit_price
            total_cost = grn_item.accepted_qty * unit_cost

            StockEntry.objects.create(
                entry_type=StockEntry.EntryType.RECEIPT,
                entry_date=instance.receipt_date,
                item=item,
                warehouse=warehouse,
                quantity=grn_item.accepted_qty,
                unit_cost=unit_cost,
                total_cost=total_cost,
                source='GRN',
                source_reference=instance.grn_number,
                reference_number=instance.purchase_order.po_number,
                notes=f"Auto-created from GRN {instance.grn_number}",
            )

            # Update or create the StockLedger running balance
            ledger, _created = StockLedger.objects.get_or_create(
                item=item,
                warehouse=warehouse,
                defaults={
                    'balance_qty': Decimal('0'),
                    'valuation_amount': Decimal('0'),
                },
            )
            ledger.balance_qty += grn_item.accepted_qty
            ledger.valuation_amount += total_cost
            ledger.last_movement_date = instance.receipt_date
            ledger.save(update_fields=[
                'balance_qty', 'valuation_amount', 'last_movement_date',
            ])

            logger.info(
                "Created StockEntry RECEIPT for item %s qty %s from GRN %s",
                item.code,
                grn_item.accepted_qty,
                instance.grn_number,
            )


# ---------------------------------------------------------------------------
# 2. Budget enforcement helper
# ---------------------------------------------------------------------------

def check_budget_availability(account, cost_center, fiscal_year, amount):
    """
    Check whether sufficient budget is available for a proposed expenditure.

    Returns:
        (bool, dict): Tuple of (is_available, details).
    """
    from finance.models import Budget, BudgetCommitment, JournalLine

    budget_qs = Budget.objects.filter(
        account=account,
        fiscal_year=fiscal_year,
    )
    if cost_center is not None:
        budget_qs = budget_qs.filter(cost_center=cost_center)
    else:
        budget_qs = budget_qs.filter(cost_center__isnull=True)

    budget = budget_qs.first()

    if budget is None:
        return False, {
            'error': 'No budget found for the given account, cost center, and fiscal year.',
            'account': str(account),
            'cost_center': str(cost_center) if cost_center else None,
            'fiscal_year': str(fiscal_year),
            'requested': amount,
        }

    budget_amount = budget.revised_amount or budget.original_amount

    # Sum of COMMITTED encumbrances
    committed_agg = BudgetCommitment.objects.filter(
        budget=budget,
        status=BudgetCommitment.CommitmentStatus.COMMITTED,
    ).aggregate(total=Sum('amount'))
    committed = committed_agg['total'] or Decimal('0')

    # Actual spend from posted journal lines
    journal_filter = Q(
        account=account,
        journal_entry__status='POSTED',
        journal_entry__journal_date__gte=fiscal_year.start_date,
        journal_entry__journal_date__lte=fiscal_year.end_date,
    )
    if cost_center is not None:
        journal_filter &= Q(cost_center=cost_center)

    actuals_agg = JournalLine.objects.filter(journal_filter).aggregate(
        total_debit=Sum('debit_amount'),
        total_credit=Sum('credit_amount'),
    )

    if account.account_type == 'EXPENSE':
        actual = (actuals_agg['total_debit'] or Decimal('0')) - (
            actuals_agg['total_credit'] or Decimal('0')
        )
    else:
        actual = (actuals_agg['total_credit'] or Decimal('0')) - (
            actuals_agg['total_debit'] or Decimal('0')
        )

    available = budget_amount - committed - actual

    details = {
        'budget_id': str(budget.id),
        'budget_amount': budget_amount,
        'committed': committed,
        'actual': actual,
        'available': available,
        'requested': amount,
    }

    if available >= amount:
        details['shortfall'] = Decimal('0')
        return True, details
    else:
        details['shortfall'] = amount - available
        return False, details


# ---------------------------------------------------------------------------
# 3. Employee termination -> Asset recovery flag
# ---------------------------------------------------------------------------

@receiver(post_save, sender='employees.Employee')
def employee_exit_flag_asset_recovery(sender, instance, **kwargs):
    """
    When an Employee's status changes to TERMINATED or RESIGNED, query
    inventory.Asset for assets where custodian=employee and flag them
    for recovery.
    """
    from employees.models import Employee

    exit_statuses = {
        Employee.EmploymentStatus.TERMINATED,
        Employee.EmploymentStatus.RESIGNED,
    }

    if instance.status not in exit_statuses:
        return

    from inventory.models import Asset

    active_assets = Asset.objects.filter(
        custodian=instance,
        status=Asset.Status.ACTIVE,
    )

    if not active_assets.exists():
        return

    asset_list = list(active_assets.values_list('asset_number', 'name'))
    asset_count = len(asset_list)

    logger.warning(
        "ASSET RECOVERY REQUIRED: Employee %s status changed to %s. "
        "%d active asset(s) assigned: %s",
        instance.employee_number if hasattr(instance, 'employee_number') else instance.id,
        instance.status,
        asset_count,
        ', '.join(f"{num} ({name})" for num, name in asset_list),
    )


# ---------------------------------------------------------------------------
# 4. PO approval -> Budget commitment
# ---------------------------------------------------------------------------

@receiver(post_save, sender='procurement.PurchaseOrder')
def po_approved_create_budget_commitments(sender, instance, **kwargs):
    """
    When a PurchaseOrder status changes to APPROVED, create BudgetCommitment
    records against the relevant budgets for each PO line item.
    """
    from procurement.models import PurchaseOrder

    if instance.status != PurchaseOrder.Status.APPROVED:
        return

    from finance.models import Budget, BudgetCommitment

    po_items = instance.items.select_related(
        'requisition_item', 'item',
    ).all()

    with transaction.atomic():
        for po_item in po_items:
            line_total = po_item.total or (po_item.quantity * po_item.unit_price)

            if line_total <= 0:
                continue

            # Determine the budget to commit against
            budget = None

            # First: try the budget linked via the requisition item
            if hasattr(po_item, 'requisition_item') and po_item.requisition_item:
                if hasattr(po_item.requisition_item, 'budget_id') and po_item.requisition_item.budget_id:
                    budget = po_item.requisition_item.budget

            # Fallback: look up budget by item category GL account
            if budget is None and po_item.item and po_item.item.category:
                gl_account = getattr(po_item.item.category, 'gl_account', None)
                if gl_account:
                    cost_center = (
                        instance.requisition.cost_center
                        if instance.requisition
                        else None
                    )
                    budget_qs = Budget.objects.filter(
                        account=gl_account,
                        status__in=['DRAFT', 'APPROVED', 'REVISED'],
                    )
                    if cost_center:
                        budget_qs = budget_qs.filter(cost_center=cost_center)
                    budget = budget_qs.order_by('-fiscal_year__start_date').first()

            if budget is None:
                logger.warning(
                    "No budget found for PO %s line item '%s'; "
                    "skipping commitment creation.",
                    instance.po_number,
                    po_item.description,
                )
                continue

            # Avoid duplicate commitments
            commitment_ref = f"{instance.po_number}:{po_item.id}"
            existing = BudgetCommitment.objects.filter(
                budget=budget,
                source='PO',
                source_reference=commitment_ref,
            ).exists()

            if existing:
                continue

            BudgetCommitment.objects.create(
                budget=budget,
                commitment_date=instance.order_date or timezone.now().date(),
                amount=line_total,
                source='PO',
                source_reference=commitment_ref,
                status=BudgetCommitment.CommitmentStatus.COMMITTED,
            )

            logger.info(
                "Created BudgetCommitment of %s for PO %s item '%s' "
                "against budget %s",
                line_total,
                instance.po_number,
                po_item.description,
                budget.id,
            )
