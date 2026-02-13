import json
import logging
from django.http import StreamingHttpResponse
from django.db.models import Count, Max
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser

from .models import Conversation, Message, MessageAttachment, PromptTemplate
from .serializers import (
    AttachmentSerializer,
    ChatRequestSerializer,
    ConversationListSerializer,
    ConversationDetailSerializer,
    PromptTemplateSerializer,
)
from .services import OllamaService
from .file_processor import FileProcessor

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

        # Get or create conversation
        if conversation_id:
            try:
                conversation = Conversation.objects.get(id=conversation_id, user=request.user)
            except Conversation.DoesNotExist:
                return Response(
                    {"error": "Conversation not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )
        else:
            # Auto-generate title from first message
            title = user_message[:80] + ('...' if len(user_message) > 80 else '')
            conversation = Conversation.objects.create(user=request.user, title=title)

        # Save user message
        user_msg = Message.objects.create(
            conversation=conversation,
            role=Message.Role.USER,
            content=user_message,
        )

        # Link attachments to this message
        attachments = []
        if attachment_ids:
            attachments = list(
                MessageAttachment.objects.filter(
                    id__in=attachment_ids,
                    conversation=conversation,
                    uploaded_by=request.user,
                )
            )
            MessageAttachment.objects.filter(
                id__in=[a.id for a in attachments]
            ).update(message=user_msg)

        # Build history from last 20 messages
        history_qs = conversation.messages.order_by('-created_at')[:20]
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in reversed(list(history_qs))
        ]
        # Remove the user message we just added (it's passed separately)
        if history and history[-1]["role"] == "user":
            history = history[:-1]

        service = OllamaService()

        def event_stream():
            # Send conversation metadata first
            yield json.dumps({
                "type": "meta",
                "conversation_id": str(conversation.id),
            }) + "\n"

            full_response = []

            # Choose streaming method based on attachments
            if attachments:
                stream_gen = service.chat_stream_with_files(history, user_message, attachments)
            else:
                stream_gen = service.chat_stream(history, user_message)

            for line in stream_gen:
                yield line
                try:
                    data = json.loads(line.strip())
                    if data.get("type") == "token":
                        full_response.append(data.get("content", ""))
                except (json.JSONDecodeError, KeyError):
                    pass

            # Save the full assistant response
            if full_response:
                Message.objects.create(
                    conversation=conversation,
                    role=Message.Role.ASSISTANT,
                    content="".join(full_response),
                )
                # Update conversation timestamp
                conversation.save(update_fields=['updated_at'])

        response = StreamingHttpResponse(
            event_stream(),
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
        service = OllamaService()
        health = service.check_health()
        http_status = status.HTTP_200_OK if health["status"] == "ok" else status.HTTP_503_SERVICE_UNAVAILABLE
        return Response(health, status=http_status)
