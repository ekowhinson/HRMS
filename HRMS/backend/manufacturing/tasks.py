"""Celery tasks for manufacturing module."""

import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('hrms')


@shared_task(bind=True, queue='default', max_retries=2, default_retry_delay=60)
def check_overdue_work_orders(self):
    """Find work orders past their planned end date and log warnings."""
    from .models import WorkOrder

    today = timezone.now().date()
    overdue = WorkOrder.objects.filter(
        status__in=[WorkOrder.Status.RELEASED, WorkOrder.Status.IN_PROGRESS],
        planned_end__lt=today,
    )

    overdue_list = []
    for wo in overdue:
        days = (today - wo.planned_end).days
        logger.warning(
            f"Overdue work order: {wo.work_order_number} — {days} days late"
        )
        overdue_list.append({
            'work_order': wo.work_order_number,
            'product': str(wo.product),
            'days_overdue': days,
        })

    return {'status': 'success', 'overdue_count': len(overdue_list), 'work_orders': overdue_list}


@shared_task(bind=True, queue='finance', max_retries=2, default_retry_delay=60)
def calculate_manufacturing_variance(self, work_order_id):
    """Compare planned vs actual costs and report variance."""
    from .models import WorkOrder
    from .services import calculate_production_cost

    wo = WorkOrder.all_objects.get(pk=work_order_id)
    cost_data = calculate_production_cost(str(wo.pk))

    from decimal import Decimal
    actual = Decimal(cost_data['total_cost'])
    planned = wo.estimated_cost or Decimal('0.00')
    variance = actual - planned

    logger.info(
        f"Manufacturing variance for {wo.work_order_number}: "
        f"planned={planned}, actual={actual}, variance={variance}"
    )

    return {
        'status': 'success',
        'work_order': wo.work_order_number,
        'planned_cost': str(planned),
        'actual_cost': str(actual),
        'variance': str(variance),
    }
