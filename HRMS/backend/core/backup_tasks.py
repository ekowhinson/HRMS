"""Celery tasks for tenant backup and restore."""

import logging
from celery import shared_task
from django.utils import timezone

logger = logging.getLogger('hrms')


@shared_task(bind=True, queue='default', soft_time_limit=3600, time_limit=7200)
def execute_backup_task(self, backup_id):
    """Async backup execution with progress tracking."""
    from .backup_service import TenantBackupService
    from .backup_models import TenantBackup

    logger.info(f"Starting backup task: {backup_id}")
    try:
        service = TenantBackupService()
        service.execute_backup(backup_id)
    except Exception as e:
        logger.error(f"Backup task failed: {backup_id} - {e}")
        try:
            backup = TenantBackup.objects.get(id=backup_id)
            backup.status = TenantBackup.Status.FAILED
            backup.error_message = str(e)
            backup.save(update_fields=['status', 'error_message'])
        except TenantBackup.DoesNotExist:
            pass
        raise


@shared_task(bind=True, queue='default', soft_time_limit=7200, time_limit=14400)
def execute_restore_task(self, restore_id):
    """Async restore execution with progress tracking and transaction safety."""
    from .backup_service import TenantBackupService
    from .backup_models import TenantRestore

    logger.info(f"Starting restore task: {restore_id}")
    try:
        service = TenantBackupService()
        service.execute_restore(restore_id)
    except Exception as e:
        logger.error(f"Restore task failed: {restore_id} - {e}")
        try:
            restore = TenantRestore.objects.get(id=restore_id)
            restore.status = TenantRestore.Status.FAILED
            restore.error_log = str(e)
            restore.save(update_fields=['status', 'error_log'])
        except TenantRestore.DoesNotExist:
            pass
        raise


@shared_task(queue='default')
def cleanup_expired_backups_task():
    """Celery Beat: clean up expired backups."""
    from .backup_service import TenantBackupService

    service = TenantBackupService()
    count = service.cleanup_expired_backups()
    logger.info(f"Cleaned up {count} expired backups")
    return {'cleaned_up': count}


@shared_task(queue='default')
def check_backup_schedules_task():
    """Celery Beat: check which scheduled backups are due and trigger them."""
    from .backup_models import BackupSchedule
    from .backup_service import TenantBackupService

    now = timezone.now()
    due_schedules = BackupSchedule.objects.filter(
        is_active=True,
        next_run_at__lte=now,
    ).select_related('organization')

    triggered = 0
    for schedule in due_schedules:
        try:
            service = TenantBackupService()
            service.create_backup(
                organization=schedule.organization,
                backup_type=schedule.backup_type,
                modules=schedule.modules_included,
                name=f"Scheduled: {schedule.name} ({now.strftime('%Y-%m-%d')})",
                created_by=None,
            )
            schedule.last_run_at = now
            schedule.last_status = 'COMPLETED'
            schedule.consecutive_failures = 0
            schedule.next_run_at = _calculate_next_run(schedule)
            schedule.save()
            triggered += 1
        except Exception as e:
            schedule.last_status = 'FAILED'
            schedule.consecutive_failures += 1
            schedule.next_run_at = _calculate_next_run(schedule)
            schedule.save()
            logger.error(f"Scheduled backup failed for {schedule.name}: {e}")

    logger.info(f"Triggered {triggered} scheduled backups")
    return {'triggered': triggered}


def _calculate_next_run(schedule):
    """Calculate the next run time based on schedule config."""
    from datetime import timedelta
    now = timezone.now()

    if schedule.schedule_type == 'DAILY':
        return now + timedelta(days=1)
    elif schedule.schedule_type == 'WEEKLY':
        return now + timedelta(weeks=1)
    elif schedule.schedule_type == 'MONTHLY':
        return now + timedelta(days=30)
    return now + timedelta(days=1)
