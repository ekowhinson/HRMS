"""Celery tasks for finance module."""

import logging
from celery import shared_task

logger = logging.getLogger('hrms')


@shared_task(bind=True, queue='finance')
def post_payroll_to_gl(self, payroll_run_id, tenant_id=None):
    """Create GL journal entries from a completed payroll run."""
    logger.info(f"Posting payroll run {payroll_run_id} to GL")
    # Implementation will be added when payroll integration is built
    return {'status': 'success', 'payroll_run_id': payroll_run_id}


@shared_task(bind=True, queue='finance')
def calculate_depreciation(self, fiscal_period_id, tenant_id=None):
    """Calculate monthly depreciation for all active assets."""
    logger.info(f"Calculating depreciation for period {fiscal_period_id}")
    # Implementation will be added with inventory/asset module
    return {'status': 'success', 'fiscal_period_id': fiscal_period_id}
