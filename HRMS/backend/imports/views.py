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

from .models import ImportJob, ImportTemplate, ImportLog
from .serializers import (
    ImportJobListSerializer, ImportJobSerializer, ImportUploadSerializer,
    ConfirmMappingSerializer, ImportTemplateSerializer, ImportLogSerializer,
    ImportProgressSerializer, FieldDefinitionSerializer
)
from .parsers import parse_file, FileParser
from .mapper import ColumnMapper
from .processor import ImportProcessor


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

        # Check row limit
        if parsed.total_rows > ImportProcessor.MAX_RECORDS:
            return Response(
                {'error': f'File has {parsed.total_rows} rows, exceeding maximum of {ImportProcessor.MAX_RECORDS}'},
                status=status.HTTP_400_BAD_REQUEST
            )

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
        Small imports (<1000 rows) process synchronously.
        Large imports (1000-10000 rows) can use background processing.
        """
        job = self.get_object()

        if job.status != ImportJob.Status.PREVIEW:
            return Response(
                {'error': 'Job must be in preview state to execute'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Process import
        processor = ImportProcessor()

        if job.total_rows > 1000:
            # For large imports, start processing and return immediately
            # In production, this should use Celery or similar
            job.status = ImportJob.Status.IMPORTING
            job.save()

            # For now, process synchronously but return immediately
            # with progress tracking
            result = processor.process(job)
        else:
            # Small import - process synchronously
            result = processor.process(job)

        # Refresh job from DB
        job.refresh_from_db()

        return Response({
            'job': ImportJobSerializer(job).data,
            'result': {
                'success_count': result.success_count,
                'error_count': result.error_count,
                'skip_count': result.skip_count,
                'errors': result.errors[:20]  # Limit error detail
            }
        })

    @action(detail=True, methods=['GET'])
    def progress(self, request, pk=None):
        """
        Get real-time progress for import.
        GET /imports/{id}/progress/
        """
        job = self.get_object()

        # Check cache first for real-time updates
        cache_key = f'import_progress_{job.id}'
        cached = cache.get(cache_key)

        if cached:
            progress_data = cached
        else:
            progress_data = {
                'processed': job.processed_rows,
                'total': job.total_rows,
                'percentage': job.progress_percentage
            }

        return Response({
            **progress_data,
            'success_count': job.success_count,
            'error_count': job.error_count,
            'status': job.status,
            'errors': job.errors[:10]  # Limit errors
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
