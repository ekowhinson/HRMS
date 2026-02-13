from django.contrib import admin
from .models import Conversation, Message, MessageAttachment, PromptTemplate


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display = ['title', 'user', 'is_archived', 'created_at', 'updated_at']
    list_filter = ['is_archived', 'created_at']
    search_fields = ['title', 'user__username', 'user__email']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['short_content', 'role', 'conversation', 'created_at']
    list_filter = ['role', 'created_at']
    search_fields = ['content']
    readonly_fields = ['id', 'created_at']

    def short_content(self, obj):
        return obj.content[:80]
    short_content.short_description = 'Content'


@admin.register(MessageAttachment)
class MessageAttachmentAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'file_type', 'file_size', 'uploaded_by', 'conversation', 'created_at']
    list_filter = ['file_type', 'created_at']
    search_fields = ['file_name']
    readonly_fields = ['id', 'created_at', 'parsed_summary', 'parsed_metadata']


@admin.register(PromptTemplate)
class PromptTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'requires_file', 'sort_order', 'is_active']
    list_filter = ['category', 'is_active', 'requires_file']
    search_fields = ['name', 'description']
    readonly_fields = ['id']
