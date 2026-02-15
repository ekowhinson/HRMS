"""
Chat orchestration service.

Owns conversation management, message persistence, attachment linking,
history building, and stream orchestration.  Views delegate to this service
so they stay a thin HTTP layer.
"""

import json
import logging

from .models import Conversation, Message, MessageAttachment
from .providers import PAYROLL_AUDIT_SYSTEM_PROMPT, get_llm_provider

logger = logging.getLogger(__name__)


class ChatOrchestrationService:
    """Coordinates a single chat turn: persist messages, build context, stream response."""

    def __init__(self, llm_provider=None, payroll_provider=None):
        self.llm = llm_provider or get_llm_provider()
        self._payroll_provider = payroll_provider

    @property
    def payroll_provider(self):
        if self._payroll_provider is None:
            from .payroll_provider import PayrollDataProvider
            self._payroll_provider = PayrollDataProvider()
        return self._payroll_provider

    # ── public API ───────────────────────────────────────────────────

    def get_or_create_conversation(self, user, conversation_id=None, title=None):
        if conversation_id:
            return Conversation.objects.get(id=conversation_id, user=user)
        return Conversation.objects.create(
            user=user,
            title=title or 'New Chat',
        )

    def save_user_message(self, conversation, content):
        return Message.objects.create(
            conversation=conversation,
            role=Message.Role.USER,
            content=content,
        )

    def link_attachments(self, conversation, user, attachment_ids, message):
        if not attachment_ids:
            return []
        attachments = list(
            MessageAttachment.objects.filter(
                id__in=attachment_ids,
                conversation=conversation,
                uploaded_by=user,
            )
        )
        MessageAttachment.objects.filter(
            id__in=[a.id for a in attachments]
        ).update(message=message)
        return attachments

    def fetch_payroll_context(self, payroll_run_id):
        if not payroll_run_id:
            return None
        try:
            return self.payroll_provider.get_payroll_context(payroll_run_id)
        except Exception as e:
            logger.error(f"Failed to fetch payroll context: {e}")
            return None

    def build_history(self, conversation, exclude_last_user=True):
        history_qs = conversation.messages.order_by('-created_at')[:20]
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in reversed(list(history_qs))
        ]
        if exclude_last_user and history and history[-1]["role"] == "user":
            history = history[:-1]
        return history

    def stream_response(self, conversation, user_message, history, attachments, payroll_context):
        """Yield JSON-line stream and persist the assistant response on completion."""
        meta = {
            "type": "meta",
            "conversation_id": str(conversation.id),
        }
        if payroll_context and payroll_context.get('audit_summary'):
            meta["audit_summary"] = payroll_context['audit_summary']
        yield json.dumps(meta) + "\n"

        full_response = []

        if payroll_context and payroll_context.get('context_text'):
            stream_gen = self.llm.chat_stream(
                history,
                user_message,
                context=f"[Payroll Data]\n{payroll_context['context_text']}",
                extra_system_prompt=PAYROLL_AUDIT_SYSTEM_PROMPT,
            )
        elif attachments:
            stream_gen = self.llm.chat_stream_with_files(history, user_message, attachments)
        else:
            stream_gen = self.llm.chat_stream(history, user_message)

        for line in stream_gen:
            yield line
            try:
                data = json.loads(line.strip())
                if data.get("type") == "token":
                    full_response.append(data.get("content", ""))
            except (json.JSONDecodeError, KeyError):
                pass

        if full_response:
            Message.objects.create(
                conversation=conversation,
                role=Message.Role.ASSISTANT,
                content="".join(full_response),
            )
            conversation.save(update_fields=['updated_at'])
