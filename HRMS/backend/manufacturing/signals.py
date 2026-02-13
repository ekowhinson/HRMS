"""Signals for manufacturing module."""

import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger('hrms')


@receiver(post_save, sender='manufacturing.WorkOrder')
def work_order_completed_receipt_stock(sender, instance, **kwargs):
    """On WorkOrder COMPLETED, ensure production batches have stock entries."""
    if instance.status == 'COMPLETED':
        batches_without_stock = instance.batches.filter(stock_entry__isnull=True)
        if batches_without_stock.exists():
            logger.warning(
                f"Work order {instance.work_order_number} completed with "
                f"{batches_without_stock.count()} batches missing stock entries"
            )
