"""
Serializers for the Company Policy module.
"""

import base64
from rest_framework import serializers
from .models import PolicyCategory, Policy, PolicyVersion, PolicyAcknowledgement, PolicyNotification


class PolicyCategorySerializer(serializers.ModelSerializer):
    """Serializer for policy categories."""
    policy_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = PolicyCategory
        fields = [
            'id', 'name', 'code', 'description', 'icon',
            'sort_order', 'is_active', 'policy_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PolicyVersionSerializer(serializers.ModelSerializer):
    """Serializer for policy version history."""
    versioned_by_name = serializers.CharField(
        source='versioned_by.get_full_name',
        read_only=True
    )

    class Meta:
        model = PolicyVersion
        fields = [
            'id', 'version', 'title', 'content', 'version_notes',
            'effective_date', 'versioned_at', 'versioned_by', 'versioned_by_name'
        ]
        read_only_fields = ['id', 'versioned_at', 'versioned_by']


class PolicyListSerializer(serializers.ModelSerializer):
    """List serializer for policies (summary view)."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_policy_type_display', read_only=True)
    acknowledgement_count = serializers.IntegerField(read_only=True)
    pending_acknowledgement_count = serializers.IntegerField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    has_attachment = serializers.SerializerMethodField()

    class Meta:
        model = Policy
        fields = [
            'id', 'title', 'code', 'category', 'category_name',
            'policy_type', 'type_display', 'summary', 'version',
            'status', 'status_display', 'effective_date', 'review_date',
            'expiry_date', 'published_at', 'requires_acknowledgement',
            'acknowledgement_count', 'pending_acknowledgement_count',
            'is_active', 'has_attachment', 'created_at', 'updated_at'
        ]

    def get_has_attachment(self, obj):
        return bool(obj.attachment)


class PolicyDetailSerializer(serializers.ModelSerializer):
    """Detail serializer for policies (full view)."""
    category_name = serializers.CharField(source='category.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_policy_type_display', read_only=True)
    published_by_name = serializers.CharField(
        source='published_by.get_full_name',
        read_only=True,
        allow_null=True
    )
    approved_by_name = serializers.CharField(
        source='approved_by.get_full_name',
        read_only=True,
        allow_null=True
    )
    acknowledgement_count = serializers.IntegerField(read_only=True)
    pending_acknowledgement_count = serializers.IntegerField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    versions = PolicyVersionSerializer(many=True, read_only=True)
    has_attachment = serializers.SerializerMethodField()
    user_acknowledged = serializers.SerializerMethodField()

    class Meta:
        model = Policy
        fields = [
            'id', 'title', 'code', 'category', 'category_name',
            'policy_type', 'type_display', 'summary', 'content',
            'version', 'version_notes', 'status', 'status_display',
            'effective_date', 'review_date', 'expiry_date',
            'published_at', 'published_by', 'published_by_name',
            'approved_at', 'approved_by', 'approved_by_name',
            'requires_acknowledgement', 'acknowledgement_deadline_days',
            'applies_to_all', 'target_departments', 'target_divisions',
            'acknowledgement_count', 'pending_acknowledgement_count',
            'is_active', 'has_attachment', 'attachment_name', 'attachment_type',
            'attachment_size', 'versions', 'user_acknowledged',
            'created_at', 'updated_at'
        ]

    def get_has_attachment(self, obj):
        return bool(obj.attachment)

    def get_user_acknowledged(self, obj):
        """Check if current user has acknowledged this policy."""
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            employee = getattr(request.user, 'employee', None)
            if employee:
                return obj.acknowledgements.filter(employee=employee).exists()
        return False


class PolicyCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating policies."""
    attachment_data = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = Policy
        fields = [
            'id', 'title', 'code', 'category', 'policy_type',
            'summary', 'content', 'version', 'version_notes',
            'status', 'effective_date', 'review_date', 'expiry_date',
            'requires_acknowledgement', 'acknowledgement_deadline_days',
            'applies_to_all', 'target_departments', 'target_divisions',
            'attachment_data', 'attachment_name', 'attachment_type'
        ]

    def validate_code(self, value):
        """Ensure code is uppercase."""
        return value.upper()

    def create(self, validated_data):
        attachment_data = validated_data.pop('attachment_data', None)
        target_departments = validated_data.pop('target_departments', [])
        target_divisions = validated_data.pop('target_divisions', [])

        # Set created_by from request
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['created_by'] = request.user

        policy = Policy.objects.create(**validated_data)

        # Set M2M relationships
        if target_departments:
            policy.target_departments.set(target_departments)
        if target_divisions:
            policy.target_divisions.set(target_divisions)

        # Handle attachment
        if attachment_data:
            policy.attachment = base64.b64decode(attachment_data)
            policy.attachment_size = len(policy.attachment)
            policy.save()

        return policy

    def update(self, instance, validated_data):
        attachment_data = validated_data.pop('attachment_data', None)
        target_departments = validated_data.pop('target_departments', None)
        target_divisions = validated_data.pop('target_divisions', None)

        # Create version snapshot if published and content changed
        if instance.status == Policy.Status.PUBLISHED:
            content_changed = (
                validated_data.get('content') != instance.content or
                validated_data.get('title') != instance.title
            )
            if content_changed:
                request = self.context.get('request')
                PolicyVersion.objects.create(
                    policy=instance,
                    version=instance.version,
                    title=instance.title,
                    content=instance.content,
                    version_notes=instance.version_notes,
                    effective_date=instance.effective_date,
                    versioned_by=request.user if request else None
                )

        # Set updated_by from request
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['updated_by'] = request.user

        # Update fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        # Handle attachment
        if attachment_data:
            instance.attachment = base64.b64decode(attachment_data)
            instance.attachment_size = len(instance.attachment)
        elif attachment_data == '':
            instance.attachment = None
            instance.attachment_name = ''
            instance.attachment_type = ''
            instance.attachment_size = None

        instance.save()

        # Update M2M relationships
        if target_departments is not None:
            instance.target_departments.set(target_departments)
        if target_divisions is not None:
            instance.target_divisions.set(target_divisions)

        return instance


class PolicyAcknowledgementSerializer(serializers.ModelSerializer):
    """Serializer for policy acknowledgements."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    policy_code = serializers.CharField(source='policy.code', read_only=True)
    policy_title = serializers.CharField(source='policy.title', read_only=True)

    class Meta:
        model = PolicyAcknowledgement
        fields = [
            'id', 'policy', 'policy_code', 'policy_title',
            'employee', 'employee_name', 'employee_number',
            'acknowledged_at', 'acknowledged_version',
            'ip_address', 'comments', 'created_at'
        ]
        read_only_fields = [
            'id', 'acknowledged_at', 'acknowledged_version',
            'ip_address', 'created_at'
        ]


class AcknowledgePolicySerializer(serializers.Serializer):
    """Serializer for acknowledging a policy."""
    comments = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        request = self.context.get('request')
        policy = self.context.get('policy')
        employee = request.user.employee

        # Get client IP
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip_address = x_forwarded_for.split(',')[0]
        else:
            ip_address = request.META.get('REMOTE_ADDR')

        acknowledgement = PolicyAcknowledgement.objects.create(
            policy=policy,
            employee=employee,
            acknowledged_version=policy.version,
            ip_address=ip_address,
            user_agent=request.META.get('HTTP_USER_AGENT', ''),
            comments=validated_data.get('comments', ''),
            created_by=request.user
        )

        return acknowledgement


class PolicyNotificationSerializer(serializers.ModelSerializer):
    """Serializer for policy notifications."""
    policy_code = serializers.CharField(source='policy.code', read_only=True)
    policy_title = serializers.CharField(source='policy.title', read_only=True)
    type_display = serializers.CharField(source='get_notification_type_display', read_only=True)

    class Meta:
        model = PolicyNotification
        fields = [
            'id', 'policy', 'policy_code', 'policy_title',
            'notification_type', 'type_display', 'sent_at',
            'sent_via', 'is_read', 'read_at'
        ]
        read_only_fields = ['id', 'sent_at']


class PolicyStatsSerializer(serializers.Serializer):
    """Serializer for policy statistics."""
    total_policies = serializers.IntegerField()
    published_policies = serializers.IntegerField()
    draft_policies = serializers.IntegerField()
    total_acknowledgements = serializers.IntegerField()
    pending_acknowledgements = serializers.IntegerField()
    overdue_acknowledgements = serializers.IntegerField()
    policies_by_category = serializers.ListField()
    policies_by_type = serializers.ListField()
