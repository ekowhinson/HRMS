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
from celery.signals import task_failure, task_retry
from django.conf import settings

logger = logging.getLogger('nhia_hrms')

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
    timezone='Africa/Accra',
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
        'imports.tasks.*': {'queue': 'imports'},
        'reports.tasks.*': {'queue': 'reports'},
        'payroll.tasks.*': {'queue': 'payroll'},
    },

    # Default queue
    task_default_queue='default',

    # Beat schedule for periodic tasks
    beat_schedule={
        # ── Cleanup tasks ────────────────────────────────────────────
        'cleanup-expired-imports': {
            'task': 'imports.tasks.cleanup_expired_imports',
            'schedule': 3600.0,  # Every hour
        },
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
    },
)

# Auto-discover tasks from all installed apps
app.autodiscover_tasks(['imports', 'core', 'payroll', 'reports', 'training'])


# ── Task failure / retry signal handlers ────────────────────────────────────

@task_failure.connect
def handle_task_failure(sender=None, task_id=None, exception=None,
                        args=None, kwargs=None, traceback=None,
                        einfo=None, **kw):
    """Log task failures with structured data for Cloud Monitoring alerts."""
    logger.error(
        "Celery task failed: %s[%s]",
        sender.name if sender else 'unknown',
        task_id,
        extra={
            'task_name': sender.name if sender else 'unknown',
            'task_id': task_id,
            'exception': str(exception),
            'args': str(args)[:500],
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
