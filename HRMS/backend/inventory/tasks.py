"""
Celery tasks for inventory and asset management.
"""

import logging
from decimal import Decimal
from datetime import date, timedelta

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def calculate_monthly_depreciation(fiscal_period_id):
    """
    Calculate depreciation for all active assets for a given fiscal period.

    Uses the asset's depreciation method to compute the monthly charge,
    creates AssetDepreciation records, and updates the asset's
    accumulated_depreciation and current_value.

    Args:
        fiscal_period_id: UUID of the FiscalPeriod to process.
    """
    from finance.models import FiscalPeriod
    from inventory.models import Asset, AssetDepreciation

    try:
        fiscal_period = FiscalPeriod.objects.get(id=fiscal_period_id)
    except FiscalPeriod.DoesNotExist:
        logger.error("FiscalPeriod %s not found", fiscal_period_id)
        return {'status': 'error', 'message': f'FiscalPeriod {fiscal_period_id} not found'}

    active_assets = Asset.objects.filter(
        status=Asset.Status.ACTIVE
    ).exclude(
        depreciations__fiscal_period=fiscal_period
    )

    processed = 0
    skipped = 0
    errors = []

    for asset in active_assets:
        try:
            depreciable_amount = asset.acquisition_cost - asset.salvage_value
            if depreciable_amount <= 0 or asset.useful_life_months <= 0:
                skipped += 1
                continue

            # Calculate monthly depreciation based on method
            if asset.depreciation_method == Asset.DepreciationMethod.STRAIGHT_LINE:
                monthly_depreciation = depreciable_amount / Decimal(asset.useful_life_months)

            elif asset.depreciation_method == Asset.DepreciationMethod.DECLINING_BALANCE:
                # Double declining balance rate
                annual_rate = Decimal(2) / Decimal(asset.useful_life_months / 12)
                monthly_rate = annual_rate / Decimal(12)
                monthly_depreciation = asset.current_value * monthly_rate

            elif asset.depreciation_method == Asset.DepreciationMethod.SUM_OF_YEARS:
                total_years = asset.useful_life_months / 12
                # Determine remaining years based on accumulated depreciation
                elapsed_months = AssetDepreciation.objects.filter(asset=asset).count()
                remaining_years = max(total_years - (elapsed_months / 12), 0)
                sum_of_years = (total_years * (total_years + 1)) / 2
                if sum_of_years > 0:
                    annual_depreciation = depreciable_amount * Decimal(remaining_years) / Decimal(sum_of_years)
                    monthly_depreciation = annual_depreciation / Decimal(12)
                else:
                    monthly_depreciation = Decimal(0)

            else:
                # Units of production - skip if no usage data
                skipped += 1
                continue

            # Ensure we don't depreciate below salvage value
            max_remaining = asset.current_value - asset.salvage_value
            if max_remaining <= 0:
                skipped += 1
                continue

            monthly_depreciation = min(monthly_depreciation, max_remaining)
            monthly_depreciation = monthly_depreciation.quantize(Decimal('0.01'))

            new_accumulated = asset.accumulated_depreciation + monthly_depreciation
            new_book_value = asset.acquisition_cost - new_accumulated

            # Create depreciation record
            AssetDepreciation.objects.create(
                asset=asset,
                fiscal_period=fiscal_period,
                depreciation_amount=monthly_depreciation,
                accumulated_depreciation=new_accumulated,
                book_value=new_book_value,
            )

            # Update asset
            asset.accumulated_depreciation = new_accumulated
            asset.current_value = new_book_value
            asset.save(update_fields=['accumulated_depreciation', 'current_value', 'updated_at'])

            processed += 1

        except Exception as e:
            error_msg = f"Error processing asset {asset.asset_number}: {str(e)}"
            logger.exception(error_msg)
            errors.append(error_msg)

    result = {
        'status': 'success',
        'fiscal_period': str(fiscal_period),
        'processed': processed,
        'skipped': skipped,
        'errors': len(errors),
        'error_details': errors[:10],  # Limit error details
    }

    logger.info(
        "Monthly depreciation complete for %s: %d processed, %d skipped, %d errors",
        fiscal_period, processed, skipped, len(errors)
    )

    return result


@shared_task
def check_reorder_levels():
    """
    Check stock levels against reorder points and create notifications
    for items that need to be reordered.

    Compares StockLedger balance_qty against Item.reorder_level across
    all warehouses. Sends notifications to warehouse managers.
    """
    from inventory.models import Item, StockLedger
    from django.db.models import Sum

    try:
        # Get all stockable, active items with reorder levels set
        items_to_check = Item.objects.filter(
            is_stockable=True,
            is_active=True,
            reorder_level__gt=0,
        )

        reorder_needed = []

        for item in items_to_check:
            # Get total stock across all warehouses
            total_stock = StockLedger.objects.filter(
                item=item
            ).aggregate(total=Sum('balance_qty'))['total'] or Decimal(0)

            if total_stock <= item.reorder_level:
                reorder_needed.append({
                    'item_code': item.code,
                    'item_name': item.name,
                    'current_stock': float(total_stock),
                    'reorder_level': float(item.reorder_level),
                    'reorder_qty': float(item.reorder_qty),
                    'deficit': float(item.reorder_level - total_stock),
                })

        if reorder_needed:
            # Send notifications to warehouse managers
            from inventory.models import Warehouse
            from core.tasks import send_notification_task

            warehouse_managers = Warehouse.objects.filter(
                is_active=True,
                manager__isnull=False,
            ).select_related('manager__user').values_list('manager__user__id', flat=True).distinct()

            for user_id in warehouse_managers:
                if user_id:
                    send_notification_task.delay(
                        str(user_id),
                        'WARNING',
                        {
                            'title': f'Reorder Alert: {len(reorder_needed)} items below reorder level',
                            'message': f'{len(reorder_needed)} items are at or below their reorder levels and need to be replenished. Items: {", ".join(r["item_code"] for r in reorder_needed[:5])}{"..." if len(reorder_needed) > 5 else ""}',
                            'link': '/inventory/stock-ledger',
                            'extra_data': {'reorder_items': reorder_needed[:20]},
                        }
                    )

        result = {
            'status': 'success',
            'items_checked': items_to_check.count(),
            'reorder_needed': len(reorder_needed),
            'items': reorder_needed[:20],
        }

        logger.info(
            "Reorder level check complete: %d items checked, %d need reorder",
            items_to_check.count(), len(reorder_needed)
        )

        return result

    except Exception as e:
        logger.exception("Reorder level check failed: %s", str(e))
        return {'status': 'error', 'message': str(e)}


@shared_task
def check_maintenance_schedules():
    """
    Check for maintenance schedules that are due within the next 7 days
    or overdue, and send notifications.
    """
    from inventory.models import MaintenanceSchedule
    from core.tasks import send_notification_task

    try:
        today = date.today()
        upcoming_date = today + timedelta(days=7)

        # Find schedules due within 7 days or overdue
        due_schedules = MaintenanceSchedule.objects.filter(
            is_active=True,
            next_due_date__lte=upcoming_date,
        ).select_related('asset', 'asset__custodian__user', 'vendor')

        overdue = []
        upcoming = []

        for schedule in due_schedules:
            schedule_data = {
                'schedule_id': str(schedule.id),
                'asset_number': schedule.asset.asset_number,
                'asset_name': schedule.asset.name,
                'title': schedule.title,
                'next_due_date': schedule.next_due_date.isoformat(),
                'estimated_cost': float(schedule.estimated_cost),
                'vendor_name': schedule.vendor.name if schedule.vendor else None,
            }

            if schedule.next_due_date < today:
                schedule_data['days_overdue'] = (today - schedule.next_due_date).days
                overdue.append(schedule_data)
            else:
                schedule_data['days_until_due'] = (schedule.next_due_date - today).days
                upcoming.append(schedule_data)

            # Notify asset custodian
            if schedule.asset.custodian and hasattr(schedule.asset.custodian, 'user') and schedule.asset.custodian.user:
                notification_type = 'WARNING' if schedule.next_due_date < today else 'TASK'
                prefix = 'OVERDUE' if schedule.next_due_date < today else 'Upcoming'

                send_notification_task.delay(
                    str(schedule.asset.custodian.user.id),
                    notification_type,
                    {
                        'title': f'{prefix} Maintenance: {schedule.asset.asset_number} - {schedule.title}',
                        'message': f'Maintenance "{schedule.title}" for asset {schedule.asset.asset_number} ({schedule.asset.name}) is {"overdue since " + schedule.next_due_date.strftime("%d %b %Y") if schedule.next_due_date < today else "due on " + schedule.next_due_date.strftime("%d %b %Y")}.',
                        'link': '/inventory/maintenance-schedules',
                        'extra_data': schedule_data,
                    }
                )

        result = {
            'status': 'success',
            'total_checked': due_schedules.count(),
            'overdue': len(overdue),
            'upcoming': len(upcoming),
            'overdue_details': overdue[:10],
            'upcoming_details': upcoming[:10],
        }

        logger.info(
            "Maintenance schedule check complete: %d overdue, %d upcoming",
            len(overdue), len(upcoming)
        )

        return result

    except Exception as e:
        logger.exception("Maintenance schedule check failed: %s", str(e))
        return {'status': 'error', 'message': str(e)}
