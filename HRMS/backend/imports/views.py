"""
Views for data import functionality.
"""

import csv
import io
from rest_framework import viewsets, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from django.http import HttpResponse
from django.core.cache import cache
from django.utils import timezone

from .models import ImportJob, ImportTemplate, ImportLog, MultiFileImportBatch, Dataset, DatasetFile, JoinConfiguration
from .serializers import (
    ImportJobListSerializer, ImportJobSerializer, ImportUploadSerializer,
    ConfirmMappingSerializer, ImportTemplateSerializer, ImportLogSerializer,
    ImportProgressSerializer, FieldDefinitionSerializer,
    MultiFileImportBatchListSerializer, MultiFileImportBatchSerializer,
    MultiFileUploadSerializer, BatchConfirmSerializer, BatchAnalysisSerializer,
    DatasetListSerializer, DatasetSerializer, DatasetUploadSerializer,
    DatasetFileSerializer, JoinConfigurationSerializer, ConfigureJoinsSerializer,
    MergePreviewSerializer
)
from .parsers import parse_file, FileParser
from .mapper import ColumnMapper
from .processor import ImportProcessor
from .chunked_processor import ChunkedImportProcessor, ChunkedFileReader
from .orchestrator import MultiFileOrchestrator, AI_AGENTS_AVAILABLE
from .analyzer import FileAnalyzer
from .merger import DatasetMerger, MergeResult

# Thresholds for chunked processing
CHUNKED_PROCESSING_THRESHOLD = 5000  # Use chunked for files with more than 5K rows
MAX_ROWS_STANDARD = 10000  # Standard processor limit
MAX_ROWS_CHUNKED = 1000000  # Chunked processor can handle up to 1M rows


class ImportJobViewSet(viewsets.ModelViewSet):
    """ViewSet for import jobs."""
    queryset = ImportJob.objects.select_related('created_by', 'template')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return ImportJobListSerializer
        return ImportJobSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Filter by current user unless staff/superuser
        user = self.request.user
        if not (user.is_staff or user.is_superuser):
            queryset = queryset.filter(created_by=user)
        return queryset.order_by('-created_at')

    @action(detail=False, methods=['POST'], parser_classes=[MultiPartParser, FormParser])
    def upload(self, request):
        """
        Upload a file and initiate import job.
        POST /imports/upload/
        Returns job with parsed headers, sample data, and suggested mapping.
        """
        serializer = ImportUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        file_obj = serializer.validated_data['file']
        target_model = serializer.validated_data['target_model']
        instructions = serializer.validated_data.get('instructions', '')
        template_id = serializer.validated_data.get('template_id')

        # Read file content
        content = file_obj.read()
        filename = file_obj.name

        # Detect file type
        file_type = FileParser.detect_type(filename, content)

        # Parse file
        try:
            parsed = parse_file(content, filename)
        except ImportError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to parse file: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check row limit - allow up to 1M rows with chunked processing
        if parsed.total_rows > MAX_ROWS_CHUNKED:
            return Response(
                {'error': f'File has {parsed.total_rows} rows, exceeding maximum of {MAX_ROWS_CHUNKED:,}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Determine processing mode
        use_chunked = parsed.total_rows > CHUNKED_PROCESSING_THRESHOLD

        # Get template if specified
        template = None
        if template_id:
            try:
                template = ImportTemplate.objects.get(id=template_id)
            except ImportTemplate.DoesNotExist:
                pass

        # Generate column mapping
        mapper = ColumnMapper()
        mapping_results = mapper.map_columns(
            headers=parsed.headers,
            target_model=target_model,
            instructions=instructions
        )

        # Convert mapping results to dict
        column_mapping = {
            result.source_column: result.target_field
            for result in mapping_results.values()
            if result.confidence >= 0.5
        }
        mapping_confidence = {
            result.source_column: {
                'target_field': result.target_field,
                'confidence': result.confidence,
                'reason': result.reason
            }
            for result in mapping_results.values()
        }

        # Use template mapping if provided
        if template:
            column_mapping = template.column_mapping
            mapping_confidence = {}

        # Create import job
        job = ImportJob.objects.create(
            original_filename=filename,
            file_type=file_type,
            target_model=target_model,
            instructions=instructions,
            column_mapping=column_mapping,
            mapping_confidence=mapping_confidence,
            headers=parsed.headers,
            sample_data=parsed.sample_rows,
            total_rows=parsed.total_rows,
            status=ImportJob.Status.MAPPING,
            template=template,
            created_by=request.user
        )

        # Store file data
        job.set_file(content, filename)
        job.save()

        return Response(
            ImportJobSerializer(job).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['POST'])
    def confirm_mapping(self, request, pk=None):
        """
        Confirm and validate column mapping.
        POST /imports/{id}/confirm-mapping/
        Returns validation results and preview.
        """
        job = self.get_object()

        if job.status not in [ImportJob.Status.MAPPING, ImportJob.Status.PREVIEW]:
            return Response(
                {'error': 'Job is not in mapping state'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ConfirmMappingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        column_mapping = serializer.validated_data['column_mapping']

        # Validate mapping
        mapper = ColumnMapper()
        validation = mapper.validate_mapping(
            mapping=column_mapping,
            sample_data=job.sample_data,
            headers=job.headers,
            target_model=job.target_model
        )

        # Update job
        job.column_mapping = column_mapping
        job.validation_errors = validation.errors + validation.warnings
        job.status = ImportJob.Status.PREVIEW
        job.save()

        return Response({
            'job': ImportJobSerializer(job).data,
            'validation': {
                'is_valid': validation.is_valid,
                'errors': validation.errors,
                'warnings': validation.warnings,
                'sample_transformations': validation.sample_transformations
            }
        })

    @action(detail=True, methods=['POST'])
    def execute(self, request, pk=None):
        """
        Execute the import.
        POST /imports/{id}/execute/

        Query params:
        - async: Set to 'true' to run import in background (recommended for large files)

        Processing modes:
        - Small imports (<5000 rows): Standard processor, synchronous
        - Large imports (5000-1M rows): Chunked processor
        - With async=true: Background processing via Celery
        """
        job = self.get_object()

        if job.status != ImportJob.Status.PREVIEW:
            return Response(
                {'error': 'Job must be in preview state to execute'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if async processing is requested
        run_async = request.query_params.get('async', '').lower() == 'true'
        use_chunked = job.total_rows > CHUNKED_PROCESSING_THRESHOLD

        # For very large imports, force async processing
        if job.total_rows > 50000:
            run_async = True

        if run_async:
            # Use Celery for background processing
            from .tasks import process_import_task

            job.status = ImportJob.Status.IMPORTING
            job.started_at = timezone.now()
            job.save(update_fields=['status', 'started_at'])

            # Queue the task
            task = process_import_task.delay(str(job.id), use_chunked=use_chunked)

            # Store task ID
            job.celery_task_id = task.id
            job.save(update_fields=['celery_task_id'])

            return Response({
                'job': ImportJobSerializer(job).data,
                'task': {
                    'id': task.id,
                    'status': 'queued',
                    'processing_mode': 'async_chunked' if use_chunked else 'async_standard',
                },
                'message': 'Import queued for background processing. Poll /progress/ for status.'
            }, status=status.HTTP_202_ACCEPTED)

        # Synchronous processing
        if use_chunked:
            # Use memory-efficient chunked processor for large files
            processor = ChunkedImportProcessor(chunk_size=1000)
            job.status = ImportJob.Status.IMPORTING
            job.save()
            result = processor.process(job)

            # Chunked processor returns ChunkedImportResult
            response_data = {
                'job': ImportJobSerializer(job).data,
                'result': {
                    'success_count': result.success_count,
                    'error_count': result.error_count,
                    'skip_count': result.skip_count,
                    'errors': result.errors[:20],
                    'chunks_processed': result.chunks_processed,
                    'total_chunks': result.total_chunks,
                    'processing_time_seconds': result.processing_time_seconds,
                    'processing_mode': 'chunked'
                }
            }
        else:
            # Use standard processor for smaller files
            processor = ImportProcessor()
            result = processor.process(job)

            response_data = {
                'job': ImportJobSerializer(job).data,
                'result': {
                    'success_count': result.success_count,
                    'error_count': result.error_count,
                    'skip_count': result.skip_count,
                    'errors': result.errors[:20],
                    'processing_mode': 'standard'
                }
            }

        # Refresh job from DB
        job.refresh_from_db()
        response_data['job'] = ImportJobSerializer(job).data

        return Response(response_data)

    @action(detail=True, methods=['GET'])
    def progress(self, request, pk=None):
        """
        Get real-time progress for import.
        GET /imports/{id}/progress/
        Returns detailed progress including chunk information for large imports.
        """
        job = self.get_object()

        # Check cache first for real-time updates (chunked processor updates this)
        cache_key = f'import_progress_{job.id}'
        cached = cache.get(cache_key)

        if cached:
            progress_data = {
                'processed': cached.get('processed', 0),
                'total': cached.get('total', job.total_rows),
                'percentage': cached.get('percentage', 0),
                'chunk': cached.get('chunk', 0),
                'total_chunks': cached.get('total_chunks', 0),
            }
        else:
            progress_data = {
                'processed': job.success_count + job.error_count + job.skip_count,
                'total': job.total_rows,
                'percentage': round(
                    ((job.success_count + job.error_count + job.skip_count) / job.total_rows * 100)
                    if job.total_rows > 0 else 0,
                    1
                ),
                'chunk': 0,
                'total_chunks': 0,
            }

        response_data = {
            **progress_data,
            'success_count': job.success_count,
            'error_count': job.error_count,
            'skip_count': job.skip_count,
            'status': job.status,
            'is_large_import': job.total_rows > CHUNKED_PROCESSING_THRESHOLD,
            'errors': job.errors[:10] if job.errors else []
        }

        # Include Celery task status if available
        if job.celery_task_id:
            from .tasks import get_task_status
            task_status = get_task_status(job.celery_task_id)
            response_data['task'] = task_status

        return Response(response_data)

    @action(detail=True, methods=['GET'])
    def task_status(self, request, pk=None):
        """
        Get Celery task status for async import.
        GET /imports/{id}/task-status/
        """
        job = self.get_object()

        if not job.celery_task_id:
            return Response({
                'error': 'No background task associated with this job'
            }, status=status.HTTP_404_NOT_FOUND)

        from .tasks import get_task_status
        task_status = get_task_status(job.celery_task_id)

        return Response({
            'job_id': str(job.id),
            'job_status': job.status,
            **task_status
        })

    @action(detail=True, methods=['POST'])
    def cancel(self, request, pk=None):
        """
        Cancel an import job.
        POST /imports/{id}/cancel/
        """
        job = self.get_object()

        if job.status in [ImportJob.Status.COMPLETED, ImportJob.Status.FAILED, ImportJob.Status.CANCELLED]:
            return Response({
                'error': f'Cannot cancel job in {job.status} status'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Revoke Celery task if running
        if job.celery_task_id:
            from .tasks import revoke_task
            revoke_task(job.celery_task_id, terminate=True)

        # Update job status
        job.status = ImportJob.Status.CANCELLED
        job.completed_at = timezone.now()
        job.save(update_fields=['status', 'completed_at'])

        return Response({
            'job': ImportJobSerializer(job).data,
            'message': 'Import cancelled successfully'
        })

    @action(detail=True, methods=['GET'])
    def download_errors(self, request, pk=None):
        """
        Download error report as CSV.
        GET /imports/{id}/download-errors/
        """
        job = self.get_object()

        if not job.errors:
            return Response(
                {'error': 'No errors to download'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)

        # Header
        writer.writerow(['Row', 'Error Type', 'Message', 'Data'])

        # Data
        for error in job.errors:
            writer.writerow([
                error.get('row', ''),
                error.get('type', ''),
                error.get('message', ''),
                error.get('data', '')
            ])

        # Create response
        response = HttpResponse(output.getvalue(), content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="import_errors_{job.id}.csv"'

        return response

    @action(detail=True, methods=['POST'])
    def cancel(self, request, pk=None):
        """Cancel an import job."""
        job = self.get_object()

        if job.status in [ImportJob.Status.COMPLETED, ImportJob.Status.FAILED]:
            return Response(
                {'error': 'Cannot cancel completed or failed jobs'},
                status=status.HTTP_400_BAD_REQUEST
            )

        job.status = ImportJob.Status.CANCELLED
        job.save()

        return Response({'message': 'Import cancelled'})


class MultiFileImportBatchViewSet(viewsets.ModelViewSet):
    """
    ViewSet for multi-file import batches.

    Uses AI-powered analysis with 3 specialized agents when ANTHROPIC_API_KEY is configured:
    1. FileProfilerAgent - Analyzes file structure and content
    2. SchemaMatcherAgent - Matches files to database models
    3. ImportPlannerAgent - Creates optimal import execution plan

    Falls back to rule-based analysis when AI is not available.
    """
    queryset = MultiFileImportBatch.objects.select_related('created_by')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return MultiFileImportBatchListSerializer
        return MultiFileImportBatchSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not (user.is_staff or user.is_superuser):
            queryset = queryset.filter(created_by=user)
        return queryset.order_by('-created_at')

    @action(detail=False, methods=['GET'])
    def ai_status(self, request):
        """
        Check if AI-powered analysis is available.
        GET /imports/batches/ai_status/

        Returns:
            - ai_available: boolean indicating if AI analysis is configured
            - analysis_mode: 'ai' or 'rule-based'
            - agents: list of AI agents used (when AI is available)
        """
        return Response({
            'ai_available': AI_AGENTS_AVAILABLE,
            'analysis_mode': 'ai' if AI_AGENTS_AVAILABLE else 'rule-based',
            'agents': [
                {
                    'name': 'FileProfilerAgent',
                    'description': 'Analyzes file structure, detects data types, and summarizes content'
                },
                {
                    'name': 'SchemaMatcherAgent',
                    'description': 'Matches file profiles to database models and maps columns'
                },
                {
                    'name': 'ImportPlannerAgent',
                    'description': 'Creates optimal import execution plan considering dependencies'
                }
            ] if AI_AGENTS_AVAILABLE else [],
            'message': (
                'AI-powered analysis is active. Files will be analyzed using 3 specialized AI agents.'
                if AI_AGENTS_AVAILABLE else
                'AI analysis not configured. Using rule-based pattern matching. '
                'Set ANTHROPIC_API_KEY environment variable to enable AI analysis.'
            )
        })

    @action(detail=False, methods=['POST'], parser_classes=[MultiPartParser, FormParser])
    def upload(self, request):
        """
        Upload multiple files for AI-powered analysis and batch import.
        POST /imports/batches/upload/

        The system will:
        1. Parse all uploaded files
        2. Analyze each file to detect its target data type
        3. Determine dependencies and processing order
        4. Return analysis results for user review before import
        """
        serializer = MultiFileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        files_data = serializer.validated_data['files']
        name = serializer.validated_data.get('name', '')
        instructions = serializer.validated_data.get('instructions', '')
        auto_create_dependencies = serializer.validated_data.get('auto_create_dependencies', True)
        update_existing = serializer.validated_data.get('update_existing', True)

        # Prepare files list
        files = []
        for file_obj in files_data:
            content = file_obj.read()
            files.append((file_obj.name, content))

        # Analyze files
        orchestrator = MultiFileOrchestrator(user=request.user)

        try:
            analysis = orchestrator.analyze_files(files, instructions)
        except Exception as e:
            return Response(
                {'error': f'Failed to analyze files: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if analysis.errors and not analysis.files:
            return Response(
                {'error': 'All files failed analysis', 'details': analysis.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create the batch
        try:
            batch = orchestrator.create_batch(
                analysis=analysis,
                name=name,
                instructions=instructions,
                auto_create_dependencies=auto_create_dependencies,
                update_existing=update_existing
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to create batch: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response({
            'batch': MultiFileImportBatchSerializer(batch).data,
            'analysis': {
                'processing_order': analysis.processing_order,
                'detected_models': analysis.detected_models,
                'confidence_scores': analysis.confidence_scores,
                'warnings': analysis.warnings,
                'errors': analysis.errors,
            },
            'ai_analysis': {
                'used': orchestrator.use_ai,
                'mode': 'ai' if orchestrator.use_ai else 'rule-based',
                'agents_used': [
                    'FileProfilerAgent',
                    'SchemaMatcherAgent',
                    'ImportPlannerAgent'
                ] if orchestrator.use_ai else []
            }
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['POST'], parser_classes=[MultiPartParser, FormParser])
    def analyze(self, request):
        """
        Analyze files without creating a batch (preview only).
        POST /imports/batches/analyze/

        Returns analysis results without committing anything to the database.
        """
        serializer = MultiFileUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        files_data = serializer.validated_data['files']
        instructions = serializer.validated_data.get('instructions', '')

        # Prepare files list
        files = []
        for file_obj in files_data:
            content = file_obj.read()
            files.append((file_obj.name, content))

        # Analyze files
        orchestrator = MultiFileOrchestrator(user=request.user)

        try:
            analysis = orchestrator.analyze_files(files, instructions)
        except Exception as e:
            return Response(
                {'error': f'Failed to analyze files: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Build response
        files_analysis = {}
        for filename, file_info in analysis.files.items():
            files_analysis[filename] = {
                'detected_model': file_info.analysis.detected_model,
                'confidence': file_info.analysis.confidence,
                'matched_fields': file_info.analysis.matched_fields,
                'file_category': file_info.analysis.file_category,
                'dependencies': file_info.analysis.dependencies,
                'total_rows': file_info.total_rows,
                'headers': file_info.headers,
                'sample_data': file_info.sample_data[:5],
                'reason': file_info.analysis.reason,
                'model_scores': file_info.analysis.model_scores,
            }

        return Response({
            'files': files_analysis,
            'processing_order': analysis.processing_order,
            'detected_models': analysis.detected_models,
            'confidence_scores': analysis.confidence_scores,
            'warnings': analysis.warnings,
            'errors': analysis.errors,
            'ai_analysis': {
                'used': orchestrator.use_ai,
                'mode': 'ai' if orchestrator.use_ai else 'rule-based',
                'agents_used': [
                    'FileProfilerAgent',
                    'SchemaMatcherAgent',
                    'ImportPlannerAgent'
                ] if orchestrator.use_ai else [],
                'description': (
                    'Files analyzed using 3 AI agents for intelligent detection and mapping'
                    if orchestrator.use_ai else
                    'Files analyzed using rule-based pattern matching'
                )
            }
        })

    @action(detail=True, methods=['POST'])
    def execute(self, request, pk=None):
        """
        Execute the batch import.
        POST /imports/batches/{id}/execute/

        Processes all files in the determined order.
        """
        batch = self.get_object()

        if batch.status not in [MultiFileImportBatch.Status.READY, MultiFileImportBatch.Status.PENDING]:
            return Response(
                {'error': f'Batch is in {batch.status} state, cannot execute'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Parse overrides if provided
        serializer = BatchConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        overrides = serializer.validated_data.get('overrides', [])

        # Apply overrides to jobs
        for override in overrides:
            job_id = override.get('job_id')
            if job_id:
                try:
                    job = batch.jobs.get(id=job_id)
                    if 'target_model' in override and override['target_model']:
                        job.target_model = override['target_model']
                    if 'column_mapping' in override and override['column_mapping']:
                        job.column_mapping = override['column_mapping']
                    job.save()
                except ImportJob.DoesNotExist:
                    pass

        # Process the batch
        orchestrator = MultiFileOrchestrator(user=request.user)
        result = orchestrator.process_batch(batch)

        # Refresh batch from DB
        batch.refresh_from_db()

        return Response({
            'batch': MultiFileImportBatchSerializer(batch).data,
            'result': {
                'total_files': result.total_files,
                'completed_files': result.completed_files,
                'failed_files': result.failed_files,
                'total_rows': result.total_rows,
                'success_count': result.success_count,
                'error_count': result.error_count,
                'skip_count': result.skip_count,
                'errors': result.errors[:20],
            }
        })

    @action(detail=True, methods=['GET'])
    def progress(self, request, pk=None):
        """
        Get real-time progress for batch import.
        GET /imports/batches/{id}/progress/
        """
        batch = self.get_object()
        orchestrator = MultiFileOrchestrator(user=request.user)
        summary = orchestrator.get_batch_summary(batch)
        return Response(summary)

    @action(detail=True, methods=['PATCH'])
    def update_job(self, request, pk=None):
        """
        Update a specific job's mapping within a batch.
        PATCH /imports/batches/{id}/update-job/
        """
        batch = self.get_object()

        if batch.status not in [MultiFileImportBatch.Status.READY, MultiFileImportBatch.Status.PENDING]:
            return Response(
                {'error': 'Cannot update jobs after batch has started processing'},
                status=status.HTTP_400_BAD_REQUEST
            )

        job_id = request.data.get('job_id')
        if not job_id:
            return Response(
                {'error': 'job_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            job = batch.jobs.get(id=job_id)
        except ImportJob.DoesNotExist:
            return Response(
                {'error': 'Job not found in this batch'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Update fields
        if 'target_model' in request.data:
            job.target_model = request.data['target_model']
        if 'column_mapping' in request.data:
            job.column_mapping = request.data['column_mapping']

        job.save()

        return Response({
            'message': 'Job updated',
            'job': {
                'id': str(job.id),
                'filename': job.original_filename,
                'target_model': job.target_model,
                'column_mapping': job.column_mapping,
            }
        })

    @action(detail=True, methods=['POST'])
    def cancel(self, request, pk=None):
        """Cancel a batch import."""
        batch = self.get_object()

        if batch.status in [MultiFileImportBatch.Status.COMPLETED, MultiFileImportBatch.Status.FAILED]:
            return Response(
                {'error': 'Cannot cancel completed or failed batches'},
                status=status.HTTP_400_BAD_REQUEST
            )

        batch.status = MultiFileImportBatch.Status.CANCELLED
        batch.save()

        # Cancel all pending jobs
        batch.jobs.filter(status__in=[ImportJob.Status.PENDING, ImportJob.Status.PREVIEW]).update(
            status=ImportJob.Status.CANCELLED
        )

        return Response({'message': 'Batch cancelled'})


class ImportTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for import templates."""
    queryset = ImportTemplate.objects.select_related('created_by')
    serializer_class = ImportTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        # Show public templates and user's own templates
        if not (user.is_staff or user.is_superuser):
            queryset = queryset.filter(
                models.Q(is_public=True) | models.Q(created_by=user)
            )

        # Filter by target model if specified
        target_model = self.request.query_params.get('target_model')
        if target_model:
            queryset = queryset.filter(target_model=target_model)

        return queryset.order_by('target_model', 'name')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class FieldDefinitionsView(APIView):
    """Get field definitions for a target model."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, target_model):
        """GET /imports/fields/{target_model}/"""
        mapper = ColumnMapper()
        fields = mapper.get_field_definitions(target_model)

        if not fields:
            return Response(
                {'error': f'Unknown target model: {target_model}'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(fields)


# Import the models module for the Q object
from django.db import models


class DatasetViewSet(viewsets.ModelViewSet):
    """
    ViewSet for AI Data Analyzer datasets.

    Allows users to:
    1. Upload multiple files for analysis
    2. Get AI-suggested join configurations
    3. Configure joins manually
    4. Preview merged data
    5. Execute merge and save result
    6. Export or use for import
    """
    queryset = Dataset.objects.select_related('created_by').prefetch_related('files', 'joins')
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return DatasetListSerializer
        return DatasetSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if not (user.is_staff or user.is_superuser):
            queryset = queryset.filter(created_by=user)
        return queryset.order_by('-created_at')

    @action(detail=False, methods=['POST'], parser_classes=[MultiPartParser, FormParser])
    def upload(self, request):
        """
        Upload files, analyze them with AI, and get join suggestions.
        POST /imports/datasets/upload/
        """
        serializer = DatasetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        files_data = serializer.validated_data['files']
        name = serializer.validated_data.get('name', '') or 'Untitled Dataset'
        description = serializer.validated_data.get('description', '')

        # Create the dataset
        dataset = Dataset.objects.create(
            name=name,
            description=description,
            status=Dataset.Status.ANALYZING,
            created_by=request.user
        )

        # Process each file
        files_info = []
        total_rows = 0

        for order, file_obj in enumerate(files_data):
            content = file_obj.read()
            filename = file_obj.name
            file_type = FileParser.detect_type(filename, content)

            try:
                parsed = parse_file(content, filename)
            except Exception as e:
                dataset.fail(f"Failed to parse file {filename}: {str(e)}")
                return Response(
                    {'error': f'Failed to parse file {filename}: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Detect data types
            analyzer = FileAnalyzer()
            analysis_result = analyzer.analyze(parsed.headers, parsed.sample_rows, filename)

            # Create DatasetFile
            dataset_file = DatasetFile.objects.create(
                dataset=dataset,
                file_name=filename,
                file_type=file_type,
                headers=parsed.headers,
                sample_data=parsed.sample_rows[:10],
                row_count=parsed.total_rows,
                detected_data_types=analysis_result.matched_fields if hasattr(analysis_result, 'matched_fields') else {},
                detected_patterns={
                    'file_category': analysis_result.file_category if hasattr(analysis_result, 'file_category') else 'unknown',
                },
                order=order
            )

            # Store file data
            dataset_file.set_file(content, filename)
            dataset_file.save()

            files_info.append({
                'filename': filename,
                'headers': parsed.headers,
                'sample_data': parsed.sample_rows[:5],
                'row_count': parsed.total_rows,
                'data_types': dataset_file.detected_data_types,
            })

            total_rows += parsed.total_rows

        # Update dataset statistics
        dataset.file_count = len(files_data)
        dataset.total_source_rows = total_rows

        # Get AI join suggestions
        ai_analysis = {}
        join_suggestions = []

        try:
            if AI_AGENTS_AVAILABLE:
                from .ai_agents import DataJoinAnalyzerAgent
                agent = DataJoinAnalyzerAgent()
                result = agent.analyze_files(files_info)

                ai_analysis = {
                    'files': result.files,
                    'relationship_graph': result.relationship_graph,
                    'warnings': result.warnings,
                    'recommendations': result.recommendations,
                }

                # Create JoinConfiguration objects from suggestions
                file_map = {f.file_name: f for f in dataset.files.all()}

                for suggestion in result.join_suggestions:
                    left_file = file_map.get(suggestion.left_file)
                    right_file = file_map.get(suggestion.right_file)

                    if left_file and right_file:
                        join_config = JoinConfiguration.objects.create(
                            dataset=dataset,
                            left_file=left_file,
                            left_column=suggestion.left_column,
                            right_file=right_file,
                            right_column=suggestion.right_column,
                            join_type=suggestion.join_type_recommendation,
                            is_ai_suggested=True,
                            ai_confidence=suggestion.confidence,
                            ai_reasoning=suggestion.reasoning,
                            relationship_type=suggestion.relationship_type,
                            sample_matches=suggestion.sample_matches,
                            order=len(join_suggestions)
                        )
                        join_suggestions.append({
                            'id': str(join_config.id),
                            'left_file': suggestion.left_file,
                            'left_column': suggestion.left_column,
                            'right_file': suggestion.right_file,
                            'right_column': suggestion.right_column,
                            'confidence': suggestion.confidence,
                            'join_type': suggestion.join_type_recommendation,
                            'reasoning': suggestion.reasoning,
                            'relationship_type': suggestion.relationship_type,
                        })

                ai_analysis['join_suggestions'] = join_suggestions
            else:
                # Use rule-based fallback
                from .merger import DataJoinAnalyzerRuleBased
                analyzer = DataJoinAnalyzerRuleBased()
                suggestions = analyzer.analyze_files(files_info)

                file_map = {f.file_name: f for f in dataset.files.all()}

                for suggestion in suggestions[:5]:  # Limit to top 5
                    left_file = file_map.get(suggestion['left_file'])
                    right_file = file_map.get(suggestion['right_file'])

                    if left_file and right_file:
                        join_config = JoinConfiguration.objects.create(
                            dataset=dataset,
                            left_file=left_file,
                            left_column=suggestion['left_column'],
                            right_file=right_file,
                            right_column=suggestion['right_column'],
                            join_type=suggestion.get('join_type_recommendation', 'left'),
                            is_ai_suggested=False,
                            ai_confidence=suggestion['confidence'],
                            ai_reasoning=suggestion.get('reasoning', ''),
                            order=len(join_suggestions)
                        )
                        join_suggestions.append(suggestion)

                ai_analysis = {
                    'join_suggestions': join_suggestions,
                    'warnings': [],
                    'recommendations': ['Review suggested joins before merging'],
                    'mode': 'rule-based'
                }

        except Exception as e:
            ai_analysis = {
                'error': str(e),
                'warnings': ['AI analysis failed, no join suggestions available'],
                'recommendations': ['Configure joins manually']
            }

        dataset.ai_analysis = ai_analysis
        dataset.status = Dataset.Status.READY
        dataset.save()

        return Response({
            'dataset': DatasetSerializer(dataset).data,
            'ai_analysis': ai_analysis,
            'ai_available': AI_AGENTS_AVAILABLE,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['POST'])
    def configure_joins(self, request, pk=None):
        """
        Configure join relationships between files.
        POST /imports/datasets/{id}/configure-joins/
        """
        dataset = self.get_object()

        if dataset.status not in [Dataset.Status.READY, Dataset.Status.DRAFT]:
            return Response(
                {'error': 'Dataset is not in a configurable state'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ConfigureJoinsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Clear existing joins
        dataset.joins.all().delete()

        # Create new join configurations
        file_map = {str(f.id): f for f in dataset.files.all()}

        for join_data in serializer.validated_data['joins']:
            left_file = file_map.get(str(join_data['left_file_id']))
            right_file = file_map.get(str(join_data['right_file_id']))

            if not left_file:
                return Response(
                    {'error': f"Left file not found: {join_data['left_file_id']}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if not right_file:
                return Response(
                    {'error': f"Right file not found: {join_data['right_file_id']}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Validate columns exist
            if join_data['left_column'] not in left_file.headers:
                return Response(
                    {'error': f"Column '{join_data['left_column']}' not found in {left_file.file_name}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if join_data['right_column'] not in right_file.headers:
                return Response(
                    {'error': f"Column '{join_data['right_column']}' not found in {right_file.file_name}"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            JoinConfiguration.objects.create(
                dataset=dataset,
                left_file=left_file,
                left_column=join_data['left_column'],
                right_file=right_file,
                right_column=join_data['right_column'],
                join_type=join_data.get('join_type', 'left'),
                order=join_data.get('order', 0)
            )

        dataset.refresh_from_db()

        return Response({
            'dataset': DatasetSerializer(dataset).data,
            'message': f"Configured {len(serializer.validated_data['joins'])} joins"
        })

    @action(detail=True, methods=['POST'])
    def preview(self, request, pk=None):
        """
        Preview merged data (limited rows).
        POST /imports/datasets/{id}/preview/
        """
        dataset = self.get_object()

        if not dataset.files.exists():
            return Response(
                {'error': 'No files in dataset'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prepare files for merger
        files = []
        for f in dataset.files.all():
            files.append({
                'file_id': str(f.id),
                'alias': f.alias,
                'data': f.get_file(),
                'file_name': f.file_name,
                'file_type': f.file_type,
            })

        # Prepare joins
        joins = []
        for j in dataset.joins.all().order_by('order'):
            joins.append({
                'left_file_id': str(j.left_file_id),
                'left_column': j.left_column,
                'right_file_id': str(j.right_file_id),
                'right_column': j.right_column,
                'join_type': j.join_type,
                'order': j.order,
            })

        # Execute preview merge
        merger = DatasetMerger()
        limit = int(request.data.get('limit', 100))
        result = merger.preview_merge(files, joins, limit=limit)

        return Response({
            'success': result.success,
            'headers': result.headers,
            'data': result.data,
            'row_count': result.row_count,
            'statistics': result.statistics,
            'warnings': result.warnings,
            'errors': result.errors,
        })

    @action(detail=True, methods=['POST'])
    def merge(self, request, pk=None):
        """
        Execute merge and save result.
        POST /imports/datasets/{id}/merge/
        """
        dataset = self.get_object()

        if not dataset.files.exists():
            return Response(
                {'error': 'No files in dataset'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Prepare files for merger
        files = []
        for f in dataset.files.all():
            files.append({
                'file_id': str(f.id),
                'alias': f.alias,
                'data': f.get_file(),
                'file_name': f.file_name,
                'file_type': f.file_type,
            })

        # Prepare joins
        joins = []
        for j in dataset.joins.all().order_by('order'):
            joins.append({
                'left_file_id': str(j.left_file_id),
                'left_column': j.left_column,
                'right_file_id': str(j.right_file_id),
                'right_column': j.right_column,
                'join_type': j.join_type,
                'order': j.order,
            })

        # Execute merge
        merger = DatasetMerger()
        result = merger.merge_files(files, joins)

        if not result.success:
            dataset.fail('; '.join(result.errors))
            return Response({
                'success': False,
                'errors': result.errors,
            }, status=status.HTTP_400_BAD_REQUEST)

        # Save merged data
        csv_data = merger.export_to_csv(result)
        dataset.merged_data = csv_data
        dataset.merged_headers = result.headers
        dataset.merged_row_count = result.row_count
        dataset.merged_sample_data = result.data[:10]
        dataset.mark_merged()

        return Response({
            'success': True,
            'dataset': DatasetSerializer(dataset).data,
            'statistics': result.statistics,
            'warnings': result.warnings,
        })

    @action(detail=True, methods=['GET'])
    def export(self, request, pk=None):
        """
        Export merged data as CSV or Excel.
        GET /imports/datasets/{id}/export/?format=csv|xlsx
        """
        dataset = self.get_object()

        if dataset.status not in [Dataset.Status.MERGED, Dataset.Status.SAVED]:
            return Response(
                {'error': 'Dataset must be merged before exporting'},
                status=status.HTTP_400_BAD_REQUEST
            )

        export_format = request.query_params.get('format', 'csv')

        if export_format == 'xlsx':
            # Re-merge to get Excel format
            files = []
            for f in dataset.files.all():
                files.append({
                    'file_id': str(f.id),
                    'alias': f.alias,
                    'data': f.get_file(),
                    'file_name': f.file_name,
                    'file_type': f.file_type,
                })

            joins = []
            for j in dataset.joins.all().order_by('order'):
                joins.append({
                    'left_file_id': str(j.left_file_id),
                    'left_column': j.left_column,
                    'right_file_id': str(j.right_file_id),
                    'right_column': j.right_column,
                    'join_type': j.join_type,
                    'order': j.order,
                })

            merger = DatasetMerger()
            result = merger.merge_files(files, joins)
            content = merger.export_to_excel(result)
            content_type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            filename = f"{dataset.name.replace(' ', '_')}.xlsx"
        else:
            content = dataset.merged_data
            content_type = 'text/csv'
            filename = f"{dataset.name.replace(' ', '_')}.csv"

        response = HttpResponse(content, content_type=content_type)
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=['POST'])
    def use_for_import(self, request, pk=None):
        """
        Create an ImportJob from the merged dataset.
        POST /imports/datasets/{id}/use-for-import/
        """
        dataset = self.get_object()

        if dataset.status not in [Dataset.Status.MERGED, Dataset.Status.SAVED]:
            return Response(
                {'error': 'Dataset must be merged before using for import'},
                status=status.HTTP_400_BAD_REQUEST
            )

        target_model = request.data.get('target_model')
        if not target_model:
            return Response(
                {'error': 'target_model is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if target_model not in [choice[0] for choice in ImportJob.TargetModel.choices]:
            return Response(
                {'error': f'Invalid target_model: {target_model}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create ImportJob from merged data
        import_job = ImportJob.objects.create(
            original_filename=f"{dataset.name}_merged.csv",
            file_type='csv',
            target_model=target_model,
            instructions=f"Created from merged dataset: {dataset.name}",
            headers=dataset.merged_headers,
            sample_data=dataset.merged_sample_data,
            total_rows=dataset.merged_row_count,
            status=ImportJob.Status.MAPPING,
            created_by=request.user
        )

        # Store merged data as file
        import_job.set_file(dataset.merged_data, f"{dataset.name}_merged.csv")
        import_job.save()

        # Generate initial column mapping
        mapper = ColumnMapper()
        mapping_results = mapper.map_columns(
            headers=dataset.merged_headers,
            target_model=target_model,
            instructions=""
        )

        column_mapping = {
            result.source_column: result.target_field
            for result in mapping_results.values()
            if result.confidence >= 0.5
        }
        mapping_confidence = {
            result.source_column: {
                'target_field': result.target_field,
                'confidence': result.confidence,
                'reason': result.reason
            }
            for result in mapping_results.values()
        }

        import_job.column_mapping = column_mapping
        import_job.mapping_confidence = mapping_confidence
        import_job.save()

        dataset.mark_saved()

        return Response({
            'import_job': ImportJobSerializer(import_job).data,
            'dataset': DatasetSerializer(dataset).data,
        }, status=status.HTTP_201_CREATED)


class UnifiedImportView(APIView):
    """
    Unified multi-file import API.

    Handles:
    - Multiple file upload
    - Automatic joining on employee ID
    - Setup model creation (divisions, departments, grades, positions, banks, etc.)
    - Employee creation with proper FK references
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    # Threshold for async processing
    ASYNC_THRESHOLD = 10000  # rows

    def post(self, request):
        """
        Process multi-file employee import.

        POST /imports/unified/

        Form data:
        - files: Multiple files to import (required)
        - update_existing: Whether to update existing employees (default: true)
        - join_column: Column to join files on (auto-detected if not provided)
        - async: Force async processing (default: auto based on file size)
        """
        import base64
        from .unified_import import UnifiedImportProcessor

        files = request.FILES.getlist('files')
        if not files:
            return Response(
                {'error': 'No files provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        update_existing = request.data.get('update_existing', 'true').lower() == 'true'
        join_column = request.data.get('join_column')
        run_async = request.data.get('async', '').lower() == 'true'

        # Read file contents and estimate row count
        file_data = []
        total_size = 0
        for file_obj in files:
            content = file_obj.read()
            filename = file_obj.name
            file_data.append((filename, content))
            total_size += len(content)

        # Estimate rows (rough: ~100 bytes per row for CSV)
        estimated_rows = total_size // 100

        # Use async for large files
        if run_async or estimated_rows > self.ASYNC_THRESHOLD:
            # Encode files for Celery task
            encoded_files = [
                (filename, base64.b64encode(content).decode('utf-8'))
                for filename, content in file_data
            ]

            from .tasks import unified_import_task
            task = unified_import_task.delay(
                file_data=encoded_files,
                user_id=str(request.user.id) if request.user else None,
                update_existing=update_existing,
                join_column=join_column,
            )

            return Response({
                'async': True,
                'task_id': task.id,
                'message': 'Import started in background',
                'status_url': f'/api/v1/imports/unified/status/{task.id}/',
                'estimated_rows': estimated_rows,
            }, status=status.HTTP_202_ACCEPTED)

        # Synchronous processing for smaller files
        processor = UnifiedImportProcessor(user=request.user)
        result = processor.process_import(
            files=file_data,
            mapping=None,  # Auto-detect
            update_existing=update_existing,
            join_column=join_column,
        )

        return Response({
            'async': False,
            'success': result.success,
            'total_rows': result.total_rows,
            'employees_created': result.employees_created,
            'employees_updated': result.employees_updated,
            'employees_skipped': result.employees_skipped,
            'setups_created': result.setups_created,
            'errors': result.errors[:100] if result.errors else [],  # Limit error output
            'warnings': result.warnings,
            'error_count': len(result.errors),
        }, status=status.HTTP_200_OK if result.success else status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        """
        Get information about the unified import endpoint.
        GET /imports/unified/
        """
        return Response({
            'description': 'Unified multi-file employee import',
            'method': 'POST',
            'content_type': 'multipart/form-data',
            'parameters': {
                'files': {
                    'type': 'file[]',
                    'required': True,
                    'description': 'One or more CSV/Excel files to import'
                },
                'update_existing': {
                    'type': 'boolean',
                    'required': False,
                    'default': True,
                    'description': 'Whether to update existing employees'
                },
                'join_column': {
                    'type': 'string',
                    'required': False,
                    'description': 'Column to join files on (auto-detected if not provided)'
                },
            },
            'supported_file_types': ['csv', 'xlsx', 'xls'],
            'features': [
                'Auto-joins multiple files on employee ID',
                'Auto-creates setup records (divisions, departments, grades, positions, banks)',
                'Auto-detects column mappings',
                'Creates employees with proper FK references',
                'Supports CSV and Excel files',
            ],
            'auto_detected_columns': [
                'employee_id/number', 'first_name', 'last_name', 'full_name',
                'date_of_birth', 'gender', 'marital_status',
                'department', 'position', 'grade', 'division', 'directorate',
                'bank_name', 'account_number', 'branch_name',
                'email', 'phone', 'address', 'city', 'region',
                'date_of_joining', 'employment_status', 'employment_type',
                'salary_band', 'salary_level', 'salary_notch', 'basic_salary',
                'ghana_card', 'ssnit', 'tin', 'staff_category',
            ],
        })


class UnifiedImportStatusView(APIView):
    """Get status of an async unified import task."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, task_id):
        """
        Get status of an async import task.

        GET /imports/unified/status/{task_id}/
        """
        from .tasks import get_task_status

        # Get task status
        status_data = get_task_status(task_id)

        # Get progress from cache
        progress = cache.get(f'unified_import_progress_{task_id}', {})

        return Response({
            **status_data,
            'progress': progress,
        })


class SalaryStructureImportView(APIView):
    """
    Import salary structure (bands, levels, notches) from Excel file.

    Expected file format:
    - Grade category | Band | Grade Title | Level | Notch 1 | Notch 2 | ... | Notch 10
    """
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        """
        Import salary structure from Excel file.

        POST /imports/salary-structure/

        Form data:
        - file: Excel file with salary structure
        """
        from .unified_import import import_salary_structure

        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check file type
        filename = file_obj.name.lower()
        if not filename.endswith(('.xlsx', '.xls')):
            return Response(
                {'error': 'File must be an Excel file (.xlsx or .xls)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Read file content
        content = file_obj.read()

        # Run the import
        result = import_salary_structure(content, file_obj.name, user=request.user)

        return Response({
            'success': result.success,
            'bands_created': result.bands_created,
            'bands_updated': result.bands_updated,
            'levels_created': result.levels_created,
            'levels_updated': result.levels_updated,
            'notches_created': result.notches_created,
            'notches_updated': result.notches_updated,
            'errors': result.errors,
            'summary': {
                'total_bands': result.bands_created + result.bands_updated,
                'total_levels': result.levels_created + result.levels_updated,
                'total_notches': result.notches_created + result.notches_updated,
            }
        }, status=status.HTTP_200_OK if result.success else status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        """
        Get information about the salary structure import endpoint.
        GET /imports/salary-structure/
        """
        return Response({
            'description': 'Import salary structure (bands, levels, notches) from Excel file',
            'method': 'POST',
            'content_type': 'multipart/form-data',
            'parameters': {
                'file': {
                    'type': 'file',
                    'required': True,
                    'description': 'Excel file (.xlsx or .xls) with salary structure'
                },
            },
            'expected_format': {
                'columns': [
                    'Grade category (optional)',
                    'Band (e.g., Band 1, Band 2, ...)',
                    'Grade Title (optional, used as level name)',
                    'Level (e.g., Level 1A, Level 1B, ...)',
                    'Notch 1, Notch 2, ... Notch 10 (salary amounts)',
                ],
                'example_row': {
                    'Band': 'Band 4',
                    'Grade Title': 'Principal Administrative Officers',
                    'Level': 'Level 4B',
                    'Notch 1': 7369.23,
                    'Notch 2': 7590.29,
                    '...': '...',
                }
            },
            'creates': [
                'SalaryBand records (e.g., BAND_1 through BAND_8)',
                'SalaryLevel records (e.g., 1A, 1B, 4A, 4B)',
                'SalaryNotch records with salary amounts',
            ],
        })
