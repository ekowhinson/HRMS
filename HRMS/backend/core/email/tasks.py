"""
Celery tasks for email dispatch and maintenance.
"""

import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_email_task(
    self,
    event_name: str,
    recipient_email: str,
    context: dict,
    recipient_user_id: str | None = None,
    from_email: str | None = None,
    subject_override: str | None = None,
):
    """
    Celery task to send an email asynchronously.
    Retries up to 3 times on failure.
    """
    from core.email.events import EmailEvent
    from core.email.service import EmailService

    try:
        event = EmailEvent[event_name]
    except KeyError:
        logger.error("Unknown email event: %s", event_name)
        return {'status': 'error', 'message': f'Unknown event: {event_name}'}

    # Resolve user if provided
    recipient_user = None
    if recipient_user_id:
        from django.contrib.auth import get_user_model
        User = get_user_model()
        try:
            recipient_user = User.objects.get(pk=recipient_user_id)
        except User.DoesNotExist:
            logger.warning("Email recipient user %s not found", recipient_user_id)

    try:
        success = EmailService.send(
            event=event,
            recipient_email=recipient_email,
            context=context,
            recipient_user=recipient_user,
            from_email=from_email,
            subject_override=subject_override,
        )
        return {
            'status': 'sent' if success else 'suppressed',
            'event': event_name,
            'to': recipient_email,
        }
    except Exception as exc:
        logger.error(
            "Email task failed (attempt %d): event=%s to=%s error=%s",
            self.request.retries + 1, event_name, recipient_email, exc,
        )
        raise self.retry(exc=exc)


@shared_task
def cleanup_old_email_logs():
    """
    Remove email logs older than 90 days.
    Runs daily at 4:00 AM via Celery Beat.
    """
    from datetime import timedelta
    from django.utils import timezone
    from core.models import EmailLog

    cutoff = timezone.now() - timedelta(days=90)

    try:
        deleted_count, _ = EmailLog.objects.filter(
            created_at__lt=cutoff
        ).delete()
        logger.info("Cleaned up %d old email logs", deleted_count)
        return {'status': 'success', 'deleted': deleted_count}
    except Exception as e:
        logger.exception("Email log cleanup failed: %s", e)
        return {'status': 'error', 'message': str(e)}
