"""Recruitment Celery tasks for email notifications."""

import logging
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_application_confirmation_email(self, applicant_id: str, portal_token: str = ''):
    """Send confirmation email to applicant after application submission."""
    from .models import Applicant
    from core.email import send_email, EmailEvent

    try:
        applicant = Applicant.objects.select_related('vacancy').get(pk=applicant_id)
    except Applicant.DoesNotExist:
        logger.error(f"Applicant {applicant_id} not found for confirmation email")
        return {'status': 'error', 'message': 'Applicant not found'}

    vacancy = applicant.vacancy
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

    # Build portal link
    portal_url = ''
    if portal_token:
        portal_url = f"{frontend_url}/portal/dashboard?token={portal_token}"

    try:
        send_email(
            event=EmailEvent.APPLICATION_RECEIVED,
            recipient_email=applicant.email,
            context={
                'applicant_name': f"{applicant.first_name} {applicant.last_name}",
                'position': vacancy.job_title,
                'applicant_number': applicant.applicant_number,
                'department': vacancy.department.name if vacancy.department else 'N/A',
                'application_date': applicant.application_date.strftime('%d %B %Y'),
                'portal_url': portal_url,
                'cta_url': portal_url,
                'cta_text': 'Track Your Application',
            },
            sync=True,
        )
        logger.info(f"Confirmation email sent to {applicant.email} for {applicant.applicant_number}")
        return {'status': 'sent', 'email': applicant.email, 'applicant': applicant.applicant_number}
    except Exception as exc:
        logger.error(f"Failed to send confirmation email to {applicant.email}: {exc}")
        raise self.retry(exc=exc)
