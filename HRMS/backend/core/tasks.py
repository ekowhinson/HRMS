"""
Celery tasks for core functionality.
"""

import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def warm_cache_task():
    """
    Warm the cache with commonly used data.
    Runs periodically via Celery Beat.
    """
    from .caching import CacheManager

    try:
        CacheManager.warm_cache()
        logger.info("Cache warming completed successfully")
        return {'status': 'success', 'message': 'Cache warmed'}
    except Exception as e:
        logger.exception(f"Cache warming failed: {str(e)}")
        return {'status': 'error', 'message': str(e)}


@shared_task
def invalidate_cache_task(cache_type: str = 'all'):
    """
    Invalidate cache entries.

    Args:
        cache_type: Type of cache to invalidate (all, employees, organization, lookups)
    """
    from .caching import CacheManager
    from django.core.cache import caches

    try:
        if cache_type == 'all':
            for alias in ['default', 'persistent', 'volatile']:
                try:
                    caches[alias].clear()
                except:
                    pass
            message = 'All caches cleared'

        elif cache_type == 'employees':
            CacheManager.invalidate_employee_caches()
            message = 'Employee caches cleared'

        elif cache_type == 'organization':
            CacheManager.invalidate_organization_caches()
            message = 'Organization caches cleared'

        else:
            message = f'Unknown cache type: {cache_type}'

        logger.info(message)
        return {'status': 'success', 'message': message}

    except Exception as e:
        logger.exception(f"Cache invalidation failed: {str(e)}")
        return {'status': 'error', 'message': str(e)}


@shared_task
def send_notification_task(user_id: str, notification_type: str, data: dict):
    """
    Send a notification to a user.
    Placeholder for future notification system.

    Args:
        user_id: UUID of the user
        notification_type: Type of notification
        data: Notification data
    """
    logger.info(f"Notification for user {user_id}: {notification_type} - {data}")
    return {'status': 'sent', 'user_id': user_id, 'type': notification_type}


@shared_task
def cleanup_old_audit_logs():
    """
    Clean up old audit logs to manage database size.
    Keeps last 90 days of logs.
    """
    from core.models import AuditLog
    from django.utils import timezone
    from datetime import timedelta

    cutoff_date = timezone.now() - timedelta(days=90)

    try:
        deleted_count, _ = AuditLog.objects.filter(
            created_at__lt=cutoff_date
        ).delete()

        logger.info(f"Cleaned up {deleted_count} old audit logs")
        return {'status': 'success', 'deleted': deleted_count}

    except Exception as e:
        logger.exception(f"Audit log cleanup failed: {str(e)}")
        return {'status': 'error', 'message': str(e)}
