"""Celery tasks for procurement module."""

import logging
from datetime import timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('hrms')


@shared_task(bind=True, queue='procurement')
def check_contract_renewals(self):
    """Check for contracts nearing expiry and flag for renewal.

    Looks for active contracts that will expire within the next 30 days
    and creates notifications for the relevant users.
    """
    from procurement.models import Contract

    threshold_date = timezone.now().date() + timedelta(days=30)
    expiring_contracts = Contract.objects.filter(
        status=Contract.Status.ACTIVE,
        end_date__lte=threshold_date,
        end_date__gte=timezone.now().date(),
    )

    results = []
    for contract in expiring_contracts:
        days_remaining = (contract.end_date - timezone.now().date()).days
        logger.info(
            f"Contract {contract.contract_number} ({contract.title}) "
            f"expires in {days_remaining} days. Auto-renew: {contract.auto_renew}"
        )
        results.append({
            'contract_number': contract.contract_number,
            'title': contract.title,
            'end_date': str(contract.end_date),
            'days_remaining': days_remaining,
            'auto_renew': contract.auto_renew,
            'vendor': str(contract.vendor),
        })

    logger.info(f"Found {len(results)} contracts nearing expiry.")
    return {
        'status': 'success',
        'expiring_count': len(results),
        'contracts': results,
    }


@shared_task(bind=True, queue='procurement')
def check_overdue_deliveries(self):
    """Check for purchase orders past their expected delivery date.

    Looks for approved/sent POs where the delivery date has passed
    and the order has not been fully received.
    """
    from procurement.models import PurchaseOrder

    today = timezone.now().date()
    overdue_pos = PurchaseOrder.objects.filter(
        status__in=[
            PurchaseOrder.Status.APPROVED,
            PurchaseOrder.Status.SENT,
            PurchaseOrder.Status.PARTIAL,
        ],
        delivery_date__lt=today,
    )

    results = []
    for po in overdue_pos:
        days_overdue = (today - po.delivery_date).days
        logger.warning(
            f"PO {po.po_number} is {days_overdue} days overdue. "
            f"Vendor: {po.vendor}. Status: {po.status}"
        )
        results.append({
            'po_number': po.po_number,
            'vendor': str(po.vendor),
            'delivery_date': str(po.delivery_date),
            'days_overdue': days_overdue,
            'status': po.status,
            'total_amount': str(po.total_amount),
        })

    logger.info(f"Found {len(results)} overdue purchase orders.")
    return {
        'status': 'success',
        'overdue_count': len(results),
        'purchase_orders': results,
    }
