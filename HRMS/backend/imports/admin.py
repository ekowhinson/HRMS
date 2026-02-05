"""
Admin configuration for imports app.
"""

from django.contrib import admin
from .models import ImportJob, ImportTemplate, ImportLog


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'original_filename', 'target_model', 'status',
        'total_rows', 'success_count', 'error_count', 'created_at'
    ]
    list_filter = ['status', 'target_model', 'file_type', 'created_at']
    search_fields = ['id', 'original_filename']
    readonly_fields = [
        'id', 'headers', 'sample_data', 'column_mapping', 'mapping_confidence',
        'errors', 'validation_errors', 'started_at', 'completed_at',
        'created_at', 'updated_at'
    ]
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


@admin.register(ImportTemplate)
class ImportTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'target_model', 'is_public', 'created_by', 'created_at']
    list_filter = ['target_model', 'is_public', 'created_at']
    search_fields = ['name', 'description']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(ImportLog)
class ImportLogAdmin(admin.ModelAdmin):
    list_display = ['import_job', 'level', 'row_number', 'message', 'created_at']
    list_filter = ['level', 'created_at']
    search_fields = ['message']
    readonly_fields = ['id', 'created_at']
    raw_id_fields = ['import_job']
