"""
Core app admin configuration.
"""

from django.contrib import admin
from .models import (
    Region, District, AuditLog, Notification,
    Announcement, AnnouncementTarget, AnnouncementRead, AnnouncementAttachment,
    EmailLog, EmailPreference,
)


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'country', 'is_active']
    list_filter = ['is_active', 'country']
    search_fields = ['code', 'name']
    ordering = ['name']


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'region', 'is_active']
    list_filter = ['region', 'is_active']
    search_fields = ['code', 'name']
    ordering = ['region', 'name']


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'action', 'model_name', 'object_repr', 'timestamp']
    list_filter = ['action', 'model_name', 'timestamp']
    search_fields = ['user__username', 'model_name', 'object_repr']
    ordering = ['-timestamp']
    readonly_fields = [
        'user', 'action', 'model_name', 'object_id', 'object_repr',
        'changes', 'ip_address', 'user_agent', 'timestamp'
    ]


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'title', 'notification_type', 'is_read', 'created_at']
    list_filter = ['notification_type', 'is_read']
    search_fields = ['user__username', 'title']
    ordering = ['-created_at']


# Announcement Admin

class AnnouncementTargetInline(admin.TabularInline):
    model = AnnouncementTarget
    extra = 0
    fields = ['department', 'grade', 'work_location', 'employment_type']


class AnnouncementAttachmentInline(admin.TabularInline):
    model = AnnouncementAttachment
    extra = 0
    fields = ['file_name', 'mime_type', 'file_size', 'description']
    readonly_fields = ['file_name', 'mime_type', 'file_size']


@admin.register(Announcement)
class AnnouncementAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'category', 'priority', 'status',
        'is_company_wide', 'published_at', 'pin_to_top'
    ]
    list_filter = ['status', 'category', 'priority', 'is_company_wide', 'pin_to_top']
    search_fields = ['title', 'content', 'summary']
    ordering = ['-created_at']
    prepopulated_fields = {'slug': ('title',)}
    readonly_fields = ['published_at', 'published_by']
    inlines = [AnnouncementTargetInline, AnnouncementAttachmentInline]
    fieldsets = (
        ('Content', {
            'fields': ('title', 'slug', 'content', 'summary')
        }),
        ('Classification', {
            'fields': ('category', 'priority', 'status')
        }),
        ('Targeting', {
            'fields': ('is_company_wide',),
            'description': 'If unchecked, add targeting rules below'
        }),
        ('Scheduling', {
            'fields': ('publish_date', 'expiry_date')
        }),
        ('Options', {
            'fields': ('requires_acknowledgement', 'allow_comments', 'pin_to_top', 'show_on_dashboard')
        }),
        ('Publishing', {
            'fields': ('published_at', 'published_by'),
            'classes': ('collapse',)
        }),
    )

    actions = ['publish_announcements', 'archive_announcements']

    def publish_announcements(self, request, queryset):
        from django.utils import timezone
        count = queryset.filter(
            status__in=[Announcement.Status.DRAFT, Announcement.Status.SCHEDULED]
        ).update(
            status=Announcement.Status.PUBLISHED,
            published_at=timezone.now(),
            published_by=request.user
        )
        self.message_user(request, f'{count} announcement(s) published.')
    publish_announcements.short_description = 'Publish selected announcements'

    def archive_announcements(self, request, queryset):
        count = queryset.update(status=Announcement.Status.ARCHIVED)
        self.message_user(request, f'{count} announcement(s) archived.')
    archive_announcements.short_description = 'Archive selected announcements'


@admin.register(AnnouncementTarget)
class AnnouncementTargetAdmin(admin.ModelAdmin):
    list_display = ['announcement', 'department', 'grade', 'work_location', 'employment_type']
    list_filter = ['department', 'grade']
    search_fields = ['announcement__title']


@admin.register(AnnouncementRead)
class AnnouncementReadAdmin(admin.ModelAdmin):
    list_display = ['announcement', 'employee', 'read_at', 'acknowledged', 'acknowledged_at']
    list_filter = ['acknowledged', 'read_at']
    search_fields = ['announcement__title', 'employee__employee_number']
    ordering = ['-read_at']


@admin.register(AnnouncementAttachment)
class AnnouncementAttachmentAdmin(admin.ModelAdmin):
    list_display = ['announcement', 'file_name', 'mime_type', 'file_size', 'created_at']
    search_fields = ['file_name', 'announcement__title']


# Email Admin

@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ['recipient_email', 'event_type', 'subject', 'status', 'created_at']
    list_filter = ['status', 'event_type', 'created_at']
    search_fields = ['recipient_email', 'subject', 'event_type']
    ordering = ['-created_at']
    readonly_fields = [
        'recipient_email', 'recipient_user', 'from_email', 'subject',
        'event_type', 'template_name', 'status', 'status_detail',
        'sendgrid_message_id', 'sent_at', 'delivered_at', 'opened_at',
        'context_snapshot', 'retry_count', 'created_at',
    ]


@admin.register(EmailPreference)
class EmailPreferenceAdmin(admin.ModelAdmin):
    list_display = ['user', 'all_emails_enabled']
    search_fields = ['user__email', 'user__first_name', 'user__last_name']
