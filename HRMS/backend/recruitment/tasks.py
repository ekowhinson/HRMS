"""Recruitment Celery tasks for email notifications."""

import logging
from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def send_application_confirmation_email(self, applicant_id: str, portal_token: str = ''):
    """Send confirmation email to applicant after application submission."""
    from .models import Applicant

    try:
        applicant = Applicant.objects.select_related('vacancy').get(pk=applicant_id)
    except Applicant.DoesNotExist:
        logger.error(f"Applicant {applicant_id} not found for confirmation email")
        return {'status': 'error', 'message': 'Applicant not found'}

    vacancy = applicant.vacancy
    frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

    # Build portal link
    portal_link = ''
    if portal_token:
        portal_link = f"{frontend_url}/portal/dashboard?token={portal_token}"

    subject = f"Application Received - {vacancy.job_title} ({applicant.applicant_number})"

    message = (
        f"Dear {applicant.first_name} {applicant.last_name},\n\n"
        f"Thank you for your application for the position of {vacancy.job_title} "
        f"at the National Health Insurance Authority (NHIA).\n\n"
        f"Your application has been received and is being reviewed. "
        f"Here are your application details:\n\n"
        f"  Application Number: {applicant.applicant_number}\n"
        f"  Position: {vacancy.job_title}\n"
        f"  Department: {vacancy.department.name if vacancy.department else 'N/A'}\n"
        f"  Date Submitted: {applicant.application_date.strftime('%d %B %Y')}\n\n"
    )

    if portal_link:
        message += (
            f"You can track your application status using the link below:\n\n"
            f"  {portal_link}\n\n"
            f"Please keep this link safe as it gives you access to your application portal.\n\n"
        )

    message += (
        f"Next Steps:\n"
        f"  1. Your application will be reviewed by our recruitment team.\n"
        f"  2. If shortlisted, you will be contacted for the next stage.\n"
        f"  3. You can check your application status anytime via the portal link above.\n\n"
        f"If you have any questions, please do not hesitate to contact our HR department.\n\n"
        f"Best regards,\n"
        f"NHIA Human Resource Department\n"
    )

    # HTML version
    html_message = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #1e40af; padding: 20px; border-radius: 8px 8px 0 0;">
            <h2 style="color: #ffffff; margin: 0;">Application Received</h2>
        </div>

        <div style="border: 1px solid #e5e7eb; border-top: none; padding: 24px; border-radius: 0 0 8px 8px;">
            <p>Dear <strong>{applicant.first_name} {applicant.last_name}</strong>,</p>

            <p>Thank you for your application for the position of
            <strong>{vacancy.job_title}</strong> at the National Health Insurance Authority (NHIA).</p>

            <p>Your application has been received and is being reviewed.</p>

            <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #374151;">Application Details</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 6px 0; color: #6b7280;">Application Number:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #1e40af;">{applicant.applicant_number}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #6b7280;">Position:</td>
                        <td style="padding: 6px 0; font-weight: 600;">{vacancy.job_title}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #6b7280;">Department:</td>
                        <td style="padding: 6px 0;">{vacancy.department.name if vacancy.department else 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 6px 0; color: #6b7280;">Date Submitted:</td>
                        <td style="padding: 6px 0;">{applicant.application_date.strftime('%d %B %Y')}</td>
                    </tr>
                </table>
            </div>

            {"<div style='text-align: center; margin: 24px 0;'>"
             "<a href='" + portal_link + "' "
             "style='display: inline-block; background-color: #1e40af; color: #ffffff; "
             "padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;'>"
             "Track Your Application</a>"
             "</div>"
             "<p style='text-align: center; font-size: 13px; color: #6b7280;'>"
             "Or copy this link: <br>"
             "<a href='" + portal_link + "' style='color: #1e40af; word-break: break-all;'>"
             + portal_link + "</a></p>"
             if portal_link else ""}

            <div style="border-top: 1px solid #e5e7eb; margin-top: 20px; padding-top: 16px;">
                <h3 style="color: #374151; margin-top: 0;">Next Steps</h3>
                <ol style="color: #4b5563; padding-left: 20px;">
                    <li style="margin-bottom: 8px;">Your application will be reviewed by our recruitment team.</li>
                    <li style="margin-bottom: 8px;">If shortlisted, you will be contacted for the next stage.</li>
                    <li style="margin-bottom: 8px;">You can check your application status anytime via the portal link above.</li>
                </ol>
            </div>

            <p style="color: #4b5563;">If you have any questions, please do not hesitate to contact our HR department.</p>

            <p style="color: #4b5563;">
                Best regards,<br>
                <strong>NHIA Human Resource Department</strong>
            </p>
        </div>

        <div style="text-align: center; padding: 16px; font-size: 12px; color: #9ca3af;">
            National Health Insurance Authority &mdash; Human Resource Management System
        </div>
    </div>
    """

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[applicant.email],
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(f"Confirmation email sent to {applicant.email} for {applicant.applicant_number}")
        return {'status': 'sent', 'email': applicant.email, 'applicant': applicant.applicant_number}
    except Exception as exc:
        logger.error(f"Failed to send confirmation email to {applicant.email}: {exc}")
        raise self.retry(exc=exc)
