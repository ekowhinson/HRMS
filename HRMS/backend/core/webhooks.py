"""
SendGrid Event Webhook receiver.

Receives delivery/open/bounce events from SendGrid and updates
the corresponding EmailLog records for tracking and analytics.
"""

import hashlib
import hmac
import json
import logging
from datetime import datetime, timezone as dt_timezone

from django.conf import settings
from django.http import JsonResponse
from django.utils.decorators import method_decorator
from django.views import View
from django.views.decorators.csrf import csrf_exempt

from core.models import EmailLog

logger = logging.getLogger(__name__)


@method_decorator(csrf_exempt, name='dispatch')
class SendGridWebhookView(View):
    """
    Receives batched event webhooks from SendGrid.

    SendGrid posts a JSON array of events (delivered, open, bounce, etc.).
    We match each event to an EmailLog via sg_message_id and update status.
    """

    http_method_names = ['post']

    def post(self, request):
        # Verify signature if verification key is configured
        verification_key = getattr(settings, 'SENDGRID_WEBHOOK_VERIFICATION_KEY', '')
        if verification_key:
            if not self._verify_signature(request, verification_key):
                logger.warning("SendGrid webhook signature verification failed")
                return JsonResponse({'error': 'Invalid signature'}, status=403)

        try:
            events = json.loads(request.body)
        except (json.JSONDecodeError, ValueError):
            return JsonResponse({'error': 'Invalid JSON'}, status=400)

        if not isinstance(events, list):
            return JsonResponse({'error': 'Expected JSON array'}, status=400)

        processed = 0
        for event in events:
            if self._process_event(event):
                processed += 1

        logger.info("SendGrid webhook: processed %d/%d events", processed, len(events))
        return JsonResponse({'status': 'ok', 'processed': processed})

    def _verify_signature(self, request, public_key):
        """Verify SendGrid Event Webhook signature using ECDSA."""
        try:
            from sendgrid.helpers.eventwebhook import EventWebhook, EventWebhookHeader

            signature = request.headers.get(EventWebhookHeader.SIGNATURE, '')
            timestamp = request.headers.get(EventWebhookHeader.TIMESTAMP, '')

            if not signature or not timestamp:
                return False

            ew = EventWebhook(public_key)
            return ew.verify_signature(
                request.body.decode('utf-8'),
                signature,
                timestamp,
            )
        except ImportError:
            logger.warning("sendgrid.helpers.eventwebhook not available, skipping verification")
            return True
        except Exception as e:
            logger.warning("SendGrid signature verification error: %s", e)
            return False

    def _process_event(self, event):
        """Process a single SendGrid event and update the matching EmailLog."""
        sg_message_id = event.get('sg_message_id', '')
        event_type = event.get('event', '')

        if not sg_message_id or not event_type:
            return False

        # SendGrid sg_message_id may have a filter ID suffix — strip it
        # Format: "abc123.filter0001" — we stored just the base ID
        base_msg_id = sg_message_id.split('.')[0]

        try:
            email_log = EmailLog.objects.filter(
                sendgrid_message_id__startswith=base_msg_id
            ).first()

            if not email_log:
                logger.debug("No EmailLog found for sg_message_id=%s", sg_message_id)
                return False

            timestamp = self._parse_timestamp(event.get('timestamp'))

            if event_type == 'delivered':
                email_log.status = EmailLog.Status.DELIVERED
                if timestamp:
                    email_log.delivered_at = timestamp
                email_log.save(update_fields=['status', 'delivered_at', 'updated_at'])

            elif event_type == 'open':
                # Only record first open
                if not email_log.opened_at and timestamp:
                    email_log.opened_at = timestamp
                    email_log.save(update_fields=['opened_at', 'updated_at'])

            elif event_type == 'bounce':
                email_log.status = EmailLog.Status.BOUNCED
                email_log.status_detail = event.get('reason', '')[:1000]
                email_log.save(update_fields=['status', 'status_detail', 'updated_at'])

            elif event_type == 'dropped':
                email_log.status = EmailLog.Status.FAILED
                email_log.status_detail = event.get('reason', '')[:1000]
                email_log.save(update_fields=['status', 'status_detail', 'updated_at'])

            elif event_type == 'deferred':
                email_log.status_detail = f"Deferred: {event.get('response', '')}"[:1000]
                email_log.save(update_fields=['status_detail', 'updated_at'])

            else:
                # processed, click, unsubscribe, etc. — log but don't update
                return False

            return True

        except Exception as e:
            logger.exception("Error processing SendGrid event: %s", e)
            return False

    def _parse_timestamp(self, ts):
        """Parse a Unix timestamp from SendGrid event data."""
        if not ts:
            return None
        try:
            return datetime.fromtimestamp(int(ts), tz=dt_timezone.utc)
        except (ValueError, TypeError, OSError):
            return None
