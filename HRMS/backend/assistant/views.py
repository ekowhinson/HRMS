import json
from django.http import StreamingHttpResponse
from django.db.models import Count, Max
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Conversation, Message
from .serializers import (
    ChatRequestSerializer,
    ConversationListSerializer,
    ConversationDetailSerializer,
)
from .services import OllamaService


class ChatView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user_message = serializer.validated_data['message']
        conversation_id = serializer.validated_data.get('conversation_id')

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
        Message.objects.create(
            conversation=conversation,
            role=Message.Role.USER,
            content=user_message,
        )

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
            for line in service.chat_stream(history, user_message):
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
