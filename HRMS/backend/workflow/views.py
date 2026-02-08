"""
Views for the Workflow / Approval module.
"""

from rest_framework import viewsets, status, generics
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q, Count
from django.utils import timezone

from accounts.models import User
from .models import (
    WorkflowDefinition,
    ApprovalLevel,
    ApprovalRequest,
    WorkflowInstance,
    ApproverType,
)
from .serializers import (
    WorkflowDefinitionListSerializer,
    WorkflowDefinitionDetailSerializer,
    WorkflowDefinitionCreateSerializer,
    ApprovalLevelSerializer,
    ApprovalLevelWriteSerializer,
    ApprovalRequestSerializer,
    WorkflowInstanceSerializer,
    ApprovalActionSerializer,
    SetLevelsSerializer,
)
from .engine import ApprovalEngine, ApprovalEngineError


# ── Workflow Definition CRUD (Admin) ──────────────────────────────

class WorkflowDefinitionViewSet(viewsets.ModelViewSet):
    """Admin CRUD for workflow definitions."""
    permission_classes = [IsAuthenticated]
    queryset = WorkflowDefinition.objects.all().order_by('name')

    def get_serializer_class(self):
        if self.action == 'list':
            return WorkflowDefinitionListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return WorkflowDefinitionCreateSerializer
        return WorkflowDefinitionDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Optional filters
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        content_type = self.request.query_params.get('content_type')
        if content_type:
            try:
                app_label, model = content_type.split('.')
                ct = ContentType.objects.get(app_label=app_label, model=model)
                qs = qs.filter(content_type=ct)
            except (ValueError, ContentType.DoesNotExist):
                pass
        return qs

    @action(detail=True, methods=['post'], url_path='set-levels')
    def set_levels(self, request, pk=None):
        """Bulk set approval levels for a workflow (replaces all)."""
        workflow = self.get_object()
        serializer = SetLevelsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Delete existing levels and create new ones
        workflow.approval_levels.all().delete()
        for level_data in serializer.validated_data['levels']:
            ApprovalLevel.objects.create(workflow=workflow, **level_data)

        # Return updated workflow
        result = WorkflowDefinitionDetailSerializer(workflow)
        return Response(result.data)

    @action(detail=False, methods=['get'], url_path='for-module')
    def for_module(self, request):
        """Get workflow config for a specific content type."""
        content_type = request.query_params.get('content_type')
        if not content_type:
            return Response(
                {'error': 'content_type query parameter required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            app_label, model = content_type.split('.')
            ct = ContentType.objects.get(app_label=app_label, model=model)
        except (ValueError, ContentType.DoesNotExist):
            return Response(
                {'error': f'Invalid content type: {content_type}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        workflows = WorkflowDefinition.objects.filter(
            content_type=ct, is_active=True
        )
        serializer = WorkflowDefinitionListSerializer(workflows, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='approver-types')
    def approver_types(self, request):
        """Return list of available approver types for frontend dropdowns."""
        types = [
            {'value': choice.value, 'label': choice.label}
            for choice in ApproverType
        ]
        return Response(types)

    @action(detail=False, methods=['get'], url_path='content-types')
    def content_types(self, request):
        """Return available content types for workflow assignment."""
        # Return content types for common HR modules
        modules = [
            'leave', 'benefits', 'payroll', 'employees',
            'performance', 'recruitment', 'exits', 'discipline',
        ]
        cts = ContentType.objects.filter(app_label__in=modules).order_by('app_label', 'model')
        result = [
            {
                'id': ct.pk,
                'key': f'{ct.app_label}.{ct.model}',
                'label': f'{ct.app_label} - {ct.model}',
            }
            for ct in cts
        ]
        return Response(result)


# ── My Pending Approvals ──────────────────────────────────────────

class MyPendingApprovalsView(generics.ListAPIView):
    """List pending approvals for the current user."""
    permission_classes = [IsAuthenticated]
    serializer_class = ApprovalRequestSerializer

    def get_queryset(self):
        qs = ApprovalEngine.get_pending_for_user(self.request.user)
        # Optional filters
        module = self.request.query_params.get('module')
        if module:
            try:
                app_label, model = module.split('.')
                ct = ContentType.objects.get(app_label=app_label, model=model)
                qs = qs.filter(instance__content_type=ct)
            except (ValueError, ContentType.DoesNotExist):
                pass
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(instance__workflow__name__icontains=search) |
                Q(comments__icontains=search)
            )
        return qs


# ── Approval Action ───────────────────────────────────────────────

class ApprovalActionView(APIView):
    """Process an approval action (approve/reject/delegate/return)."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action_type = serializer.validated_data['action']
        comments = serializer.validated_data.get('comments', '')
        delegated_to_id = serializer.validated_data.get('delegated_to')

        try:
            if action_type == 'DELEGATE':
                if not delegated_to_id:
                    return Response(
                        {'error': 'delegated_to is required for delegation'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                try:
                    to_user = User.objects.get(pk=delegated_to_id)
                except User.DoesNotExist:
                    return Response(
                        {'error': 'Delegate user not found'},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                result = ApprovalEngine.delegate(
                    pk, request.user, to_user, reason=comments
                )
            else:
                result = ApprovalEngine.process_action(
                    pk, action_type, request.user, comments=comments
                )

            return Response(ApprovalRequestSerializer(result).data)

        except ApprovalEngineError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )


# ── Object Approval Status ────────────────────────────────────────

class ObjectApprovalStatusView(APIView):
    """Get the approval chain status for a specific object."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        content_type = request.query_params.get('content_type')
        object_id = request.query_params.get('object_id')

        if not content_type or not object_id:
            return Response(
                {'error': 'content_type and object_id query parameters required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        instance = ApprovalEngine.get_approval_status(content_type, object_id)
        if not instance:
            return Response(
                {'error': 'No workflow instance found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(WorkflowInstanceSerializer(instance).data)


# ── Approval Stats (Dashboard) ────────────────────────────────────

class ApprovalStatsView(APIView):
    """Dashboard stats: pending count, approved today, etc."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        pending = ApprovalEngine.get_pending_for_user(user)
        pending_count = pending.count()

        # Approved today by this user
        approved_today = ApprovalRequest.objects.filter(
            responded_by=user,
            status=ApprovalRequest.Status.APPROVED,
            responded_at__gte=today_start,
        ).count()

        # Rejected today by this user
        rejected_today = ApprovalRequest.objects.filter(
            responded_by=user,
            status=ApprovalRequest.Status.REJECTED,
            responded_at__gte=today_start,
        ).count()

        # Overdue (pending with due_date in the past)
        overdue = pending.filter(
            due_date__lt=timezone.now(),
        ).count()

        # Breakdown by module
        module_breakdown = (
            pending
            .values('instance__content_type__app_label')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        by_module = {
            item['instance__content_type__app_label']: item['count']
            for item in module_breakdown
        }

        return Response({
            'pending_count': pending_count,
            'approved_today': approved_today,
            'rejected_today': rejected_today,
            'overdue_count': overdue,
            'by_module': by_module,
        })
