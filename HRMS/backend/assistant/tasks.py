"""
Celery tasks for the AI assistant import pipeline.
"""

import logging

from celery import shared_task
from django.core.cache import cache

logger = logging.getLogger(__name__)


@shared_task(bind=True, queue='imports', max_retries=0, time_limit=3600, soft_time_limit=3500)
def execute_import(self, session_id, user_id):
    """
    Execute a confirmed import session.

    Updates progress in Redis cache so the frontend can poll.
    """
    from .models import ImportSession
    from .import_pipeline.registry import import_registry
    from .import_pipeline.import_executor import ImportExecutor
    from .import_pipeline import creators  # noqa: F401 — triggers registration
    from django.contrib.auth import get_user_model

    User = get_user_model()

    try:
        session = ImportSession.objects.get(pk=session_id)
    except ImportSession.DoesNotExist:
        logger.error(f"Import session not found: {session_id}")
        return {'status': 'error', 'message': 'Session not found'}

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        session.status = ImportSession.Status.FAILED
        session.error_details = [{'error': 'User not found'}]
        session.save(update_fields=['status', 'error_details', 'updated_at'])
        return {'status': 'error', 'message': 'User not found'}

    # Attach user to session for creators
    session.user = user

    cache_key = session.progress_key or f'import_progress_{session_id}'
    session.progress_key = cache_key
    session.celery_task_id = self.request.id
    session.save(update_fields=['progress_key', 'celery_task_id', 'updated_at'])

    def progress_callback(processed, total):
        progress = {
            'processed': processed,
            'total': total,
            'percentage': round((processed / total) * 100) if total else 0,
            'status': 'processing',
        }
        cache.set(cache_key, progress, timeout=3600)

    try:
        executor = ImportExecutor()
        executor.execute(session, import_registry, progress_callback=progress_callback)

        session.refresh_from_db()
        final_progress = {
            'processed': session.total_rows,
            'total': session.total_rows,
            'percentage': 100,
            'status': session.status,
            'rows_created': session.rows_created,
            'rows_updated': session.rows_updated,
            'rows_errored': session.rows_errored,
        }
        cache.set(cache_key, final_progress, timeout=3600)

        return {
            'status': session.status,
            'rows_created': session.rows_created,
            'rows_updated': session.rows_updated,
            'rows_errored': session.rows_errored,
        }

    except Exception as e:
        logger.exception(f"Import execution failed for session {session_id}")
        session.status = ImportSession.Status.FAILED
        session.error_details = [{'error': str(e)}]
        session.save(update_fields=['status', 'error_details', 'updated_at'])

        cache.set(cache_key, {
            'status': 'FAILED',
            'error': str(e),
        }, timeout=3600)

        return {'status': 'error', 'message': str(e)}
