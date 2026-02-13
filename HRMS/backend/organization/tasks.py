"""
Celery tasks for organization setup.
"""

import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, queue='default', max_retries=0)
def setup_organization_task(self, org_id, modules=None, year=None):
    """
    Background task to set up an organization with statutory and sample data.

    Args:
        org_id: Organization UUID (string)
        modules: List of module names to seed (default: all)
        year: Year for payroll calendar (default: current year)
    """
    from organization.models import Organization
    from organization.setup import setup_organization

    try:
        org = Organization.objects.get(id=org_id)
    except Organization.DoesNotExist:
        logger.error(f'Organization {org_id} not found')
        return {'status': 'error', 'message': f'Organization {org_id} not found'}

    logger.info(f'Starting setup for organization: {org.name} ({org.code})')

    try:
        result = setup_organization(org=org, modules=modules, year=year)
        logger.info(
            f'Setup completed for {org.code}: '
            f'created={result["total_created"]}, updated={result["total_updated"]}'
        )
        return result
    except Exception as e:
        logger.error(f'Setup failed for {org.code}: {e}')
        return {'status': 'error', 'message': str(e)}
