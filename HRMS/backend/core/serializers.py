"""
Core app serializers.
"""

from rest_framework import serializers
from django.utils import timezone

from .models import (
    Region, District, Notification, AuditLog,
    Announcement, AnnouncementTarget, AnnouncementRead, AnnouncementAttachment,
    Attachment
)


# ============================================
# Document Handling Mixins
# ============================================

class DocumentSerializerMixin:
    """
    Mixin for serializers that handle document upload/download.
    Provides standardized file upload and base64 download.

    Use this mixin with models that inherit from BinaryFileMixin.
    Add 'file', 'file_url', 'file_info' to your serializer's fields.
    """
    file = serializers.FileField(write_only=True, required=False)
    file_url = serializers.SerializerMethodField()
    file_info = serializers.SerializerMethodField()

    def get_file_url(self, obj):
        """Return file as data URI for embedding/download."""
        if hasattr(obj, 'has_file') and obj.has_file:
            return obj.get_file_data_uri()
        return None

    def get_file_info(self, obj):
        """Return file metadata."""
        if hasattr(obj, 'has_file') and obj.has_file:
            return {
                'name': obj.file_name,
                'size': obj.file_size,
                'type': obj.mime_type,
                'checksum': obj.file_checksum,
                'is_image': obj.is_image,
                'is_pdf': obj.is_pdf,
                'is_document': obj.is_document,
            }
        return None

    def handle_file_upload(self, instance, file_obj):
        """Handle file upload for create/update operations."""
        if file_obj:
            instance.set_file(file_obj)
            instance.save()
        return instance


class DocumentListSerializerMixin:
    """
    Lightweight mixin for document lists (excludes file_url to reduce payload).
    Use this for list views where you don't need the actual file content.
    """
    file_info = serializers.SerializerMethodField()

    def get_file_info(self, obj):
        """Return file metadata."""
        if hasattr(obj, 'has_file') and obj.has_file:
            return {
                'name': obj.file_name,
                'size': obj.file_size,
                'type': obj.mime_type,
                'is_image': obj.is_image,
                'is_pdf': obj.is_pdf,
            }
        return None


# ============================================
# Attachment Serializers
# ============================================

class AttachmentSerializer(DocumentSerializerMixin, serializers.ModelSerializer):
    """
    Full serializer for generic Attachment model.
    Supports file upload and base64 download.
    """
    class Meta:
        model = Attachment
        fields = [
            'id', 'attachment_type', 'description',
            'content_type_name', 'object_id',
            'file', 'file_url', 'file_info',
            'file_name', 'file_size', 'mime_type',
            'created_at', 'created_by'
        ]
        read_only_fields = ['id', 'file_name', 'file_size', 'mime_type', 'created_at', 'created_by']

    def create(self, validated_data):
        file_obj = validated_data.pop('file', None)
        # Set created_by from request
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user
        instance = super().create(validated_data)
        self.handle_file_upload(instance, file_obj)
        return instance

    def update(self, validated_data):
        file_obj = validated_data.pop('file', None)
        instance = super().update(instance, validated_data)
        if file_obj:
            self.handle_file_upload(instance, file_obj)
        return instance


class AttachmentListSerializer(DocumentListSerializerMixin, serializers.ModelSerializer):
    """
    Lightweight serializer for attachment lists.
    Excludes file content to reduce payload size.
    """
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)

    class Meta:
        model = Attachment
        fields = [
            'id', 'attachment_type', 'description',
            'content_type_name', 'object_id',
            'file_info', 'file_name', 'file_size', 'mime_type',
            'created_at', 'created_by_name'
        ]


class RegionSerializer(serializers.ModelSerializer):
    """Serializer for Region model."""

    class Meta:
        model = Region
        fields = ['id', 'code', 'name', 'capital', 'is_active']


class DistrictSerializer(serializers.ModelSerializer):
    """Serializer for District model."""
    region_name = serializers.CharField(source='region.name', read_only=True)

    class Meta:
        model = District
        fields = ['id', 'code', 'name', 'region', 'region_name', 'is_active']


class NotificationSerializer(serializers.ModelSerializer):
    """Serializer for Notification model."""

    class Meta:
        model = Notification
        fields = [
            'id', 'title', 'message', 'notification_type',
            'is_read', 'read_at', 'link', 'extra_data', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for AuditLog model."""
    user_name = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user', 'user_name', 'action', 'model_name',
            'object_id', 'object_repr', 'changes', 'ip_address',
            'user_agent', 'created_at'
        ]


# ============================================
# Announcement Serializers
# ============================================

class AnnouncementAttachmentSerializer(serializers.ModelSerializer):
    """Serializer for Announcement attachments."""
    file = serializers.FileField(write_only=True, required=False)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = AnnouncementAttachment
        fields = [
            'id', 'announcement', 'file', 'file_url',
            'file_name', 'mime_type', 'file_size', 'description', 'created_at'
        ]
        read_only_fields = ['id', 'file_name', 'mime_type', 'file_size', 'created_at']

    def get_file_url(self, obj):
        if obj.has_file:
            return obj.get_file_data_uri()
        return None

    def create(self, validated_data):
        file_obj = validated_data.pop('file', None)
        instance = super().create(validated_data)
        if file_obj:
            instance.set_file(file_obj)
            instance.save()
        return instance


class AnnouncementTargetSerializer(serializers.ModelSerializer):
    """Serializer for Announcement targeting rules."""
    department_name = serializers.CharField(source='department.name', read_only=True, allow_null=True)
    grade_name = serializers.CharField(source='grade.name', read_only=True, allow_null=True)
    location_name = serializers.CharField(source='work_location.name', read_only=True, allow_null=True)

    class Meta:
        model = AnnouncementTarget
        fields = [
            'id', 'announcement', 'department', 'department_name',
            'grade', 'grade_name', 'work_location', 'location_name',
            'employment_type'
        ]


class AnnouncementReadSerializer(serializers.ModelSerializer):
    """Serializer for tracking announcement reads."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)

    class Meta:
        model = AnnouncementRead
        fields = [
            'id', 'announcement', 'employee', 'employee_name', 'employee_number',
            'read_at', 'acknowledged', 'acknowledged_at'
        ]
        read_only_fields = ['id', 'read_at', 'acknowledged_at']


class AnnouncementListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for announcement lists."""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    banner_url = serializers.SerializerMethodField()
    read_count = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'slug', 'summary', 'category', 'priority', 'status',
            'is_company_wide', 'publish_date', 'expiry_date',
            'published_at', 'pin_to_top', 'show_on_dashboard',
            'banner_url', 'requires_acknowledgement',
            'read_count', 'is_read',
            'created_by_name', 'created_at'
        ]

    def get_banner_url(self, obj):
        if obj.has_banner:
            return obj.get_banner_data_uri()
        return None

    def get_read_count(self, obj):
        return obj.reads.count()

    def get_is_read(self, obj):
        request = self.context.get('request')
        if request and hasattr(request.user, 'employee'):
            return obj.reads.filter(employee=request.user.employee).exists()
        return False


class AnnouncementSerializer(serializers.ModelSerializer):
    """Full serializer for announcement detail."""
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True, allow_null=True)
    published_by_name = serializers.CharField(source='published_by.get_full_name', read_only=True, allow_null=True)
    banner_url = serializers.SerializerMethodField()
    targets = AnnouncementTargetSerializer(many=True, read_only=True)
    attachments = AnnouncementAttachmentSerializer(many=True, read_only=True)
    read_stats = serializers.SerializerMethodField()
    is_read = serializers.SerializerMethodField()
    is_acknowledged = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'slug', 'content', 'summary',
            'category', 'priority', 'status',
            'is_company_wide', 'publish_date', 'expiry_date',
            'requires_acknowledgement', 'allow_comments',
            'published_at', 'published_by', 'published_by_name',
            'pin_to_top', 'show_on_dashboard',
            'banner_url', 'targets', 'attachments',
            'read_stats', 'is_read', 'is_acknowledged',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'slug', 'published_at', 'published_by', 'created_at', 'updated_at'
        ]

    def get_banner_url(self, obj):
        if obj.has_banner:
            return obj.get_banner_data_uri()
        return None

    def get_read_stats(self, obj):
        total_reads = obj.reads.count()
        acknowledged = obj.reads.filter(acknowledged=True).count()
        target_count = obj.get_target_employees().count() if obj.pk else 0
        return {
            'total_read': total_reads,
            'acknowledged': acknowledged,
            'target_count': target_count,
            'read_percentage': round((total_reads / target_count * 100), 1) if target_count > 0 else 0
        }

    def get_is_read(self, obj):
        request = self.context.get('request')
        if request and hasattr(request.user, 'employee'):
            return obj.reads.filter(employee=request.user.employee).exists()
        return False

    def get_is_acknowledged(self, obj):
        request = self.context.get('request')
        if request and hasattr(request.user, 'employee'):
            return obj.reads.filter(employee=request.user.employee, acknowledged=True).exists()
        return False


class AnnouncementCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating announcements."""
    banner = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'content', 'summary',
            'category', 'priority', 'is_company_wide',
            'publish_date', 'expiry_date',
            'requires_acknowledgement', 'allow_comments',
            'pin_to_top', 'show_on_dashboard', 'banner'
        ]
        read_only_fields = ['id']

    def create(self, validated_data):
        banner_file = validated_data.pop('banner', None)
        instance = super().create(validated_data)
        if banner_file:
            instance.set_banner(banner_file)
            instance.save()
        return instance

    def update(self, instance, validated_data):
        banner_file = validated_data.pop('banner', None)
        instance = super().update(instance, validated_data)
        if banner_file:
            instance.set_banner(banner_file)
            instance.save()
        return instance


class DashboardAnnouncementSerializer(serializers.ModelSerializer):
    """Compact serializer for dashboard widget."""
    banner_url = serializers.SerializerMethodField()

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'slug', 'summary', 'category', 'priority',
            'banner_url', 'published_at', 'requires_acknowledgement'
        ]

    def get_banner_url(self, obj):
        if obj.has_banner:
            return obj.get_banner_data_uri()
        return None
