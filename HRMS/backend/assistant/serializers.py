from rest_framework import serializers
from .models import (
    Conversation, Message, MessageAttachment, PromptTemplate,
    ImportSession, ImportPreviewRow, ImportResult,
)


class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MessageAttachment
        fields = [
            'id', 'file_name', 'file_size', 'mime_type',
            'file_type', 'parsed_summary', 'parsed_metadata', 'created_at',
        ]
        read_only_fields = fields


class MessageSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'role', 'content', 'created_at', 'attachments']
        read_only_fields = ['id', 'created_at']


class ConversationListSerializer(serializers.ModelSerializer):
    message_count = serializers.IntegerField(read_only=True)
    last_message_at = serializers.DateTimeField(read_only=True)

    class Meta:
        model = Conversation
        fields = ['id', 'title', 'is_archived', 'created_at', 'updated_at', 'message_count', 'last_message_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ConversationDetailSerializer(serializers.ModelSerializer):
    messages = MessageSerializer(many=True, read_only=True)

    class Meta:
        model = Conversation
        fields = ['id', 'title', 'is_archived', 'created_at', 'updated_at', 'messages']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=10000)
    conversation_id = serializers.UUIDField(required=False, allow_null=True)
    attachment_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        default=list,
    )
    payroll_run_id = serializers.UUIDField(required=False, allow_null=True)


class PromptTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PromptTemplate
        fields = [
            'id', 'name', 'description', 'prompt_text',
            'category', 'icon', 'requires_file', 'sort_order',
        ]
        read_only_fields = fields


# ── Import pipeline serializers ─────────────────────────────────────────────


class ImportPreviewRowSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportPreviewRow
        fields = [
            'id', 'row_number', 'action', 'parsed_data', 'raw_data',
            'existing_record_id', 'changes', 'errors', 'warnings',
        ]
        read_only_fields = fields


class ImportResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = ImportResult
        fields = [
            'id', 'row_number', 'action_taken', 'record_id',
            'record_type', 'error_message', 'created_at',
        ]
        read_only_fields = fields


class ImportSessionSerializer(serializers.ModelSerializer):
    preview_rows = ImportPreviewRowSerializer(many=True, read_only=True)
    results = ImportResultSerializer(many=True, read_only=True)

    class Meta:
        model = ImportSession
        fields = [
            'id', 'entity_type', 'status',
            'column_mapping', 'confirmed_mapping', 'import_params',
            'total_rows', 'rows_created', 'rows_updated',
            'rows_skipped', 'rows_errored', 'error_details',
            'celery_task_id', 'progress_key',
            'created_at', 'updated_at',
            'preview_rows', 'results',
        ]
        read_only_fields = fields


class ImportSessionListSerializer(serializers.ModelSerializer):
    """Lightweight list serializer without nested rows."""
    class Meta:
        model = ImportSession
        fields = [
            'id', 'entity_type', 'status',
            'total_rows', 'rows_created', 'rows_updated',
            'rows_skipped', 'rows_errored',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


class ImportAnalyzeRequestSerializer(serializers.Serializer):
    attachment_id = serializers.UUIDField()
    entity_type = serializers.ChoiceField(
        choices=ImportSession.EntityType.choices,
        required=False,
        allow_null=True,
    )


class ImportPreviewRequestSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
    confirmed_mapping = serializers.DictField(
        child=serializers.CharField(allow_null=True),
        required=False,
    )
    import_params = serializers.DictField(required=False)


class ImportConfirmRequestSerializer(serializers.Serializer):
    session_id = serializers.UUIDField()
