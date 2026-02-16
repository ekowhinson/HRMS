"""
Email service — renders templates and dispatches via Django's email framework.

Usage:
    from core.email import send_email, EmailEvent

    send_email(
        event=EmailEvent.LEAVE_APPROVED,
        recipient_email='user@example.com',
        context={'employee_name': 'John', 'leave_type': 'Annual'},
        recipient_user=user_instance,     # optional, for logging & prefs
    )
"""

import logging

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from .events import EmailEvent

logger = logging.getLogger(__name__)


class EmailService:
    """Renders email templates and sends via the configured backend."""

    @staticmethod
    def _build_base_context(context: dict) -> dict:
        """Add standard context variables available to all templates."""
        base = {
            'org_name': settings.HRMS_SETTINGS.get('ORGANIZATION_NAME', 'NHIA'),
            'frontend_url': getattr(settings, 'FRONTEND_URL', 'http://localhost:3000'),
            'current_year': __import__('datetime').date.today().year,
        }
        base.update(context)
        return base

    @classmethod
    def render_email(cls, event: EmailEvent, context: dict) -> tuple:
        """
        Render an email template and return (subject, html_body, text_body).
        """
        full_context = cls._build_base_context(context)

        # Render HTML
        template_path = f'email/{event.template}'
        html_body = render_to_string(template_path, full_context)

        # Generate plain text fallback from HTML
        text_body = strip_tags(html_body)

        # Build subject
        subject = event.get_subject(**full_context)

        return subject, html_body, text_body

    @classmethod
    def send(
        cls,
        event: EmailEvent,
        recipient_email: str,
        context: dict | None = None,
        recipient_user=None,
        from_email: str | None = None,
        subject_override: str | None = None,
    ) -> bool:
        """
        Render and send an email synchronously.
        Returns True on success, False on failure.
        """
        context = context or {}

        # Check user preferences (non-critical emails only)
        if recipient_user and not event.is_critical:
            if not cls._check_preferences(recipient_user, event.category):
                logger.info(
                    "Email suppressed by user preference: user=%s event=%s",
                    recipient_user.id, event.name,
                )
                return False

        try:
            subject, html_body, text_body = cls.render_email(event, context)

            if subject_override:
                subject = subject_override

            sender = from_email or settings.DEFAULT_FROM_EMAIL

            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=sender,
                to=[recipient_email],
            )
            msg.attach_alternative(html_body, 'text/html')
            msg.send(fail_silently=False)

            # Log the email
            cls._log_email(
                event=event,
                recipient_email=recipient_email,
                recipient_user=recipient_user,
                subject=subject,
                from_email=sender,
                context=context,
                status='SENT',
            )

            logger.info(
                "Email sent: event=%s to=%s subject='%s'",
                event.name, recipient_email, subject,
            )
            return True

        except Exception as e:
            logger.exception(
                "Email send failed: event=%s to=%s error=%s",
                event.name, recipient_email, e,
            )
            cls._log_email(
                event=event,
                recipient_email=recipient_email,
                recipient_user=recipient_user,
                subject=context.get('subject', event.default_subject),
                from_email=from_email or settings.DEFAULT_FROM_EMAIL,
                context=context,
                status='FAILED',
                status_detail=str(e),
            )
            return False

    @staticmethod
    def _check_preferences(user, category: str) -> bool:
        """Check if user has opted out of this email category."""
        try:
            pref = user.email_preference
            return pref.is_enabled_for(category)
        except Exception:
            # No preference record = all emails enabled
            return True

    @staticmethod
    def _log_email(
        event: EmailEvent,
        recipient_email: str,
        recipient_user,
        subject: str,
        from_email: str,
        context: dict,
        status: str,
        status_detail: str = '',
    ):
        """Create an EmailLog record."""
        try:
            from core.models import EmailLog

            # Sanitize context — remove sensitive fields
            safe_context = {
                k: v for k, v in context.items()
                if k not in ('password', 'token', 'secret', 'code', 'otp',
                             'verification_code', 'reset_url', 'portal_token')
            }

            EmailLog.objects.create(
                recipient_email=recipient_email,
                recipient_user=recipient_user,
                from_email=from_email,
                subject=subject,
                event_type=event.name,
                template_name=event.template,
                status=status,
                status_detail=status_detail,
                context_snapshot=safe_context,
            )
        except Exception as e:
            logger.warning("Failed to create email log: %s", e)


def send_email(
    event: EmailEvent,
    recipient_email: str,
    context: dict | None = None,
    recipient_user=None,
    from_email: str | None = None,
    subject_override: str | None = None,
    sync: bool = False,
) -> bool | str:
    """
    Public API for sending emails.

    By default dispatches via Celery (async). Set sync=True for immediate send
    (used for critical emails like 2FA codes).

    Returns:
        - True/False if sync=True
        - Celery task ID string if async
    """
    if sync:
        return EmailService.send(
            event=event,
            recipient_email=recipient_email,
            context=context,
            recipient_user=recipient_user,
            from_email=from_email,
            subject_override=subject_override,
        )

    # Async dispatch via Celery
    from core.email.tasks import send_email_task

    result = send_email_task.delay(
        event_name=event.name,
        recipient_email=recipient_email,
        context=context or {},
        recipient_user_id=str(recipient_user.id) if recipient_user else None,
        from_email=from_email,
        subject_override=subject_override,
    )
    return result.id
