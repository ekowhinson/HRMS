"""
Serializers for import functionality.
"""

from rest_framework import serializers

from .models import ImportJob, ImportTemplate, ImportLog


class ImportJobListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for import job lists."""
    progress = serializers.ReadOnlyField(source='progress_percentage')
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = ImportJob
        fields = [
            'id', 'original_filename', 'file_type', 'target_model',
            'status', 'total_rows', 'processed_rows', 'success_count',
            'error_count', 'skip_count', 'progress',
            'created_at', 'completed_at', 'created_by_name'
        ]


class ImportJobSerializer(serializers.ModelSerializer):
    """Full serializer for import job detail."""
    progress = serializers.ReadOnlyField(source='progress_percentage')
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = ImportJob
        fields = [
            'id', 'original_filename', 'file_type', 'target_model',
            'instructions', 'column_mapping', 'mapping_confidence',
            'headers', 'sample_data', 'status',
            'total_rows', 'processed_rows', 'success_count',
            'error_count', 'skip_count', 'errors', 'validation_errors',
            'progress', 'started_at', 'completed_at',
            'template', 'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = [
            'id', 'status', 'total_rows', 'processed_rows',
            'success_count', 'error_count', 'skip_count',
            'errors', 'validation_errors', 'progress',
            'started_at', 'completed_at', 'created_at', 'created_by'
        ]


class ImportUploadSerializer(serializers.Serializer):
    """Serializer for file upload."""
    file = serializers.FileField()
    target_model = serializers.ChoiceField(choices=ImportJob.TargetModel.choices)
    instructions = serializers.CharField(required=False, allow_blank=True)
    template_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_file(self, value):
        """Validate uploaded file."""
        # Check file size (10MB max)
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError(
                f"File size ({value.size / 1024 / 1024:.1f}MB) exceeds maximum allowed (10MB)"
            )

        # Check file extension
        filename = value.name.lower()
        allowed_extensions = ['.csv', '.xlsx', '.xls', '.txt', '.pdf']
        if not any(filename.endswith(ext) for ext in allowed_extensions):
            raise serializers.ValidationError(
                f"File type not supported. Allowed types: {', '.join(allowed_extensions)}"
            )

        return value


class ConfirmMappingSerializer(serializers.Serializer):
    """Serializer for confirming column mapping."""
    column_mapping = serializers.DictField(
        child=serializers.CharField(),
        help_text="Maps source columns to target fields"
    )

    def validate_column_mapping(self, value):
        """Validate mapping structure."""
        if not value:
            raise serializers.ValidationError("Column mapping cannot be empty")

        # Check for duplicate target fields
        targets = list(value.values())
        if len(targets) != len(set(targets)):
            raise serializers.ValidationError(
                "Multiple columns cannot map to the same target field"
            )

        return value


class ImportTemplateSerializer(serializers.ModelSerializer):
    """Serializer for import templates."""
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = ImportTemplate
        fields = [
            'id', 'name', 'description', 'target_model',
            'column_mapping', 'default_values', 'transformation_rules',
            'is_public', 'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = ['id', 'created_at', 'created_by']


class ImportLogSerializer(serializers.ModelSerializer):
    """Serializer for import logs."""

    class Meta:
        model = ImportLog
        fields = [
            'id', 'level', 'message', 'row_number',
            'field_name', 'original_value', 'processed_value',
            'extra_data', 'created_at'
        ]


class FieldDefinitionSerializer(serializers.Serializer):
    """Serializer for field definitions."""
    name = serializers.CharField()
    type = serializers.CharField()
    required = serializers.BooleanField()
    aliases = serializers.ListField(child=serializers.CharField())
    lookup_model = serializers.CharField(allow_null=True)


class MappingResultSerializer(serializers.Serializer):
    """Serializer for mapping results."""
    source_column = serializers.CharField()
    target_field = serializers.CharField()
    confidence = serializers.FloatField()
    reason = serializers.CharField()


class ValidationResultSerializer(serializers.Serializer):
    """Serializer for validation results."""
    is_valid = serializers.BooleanField()
    errors = serializers.ListField(child=serializers.CharField())
    warnings = serializers.ListField(child=serializers.CharField())
    sample_transformations = serializers.ListField(child=serializers.DictField())


class ImportProgressSerializer(serializers.Serializer):
    """Serializer for import progress."""
    processed = serializers.IntegerField()
    total = serializers.IntegerField()
    percentage = serializers.FloatField()
    success_count = serializers.IntegerField()
    error_count = serializers.IntegerField()
    status = serializers.CharField()
    errors = serializers.ListField(child=serializers.DictField())
