"""
Leave management views.
"""

from rest_framework import viewsets, generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Q, Sum
from django.db import transaction
from datetime import datetime
from decimal import Decimal

from .models import (
    LeaveType, LeavePolicy, LeaveBalance, LeaveRequest, LeaveDocument,
    LeavePlan, LeavePlanEntry, LeaveCarryForwardRequest, LeaveReminder
)
from .serializers import (
    LeaveTypeSerializer, LeavePolicySerializer, LeaveBalanceSerializer,
    LeaveRequestSerializer, LeaveRequestCreateSerializer,
    LeaveCalendarEventSerializer, TeamLeaveSerializer, LeaveDocumentSerializer,
    LeavePlanSerializer, LeavePlanCreateSerializer, LeavePlanEntrySerializer,
    LeaveCarryForwardRequestSerializer, LeaveReminderSerializer,
    LeavePlanCalendarSerializer
)
from .permissions import IsHROrReadOnly, IsOwnerOrManager, CanApproveLeave, IsEmployee


class LeaveTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for Leave Types."""
    queryset = LeaveType.objects.filter(is_active=True)
    serializer_class = LeaveTypeSerializer
    permission_classes = [IsAuthenticated, IsHROrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['is_active', 'is_paid', 'accrual_type']
    search_fields = ['code', 'name', 'description']
    ordering = ['sort_order', 'name']


class LeavePolicyViewSet(viewsets.ModelViewSet):
    """ViewSet for Leave Policies."""
    queryset = LeavePolicy.objects.select_related('leave_type', 'grade')
    serializer_class = LeavePolicySerializer
    permission_classes = [IsAuthenticated, IsHROrReadOnly]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['leave_type', 'grade', 'is_active']
    ordering = ['leave_type', 'name']


class LeaveRequestViewSet(viewsets.ModelViewSet):
    """ViewSet for Leave Requests."""
    queryset = LeaveRequest.objects.select_related('employee', 'leave_type')
    permission_classes = [IsAuthenticated, IsOwnerOrManager]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'leave_type', 'employee']
    search_fields = ['request_number', 'employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return LeaveRequestCreateSerializer
        return LeaveRequestSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        # Superusers and staff see all
        if user.is_superuser or user.is_staff:
            return queryset

        # HR sees all
        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return queryset

        # Regular employees see their own and their team's requests
        if hasattr(user, 'employee'):
            employee = user.employee
            return queryset.filter(
                Q(employee=employee) |  # Own requests
                Q(employee__supervisor=employee)  # Direct reports' requests
            )

        return queryset.none()


class LeaveBalanceListView(generics.ListAPIView):
    """List leave balances for current user."""
    serializer_class = LeaveBalanceSerializer
    permission_classes = [IsAuthenticated, IsEmployee]

    def get_queryset(self):
        user = self.request.user
        year = self.request.query_params.get('year', timezone.now().year)
        if hasattr(user, 'employee'):
            return LeaveBalance.objects.filter(
                employee=user.employee,
                year=year
            ).select_related('leave_type')
        return LeaveBalance.objects.none()


class EmployeeLeaveBalanceView(generics.ListAPIView):
    """List leave balances for a specific employee."""
    serializer_class = LeaveBalanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        employee_id = self.kwargs['employee_id']
        year = self.request.query_params.get('year', timezone.now().year)
        return LeaveBalance.objects.filter(
            employee_id=employee_id,
            year=year
        ).select_related('leave_type')


class LeaveCalendarView(APIView):
    """Get leave calendar data."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Return leave events for the given date range.
        Query params:
            - start_date: Start of date range (YYYY-MM-DD)
            - end_date: End of date range (YYYY-MM-DD)
            - department: Filter by department ID (optional)
            - leave_type: Filter by leave type ID (optional)
            - include_plans: Include DRAFT (Plan) and PENDING status (default: false)
            - status: Filter by specific status (DRAFT, PENDING, APPROVED)
        """
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        department_id = request.query_params.get('department')
        leave_type_id = request.query_params.get('leave_type')
        include_plans = request.query_params.get('include_plans', 'false').lower() == 'true'
        status_filter = request.query_params.get('status')

        # Default to current month if no dates provided
        today = timezone.now().date()
        if not start_date_str:
            start_date = today.replace(day=1)
        else:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid start_date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        if not end_date_str:
            # Default to end of current month
            if today.month == 12:
                end_date = today.replace(year=today.year + 1, month=1, day=1)
            else:
                end_date = today.replace(month=today.month + 1, day=1)
        else:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response(
                    {'error': 'Invalid end_date format. Use YYYY-MM-DD'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Build status filter
        if status_filter:
            status_list = [status_filter]
        elif include_plans:
            status_list = [
                LeaveRequest.Status.DRAFT,
                LeaveRequest.Status.PENDING,
                LeaveRequest.Status.APPROVED
            ]
        else:
            status_list = [LeaveRequest.Status.APPROVED]

        # Query leave requests that overlap with the date range
        queryset = LeaveRequest.objects.filter(
            status__in=status_list,
            start_date__lte=end_date,
            end_date__gte=start_date
        ).select_related(
            'employee', 'employee__department', 'leave_type'
        )

        # Apply department filter
        if department_id:
            queryset = queryset.filter(employee__department_id=department_id)

        # Apply leave type filter
        if leave_type_id:
            queryset = queryset.filter(leave_type_id=leave_type_id)

        serializer = LeaveCalendarEventSerializer(queryset, many=True)
        events = serializer.data

        # Calculate overlaps for each date in the range
        overlaps = self._calculate_overlaps(queryset, start_date, end_date)

        return Response({
            'events': events,
            'overlaps': overlaps
        })

    def _calculate_overlaps(self, queryset, start_date, end_date):
        """Calculate dates with overlapping leave requests."""
        from collections import defaultdict
        from datetime import timedelta

        date_employees = defaultdict(set)

        # Build a map of date -> set of employee IDs
        for leave in queryset:
            current = max(leave.start_date, start_date)
            end = min(leave.end_date, end_date)
            while current <= end:
                date_employees[current.isoformat()].add(str(leave.employee_id))
                current += timedelta(days=1)

        # Find dates with more than one employee on leave
        overlaps = {}
        for date_str, employees in date_employees.items():
            if len(employees) > 1:
                overlaps[date_str] = len(employees)

        return overlaps


class TeamLeaveView(APIView):
    """Get team leave data for managers."""
    permission_classes = [IsAuthenticated, IsEmployee]

    def get(self, request):
        """
        Return leave requests for direct reports.
        Query params:
            - status: Filter by status (optional)
            - start_date: Filter by start date (optional)
            - end_date: Filter by end date (optional)
        """
        user = request.user

        if not hasattr(user, 'employee'):
            return Response(
                {'error': 'User is not associated with an employee record'},
                status=status.HTTP_400_BAD_REQUEST
            )

        employee = user.employee
        status_filter = request.query_params.get('status')
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        # Get leave requests for direct reports
        queryset = LeaveRequest.objects.filter(
            employee__supervisor=employee
        ).select_related(
            'employee', 'employee__position', 'leave_type'
        ).order_by('-created_at')

        # Apply status filter
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Apply date filters
        if start_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                queryset = queryset.filter(start_date__gte=start_date)
            except ValueError:
                pass

        if end_date_str:
            try:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                queryset = queryset.filter(end_date__lte=end_date)
            except ValueError:
                pass

        serializer = TeamLeaveSerializer(queryset, many=True)

        # Also include summary stats
        today = timezone.now().date()
        team_on_leave_today = LeaveRequest.objects.filter(
            employee__supervisor=employee,
            status=LeaveRequest.Status.APPROVED,
            start_date__lte=today,
            end_date__gte=today
        ).count()

        pending_count = LeaveRequest.objects.filter(
            employee__supervisor=employee,
            status=LeaveRequest.Status.PENDING
        ).count()

        return Response({
            'requests': serializer.data,
            'summary': {
                'on_leave_today': team_on_leave_today,
                'pending_approvals': pending_count,
                'total_team_members': employee.direct_reports.count()
            }
        })


class PendingApprovalsView(generics.ListAPIView):
    """List pending leave approvals for current user."""
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        # Superusers and staff see all pending
        if user.is_superuser or user.is_staff:
            return LeaveRequest.objects.filter(
                status=LeaveRequest.Status.PENDING
            ).select_related('employee', 'leave_type')

        # HR sees all pending
        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return LeaveRequest.objects.filter(
                status=LeaveRequest.Status.PENDING
            ).select_related('employee', 'leave_type')

        # Managers see their direct reports' pending requests
        if hasattr(user, 'employee'):
            return LeaveRequest.objects.filter(
                employee__supervisor=user.employee,
                status=LeaveRequest.Status.PENDING
            ).select_related('employee', 'leave_type')

        return LeaveRequest.objects.none()


class SubmitLeaveView(APIView):
    """Submit a draft leave request for approval."""
    permission_classes = [IsAuthenticated, IsOwnerOrManager]

    def post(self, request, pk):
        try:
            leave_request = LeaveRequest.objects.select_related('leave_type').get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response(
                {'error': 'Leave request not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permission
        self.check_object_permissions(request, leave_request)

        if leave_request.status != LeaveRequest.Status.DRAFT:
            return Response(
                {'error': 'Only draft requests can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate advance notice (working days)
        leave_type = leave_request.leave_type
        if leave_type.advance_notice_days > 0 and not leave_type.is_emergency:
            from .utils import count_working_days
            today = timezone.now().date()
            working_days_notice = count_working_days(today, leave_request.start_date)
            if working_days_notice < leave_type.advance_notice_days:
                return Response(
                    {
                        'error': (
                            f'{leave_type.name} requires at least {leave_type.advance_notice_days} '
                            f'working days advance notice. You have only {working_days_notice} '
                            f'working day(s) before the requested start date.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Validate leave balance
        try:
            balance = LeaveBalance.objects.get(
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                year=leave_request.start_date.year
            )
            if balance.available_balance < leave_request.number_of_days:
                return Response(
                    {'error': f'Insufficient leave balance. Available: {balance.available_balance} days'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Update pending balance
            balance.pending += leave_request.number_of_days
            balance.save()
        except LeaveBalance.DoesNotExist:
            return Response(
                {'error': 'No leave balance found for this leave type'},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_request.status = LeaveRequest.Status.PENDING
        leave_request.submitted_at = timezone.now()
        leave_request.save()

        serializer = LeaveRequestSerializer(leave_request)
        return Response({
            'message': 'Leave request submitted successfully',
            'data': serializer.data
        })


class ApproveLeaveView(APIView):
    """Approve a leave request."""
    permission_classes = [IsAuthenticated, CanApproveLeave]

    def post(self, request, pk):
        try:
            leave_request = LeaveRequest.objects.get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response(
                {'error': 'Leave request not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permission
        self.check_object_permissions(request, leave_request)

        if leave_request.status != LeaveRequest.Status.PENDING:
            return Response(
                {'error': 'Only pending requests can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_request.status = LeaveRequest.Status.APPROVED
        leave_request.approved_by = request.user
        leave_request.approved_at = timezone.now()
        leave_request.save()

        # Update leave balance
        try:
            balance = LeaveBalance.objects.get(
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                year=leave_request.start_date.year
            )
            balance.pending -= leave_request.number_of_days
            balance.taken += leave_request.number_of_days
            balance.save()
        except LeaveBalance.DoesNotExist:
            pass

        return Response({'message': 'Leave approved successfully'})


class RejectLeaveView(APIView):
    """Reject a leave request."""
    permission_classes = [IsAuthenticated, CanApproveLeave]

    def post(self, request, pk):
        try:
            leave_request = LeaveRequest.objects.get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response(
                {'error': 'Leave request not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permission
        self.check_object_permissions(request, leave_request)

        if leave_request.status != LeaveRequest.Status.PENDING:
            return Response(
                {'error': 'Only pending requests can be rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        leave_request.status = LeaveRequest.Status.REJECTED
        leave_request.rejection_reason = request.data.get('reason', '')
        leave_request.save()

        # Restore pending balance
        try:
            balance = LeaveBalance.objects.get(
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                year=leave_request.start_date.year
            )
            balance.pending -= leave_request.number_of_days
            balance.save()
        except LeaveBalance.DoesNotExist:
            pass

        return Response({'message': 'Leave rejected successfully'})


class CancelLeaveView(APIView):
    """Cancel a leave request."""
    permission_classes = [IsAuthenticated, IsOwnerOrManager]

    def post(self, request, pk):
        try:
            leave_request = LeaveRequest.objects.get(pk=pk)
        except LeaveRequest.DoesNotExist:
            return Response(
                {'error': 'Leave request not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check permission
        self.check_object_permissions(request, leave_request)

        if leave_request.status not in [LeaveRequest.Status.PENDING, LeaveRequest.Status.APPROVED]:
            return Response(
                {'error': 'Only pending or approved requests can be cancelled'},
                status=status.HTTP_400_BAD_REQUEST
            )

        old_status = leave_request.status
        leave_request.status = LeaveRequest.Status.CANCELLED
        leave_request.cancellation_reason = request.data.get('reason', '')
        leave_request.cancelled_at = timezone.now()
        leave_request.save()

        # Restore balance
        try:
            balance = LeaveBalance.objects.get(
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                year=leave_request.start_date.year
            )
            if old_status == LeaveRequest.Status.PENDING:
                balance.pending -= leave_request.number_of_days
            elif old_status == LeaveRequest.Status.APPROVED:
                balance.taken -= leave_request.number_of_days
            balance.save()
        except LeaveBalance.DoesNotExist:
            pass

        return Response({'message': 'Leave cancelled successfully'})


class LeaveDocumentUploadView(generics.CreateAPIView):
    """Upload a document for a leave request."""
    serializer_class = LeaveDocumentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class YearEndProcessView(APIView):
    """Process year-end leave carry forward."""
    permission_classes = [IsAuthenticated, IsHROrReadOnly]

    def post(self, request):
        # TODO: Implement year-end processing
        return Response(
            {'message': 'Year-end process endpoint'},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )


# ============================================
# Leave Planning ViewSets
# ============================================

class LeavePlanViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Leave Plans - Annual leave planning for employees.
    Supports mandatory annual leave planning per NHIA SRS.
    """
    queryset = LeavePlan.objects.select_related('employee', 'approved_by').prefetch_related('entries')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['year', 'status', 'employee']
    search_fields = ['employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-year', '-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return LeavePlanCreateSerializer
        return LeavePlanSerializer

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        # Superusers and HR see all
        if user.is_superuser or user.is_staff:
            return queryset

        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return queryset

        # Regular employees see their own and their team's plans
        if hasattr(user, 'employee'):
            employee = user.employee
            return queryset.filter(
                Q(employee=employee) |
                Q(employee__supervisor=employee)
            )

        return queryset.none()

    @action(detail=False, methods=['get'])
    def my_plan(self, request):
        """Get current user's leave plan for specified year."""
        year = request.query_params.get('year', timezone.now().year)
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        plan = LeavePlan.objects.filter(
            employee=request.user.employee,
            year=year
        ).first()

        if not plan:
            return Response({'message': 'No plan found for this year'}, status=status.HTTP_404_NOT_FOUND)

        serializer = LeavePlanSerializer(plan)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit leave plan for approval."""
        plan = self.get_object()

        if plan.status != LeavePlan.Status.DRAFT:
            return Response(
                {'error': 'Only draft plans can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate plan has entries
        if not plan.entries.exists():
            return Response(
                {'error': 'Plan must have at least one planned leave entry'},
                status=status.HTTP_400_BAD_REQUEST
            )

        plan.status = LeavePlan.Status.SUBMITTED
        plan.submitted_at = timezone.now()
        plan.save()

        serializer = LeavePlanSerializer(plan)
        return Response({'message': 'Plan submitted successfully', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted leave plan."""
        plan = self.get_object()

        if plan.status != LeavePlan.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted plans can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        plan.status = LeavePlan.Status.APPROVED
        plan.approved_at = timezone.now()
        plan.approved_by = request.user
        plan.manager_comments = request.data.get('comments', '')
        plan.save()

        serializer = LeavePlanSerializer(plan)
        return Response({'message': 'Plan approved successfully', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a submitted leave plan."""
        plan = self.get_object()

        if plan.status != LeavePlan.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted plans can be rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        plan.status = LeavePlan.Status.REJECTED
        plan.rejection_reason = request.data.get('reason', '')
        plan.save()

        serializer = LeavePlanSerializer(plan)
        return Response({'message': 'Plan rejected', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def request_revision(self, request, pk=None):
        """Request revision of a submitted plan."""
        plan = self.get_object()

        if plan.status != LeavePlan.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted plans can be sent for revision'},
                status=status.HTTP_400_BAD_REQUEST
            )

        plan.status = LeavePlan.Status.REVISION_REQUESTED
        plan.revision_reason = request.data.get('reason', '')
        plan.save()

        serializer = LeavePlanSerializer(plan)
        return Response({'message': 'Revision requested', 'data': serializer.data})

    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get plans pending approval (for managers/HR)."""
        queryset = self.get_queryset().filter(status=LeavePlan.Status.SUBMITTED)
        serializer = LeavePlanSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def convert_to_request(self, request, pk=None):
        """Convert a planned leave entry to an actual leave request."""
        plan = self.get_object()
        entry_id = request.data.get('entry_id')

        if not entry_id:
            return Response({'error': 'entry_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            entry = plan.entries.get(pk=entry_id)
        except LeavePlanEntry.DoesNotExist:
            return Response({'error': 'Entry not found'}, status=status.HTTP_404_NOT_FOUND)

        if entry.status != LeavePlanEntry.Status.PLANNED:
            return Response(
                {'error': 'Only planned entries can be converted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create leave request from plan entry
        import uuid
        leave_request = LeaveRequest.objects.create(
            employee=plan.employee,
            leave_type=entry.leave_type,
            request_number=f"LV-{uuid.uuid4().hex[:8].upper()}",
            start_date=entry.start_date,
            end_date=entry.end_date,
            number_of_days=entry.number_of_days,
            reason=entry.description or 'From annual leave plan',
            status=LeaveRequest.Status.DRAFT
        )

        # Link entry to request
        entry.leave_request = leave_request
        entry.status = LeavePlanEntry.Status.REQUESTED
        entry.save()

        return Response({
            'message': 'Leave request created from plan',
            'leave_request_id': str(leave_request.id)
        })


class LeavePlanEntryViewSet(viewsets.ModelViewSet):
    """ViewSet for Leave Plan Entries."""
    queryset = LeavePlanEntry.objects.select_related('leave_plan', 'leave_type', 'leave_request')
    serializer_class = LeavePlanEntrySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['leave_plan', 'leave_type', 'status', 'quarter']
    ordering = ['start_date']


class LeaveCarryForwardRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Leave Carry Forward Requests.
    Standard carry forward: Max 5 days.
    Additional days require CEO approval.
    """
    queryset = LeaveCarryForwardRequest.objects.select_related(
        'employee', 'hr_reviewer', 'ceo_approver'
    )
    serializer_class = LeaveCarryForwardRequestSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['from_year', 'to_year', 'status', 'employee']
    search_fields = ['employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if user.is_superuser or user.is_staff:
            return queryset

        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return queryset

        if hasattr(user, 'employee'):
            return queryset.filter(employee=user.employee)

        return queryset.none()

    @action(detail=True, methods=['post'])
    def hr_review(self, request, pk=None):
        """HR review of carry forward request."""
        cfr = self.get_object()

        if cfr.status != LeaveCarryForwardRequest.Status.PENDING:
            return Response(
                {'error': 'Only pending requests can be reviewed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        action_type = request.data.get('action')  # 'approve' or 'reject'
        comments = request.data.get('comments', '')

        if action_type == 'approve':
            # Check if CEO approval needed
            if cfr.additional_days_requested > 0:
                cfr.status = LeaveCarryForwardRequest.Status.AWAITING_CEO
            else:
                cfr.status = LeaveCarryForwardRequest.Status.APPROVED
                cfr.approved_carry_forward = cfr.standard_carry_forward
                cfr.days_to_lapse = cfr.available_balance - cfr.standard_carry_forward
        elif action_type == 'reject':
            cfr.status = LeaveCarryForwardRequest.Status.REJECTED
            cfr.rejection_reason = comments
        else:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

        cfr.hr_reviewer = request.user
        cfr.hr_reviewed_at = timezone.now()
        cfr.hr_comments = comments
        cfr.save()

        serializer = self.get_serializer(cfr)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def ceo_approve(self, request, pk=None):
        """CEO approval for additional carry forward days."""
        cfr = self.get_object()

        if cfr.status != LeaveCarryForwardRequest.Status.AWAITING_CEO:
            return Response(
                {'error': 'Request is not awaiting CEO approval'},
                status=status.HTTP_400_BAD_REQUEST
            )

        action_type = request.data.get('action')  # 'approve' or 'reject'
        approved_days = request.data.get('approved_days')
        comments = request.data.get('comments', '')

        if action_type == 'approve':
            if approved_days is None:
                return Response(
                    {'error': 'approved_days is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            cfr.status = LeaveCarryForwardRequest.Status.APPROVED
            cfr.approved_carry_forward = Decimal(str(approved_days))
            cfr.days_to_lapse = cfr.available_balance - cfr.approved_carry_forward
        elif action_type == 'reject':
            # If CEO rejects, only standard carry forward applies
            cfr.status = LeaveCarryForwardRequest.Status.REJECTED
            cfr.approved_carry_forward = cfr.standard_carry_forward
            cfr.days_to_lapse = cfr.available_balance - cfr.standard_carry_forward
            cfr.rejection_reason = comments
        else:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)

        cfr.ceo_approver = request.user
        cfr.ceo_approved_at = timezone.now()
        cfr.ceo_comments = comments
        cfr.save()

        serializer = self.get_serializer(cfr)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_hr_review(self, request):
        """Get requests pending HR review."""
        queryset = self.get_queryset().filter(
            status=LeaveCarryForwardRequest.Status.PENDING
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_ceo_approval(self, request):
        """Get requests pending CEO approval."""
        queryset = self.get_queryset().filter(
            status=LeaveCarryForwardRequest.Status.AWAITING_CEO
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def process(self, request, pk=None):
        """Process approved carry forward - update balances."""
        cfr = self.get_object()

        if cfr.status != LeaveCarryForwardRequest.Status.APPROVED:
            return Response(
                {'error': 'Only approved requests can be processed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Get or create next year's balance for annual leave
            annual_leave_type = LeaveType.objects.filter(
                code__in=['AL', 'ANNUAL', 'ANNUAL_LEAVE']
            ).first()

            if not annual_leave_type:
                return Response(
                    {'error': 'Annual leave type not found'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Update current year balance - mark as lapsed
            current_balance = LeaveBalance.objects.filter(
                employee=cfr.employee,
                leave_type=annual_leave_type,
                year=cfr.from_year
            ).first()

            if current_balance:
                current_balance.lapsed = cfr.days_to_lapse
                current_balance.carried_forward = cfr.approved_carry_forward
                current_balance.save()

            # Create/update next year balance with carried forward days
            next_balance, created = LeaveBalance.objects.get_or_create(
                employee=cfr.employee,
                leave_type=annual_leave_type,
                year=cfr.to_year,
                defaults={
                    'opening_balance': cfr.approved_carry_forward
                }
            )

            if not created:
                next_balance.opening_balance = cfr.approved_carry_forward
                next_balance.save()

            cfr.status = LeaveCarryForwardRequest.Status.PROCESSED
            cfr.save()

        serializer = self.get_serializer(cfr)
        return Response({
            'message': 'Carry forward processed successfully',
            'data': serializer.data
        })


class LeaveReminderViewSet(viewsets.ModelViewSet):
    """ViewSet for Leave Reminders."""
    queryset = LeaveReminder.objects.select_related('employee')
    serializer_class = LeaveReminderSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['year', 'reminder_type', 'acknowledged', 'employee']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        if user.is_superuser or user.is_staff:
            return queryset

        if hasattr(user, 'employee'):
            return queryset.filter(employee=user.employee)

        return queryset.none()

    @action(detail=False, methods=['get'])
    def my_reminders(self, request):
        """Get current user's unacknowledged reminders."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        reminders = self.get_queryset().filter(
            employee=request.user.employee,
            acknowledged=False
        )
        serializer = self.get_serializer(reminders, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge a reminder."""
        reminder = self.get_object()
        reminder.acknowledged = True
        reminder.acknowledged_at = timezone.now()
        reminder.save()

        serializer = self.get_serializer(reminder)
        return Response({'message': 'Reminder acknowledged', 'data': serializer.data})

    @action(detail=False, methods=['post'])
    def generate_q4_reminders(self, request):
        """Generate Q4 reminders for employees with outstanding leave balance."""
        from employees.models import Employee

        year = request.data.get('year', timezone.now().year)
        threshold = Decimal(str(request.data.get('threshold', 5)))

        # Find employees with outstanding balance above threshold
        balances = LeaveBalance.objects.filter(
            year=year,
            leave_type__code__in=['AL', 'ANNUAL', 'ANNUAL_LEAVE']
        ).select_related('employee', 'leave_type')

        created_count = 0
        for balance in balances:
            available = balance.available_balance
            if available > threshold:
                # Check if reminder already exists
                existing = LeaveReminder.objects.filter(
                    employee=balance.employee,
                    year=year,
                    reminder_type=LeaveReminder.ReminderType.Q4_BALANCE
                ).exists()

                if not existing:
                    LeaveReminder.objects.create(
                        employee=balance.employee,
                        year=year,
                        reminder_type=LeaveReminder.ReminderType.Q4_BALANCE,
                        outstanding_balance=available,
                        message=f"You have {available} days of annual leave remaining for {year}. "
                                f"Please plan your leave before year end. Maximum carry forward is 5 days."
                    )
                    created_count += 1

        return Response({
            'message': f'Generated {created_count} Q4 reminders',
            'count': created_count
        })


class LeavePlanCalendarView(APIView):
    """Get leave plan entries for calendar visualization."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """
        Return planned leave entries for calendar display.
        Query params:
            - start_date: Start of date range
            - end_date: End of date range
            - department: Filter by department ID
            - year: Filter by planning year
        """
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')
        department_id = request.query_params.get('department')
        year = request.query_params.get('year', timezone.now().year)

        # Parse dates
        try:
            if start_date_str:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            else:
                start_date = datetime(int(year), 1, 1).date()

            if end_date_str:
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            else:
                end_date = datetime(int(year), 12, 31).date()
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Query plan entries
        queryset = LeavePlanEntry.objects.filter(
            leave_plan__year=year,
            leave_plan__status__in=[LeavePlan.Status.SUBMITTED, LeavePlan.Status.APPROVED],
            start_date__lte=end_date,
            end_date__gte=start_date
        ).select_related(
            'leave_plan__employee', 'leave_plan__employee__department', 'leave_type'
        )

        if department_id:
            queryset = queryset.filter(leave_plan__employee__department_id=department_id)

        serializer = LeavePlanCalendarSerializer(queryset, many=True)
        return Response({'entries': serializer.data})


# ========================================
# Location-Based Approval Workflow Views
# ========================================

from .models import (
    LeaveApprovalWorkflowTemplate, LeaveApprovalWorkflowLevel,
    LocationWorkflowMapping, LeaveRequestWorkflowStatus,
    LeaveApprovalAction, LeaveRelieverValidation
)
from .serializers import (
    LeaveApprovalWorkflowTemplateSerializer, LeaveApprovalWorkflowTemplateCreateSerializer,
    LeaveApprovalWorkflowLevelSerializer,
    LocationWorkflowMappingSerializer,
    LeaveRequestWorkflowStatusSerializer,
    LeaveApprovalActionSerializer,
    LeaveRelieverValidationSerializer,
    ValidateRelieverSerializer, WorkflowActionSerializer
)


class LeaveApprovalWorkflowTemplateViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Leave Approval Workflow Templates."""
    queryset = LeaveApprovalWorkflowTemplate.objects.prefetch_related('levels')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['location_category', 'is_active', 'is_default']

    def get_serializer_class(self):
        if self.action == 'create':
            return LeaveApprovalWorkflowTemplateCreateSerializer
        return LeaveApprovalWorkflowTemplateSerializer

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get all active templates."""
        templates = self.get_queryset().filter(is_active=True)
        serializer = LeaveApprovalWorkflowTemplateSerializer(templates, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def by_category(self, request):
        """Get templates by location category."""
        category = request.query_params.get('category')
        if not category:
            return Response({'error': 'category is required'}, status=status.HTTP_400_BAD_REQUEST)

        templates = self.get_queryset().filter(location_category=category, is_active=True)
        serializer = LeaveApprovalWorkflowTemplateSerializer(templates, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_level(self, request, pk=None):
        """Add an approval level to a template."""
        template = self.get_object()

        # Get next level number
        max_level = template.levels.aggregate(max_level=models.Max('level'))['max_level'] or 0
        next_level = max_level + 1

        if next_level > template.max_levels:
            return Response(
                {'error': f'Maximum {template.max_levels} levels allowed'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = {**request.data, 'template': template.id, 'level': next_level}
        serializer = LeaveApprovalWorkflowLevelSerializer(data=data)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        """Set this template as the default for its location category."""
        template = self.get_object()

        # Clear other defaults in same category
        LeaveApprovalWorkflowTemplate.objects.filter(
            location_category=template.location_category,
            is_default=True
        ).update(is_default=False)

        template.is_default = True
        template.save()

        return Response(LeaveApprovalWorkflowTemplateSerializer(template).data)


class LeaveApprovalWorkflowLevelViewSet(viewsets.ModelViewSet):
    """ViewSet for managing workflow levels."""
    queryset = LeaveApprovalWorkflowLevel.objects.select_related('template', 'approver_role', 'approver_user')
    serializer_class = LeaveApprovalWorkflowLevelSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['template', 'approver_type']


class LocationWorkflowMappingViewSet(viewsets.ModelViewSet):
    """ViewSet for managing location to workflow mappings."""
    queryset = LocationWorkflowMapping.objects.select_related('location', 'workflow_template')
    serializer_class = LocationWorkflowMappingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['location', 'workflow_template', 'is_active']

    @action(detail=False, methods=['get'])
    def get_workflow_for_location(self, request):
        """Get the applicable workflow for a location."""
        location_id = request.query_params.get('location_id')
        if not location_id:
            return Response({'error': 'location_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        # Find active mapping
        mapping = self.get_queryset().filter(
            location_id=location_id,
            is_active=True,
            effective_from__lte=timezone.now().date()
        ).filter(
            models.Q(effective_to__isnull=True) | models.Q(effective_to__gte=timezone.now().date())
        ).first()

        if mapping:
            return Response({
                'mapping': LocationWorkflowMappingSerializer(mapping).data,
                'workflow': LeaveApprovalWorkflowTemplateSerializer(mapping.workflow_template).data
            })

        # No specific mapping - find default template
        from organization.models import WorkLocation
        try:
            location = WorkLocation.objects.get(id=location_id)
            # Determine location category based on location type
            # This would need to be customized based on actual location model structure
            default_template = LeaveApprovalWorkflowTemplate.objects.filter(
                is_default=True,
                is_active=True
            ).first()

            if default_template:
                return Response({
                    'mapping': None,
                    'workflow': LeaveApprovalWorkflowTemplateSerializer(default_template).data,
                    'is_default': True
                })
        except WorkLocation.DoesNotExist:
            pass

        return Response({'error': 'No workflow found for this location'}, status=status.HTTP_404_NOT_FOUND)


class LeaveRequestWorkflowStatusViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet for viewing leave request workflow status."""
    queryset = LeaveRequestWorkflowStatus.objects.select_related(
        'leave_request', 'workflow_template', 'pending_approver'
    ).prefetch_related('actions')
    serializer_class = LeaveRequestWorkflowStatusSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['leave_request', 'status']

    @action(detail=True, methods=['post'])
    def perform_action(self, request, pk=None):
        """Perform an approval action on a leave request."""
        workflow_status = self.get_object()

        serializer = WorkflowActionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action_type = serializer.validated_data['action']
        comments = serializer.validated_data.get('comments', '')

        # Get current level
        current_level = workflow_status.workflow_template.levels.filter(
            level=workflow_status.current_level
        ).first()

        # Verify user can approve at this level
        # (This would need more sophisticated checking in production)

        # Create action record
        leave_action = LeaveApprovalAction.objects.create(
            workflow_status=workflow_status,
            workflow_level=current_level,
            level_number=workflow_status.current_level,
            action=action_type,
            actor=request.user,
            comments=comments
        )

        # Handle date modifications if any
        if serializer.validated_data.get('modified_start_date'):
            leave_action.original_start_date = workflow_status.leave_request.start_date
            leave_action.modified_start_date = serializer.validated_data['modified_start_date']
            leave_action.original_end_date = workflow_status.leave_request.end_date
            leave_action.modified_end_date = serializer.validated_data.get('modified_end_date')
            leave_action.save()

            # Update leave request dates if approved
            if action_type == LeaveApprovalAction.ActionType.APPROVE:
                leave_request = workflow_status.leave_request
                leave_request.start_date = leave_action.modified_start_date
                leave_request.end_date = leave_action.modified_end_date or leave_request.end_date
                leave_request.number_of_days = leave_request.calculate_days()
                leave_request.save()

        # Update workflow status based on action
        if action_type == LeaveApprovalAction.ActionType.APPROVE:
            if workflow_status.current_level >= workflow_status.total_levels:
                # Final approval
                workflow_status.status = LeaveRequestWorkflowStatus.Status.APPROVED
                workflow_status.completed_at = timezone.now()

                # Update leave request
                leave_request = workflow_status.leave_request
                leave_request.status = LeaveRequest.Status.APPROVED
                leave_request.approved_at = timezone.now()
                leave_request.approved_by = request.user
                leave_request.save()
            else:
                # Move to next level
                workflow_status.advance_to_next_level()

        elif action_type == LeaveApprovalAction.ActionType.REJECT:
            workflow_status.status = LeaveRequestWorkflowStatus.Status.REJECTED
            workflow_status.completed_at = timezone.now()

            # Update leave request
            leave_request = workflow_status.leave_request
            leave_request.status = LeaveRequest.Status.REJECTED
            leave_request.rejection_reason = comments
            leave_request.save()

        workflow_status.save()

        return Response(LeaveRequestWorkflowStatusSerializer(workflow_status).data)


class LeaveRelieverValidationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing reliever validation."""
    queryset = LeaveRelieverValidation.objects.select_related(
        'leave_request', 'reliever', 'conflicting_leave', 'override_by'
    )
    serializer_class = LeaveRelieverValidationSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['leave_request', 'reliever', 'validation_status']

    @action(detail=False, methods=['post'])
    def validate_reliever(self, request):
        """Pre-validate a reliever before leave submission."""
        serializer = ValidateRelieverSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        from employees.models import Employee
        try:
            reliever = Employee.objects.get(id=serializer.validated_data['reliever_id'])
        except Employee.DoesNotExist:
            return Response({'error': 'Reliever not found'}, status=status.HTTP_404_NOT_FOUND)

        start_date = serializer.validated_data['start_date']
        end_date = serializer.validated_data['end_date']

        # Check reliever's leave during this period
        reliever_leaves = LeaveRequest.objects.filter(
            employee=reliever,
            status=LeaveRequest.Status.APPROVED,
        ).filter(
            models.Q(start_date__lte=end_date, end_date__gte=start_date)
        )

        if reliever_leaves.exists():
            conflict = reliever_leaves.first()
            return Response({
                'valid': False,
                'status': 'INVALID',
                'message': f'{reliever.full_name} is on leave from {conflict.start_date} to {conflict.end_date}',
                'conflicting_leave': {
                    'request_number': conflict.request_number,
                    'start_date': conflict.start_date,
                    'end_date': conflict.end_date,
                }
            })

        # Check if reliever is already assigned
        other_assignments = LeaveRelieverValidation.objects.filter(
            reliever=reliever,
            validation_status__in=['VALID', 'APPROVED'],
            leave_request__status=LeaveRequest.Status.APPROVED,
        ).filter(
            models.Q(leave_request__start_date__lte=end_date, leave_request__end_date__gte=start_date)
        )

        if other_assignments.exists():
            conflict = other_assignments.first()
            return Response({
                'valid': False,
                'status': 'CONFLICT',
                'message': f'{reliever.full_name} is already assigned as reliever for {conflict.leave_request.employee.full_name}',
            })

        return Response({
            'valid': True,
            'status': 'VALID',
            'message': f'{reliever.full_name} is available as reliever during this period'
        })

    @action(detail=True, methods=['post'])
    def override(self, request, pk=None):
        """Override reliever validation (for exceptional cases)."""
        validation = self.get_object()
        reason = request.data.get('reason', '')

        if not reason:
            return Response({'error': 'Override reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        validation.override_approved = True
        validation.override_by = request.user
        validation.override_reason = reason
        validation.override_at = timezone.now()
        validation.validation_status = LeaveRelieverValidation.ValidationStatus.APPROVED
        validation.save()

        return Response(LeaveRelieverValidationSerializer(validation).data)

    @action(detail=True, methods=['post'])
    def revalidate(self, request, pk=None):
        """Re-run validation for a reliever."""
        validation = self.get_object()
        validation.validate()
        return Response(LeaveRelieverValidationSerializer(validation).data)
