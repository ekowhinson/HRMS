"""
Custom Django email backend using SendGrid Web API v3.

Falls back to console backend when SENDGRID_API_KEY is not configured.
"""

import logging

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class SendGridBackend(BaseEmailBackend):
    """
    Django email backend that sends via SendGrid Web API v3 (not SMTP).
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = getattr(settings, 'SENDGRID_API_KEY', '')
        self.sandbox_mode = getattr(settings, 'SENDGRID_SANDBOX_MODE', False)

    def open(self):
        if not self.api_key:
            logger.warning("SENDGRID_API_KEY not configured, emails will not be sent")
            return False
        return True

    def close(self):
        pass

    def send_messages(self, email_messages):
        if not self.api_key:
            if not self.fail_silently:
                logger.warning("SendGrid API key not set — falling back to console output")
            for msg in email_messages:
                logger.info(
                    "Email (console fallback): to=%s subject=%s",
                    msg.to, msg.subject
                )
            return len(email_messages)

        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import (
            Mail, From, To, Subject, HtmlContent, PlainTextContent,
            TrackingSettings, ClickTracking, OpenTracking,
            MailSettings, SandBoxMode,
        )

        sg = SendGridAPIClient(api_key=self.api_key)
        sent_count = 0

        for message in email_messages:
            try:
                mail = Mail()
                mail.from_email = From(message.from_email or settings.DEFAULT_FROM_EMAIL)
                mail.subject = Subject(message.subject)

                for recipient in message.to:
                    mail.to = To(recipient)

                # Set plain text body
                mail.plain_text_content = PlainTextContent(message.body)

                # Check for HTML alternative
                if message.alternatives:
                    for content, mimetype in message.alternatives:
                        if mimetype == 'text/html':
                            mail.html_content = HtmlContent(content)
                            break

                # Tracking settings
                tracking = TrackingSettings()
                tracking.click_tracking = ClickTracking(enable=True)
                tracking.open_tracking = OpenTracking(enable=True)
                mail.tracking_settings = tracking

                # Sandbox mode for testing
                if self.sandbox_mode:
                    mail_settings = MailSettings()
                    mail_settings.sandbox_mode = SandBoxMode(enable=True)
                    mail.mail_settings = mail_settings

                response = sg.send(mail)

                if response.status_code in (200, 201, 202):
                    sent_count += 1
                    msg_id = response.headers.get('X-Message-Id', '')
                    logger.info(
                        "SendGrid email sent: to=%s subject='%s' status=%s msg_id=%s",
                        message.to, message.subject, response.status_code, msg_id,
                    )
                else:
                    logger.error(
                        "SendGrid send failed: to=%s status=%s body=%s",
                        message.to, response.status_code, response.body,
                    )

            except Exception as e:
                logger.exception("SendGrid send error: to=%s error=%s", message.to, e)
                if not self.fail_silently:
                    raise

        return sent_count
