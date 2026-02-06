"""
Admin configuration for imports app.
"""

from django.contrib import admin
from .models import ImportJob, ImportTemplate, ImportLog, MultiFileImportBatch


@admin.register(MultiFileImportBatch)
class MultiFileImportBatchAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'name', 'status', 'file_count', 'files_completed', 'files_failed',
        'total_rows', 'success_count', 'error_count', 'created_at'
    ]
    list_filter = ['status', 'created_at']
    search_fields = ['id', 'name', 'instructions']
    readonly_fields = [
        'id', 'analysis_results', 'processing_order', 'file_count',
        'total_rows', 'processed_rows', 'success_count', 'error_count',
        'files_completed', 'files_failed', 'started_at', 'completed_at',
        'created_at', 'updated_at'
    ]
    date_hierarchy = 'created_at'
    ordering = ['-created_at']


@admin.register(ImportJob)
class ImportJobAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'original_filename', 'target_model', 'detected_model',
        'detection_confidence', 'status', 'total_rows', 'success_count',
        'error_count', 'batch', 'created_at'
    ]
    list_filter = ['status', 'target_model', 'file_type', 'batch', 'created_at']
    search_fields = ['id', 'original_filename', 'detected_model']
    readonly_fields = [
        'id', 'headers', 'sample_data', 'column_mapping', 'mapping_confidence',
        'errors', 'validation_errors', 'detected_model', 'detection_confidence',
        'processing_order', 'started_at', 'completed_at', 'created_at', 'updated_at'
    ]
    raw_id_fields = ['batch']
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
