"""
Serializers for import functionality.
"""

from rest_framework import serializers

from .models import ImportJob, ImportTemplate, ImportLog, MultiFileImportBatch, Dataset, DatasetFile, JoinConfiguration


class MultiFileImportBatchListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for batch import lists."""
    progress = serializers.ReadOnlyField(source='progress_percentage')
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = MultiFileImportBatch
        fields = [
            'id', 'name', 'status', 'file_count', 'files_completed', 'files_failed',
            'total_rows', 'processed_rows', 'success_count', 'error_count',
            'progress', 'created_at', 'completed_at', 'created_by_name'
        ]


class MultiFileImportBatchSerializer(serializers.ModelSerializer):
    """Full serializer for batch import detail."""
    progress = serializers.ReadOnlyField(source='progress_percentage')
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    jobs = serializers.SerializerMethodField()

    class Meta:
        model = MultiFileImportBatch
        fields = [
            'id', 'name', 'instructions', 'status',
            'analysis_results', 'processing_order', 'file_count',
            'total_rows', 'processed_rows', 'success_count', 'error_count',
            'files_completed', 'files_failed', 'progress',
            'auto_create_dependencies', 'update_existing',
            'started_at', 'completed_at', 'created_at', 'created_by', 'created_by_name',
            'jobs'
        ]
        read_only_fields = [
            'id', 'status', 'analysis_results', 'processing_order',
            'file_count', 'total_rows', 'processed_rows',
            'success_count', 'error_count', 'files_completed', 'files_failed',
            'progress', 'started_at', 'completed_at', 'created_at', 'created_by'
        ]

    def get_jobs(self, obj):
        jobs = obj.jobs.order_by('processing_order')
        return [{
            'id': str(job.id),
            'filename': job.original_filename,
            'detected_model': job.detected_model,
            'detection_confidence': job.detection_confidence,
            'target_model': job.target_model,
            'column_mapping': job.column_mapping,
            'mapping_confidence': job.mapping_confidence,
            'headers': job.headers,
            'sample_data': job.sample_data[:5],
            'status': job.status,
            'total_rows': job.total_rows,
            'success_count': job.success_count,
            'error_count': job.error_count,
            'processing_order': job.processing_order,
        } for job in jobs]


class MultiFileUploadSerializer(serializers.Serializer):
    """Serializer for multi-file upload."""
    files = serializers.ListField(
        child=serializers.FileField(),
        min_length=1,
        max_length=20,
        help_text="List of files to import (max 20)"
    )
    name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=200,
        help_text="Optional name for the batch"
    )
    instructions = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Optional instructions for mapping"
    )
    auto_create_dependencies = serializers.BooleanField(
        default=True,
        help_text="Automatically create missing setup records"
    )
    update_existing = serializers.BooleanField(
        default=True,
        help_text="Update existing records if found"
    )

    def validate_files(self, value):
        """Validate uploaded files."""
        max_size = 10 * 1024 * 1024  # 10MB per file
        allowed_extensions = ['.csv', '.xlsx', '.xls', '.txt']

        for file_obj in value:
            # Check file size
            if file_obj.size > max_size:
                raise serializers.ValidationError(
                    f"File '{file_obj.name}' ({file_obj.size / 1024 / 1024:.1f}MB) "
                    f"exceeds maximum allowed (10MB)"
                )

            # Check file extension
            filename = file_obj.name.lower()
            if not any(filename.endswith(ext) for ext in allowed_extensions):
                raise serializers.ValidationError(
                    f"File '{file_obj.name}' type not supported. "
                    f"Allowed types: {', '.join(allowed_extensions)}"
                )

        return value


class BatchMappingOverrideSerializer(serializers.Serializer):
    """Serializer for overriding batch mappings."""
    job_id = serializers.UUIDField()
    target_model = serializers.ChoiceField(
        choices=ImportJob.TargetModel.choices,
        required=False
    )
    column_mapping = serializers.DictField(
        child=serializers.CharField(),
        required=False
    )


class BatchConfirmSerializer(serializers.Serializer):
    """Serializer for confirming and executing a batch."""
    overrides = serializers.ListField(
        child=BatchMappingOverrideSerializer(),
        required=False,
        default=list,
        help_text="Optional list of mapping overrides per job"
    )


class FileAnalysisResultSerializer(serializers.Serializer):
    """Serializer for file analysis results."""
    filename = serializers.CharField()
    detected_model = serializers.CharField()
    confidence = serializers.FloatField()
    matched_fields = serializers.DictField()
    file_category = serializers.CharField()
    dependencies = serializers.ListField(child=serializers.CharField())
    total_rows = serializers.IntegerField()
    reason = serializers.CharField()


class BatchAnalysisSerializer(serializers.Serializer):
    """Serializer for batch analysis response."""
    files = serializers.DictField(child=FileAnalysisResultSerializer())
    processing_order = serializers.ListField(child=serializers.CharField())
    warnings = serializers.ListField(child=serializers.CharField())
    errors = serializers.ListField(child=serializers.CharField())


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


# ==================== Dataset Serializers ====================

class JoinConfigurationSerializer(serializers.ModelSerializer):
    """Serializer for join configurations."""
    left_file_alias = serializers.CharField(source='left_file.alias', read_only=True)
    right_file_alias = serializers.CharField(source='right_file.alias', read_only=True)
    left_file_name = serializers.CharField(source='left_file.file_name', read_only=True)
    right_file_name = serializers.CharField(source='right_file.file_name', read_only=True)

    class Meta:
        model = JoinConfiguration
        fields = [
            'id', 'left_file', 'left_file_alias', 'left_file_name', 'left_column',
            'right_file', 'right_file_alias', 'right_file_name', 'right_column',
            'join_type', 'is_ai_suggested', 'ai_confidence', 'ai_reasoning',
            'relationship_type', 'sample_matches', 'order'
        ]
        read_only_fields = ['id', 'is_ai_suggested', 'ai_confidence', 'ai_reasoning']


class DatasetFileSerializer(serializers.ModelSerializer):
    """Serializer for dataset files."""

    class Meta:
        model = DatasetFile
        fields = [
            'id', 'file_name', 'file_type', 'headers', 'sample_data',
            'row_count', 'detected_data_types', 'detected_patterns',
            'alias', 'order', 'created_at'
        ]
        read_only_fields = [
            'id', 'file_name', 'file_type', 'headers', 'sample_data',
            'row_count', 'detected_data_types', 'detected_patterns', 'created_at'
        ]


class DatasetListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dataset lists."""
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)

    class Meta:
        model = Dataset
        fields = [
            'id', 'name', 'description', 'status', 'file_count',
            'total_source_rows', 'merged_row_count', 'created_at', 'created_by_name'
        ]


class DatasetSerializer(serializers.ModelSerializer):
    """Full serializer for dataset detail."""
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    files = DatasetFileSerializer(many=True, read_only=True)
    joins = JoinConfigurationSerializer(many=True, read_only=True)
    is_ready_for_merge = serializers.ReadOnlyField()

    class Meta:
        model = Dataset
        fields = [
            'id', 'name', 'description', 'status',
            'merged_headers', 'merged_row_count', 'merged_sample_data',
            'ai_analysis', 'file_count', 'total_source_rows',
            'error_message', 'is_ready_for_merge',
            'files', 'joins',
            'created_at', 'created_by', 'created_by_name'
        ]
        read_only_fields = [
            'id', 'status', 'merged_headers', 'merged_row_count',
            'merged_sample_data', 'ai_analysis', 'file_count',
            'total_source_rows', 'error_message', 'created_at', 'created_by'
        ]


class DatasetUploadSerializer(serializers.Serializer):
    """Serializer for dataset file upload."""
    files = serializers.ListField(
        child=serializers.FileField(),
        min_length=1,
        max_length=10,
        help_text="List of files to analyze and merge (max 10)"
    )
    name = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=200,
        help_text="Name for the dataset"
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Optional description"
    )

    def validate_files(self, value):
        """Validate uploaded files."""
        max_size = 10 * 1024 * 1024  # 10MB per file
        allowed_extensions = ['.csv', '.xlsx', '.xls']

        for file_obj in value:
            # Check file size
            if file_obj.size > max_size:
                raise serializers.ValidationError(
                    f"File '{file_obj.name}' ({file_obj.size / 1024 / 1024:.1f}MB) "
                    f"exceeds maximum allowed (10MB)"
                )

            # Check file extension
            filename = file_obj.name.lower()
            if not any(filename.endswith(ext) for ext in allowed_extensions):
                raise serializers.ValidationError(
                    f"File '{file_obj.name}' type not supported. "
                    f"Allowed types: {', '.join(allowed_extensions)}"
                )

        return value


class JoinConfigInputSerializer(serializers.Serializer):
    """Serializer for configuring a single join."""
    left_file_id = serializers.UUIDField()
    left_column = serializers.CharField(max_length=255)
    right_file_id = serializers.UUIDField()
    right_column = serializers.CharField(max_length=255)
    join_type = serializers.ChoiceField(
        choices=['inner', 'left', 'right', 'outer'],
        default='left'
    )
    order = serializers.IntegerField(default=0)


class ConfigureJoinsSerializer(serializers.Serializer):
    """Serializer for configuring multiple joins."""
    joins = serializers.ListField(
        child=JoinConfigInputSerializer(),
        min_length=1,
        help_text="List of join configurations"
    )

    def validate_joins(self, value):
        """Validate join configurations."""
        # Check for circular references
        file_refs = set()
        for join in value:
            pair = (str(join['left_file_id']), str(join['right_file_id']))
            reverse_pair = (str(join['right_file_id']), str(join['left_file_id']))

            if pair in file_refs or reverse_pair in file_refs:
                raise serializers.ValidationError(
                    "Duplicate or circular join detected"
                )
            file_refs.add(pair)

        return value


class MergePreviewSerializer(serializers.Serializer):
    """Serializer for merge preview response."""
    success = serializers.BooleanField()
    headers = serializers.ListField(child=serializers.CharField())
    data = serializers.ListField(child=serializers.ListField())
    row_count = serializers.IntegerField()
    statistics = serializers.DictField()
    warnings = serializers.ListField(child=serializers.CharField())
    errors = serializers.ListField(child=serializers.CharField())
