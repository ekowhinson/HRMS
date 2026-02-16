"""
Celery configuration for HRMS project.

Broker and result backend: Redis (Memorystore in GCP).
Task routing sends work to dedicated queues so heavy report/payroll jobs
don't starve lighter default tasks.
"""

import logging
import os

from celery import Celery
from celery.schedules import crontab
from celery.signals import task_failure, task_prerun, task_postrun, task_retry
from django.conf import settings

logger = logging.getLogger('hrms')

# Set the default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Create Celery app
app = Celery('hrms')

# Load config from Django settings, using CELERY_ namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Celery configuration
app.conf.update(
    # Task settings
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone=settings.TIME_ZONE,
    enable_utc=True,

    # Task execution settings
    task_acks_late=True,  # Acknowledge tasks after completion (better reliability)
    task_reject_on_worker_lost=True,
    task_time_limit=600,  # 10 min hard limit (default)
    task_soft_time_limit=300,  # 5 min soft limit (default)

    # Worker settings
    worker_prefetch_multiplier=1,  # Fetch one task at a time for long tasks
    worker_concurrency=4,  # Number of worker processes

    # Result backend settings
    result_expires=86400,  # Results expire after 24 hours

    # Task routing
    task_routes={
        'reports.tasks.*': {'queue': 'reports'},
        'payroll.tasks.*': {'queue': 'payroll'},
        'finance.tasks.*': {'queue': 'finance'},
        'procurement.tasks.*': {'queue': 'procurement'},
        'assistant.tasks.*': {'queue': 'imports'},
        'core.email.tasks.*': {'queue': 'emails'},
    },

    # Default queue
    task_default_queue='default',

    # Beat schedule for periodic tasks
    beat_schedule={
        # ── Cleanup tasks ────────────────────────────────────────────
        'cleanup-old-audit-logs': {
            'task': 'core.tasks.cleanup_old_audit_logs',
            'schedule': crontab(hour=2, minute=0),  # Daily at 2:00 AM
        },
        'cleanup-expired-sessions': {
            'task': 'core.tasks.cleanup_expired_sessions',
            'schedule': crontab(hour=3, minute=0),  # Daily at 3:00 AM
        },
        'cleanup-expired-tokens': {
            'task': 'core.tasks.cleanup_expired_tokens',
            'schedule': crontab(hour=3, minute=30),  # Daily at 3:30 AM
        },

        # ── Cache / performance ──────────────────────────────────────
        'warm-cache': {
            'task': 'core.tasks.warm_cache_task',
            'schedule': 21600.0,  # Every 6 hours
        },

        # ── Health / monitoring ──────────────────────────────────────
        'collect-health-metrics': {
            'task': 'core.tasks.collect_health_metrics',
            'schedule': 300.0,  # Every 5 minutes
        },

        # ── HR / business logic ──────────────────────────────────────
        'check-probation-due': {
            'task': 'core.tasks.check_probation_due',
            'schedule': crontab(hour=7, minute=0),  # Daily at 7:00 AM
        },
        'check-grievance-escalation': {
            'task': 'core.tasks.check_grievance_escalation',
            'schedule': crontab(hour=8, minute=0),  # Daily at 8:00 AM
        },
        'check-appraisal-deadlines': {
            'task': 'core.tasks.check_appraisal_deadlines',
            'schedule': crontab(hour=0, minute=30),  # Daily at 00:30
        },

        # ── Backup & Restore ──────────────────────────────────────
        'cleanup-expired-backups': {
            'task': 'core.backup_tasks.cleanup_expired_backups_task',
            'schedule': crontab(hour=3, minute=0),  # Daily at 3:00 AM
        },
        'check-backup-schedules': {
            'task': 'core.backup_tasks.check_backup_schedules_task',
            'schedule': crontab(minute='*/30'),  # Every 30 minutes
        },

        # ── Report Scheduling ─────────────────────────────────────
        'check-scheduled-reports': {
            'task': 'reports.tasks.check_scheduled_reports',
            'schedule': crontab(minute='*/15'),  # Every 15 minutes
        },

        # ── Email maintenance ────────────────────────────────────
        'cleanup-old-email-logs': {
            'task': 'core.email.tasks.cleanup_old_email_logs',
            'schedule': crontab(hour=4, minute=0),  # Daily at 4:00 AM
        },
    },
)

# Auto-discover tasks from all installed apps
app.autodiscover_tasks(['core', 'core.email', 'payroll', 'reports', 'training', 'finance', 'procurement', 'inventory', 'projects', 'assistant'])


# ── Task lifecycle signal handlers ──────────────────────────────────────────

# Thread-local storage for task start times
import threading
import time as _time

_task_timing = threading.local()


@task_prerun.connect
def handle_task_prerun(sender=None, task_id=None, args=None, kwargs=None, **kw):
    """Record task start time and log task execution start."""
    _task_timing.start = _time.monotonic()
    logger.info(
        "Celery task started: %s[%s]",
        sender.name if sender else 'unknown',
        task_id,
        extra={
            'task_name': sender.name if sender else 'unknown',
            'task_id': task_id,
            'args': str(args)[:500],
            'event': 'task_started',
        },
    )


@task_postrun.connect
def handle_task_postrun(sender=None, task_id=None, args=None, kwargs=None,
                        retval=None, state=None, **kw):
    """Log task completion with duration and result status."""
    start = getattr(_task_timing, 'start', None)
    duration_ms = round((_time.monotonic() - start) * 1000, 2) if start else 0

    logger.info(
        "Celery task completed: %s[%s] state=%s duration=%sms",
        sender.name if sender else 'unknown',
        task_id,
        state,
        duration_ms,
        extra={
            'task_name': sender.name if sender else 'unknown',
            'task_id': task_id,
            'state': state,
            'duration_ms': duration_ms,
            'event': 'task_completed',
        },
    )


@task_failure.connect
def handle_task_failure(sender=None, task_id=None, exception=None,
                        args=None, kwargs=None, traceback=None,
                        einfo=None, **kw):
    """Log task failures with structured data for Cloud Monitoring alerts."""
    start = getattr(_task_timing, 'start', None)
    duration_ms = round((_time.monotonic() - start) * 1000, 2) if start else 0

    logger.error(
        "Celery task failed: %s[%s] after %sms",
        sender.name if sender else 'unknown',
        task_id,
        duration_ms,
        extra={
            'task_name': sender.name if sender else 'unknown',
            'task_id': task_id,
            'exception': str(exception),
            'exception_type': type(exception).__name__ if exception else '',
            'args': str(args)[:500],
            'duration_ms': duration_ms,
            'event': 'task_failure',
        },
        exc_info=einfo,
    )


@task_retry.connect
def handle_task_retry(sender=None, request=None, reason=None, einfo=None, **kw):
    """Log task retries for observability."""
    logger.warning(
        "Celery task retrying: %s[%s] reason=%s",
        sender.name if sender else 'unknown',
        request.id if request else 'unknown',
        reason,
        extra={
            'task_name': sender.name if sender else 'unknown',
            'task_id': request.id if request else 'unknown',
            'retry_reason': str(reason),
            'event': 'task_retry',
        },
    )


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery."""
    print(f'Request: {self.request!r}')
