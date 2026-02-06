"""
Admin configuration for the Company Policy module.
"""

from django.contrib import admin
from django.utils.html import format_html
from .models import PolicyCategory, Policy, PolicyVersion, PolicyAcknowledgement, PolicyNotification


@admin.register(PolicyCategory)
class PolicyCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'policy_count', 'sort_order', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name', 'code', 'description']
    ordering = ['sort_order', 'name']

    def policy_count(self, obj):
        return obj.policies.filter(status='PUBLISHED').count()
    policy_count.short_description = 'Published Policies'


class PolicyVersionInline(admin.TabularInline):
    model = PolicyVersion
    extra = 0
    readonly_fields = ['version', 'title', 'versioned_at', 'versioned_by']
    can_delete = False


class PolicyAcknowledgementInline(admin.TabularInline):
    model = PolicyAcknowledgement
    extra = 0
    readonly_fields = ['employee', 'acknowledged_at', 'acknowledged_version', 'ip_address']
    can_delete = False


@admin.register(Policy)
class PolicyAdmin(admin.ModelAdmin):
    list_display = [
        'code', 'title', 'category', 'policy_type', 'status',
        'version', 'effective_date', 'acknowledgement_stats', 'created_at'
    ]
    list_filter = ['status', 'policy_type', 'category', 'requires_acknowledgement']
    search_fields = ['title', 'code', 'summary', 'content']
    readonly_fields = ['published_at', 'published_by', 'approved_at', 'approved_by']
    filter_horizontal = ['target_departments', 'target_divisions']
    date_hierarchy = 'created_at'
    ordering = ['-created_at']
    inlines = [PolicyVersionInline, PolicyAcknowledgementInline]

    fieldsets = (
        ('Basic Information', {
            'fields': ('title', 'code', 'category', 'policy_type')
        }),
        ('Content', {
            'fields': ('summary', 'content')
        }),
        ('Versioning', {
            'fields': ('version', 'version_notes')
        }),
        ('Status & Dates', {
            'fields': ('status', 'effective_date', 'review_date', 'expiry_date')
        }),
        ('Publishing', {
            'fields': ('published_at', 'published_by', 'approved_at', 'approved_by'),
            'classes': ('collapse',)
        }),
        ('Acknowledgement Settings', {
            'fields': ('requires_acknowledgement', 'acknowledgement_deadline_days')
        }),
        ('Targeting', {
            'fields': ('applies_to_all', 'target_departments', 'target_divisions'),
            'classes': ('collapse',)
        }),
        ('Attachment', {
            'fields': ('attachment_name', 'attachment_type', 'attachment_size'),
            'classes': ('collapse',)
        }),
    )

    def acknowledgement_stats(self, obj):
        ack_count = obj.acknowledgements.count()
        if obj.requires_acknowledgement:
            return format_html(
                '<span style="color: green;">{} acknowledged</span>',
                ack_count
            )
        return '-'
    acknowledgement_stats.short_description = 'Acknowledgements'


@admin.register(PolicyVersion)
class PolicyVersionAdmin(admin.ModelAdmin):
    list_display = ['policy', 'version', 'title', 'versioned_at', 'versioned_by']
    list_filter = ['versioned_at']
    search_fields = ['policy__title', 'policy__code', 'title']
    readonly_fields = ['policy', 'version', 'title', 'content', 'version_notes',
                       'effective_date', 'versioned_at', 'versioned_by']
    ordering = ['-versioned_at']


@admin.register(PolicyAcknowledgement)
class PolicyAcknowledgementAdmin(admin.ModelAdmin):
    list_display = ['policy', 'employee', 'acknowledged_version', 'acknowledged_at', 'ip_address']
    list_filter = ['acknowledged_at', 'policy__category']
    search_fields = ['policy__title', 'policy__code', 'employee__first_name', 'employee__last_name']
    readonly_fields = ['policy', 'employee', 'acknowledged_at', 'acknowledged_version',
                       'ip_address', 'user_agent', 'signature_hash']
    ordering = ['-acknowledged_at']


@admin.register(PolicyNotification)
class PolicyNotificationAdmin(admin.ModelAdmin):
    list_display = ['policy', 'employee', 'notification_type', 'sent_at', 'sent_via', 'is_read']
    list_filter = ['notification_type', 'sent_via', 'is_read', 'sent_at']
    search_fields = ['policy__title', 'employee__first_name', 'employee__last_name']
    readonly_fields = ['policy', 'employee', 'notification_type', 'sent_at', 'sent_via']
    ordering = ['-sent_at']
