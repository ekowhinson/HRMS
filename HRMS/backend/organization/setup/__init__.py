"""
Organization setup orchestrator.
Seeds statutory and sample data for new organizations.
"""

import logging
from django.db import transaction

from core.middleware import set_current_tenant, get_current_tenant

logger = logging.getLogger(__name__)


def setup_organization(org, modules=None, year=None, stdout=None, style=None):
    """
    Run all seeders for an organization within a transaction.

    Args:
        org: Organization instance
        modules: List of module names to seed (default: all)
        year: Year for payroll calendar (default: current year)
        stdout: Management command stdout for output
        style: Management command style for output formatting

    Returns:
        dict with aggregate stats per module
    """
    from .roles_setup import RolesSeeder
    from .organization_setup import OrganizationStructureSeeder
    from .payroll_setup import PayrollSeeder
    from .leave_setup import LeaveSeeder
    from .benefits_setup import BenefitsSeeder
    from .performance_setup import PerformanceSeeder
    from .discipline_setup import DisciplineSeeder
    from .workflow_setup import WorkflowSeeder
    from .recruitment_setup import RecruitmentSeeder

    SEEDERS = [
        RolesSeeder,
        OrganizationStructureSeeder,
        PayrollSeeder,
        LeaveSeeder,
        BenefitsSeeder,
        PerformanceSeeder,
        DisciplineSeeder,
        WorkflowSeeder,
        RecruitmentSeeder,
    ]

    if year is None:
        from django.utils import timezone
        year = timezone.now().year

    results = {}
    total_created = 0
    total_updated = 0

    prev_tenant = get_current_tenant()
    set_current_tenant(org)

    try:
        with transaction.atomic():
            for seeder_class in SEEDERS:
                seeder = seeder_class(org, year=year, stdout=stdout, style=style)

                # Skip if not in requested modules
                if modules and seeder.module_name not in modules:
                    continue

                if stdout and style:
                    stdout.write(style.SUCCESS(
                        f'\n=== {seeder.module_name.upper()} ==='
                    ))

                try:
                    stats = seeder.seed()
                    results[seeder.module_name] = stats
                    total_created += stats.get('created', 0)
                    total_updated += stats.get('updated', 0)

                    if stdout and style:
                        stdout.write(style.SUCCESS(
                            f'  Created: {stats["created"]}, '
                            f'Updated: {stats["updated"]}, '
                            f'Skipped: {stats["skipped"]}'
                        ))
                except Exception as e:
                    logger.error(f'Error seeding {seeder.module_name}: {e}')
                    if stdout and style:
                        stdout.write(style.ERROR(
                            f'  ERROR: {e}'
                        ))
                    raise

            # Mark setup as completed
            org.setup_completed = True
            org.save(update_fields=['setup_completed'])

    finally:
        set_current_tenant(prev_tenant)

    return {
        'status': 'completed',
        'setup_completed': True,
        'results': results,
        'total_created': total_created,
        'total_updated': total_updated,
    }
