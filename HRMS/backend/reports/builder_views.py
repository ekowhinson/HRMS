"""Views for ad-hoc report builder."""

import csv
import io
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .builder_models import ReportDefinition, ScheduledReport, ReportExecution
from .builder_serializers import (
    ReportDefinitionSerializer, ScheduledReportSerializer,
    ReportExecutionSerializer,
)
from .query_builder import ReportQueryBuilder
from .field_service import FieldEnumerationService


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def data_sources_view(request):
    """List available data sources for the report builder."""
    sources = FieldEnumerationService.get_all_data_sources()
    return Response(sources)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def fields_view(request, data_source):
    """List fields for a given data source."""
    try:
        fields = FieldEnumerationService.get_fields_for_model(data_source)
        return Response(fields)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def preview_view(request):
    """Preview a report definition without saving."""
    try:
        # Build a temporary ReportDefinition from the request data
        definition = ReportDefinition(
            data_source=request.data.get('data_source', ''),
            columns=request.data.get('columns', []),
            filters=request.data.get('filters', []),
            group_by=request.data.get('group_by', []),
            aggregations=request.data.get('aggregations', []),
            ordering=request.data.get('ordering', []),
        )

        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 50)), 500)

        builder = ReportQueryBuilder(definition, user=request.user)
        result = builder.execute(page=page, page_size=page_size)
        return Response(result)
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def export_view(request):
    """Export a report to CSV."""
    try:
        definition = ReportDefinition(
            data_source=request.data.get('data_source', ''),
            columns=request.data.get('columns', []),
            filters=request.data.get('filters', []),
            group_by=request.data.get('group_by', []),
            aggregations=request.data.get('aggregations', []),
            ordering=request.data.get('ordering', []),
        )

        builder = ReportQueryBuilder(definition, user=request.user)
        qs = builder.build_queryset()
        data = list(qs[:10000])  # Limit export to 10k rows

        if not data:
            return Response({'error': 'No data to export'}, status=status.HTTP_400_BAD_REQUEST)

        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="report_export.csv"'

        writer = csv.writer(response)
        # Header row
        if data:
            writer.writerow(data[0].keys())
            for row in data:
                writer.writerow(row.values())

        return response
    except ValueError as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ReportDefinitionViewSet(viewsets.ModelViewSet):
    """CRUD for saved report definitions."""
    serializer_class = ReportDefinitionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        from django.db.models import Q
        return ReportDefinition.objects.filter(
            Q(created_by=user) | Q(is_public=True) | Q(shared_with_users=user)
        ).distinct()

    @action(detail=True, methods=['post'])
    def execute(self, request, pk=None):
        """Execute a saved report."""
        report = self.get_object()
        page = int(request.query_params.get('page', 1))
        page_size = min(int(request.query_params.get('page_size', 50)), 500)

        execution = ReportExecution.objects.create(
            report=report,
            executed_by=request.user,
            status=ReportExecution.Status.RUNNING,
        )

        try:
            builder = ReportQueryBuilder(report, user=request.user)
            result = builder.execute(page=page, page_size=page_size)

            execution.status = ReportExecution.Status.COMPLETED
            execution.row_count = result['total']
            execution.execution_time_ms = result['execution_time_ms']
            execution.save()

            report.last_run_at = timezone.now()
            report.run_count += 1
            report.save(update_fields=['last_run_at', 'run_count'])

            return Response(result)
        except Exception as e:
            execution.status = ReportExecution.Status.FAILED
            execution.error_message = str(e)
            execution.save()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def duplicate(self, request, pk=None):
        """Clone a report definition."""
        original = self.get_object()
        clone = ReportDefinition.objects.create(
            name=f"Copy of {original.name}",
            description=original.description,
            data_source=original.data_source,
            columns=original.columns,
            filters=original.filters,
            group_by=original.group_by,
            aggregations=original.aggregations,
            ordering=original.ordering,
            chart_config=original.chart_config,
        )
        return Response(ReportDefinitionSerializer(clone).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def share(self, request, pk=None):
        """Share a report with users/roles."""
        report = self.get_object()
        user_ids = request.data.get('user_ids', [])
        role_ids = request.data.get('role_ids', [])
        if user_ids:
            report.shared_with_users.set(user_ids)
        if role_ids:
            report.shared_with_roles.set(role_ids)
        return Response({'status': 'shared'})


class ScheduledReportViewSet(viewsets.ModelViewSet):
    """CRUD for scheduled reports."""
    serializer_class = ScheduledReportSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ScheduledReport.objects.filter(
            report__created_by=self.request.user
        ).select_related('report')
