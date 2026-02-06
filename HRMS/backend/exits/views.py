"""
Views for Exit/Offboarding module.
"""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Count, Q

from .models import (
    ExitType, ExitRequest, ExitInterview, ClearanceDepartment,
    ExitClearance, ExitChecklistItem, AssetReturn, FinalSettlement
)
from .serializers import (
    ExitTypeSerializer, ExitRequestListSerializer, ExitRequestDetailSerializer,
    ExitRequestCreateSerializer, ExitInterviewSerializer, ClearanceDepartmentSerializer,
    ExitClearanceSerializer, ExitChecklistItemSerializer, AssetReturnSerializer,
    FinalSettlementSerializer, SubmitExitRequestSerializer, ApproveExitRequestSerializer,
    ClearanceActionSerializer, ReturnAssetSerializer, CalculateSettlementSerializer
)


class ExitTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for ExitType model."""
    queryset = ExitType.objects.all()
    serializer_class = ExitTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['sort_order', 'name']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == 'list':
            # Only active types for list
            queryset = queryset.filter(is_active=True)
        return queryset


class ClearanceDepartmentViewSet(viewsets.ModelViewSet):
    """ViewSet for ClearanceDepartment model."""
    queryset = ClearanceDepartment.objects.all()
    serializer_class = ClearanceDepartmentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['code', 'name']
    ordering_fields = ['sort_order', 'name']

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == 'list':
            queryset = queryset.filter(is_active=True)
        return queryset


class ExitRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for ExitRequest model."""
    queryset = ExitRequest.objects.select_related(
        'employee', 'employee__department', 'employee__position',
        'exit_type', 'reviewed_by', 'approved_by', 'completed_by'
    ).prefetch_related('clearances', 'asset_returns')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'exit_type', 'employee']
    search_fields = ['request_number', 'employee__first_name', 'employee__last_name', 'employee__employee_number']
    ordering_fields = ['request_date', 'proposed_last_day', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'list':
            return ExitRequestListSerializer
        elif self.action in ['create', 'update', 'partial_update']:
            return ExitRequestCreateSerializer
        return ExitRequestDetailSerializer

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get exit request statistics."""
        total = ExitRequest.objects.count()
        pending = ExitRequest.objects.filter(
            status__in=[ExitRequest.Status.SUBMITTED, ExitRequest.Status.PENDING_APPROVAL]
        ).count()
        in_clearance = ExitRequest.objects.filter(status=ExitRequest.Status.CLEARANCE).count()
        completed_this_month = ExitRequest.objects.filter(
            status=ExitRequest.Status.COMPLETED,
            completed_at__month=timezone.now().month,
            completed_at__year=timezone.now().year
        ).count()

        # By type
        by_type = list(ExitRequest.objects.values('exit_type__name').annotate(
            count=Count('id')
        ).order_by('-count')[:5])

        # By status
        by_status = list(ExitRequest.objects.values('status').annotate(
            count=Count('id')
        ))

        return Response({
            'total': total,
            'pending_approval': pending,
            'in_clearance': in_clearance,
            'completed_this_month': completed_this_month,
            'by_type': by_type,
            'by_status': by_status
        })

    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's exit requests."""
        if hasattr(request.user, 'employee'):
            queryset = self.get_queryset().filter(employee=request.user.employee)
            serializer = ExitRequestListSerializer(queryset, many=True)
            return Response(serializer.data)
        return Response([])

    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get exit requests pending approval."""
        queryset = self.get_queryset().filter(
            status__in=[ExitRequest.Status.SUBMITTED, ExitRequest.Status.PENDING_APPROVAL]
        )
        serializer = ExitRequestListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_clearance(self, request):
        """Get exit requests pending clearance."""
        queryset = self.get_queryset().filter(status=ExitRequest.Status.CLEARANCE)
        serializer = ExitRequestListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit exit request for approval."""
        exit_request = self.get_object()

        if exit_request.status != ExitRequest.Status.DRAFT:
            return Response(
                {'error': 'Only draft requests can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        exit_request.status = ExitRequest.Status.SUBMITTED
        exit_request.submitted_at = timezone.now()
        exit_request.save()

        serializer = ExitRequestDetailSerializer(exit_request)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve or reject exit request."""
        exit_request = self.get_object()
        serializer = ApproveExitRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action_type = serializer.validated_data['action']
        comments = serializer.validated_data.get('comments', '')

        if action_type == 'approve':
            exit_request.status = ExitRequest.Status.APPROVED
            exit_request.approved_by = request.user
            exit_request.approved_at = timezone.now()
            exit_request.approval_comments = comments

            # Set actual last day if provided
            if 'actual_last_day' in serializer.validated_data:
                exit_request.actual_last_day = serializer.validated_data['actual_last_day']

            # Move to clearance if required
            if exit_request.exit_type.requires_clearance:
                exit_request.status = ExitRequest.Status.CLEARANCE

        else:  # reject
            exit_request.status = ExitRequest.Status.REJECTED
            exit_request.reviewed_by = request.user
            exit_request.reviewed_at = timezone.now()
            exit_request.review_comments = comments

        exit_request.save()

        serializer = ExitRequestDetailSerializer(exit_request)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark exit request as completed."""
        exit_request = self.get_object()

        # Check clearances
        if exit_request.exit_type.requires_clearance and not exit_request.is_clearance_complete:
            return Response(
                {'error': 'All clearances must be completed first'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check settlement
        if hasattr(exit_request, 'final_settlement'):
            settlement = exit_request.final_settlement
            if settlement.status not in [FinalSettlement.Status.APPROVED, FinalSettlement.Status.PAID]:
                return Response(
                    {'error': 'Final settlement must be approved'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        exit_request.status = ExitRequest.Status.COMPLETED
        exit_request.completed_by = request.user
        exit_request.completed_at = timezone.now()
        exit_request.save()

        # Update employee status
        employee = exit_request.employee
        exit_type_code = exit_request.exit_type.code.upper()
        if 'RESIGN' in exit_type_code:
            employee.employment_status = 'RESIGNED'
        elif 'RETIRE' in exit_type_code:
            employee.employment_status = 'RETIRED'
        elif 'TERMIN' in exit_type_code:
            employee.employment_status = 'TERMINATED'
        else:
            employee.employment_status = 'TERMINATED'
        employee.save()

        serializer = ExitRequestDetailSerializer(exit_request)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        """Withdraw exit request."""
        exit_request = self.get_object()

        if exit_request.status in [ExitRequest.Status.COMPLETED, ExitRequest.Status.CANCELLED]:
            return Response(
                {'error': 'Cannot withdraw a completed or cancelled request'},
                status=status.HTTP_400_BAD_REQUEST
            )

        exit_request.status = ExitRequest.Status.WITHDRAWN
        exit_request.save()

        serializer = ExitRequestDetailSerializer(exit_request)
        return Response(serializer.data)


class ExitInterviewViewSet(viewsets.ModelViewSet):
    """ViewSet for ExitInterview model."""
    queryset = ExitInterview.objects.select_related(
        'exit_request', 'exit_request__employee', 'interviewer'
    )
    serializer_class = ExitInterviewSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['status', 'exit_request']
    ordering = ['-scheduled_date']

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending exit interviews."""
        queryset = self.get_queryset().filter(
            status=ExitInterview.Status.SCHEDULED,
            exit_request__status__in=[
                ExitRequest.Status.APPROVED,
                ExitRequest.Status.CLEARANCE,
                ExitRequest.Status.IN_PROGRESS
            ]
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark interview as completed."""
        interview = self.get_object()
        interview.status = ExitInterview.Status.COMPLETED
        interview.conducted_date = timezone.now()

        # Update fields from request data
        for field in ['reason_for_leaving', 'would_recommend_employer', 'would_return',
                      'job_satisfaction', 'management_satisfaction', 'work_environment',
                      'compensation_satisfaction', 'growth_opportunities', 'work_life_balance',
                      'liked_most', 'liked_least', 'suggestions', 'reason_detailed',
                      'future_plans', 'confidential_notes']:
            if field in request.data:
                setattr(interview, field, request.data[field])

        interview.save()
        serializer = self.get_serializer(interview)
        return Response(serializer.data)


class ExitClearanceViewSet(viewsets.ModelViewSet):
    """ViewSet for ExitClearance model."""
    queryset = ExitClearance.objects.select_related(
        'exit_request', 'exit_request__employee', 'department', 'cleared_by'
    ).prefetch_related('checklist_items')
    serializer_class = ExitClearanceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['exit_request', 'department', 'is_cleared']

    @action(detail=False, methods=['get'])
    def my_pending(self, request):
        """Get clearances pending for current user's department."""
        # This would need logic to match user to department
        queryset = self.get_queryset().filter(is_cleared=False)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def clear(self, request, pk=None):
        """Mark clearance as cleared."""
        clearance = self.get_object()
        serializer = ClearanceActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        clearance.is_cleared = True
        clearance.cleared_by = request.user
        clearance.cleared_at = timezone.now()
        clearance.comments = serializer.validated_data.get('comments', '')
        clearance.outstanding_items = serializer.validated_data.get('outstanding_items', '')
        clearance.conditions = serializer.validated_data.get('conditions', '')
        clearance.amount_owed = serializer.validated_data.get('amount_owed', 0)
        clearance.amount_due = serializer.validated_data.get('amount_due', 0)
        clearance.save()

        # Check if all clearances are complete
        exit_request = clearance.exit_request
        if exit_request.is_clearance_complete:
            exit_request.status = ExitRequest.Status.IN_PROGRESS
            exit_request.save()

        return Response(ExitClearanceSerializer(clearance).data)

    @action(detail=True, methods=['post'])
    def update_checklist(self, request, pk=None):
        """Update checklist item completion."""
        clearance = self.get_object()
        item_id = request.data.get('item_id')
        is_completed = request.data.get('is_completed', False)
        notes = request.data.get('notes', '')

        try:
            item = clearance.checklist_items.get(id=item_id)
            item.is_completed = is_completed
            item.notes = notes
            if is_completed:
                item.completed_by = request.user
                item.completed_at = timezone.now()
            else:
                item.completed_by = None
                item.completed_at = None
            item.save()

            return Response(ExitChecklistItemSerializer(item).data)
        except ExitChecklistItem.DoesNotExist:
            return Response(
                {'error': 'Checklist item not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class AssetReturnViewSet(viewsets.ModelViewSet):
    """ViewSet for AssetReturn model."""
    queryset = AssetReturn.objects.select_related(
        'exit_request', 'exit_request__employee', 'received_by'
    )
    serializer_class = AssetReturnSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['exit_request', 'status']
    search_fields = ['asset_name', 'asset_tag']

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get pending asset returns."""
        queryset = self.get_queryset().filter(status=AssetReturn.Status.PENDING)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def process_return(self, request, pk=None):
        """Process asset return."""
        asset = self.get_object()
        serializer = ReturnAssetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        asset.status = serializer.validated_data['status']
        asset.condition_notes = serializer.validated_data.get('condition_notes', '')
        asset.deduction_amount = serializer.validated_data.get('deduction_amount', 0)
        asset.returned_at = timezone.now()
        asset.received_by = request.user
        asset.save()

        return Response(AssetReturnSerializer(asset).data)


class FinalSettlementViewSet(viewsets.ModelViewSet):
    """ViewSet for FinalSettlement model."""
    queryset = FinalSettlement.objects.select_related(
        'exit_request', 'exit_request__employee',
        'calculated_by', 'approved_by'
    )
    serializer_class = FinalSettlementSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['exit_request', 'status']

    @action(detail=True, methods=['post'])
    def calculate(self, request, pk=None):
        """Calculate settlement amounts."""
        settlement = self.get_object()
        serializer = CalculateSettlementSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Update fields
        for field, value in serializer.validated_data.items():
            setattr(settlement, field, value)

        # Calculate totals
        settlement.calculate_totals()
        settlement.status = FinalSettlement.Status.CALCULATED
        settlement.calculated_by = request.user
        settlement.calculated_at = timezone.now()
        settlement.save()

        return Response(FinalSettlementSerializer(settlement).data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve settlement."""
        settlement = self.get_object()

        if settlement.status != FinalSettlement.Status.CALCULATED:
            return Response(
                {'error': 'Settlement must be calculated first'},
                status=status.HTTP_400_BAD_REQUEST
            )

        settlement.status = FinalSettlement.Status.APPROVED
        settlement.approved_by = request.user
        settlement.approved_at = timezone.now()
        settlement.save()

        return Response(FinalSettlementSerializer(settlement).data)

    @action(detail=True, methods=['post'])
    def mark_paid(self, request, pk=None):
        """Mark settlement as paid."""
        settlement = self.get_object()
        payment_reference = request.data.get('payment_reference', '')

        if settlement.status != FinalSettlement.Status.APPROVED:
            return Response(
                {'error': 'Settlement must be approved first'},
                status=status.HTTP_400_BAD_REQUEST
            )

        settlement.status = FinalSettlement.Status.PAID
        settlement.paid_at = timezone.now()
        settlement.payment_reference = payment_reference
        settlement.save()

        return Response(FinalSettlementSerializer(settlement).data)
