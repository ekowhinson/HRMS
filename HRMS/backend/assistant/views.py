import logging
from django.http import StreamingHttpResponse
from django.db.models import Count, Max
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser

from django.core.cache import cache

from .models import Conversation, Message, MessageAttachment, PromptTemplate, ImportSession
from .serializers import (
    AttachmentSerializer,
    ChatRequestSerializer,
    ConversationListSerializer,
    ConversationDetailSerializer,
    PromptTemplateSerializer,
    ImportSessionSerializer,
    ImportSessionListSerializer,
    ImportAnalyzeRequestSerializer,
    ImportPreviewRequestSerializer,
    ImportConfirmRequestSerializer,
)
from .providers import get_llm_provider
from .file_processor import FileProcessor
from .chat_service import ChatOrchestrationService

logger = logging.getLogger(__name__)

MAX_UPLOAD_SIZE = 20 * 1024 * 1024  # 20MB
ALLOWED_EXTENSIONS = {
    '.csv', '.xlsx', '.xls', '.pdf',
    '.png', '.jpg', '.jpeg', '.gif', '.webp',
}


class FileUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response(
                {"error": "No file provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file size
        if uploaded_file.size > MAX_UPLOAD_SIZE:
            return Response(
                {"error": f"File too large. Maximum size is {MAX_UPLOAD_SIZE // (1024*1024)}MB"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate file extension
        file_name = uploaded_file.name
        ext = '.' + file_name.rsplit('.', 1)[-1].lower() if '.' in file_name else ''
        if ext not in ALLOWED_EXTENSIONS:
            return Response(
                {"error": f"File type not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get or create conversation
        conversation_id = request.data.get('conversation_id')
        if conversation_id:
            try:
                conversation = Conversation.objects.get(id=conversation_id, user=request.user)
            except Conversation.DoesNotExist:
                return Response(
                    {"error": "Conversation not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            conversation = Conversation.objects.create(
                user=request.user,
                title=f"File: {file_name[:70]}",
            )

        # Read file data and process
        file_data = uploaded_file.read()
        mime_type = uploaded_file.content_type or 'application/octet-stream'

        processor = FileProcessor()
        result = processor.process(file_data, file_name, mime_type)

        attachment = MessageAttachment.objects.create(
            conversation=conversation,
            uploaded_by=request.user,
            file_data=file_data,
            file_name=file_name,
            file_size=len(file_data),
            mime_type=mime_type,
            file_type=result['file_type'],
            parsed_summary=result['parsed_summary'],
            parsed_metadata=result['parsed_metadata'],
        )

        serializer = AttachmentSerializer(attachment)
        data = serializer.data
        data['conversation_id'] = str(conversation.id)
        return Response(data, status=status.HTTP_201_CREATED)


class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_message = serializer.validated_data['message']
        conversation_id = serializer.validated_data.get('conversation_id')
        attachment_ids = serializer.validated_data.get('attachment_ids', [])
        payroll_run_id = serializer.validated_data.get('payroll_run_id')

        svc = ChatOrchestrationService()

        try:
            conversation = svc.get_or_create_conversation(
                user=request.user,
                conversation_id=conversation_id,
                title=user_message[:80] + ('...' if len(user_message) > 80 else ''),
            )
        except Conversation.DoesNotExist:
            return Response(
                {"error": "Conversation not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        user_msg = svc.save_user_message(conversation, user_message)
        attachments = svc.link_attachments(conversation, request.user, attachment_ids, user_msg)
        payroll_context = svc.fetch_payroll_context(payroll_run_id)
        history = svc.build_history(conversation)

        response = StreamingHttpResponse(
            svc.stream_response(conversation, user_message, history, attachments, payroll_context),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response


class PromptTemplateListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        templates = PromptTemplate.objects.filter(is_active=True)
        serializer = PromptTemplateSerializer(templates, many=True)
        return Response(serializer.data)


class ConversationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        conversations = (
            Conversation.objects.filter(user=request.user, is_archived=False)
            .annotate(
                message_count=Count('messages'),
                last_message_at=Max('messages__created_at'),
            )
            .order_by('-updated_at')
        )
        serializer = ConversationListSerializer(conversations, many=True)
        return Response(serializer.data)

    def post(self, request):
        conversation = Conversation.objects.create(
            user=request.user,
            title=request.data.get('title', 'New Chat'),
        )
        serializer = ConversationListSerializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            conversation = Conversation.objects.get(id=pk, user=request.user)
        except Conversation.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        serializer = ConversationDetailSerializer(conversation)
        return Response(serializer.data)

    def patch(self, request, pk):
        try:
            conversation = Conversation.objects.get(id=pk, user=request.user)
        except Conversation.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

        if 'title' in request.data:
            conversation.title = request.data['title']
        if 'is_archived' in request.data:
            conversation.is_archived = request.data['is_archived']
        conversation.save()

        serializer = ConversationDetailSerializer(conversation)
        return Response(serializer.data)

    def delete(self, request, pk):
        try:
            conversation = Conversation.objects.get(id=pk, user=request.user)
        except Conversation.DoesNotExist:
            return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        conversation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AssistantHealthView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider = get_llm_provider()
        health = provider.check_health()
        http_status = status.HTTP_200_OK if health["status"] == "ok" else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(health, status=http_status)


# ── Import pipeline views ───────────────────────────────────────────────────


class ImportAnalyzeView(APIView):
    """Upload → AI column mapping. Creates an ImportSession with proposed mapping."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ImportAnalyzeRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        attachment_id = serializer.validated_data['attachment_id']
        entity_type = serializer.validated_data.get('entity_type')

        try:
            attachment = MessageAttachment.objects.get(
                id=attachment_id,
                uploaded_by=request.user,
            )
        except MessageAttachment.DoesNotExist:
            return Response(
                {"error": "Attachment not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if attachment.file_type != 'DATA':
            return Response(
                {"error": "Attachment must be a data file (CSV/Excel)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        metadata = attachment.parsed_metadata or {}
        column_names = metadata.get('column_names', [])
        if not column_names:
            return Response(
                {"error": "No columns found in the file"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build sample data from the file
        import io
        import pandas as pd
        buffer = io.BytesIO(bytes(attachment.file_data))
        name = attachment.file_name.lower()
        if name.endswith('.csv'):
            df = pd.read_csv(buffer, nrows=5)
        else:
            df = pd.read_excel(buffer, nrows=5)
        sample_data = df.where(df.notna(), None).to_dict('records')

        # Import pipeline components
        from .import_pipeline.column_mapper import OllamaColumnMapper
        from .import_pipeline.registry import import_registry
        from .import_pipeline import creators  # noqa: F401

        mapper = OllamaColumnMapper()

        # Auto-detect entity type if not provided
        if not entity_type:
            entity_type = mapper.detect_entity_type(column_names, sample_data)

        # Validate entity type is supported
        if entity_type not in import_registry.supported_types():
            return Response(
                {"error": f"Unsupported entity type: {entity_type}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        target_schema = import_registry.get_target_schema(entity_type)
        column_mapping = mapper.map_columns(
            column_names, sample_data, target_schema, entity_type,
        )

        session = ImportSession.objects.create(
            user=request.user,
            conversation=attachment.conversation,
            attachment=attachment,
            entity_type=entity_type,
            status=ImportSession.Status.MAPPED,
            column_mapping=column_mapping,
            total_rows=metadata.get('rows', 0),
        )

        return Response({
            'session_id': str(session.id),
            'entity_type': entity_type,
            'column_mapping': column_mapping,
            'target_schema': target_schema,
            'source_columns': column_names,
            'sample_data': sample_data[:3],
            'total_rows': session.total_rows,
        }, status=status.HTTP_201_CREATED)


class ImportPreviewView(APIView):
    """Generate dry-run preview with validation and upsert detection."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ImportPreviewRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_id = serializer.validated_data['session_id']
        confirmed_mapping = serializer.validated_data.get('confirmed_mapping')
        import_params = serializer.validated_data.get('import_params')

        try:
            session = ImportSession.objects.get(
                id=session_id,
                user=request.user,
            )
        except ImportSession.DoesNotExist:
            return Response(
                {"error": "Import session not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.status not in (
            ImportSession.Status.MAPPED,
            ImportSession.Status.PREVIEWED,
        ):
            return Response(
                {"error": f"Session status must be MAPPED or PREVIEWED, got {session.status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if confirmed_mapping:
            session.confirmed_mapping = confirmed_mapping
        if import_params:
            session.import_params = import_params
        session.save(update_fields=['confirmed_mapping', 'import_params', 'updated_at'])

        from .import_pipeline.preview_generator import ImportPreviewGenerator
        from .import_pipeline.registry import import_registry
        from .import_pipeline import creators  # noqa: F401

        generator = ImportPreviewGenerator()
        summary = generator.generate(session, import_registry)

        return Response({
            'session_id': str(session.id),
            'status': session.status,
            'summary': summary,
        })


class ImportConfirmView(APIView):
    """Confirm the import and dispatch the Celery task."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ImportConfirmRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_id = serializer.validated_data['session_id']

        try:
            session = ImportSession.objects.get(
                id=session_id,
                user=request.user,
            )
        except ImportSession.DoesNotExist:
            return Response(
                {"error": "Import session not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if session.status != ImportSession.Status.PREVIEWED:
            return Response(
                {"error": f"Session must be PREVIEWED before confirming, got {session.status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.status = ImportSession.Status.CONFIRMED
        session.progress_key = f'import_progress_{session.id}'
        session.save(update_fields=['status', 'progress_key', 'updated_at'])

        from .tasks import execute_import
        task = execute_import.delay(str(session.id), str(request.user.id))

        session.celery_task_id = task.id
        session.save(update_fields=['celery_task_id', 'updated_at'])

        return Response({
            'session_id': str(session.id),
            'status': session.status,
            'task_id': task.id,
            'progress_key': session.progress_key,
        })


class ImportProgressView(APIView):
    """Poll execution progress from Redis."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            session = ImportSession.objects.get(id=pk, user=request.user)
        except ImportSession.DoesNotExist:
            return Response(
                {"error": "Import session not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        progress = None
        if session.progress_key:
            progress = cache.get(session.progress_key)

        return Response({
            'session_id': str(session.id),
            'status': session.status,
            'progress': progress,
            'rows_created': session.rows_created,
            'rows_updated': session.rows_updated,
            'rows_errored': session.rows_errored,
        })


class ImportSessionDetailView(APIView):
    """Full session detail with preview rows and results."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            session = ImportSession.objects.get(id=pk, user=request.user)
        except ImportSession.DoesNotExist:
            return Response(
                {"error": "Import session not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ImportSessionSerializer(session)
        return Response(serializer.data)


class ImportEntityTypesView(APIView):
    """List supported import entity types."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .import_pipeline.registry import import_registry
        from .import_pipeline import creators  # noqa: F401

        types = []
        for entity_type in import_registry.supported_types():
            creator = import_registry.get_creator(entity_type)
            types.append({
                'type': entity_type,
                'label': entity_type.replace('_', ' ').title(),
                'schema': creator.get_target_schema(),
            })

        return Response({'entity_types': types})
