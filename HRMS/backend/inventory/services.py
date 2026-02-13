"""Business logic services for inventory and asset management."""

import logging
from datetime import timedelta, date as dt_date
from decimal import Decimal

from django.apps import apps
from django.db import transaction
from django.utils import timezone

from .models import (
    StockEntry, StockLedger, Asset, AssetTransfer,
    AssetDisposal, CycleCount, CycleCountItem, MaintenanceSchedule,
)

logger = logging.getLogger('hrms')


# ========================================================================
#  Stock Services
# ========================================================================

def approve_stock_entry(stock_entry):
    """Approve a stock entry and update stock ledger accordingly.

    Handles RECEIPT, ISSUE, TRANSFER, RETURN, and ADJUSTMENT entry types.
    """
    with transaction.atomic():
        ledger, _ = StockLedger.objects.get_or_create(
            item=stock_entry.item,
            warehouse=stock_entry.warehouse,
            defaults={'balance_qty': 0, 'valuation_amount': 0},
        )

        if stock_entry.entry_type in (StockEntry.EntryType.RECEIPT, StockEntry.EntryType.RETURN):
            ledger.balance_qty += stock_entry.quantity
            ledger.valuation_amount += stock_entry.total_cost

        elif stock_entry.entry_type == StockEntry.EntryType.ISSUE:
            ledger.balance_qty -= stock_entry.quantity
            ledger.valuation_amount -= stock_entry.total_cost

        elif stock_entry.entry_type == StockEntry.EntryType.TRANSFER:
            ledger.balance_qty -= stock_entry.quantity
            ledger.valuation_amount -= stock_entry.total_cost

            if stock_entry.to_warehouse:
                to_ledger, _ = StockLedger.objects.get_or_create(
                    item=stock_entry.item,
                    warehouse=stock_entry.to_warehouse,
                    defaults={'balance_qty': 0, 'valuation_amount': 0},
                )
                to_ledger.balance_qty += stock_entry.quantity
                to_ledger.valuation_amount += stock_entry.total_cost
                to_ledger.last_movement_date = stock_entry.entry_date
                to_ledger.save()

        elif stock_entry.entry_type == StockEntry.EntryType.ADJUSTMENT:
            ledger.balance_qty += stock_entry.quantity
            ledger.valuation_amount += stock_entry.total_cost

        ledger.last_movement_date = stock_entry.entry_date
        ledger.save()

    return stock_entry


# ========================================================================
#  Asset Transfer Services
# ========================================================================

def approve_asset_transfer(transfer, user):
    """Approve a transfer and update the asset's location/custodian/department."""
    if transfer.status != AssetTransfer.Status.PENDING:
        raise ValueError("Only pending transfers can be approved")

    with transaction.atomic():
        transfer.status = AssetTransfer.Status.COMPLETED
        transfer.approved_by = user
        transfer.approved_at = timezone.now()
        transfer.save()

        asset = transfer.asset
        if transfer.to_location:
            asset.location = transfer.to_location
        if transfer.to_custodian:
            asset.custodian = transfer.to_custodian
        if transfer.to_department:
            asset.department = transfer.to_department
        asset.save()

    return transfer


def reject_asset_transfer(transfer, reason, user):
    """Reject a pending asset transfer."""
    if transfer.status != AssetTransfer.Status.PENDING:
        raise ValueError("Only pending transfers can be rejected")

    transfer.status = AssetTransfer.Status.REJECTED
    transfer.approved_by = user
    transfer.approved_at = timezone.now()
    transfer.reason = f"{transfer.reason}\nRejected: {reason}" if transfer.reason else f"Rejected: {reason}"
    transfer.save()
    return transfer


# ========================================================================
#  Asset Disposal Services
# ========================================================================

def submit_asset_disposal(disposal):
    """Submit a draft disposal for approval."""
    if disposal.status != AssetDisposal.Status.DRAFT:
        raise ValueError("Only draft disposals can be submitted")
    disposal.status = AssetDisposal.Status.PENDING
    disposal.save(update_fields=['status', 'updated_at'])
    return disposal


def approve_asset_disposal(disposal, user):
    """Approve an asset disposal, update asset status, and trigger GL posting."""
    if disposal.status != AssetDisposal.Status.PENDING:
        raise ValueError("Only pending disposals can be approved")

    with transaction.atomic():
        disposal.status = AssetDisposal.Status.APPROVED
        disposal.approved_by = user
        disposal.save(update_fields=['status', 'approved_by', 'updated_at'])

        asset = disposal.asset
        asset.status = Asset.Status.DISPOSED
        asset.disposal_date = disposal.disposal_date
        asset.disposal_value = disposal.proceeds
        asset.save(update_fields=['status', 'disposal_date', 'disposal_value', 'updated_at'])

        # Trigger GL posting asynchronously
        try:
            app = apps.get_app_config('finance')
            task_module = __import__(f'{app.name}.tasks', fromlist=['post_asset_disposal_to_gl'])
            task_module.post_asset_disposal_to_gl.delay(str(disposal.pk))
        except (LookupError, ImportError, AttributeError) as e:
            logger.warning(f"Could not dispatch GL posting for disposal {disposal.pk}: {e}")

    return disposal


def reject_asset_disposal(disposal, reason):
    """Reject a pending asset disposal."""
    if disposal.status != AssetDisposal.Status.PENDING:
        raise ValueError("Only pending disposals can be rejected")
    disposal.status = AssetDisposal.Status.REJECTED
    disposal.reason = f"{disposal.reason}\nRejected: {reason}" if disposal.reason else f"Rejected: {reason}"
    disposal.save(update_fields=['status', 'reason', 'updated_at'])
    return disposal


# ========================================================================
#  Cycle Count Services
# ========================================================================

def start_cycle_count(cycle_count):
    """Start a planned cycle count and populate system quantities from ledger."""
    if cycle_count.status != CycleCount.Status.PLANNED:
        raise ValueError("Only planned cycle counts can be started")

    with transaction.atomic():
        cycle_count.status = CycleCount.Status.IN_PROGRESS
        cycle_count.save(update_fields=['status', 'updated_at'])

        ledger_entries = StockLedger.objects.filter(
            warehouse=cycle_count.warehouse
        ).select_related('item')

        for ledger in ledger_entries:
            CycleCountItem.objects.get_or_create(
                cycle_count=cycle_count,
                item=ledger.item,
                defaults={'system_qty': ledger.balance_qty, 'counted_qty': 0},
            )

    return cycle_count


def complete_cycle_count(cycle_count):
    """Complete a cycle count (mark as ready for approval)."""
    if cycle_count.status != CycleCount.Status.IN_PROGRESS:
        raise ValueError("Only in-progress cycle counts can be completed")
    cycle_count.status = CycleCount.Status.COMPLETED
    cycle_count.save(update_fields=['status', 'updated_at'])
    return cycle_count


def approve_cycle_count(cycle_count, user):
    """Approve a cycle count and create stock adjustment entries for variances."""
    if cycle_count.status != CycleCount.Status.COMPLETED:
        raise ValueError("Only completed cycle counts can be approved")

    with transaction.atomic():
        cycle_count.status = CycleCount.Status.APPROVED
        cycle_count.approved_by = user
        cycle_count.save(update_fields=['status', 'approved_by', 'updated_at'])

        for count_item in cycle_count.items.filter(adjustment_entry__isnull=True).exclude(variance=0):
            adjustment = StockEntry.objects.create(
                entry_type=StockEntry.EntryType.ADJUSTMENT,
                entry_date=cycle_count.count_date,
                item=count_item.item,
                warehouse=cycle_count.warehouse,
                quantity=count_item.variance,
                unit_cost=count_item.item.standard_cost,
                source='CYCLE_COUNT',
                source_reference=str(cycle_count.pk),
                notes=f"Cycle count adjustment: system={count_item.system_qty}, counted={count_item.counted_qty}",
            )
            count_item.adjustment_entry = adjustment
            count_item.save(update_fields=['adjustment_entry', 'updated_at'])

            ledger, _ = StockLedger.objects.get_or_create(
                item=count_item.item,
                warehouse=cycle_count.warehouse,
                defaults={'balance_qty': 0, 'valuation_amount': 0},
            )
            ledger.balance_qty += count_item.variance
            ledger.valuation_amount += count_item.variance * count_item.item.standard_cost
            ledger.last_movement_date = cycle_count.count_date
            ledger.save()

    return cycle_count


# ========================================================================
#  Maintenance Services
# ========================================================================

def complete_maintenance(schedule, completed_date=None):
    """Mark maintenance as completed and calculate next due date."""
    if completed_date is None:
        completed_date = timezone.now().date()
    if isinstance(completed_date, str):
        completed_date = dt_date.fromisoformat(completed_date)

    schedule.last_completed = completed_date

    frequency_days = {
        MaintenanceSchedule.Frequency.DAILY: 1,
        MaintenanceSchedule.Frequency.WEEKLY: 7,
        MaintenanceSchedule.Frequency.MONTHLY: 30,
        MaintenanceSchedule.Frequency.QUARTERLY: 90,
        MaintenanceSchedule.Frequency.SEMI_ANNUAL: 182,
        MaintenanceSchedule.Frequency.ANNUAL: 365,
    }

    days = frequency_days.get(schedule.frequency, 30)
    schedule.next_due_date = completed_date + timedelta(days=days)
    schedule.save()
    return schedule
