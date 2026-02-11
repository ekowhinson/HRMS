"""
Celery configuration for HRMS project.
"""

import os
from celery import Celery
from celery.schedules import crontab
from django.conf import settings

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
    task_acks_late=True,  # Acknowledge tasks after completion
    task_reject_on_worker_lost=True,
    task_time_limit=3600,  # 1 hour hard limit
    task_soft_time_limit=3000,  # 50 min soft limit

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
        'cleanup-expired-imports': {
            'task': 'imports.tasks.cleanup_expired_imports',
            'schedule': 3600.0,  # Every hour
        },
        'warm-cache': {
            'task': 'core.tasks.warm_cache_task',
            'schedule': 21600.0,  # Every 6 hours
        },
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
app.autodiscover_tasks(['imports', 'core', 'payroll', 'training'])


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery."""
    print(f'Request: {self.request!r}')
