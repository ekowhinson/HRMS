"""
Leave management views.
"""

from rest_framework import viewsets, generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Q
from datetime import datetime

from .models import LeaveType, LeavePolicy, LeaveBalance, LeaveRequest, LeaveDocument
from .serializers import (
    LeaveTypeSerializer, LeavePolicySerializer, LeaveBalanceSerializer,
    LeaveRequestSerializer, LeaveRequestCreateSerializer,
    LeaveCalendarEventSerializer, TeamLeaveSerializer, LeaveDocumentSerializer
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
            leave_request = LeaveRequest.objects.get(pk=pk)
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
