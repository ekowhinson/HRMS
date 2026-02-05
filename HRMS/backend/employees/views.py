"""
Employee management views.
"""

from rest_framework import viewsets, generics, status, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Count, Q

from .models import (
    Employee, EmergencyContact, Dependent, Education,
    WorkExperience, Certification, Skill, BankAccount, EmploymentHistory
)
from .serializers import (
    EmployeeSerializer, EmployeeListSerializer, EmployeeCreateSerializer,
    EmergencyContactSerializer, DependentSerializer, EducationSerializer,
    WorkExperienceSerializer, CertificationSerializer, SkillSerializer,
    BankAccountSerializer, EmploymentHistorySerializer,
    EmployeeProfileSerializer, EmployeeProfileUpdateSerializer, MyTeamMemberSerializer
)
from leave.models import LeaveBalance, LeaveRequest
from leave.serializers import LeaveBalanceSerializer, LeaveRequestSerializer


class EmployeeViewSet(viewsets.ModelViewSet):
    """ViewSet for Employee CRUD operations."""
    queryset = Employee.objects.select_related(
        'department', 'position', 'grade', 'supervisor'
    ).prefetch_related('dependents', 'emergency_contacts')
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'department', 'grade', 'employment_type']
    search_fields = ['employee_number', 'first_name', 'last_name', 'work_email']
    ordering_fields = ['employee_number', 'first_name', 'last_name', 'date_of_joining']
    ordering = ['employee_number']

    def get_serializer_class(self):
        if self.action == 'list':
            return EmployeeListSerializer
        if self.action == 'create':
            return EmployeeCreateSerializer
        return EmployeeSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        # Additional filters
        status_param = self.request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
        return queryset

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate an employee."""
        employee = self.get_object()
        employee.status = Employee.EmploymentStatus.ACTIVE
        employee.save()
        return Response({'message': 'Employee activated successfully'})

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Deactivate an employee."""
        employee = self.get_object()
        employee.status = Employee.EmploymentStatus.TERMINATED
        employee.save()
        return Response({'message': 'Employee deactivated successfully'})


class BulkImportView(APIView):
    """Bulk import employees from Excel/CSV."""

    def post(self, request):
        # TODO: Implement bulk import
        return Response({'message': 'Bulk import endpoint'}, status=status.HTTP_501_NOT_IMPLEMENTED)


class BulkExportView(APIView):
    """Bulk export employees to Excel/CSV."""

    def get(self, request):
        # TODO: Implement bulk export
        return Response({'message': 'Bulk export endpoint'}, status=status.HTTP_501_NOT_IMPLEMENTED)


class DependentListView(generics.ListCreateAPIView):
    """List and create dependents for an employee."""
    serializer_class = DependentSerializer

    def get_queryset(self):
        return Dependent.objects.filter(employee_id=self.kwargs['employee_id'])

    def perform_create(self, serializer):
        serializer.save(employee_id=self.kwargs['employee_id'])


class EducationListView(generics.ListCreateAPIView):
    """List and create education records for an employee."""
    serializer_class = EducationSerializer

    def get_queryset(self):
        return Education.objects.filter(employee_id=self.kwargs['employee_id'])

    def perform_create(self, serializer):
        serializer.save(employee_id=self.kwargs['employee_id'])


class WorkExperienceListView(generics.ListCreateAPIView):
    """List and create work experience for an employee."""
    serializer_class = WorkExperienceSerializer

    def get_queryset(self):
        return WorkExperience.objects.filter(employee_id=self.kwargs['employee_id'])

    def perform_create(self, serializer):
        serializer.save(employee_id=self.kwargs['employee_id'])


class CertificationListView(generics.ListCreateAPIView):
    """List and create certifications for an employee."""
    serializer_class = CertificationSerializer

    def get_queryset(self):
        return Certification.objects.filter(employee_id=self.kwargs['employee_id'])

    def perform_create(self, serializer):
        serializer.save(employee_id=self.kwargs['employee_id'])


class SkillListView(generics.ListCreateAPIView):
    """List and create skills for an employee."""
    serializer_class = SkillSerializer

    def get_queryset(self):
        return Skill.objects.filter(employee_id=self.kwargs['employee_id'])

    def perform_create(self, serializer):
        serializer.save(employee_id=self.kwargs['employee_id'])


class BankAccountListView(generics.ListCreateAPIView):
    """List and create bank accounts for an employee."""
    serializer_class = BankAccountSerializer

    def get_queryset(self):
        return BankAccount.objects.filter(employee_id=self.kwargs['employee_id'])

    def perform_create(self, serializer):
        serializer.save(employee_id=self.kwargs['employee_id'])


class EmergencyContactListView(generics.ListCreateAPIView):
    """List and create emergency contacts for an employee."""
    serializer_class = EmergencyContactSerializer

    def get_queryset(self):
        return EmergencyContact.objects.filter(employee_id=self.kwargs['employee_id'])

    def perform_create(self, serializer):
        serializer.save(employee_id=self.kwargs['employee_id'])


class EmploymentHistoryView(generics.ListAPIView):
    """List employment history for an employee."""
    serializer_class = EmploymentHistorySerializer

    def get_queryset(self):
        return EmploymentHistory.objects.filter(employee_id=self.kwargs['employee_id'])


# ========================================
# Self-Service Portal Views
# ========================================

class MyProfileView(generics.RetrieveUpdateAPIView):
    """
    View and update current user's employee profile.
    GET /employees/me/ - View profile
    PATCH /employees/me/ - Update allowed fields
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PATCH', 'PUT']:
            return EmployeeProfileUpdateSerializer
        return EmployeeProfileSerializer

    def get_object(self):
        user = self.request.user
        if not hasattr(user, 'employee') or user.employee is None:
            from rest_framework.exceptions import NotFound
            raise NotFound('Employee profile not found')
        return user.employee


class MyLeaveBalancesView(generics.ListAPIView):
    """
    Get current user's leave balances.
    GET /employees/me/leave-balances/
    """
    serializer_class = LeaveBalanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        year = self.request.query_params.get('year', timezone.now().year)

        if not hasattr(user, 'employee') or user.employee is None:
            return LeaveBalance.objects.none()

        return LeaveBalance.objects.filter(
            employee=user.employee,
            year=year
        ).select_related('leave_type')


class MyLeaveHistoryView(generics.ListAPIView):
    """
    Get current user's leave history.
    GET /employees/me/leave-history/
    """
    serializer_class = LeaveRequestSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        if not hasattr(user, 'employee') or user.employee is None:
            return LeaveRequest.objects.none()

        queryset = LeaveRequest.objects.filter(
            employee=user.employee
        ).select_related('leave_type').order_by('-created_at')

        # Optional filters
        status_filter = self.request.query_params.get('status')
        year = self.request.query_params.get('year')

        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if year:
            queryset = queryset.filter(start_date__year=year)

        return queryset


class MyEmergencyContactsView(generics.ListCreateAPIView):
    """
    Manage current user's emergency contacts.
    GET /employees/me/emergency-contacts/
    POST /employees/me/emergency-contacts/
    """
    serializer_class = EmergencyContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'employee') or user.employee is None:
            return EmergencyContact.objects.none()
        return EmergencyContact.objects.filter(employee=user.employee)

    def perform_create(self, serializer):
        serializer.save(employee=self.request.user.employee)


class MyEmergencyContactDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Manage a specific emergency contact.
    GET/PATCH/DELETE /employees/me/emergency-contacts/<id>/
    """
    serializer_class = EmergencyContactSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'employee') or user.employee is None:
            return EmergencyContact.objects.none()
        return EmergencyContact.objects.filter(employee=user.employee)


class MyDependentsView(generics.ListCreateAPIView):
    """
    Manage current user's dependents.
    GET /employees/me/dependents/
    POST /employees/me/dependents/
    """
    serializer_class = DependentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'employee') or user.employee is None:
            return Dependent.objects.none()
        return Dependent.objects.filter(employee=user.employee)

    def perform_create(self, serializer):
        serializer.save(employee=self.request.user.employee)


class MyDependentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Manage a specific dependent.
    GET/PATCH/DELETE /employees/me/dependents/<id>/
    """
    serializer_class = DependentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'employee') or user.employee is None:
            return Dependent.objects.none()
        return Dependent.objects.filter(employee=user.employee)


class MyBankAccountsView(generics.ListAPIView):
    """
    View current user's bank accounts (read-only for security).
    GET /employees/me/bank-accounts/
    """
    serializer_class = BankAccountSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'employee') or user.employee is None:
            return BankAccount.objects.none()
        return BankAccount.objects.filter(employee=user.employee, is_active=True)


# ========================================
# Manager Views
# ========================================

class MyTeamView(generics.ListAPIView):
    """
    List current user's direct reports.
    GET /employees/me/team/
    """
    serializer_class = MyTeamMemberSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'employee') or user.employee is None:
            return Employee.objects.none()

        return Employee.objects.filter(
            supervisor=user.employee
        ).select_related('position').order_by('first_name', 'last_name')


class TeamLeaveOverviewView(APIView):
    """
    Get team leave summary for managers.
    GET /employees/me/team/leave-overview/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        if not hasattr(user, 'employee') or user.employee is None:
            return Response(
                {'error': 'Employee profile not found'},
                status=status.HTTP_400_BAD_REQUEST
            )

        employee = user.employee
        today = timezone.now().date()

        # Get direct reports
        direct_reports = Employee.objects.filter(supervisor=employee)
        team_size = direct_reports.count()

        # Who's on leave today
        on_leave_today = LeaveRequest.objects.filter(
            employee__supervisor=employee,
            status=LeaveRequest.Status.APPROVED,
            start_date__lte=today,
            end_date__gte=today
        ).select_related('employee', 'leave_type')

        # Pending approvals
        pending_approvals = LeaveRequest.objects.filter(
            employee__supervisor=employee,
            status=LeaveRequest.Status.PENDING
        ).count()

        # Upcoming leave (next 7 days)
        next_week = today + timezone.timedelta(days=7)
        upcoming_leave = LeaveRequest.objects.filter(
            employee__supervisor=employee,
            status=LeaveRequest.Status.APPROVED,
            start_date__gt=today,
            start_date__lte=next_week
        ).select_related('employee', 'leave_type')

        # Serialize on leave today
        on_leave_data = []
        for leave in on_leave_today:
            on_leave_data.append({
                'id': str(leave.id),
                'employee_id': str(leave.employee.id),
                'employee_name': leave.employee.full_name,
                'employee_photo': leave.employee.photo.url if leave.employee.photo else None,
                'leave_type': leave.leave_type.name,
                'leave_type_color': leave.leave_type.color_code,
                'start_date': leave.start_date,
                'end_date': leave.end_date,
            })

        # Serialize upcoming leave
        upcoming_data = []
        for leave in upcoming_leave:
            upcoming_data.append({
                'id': str(leave.id),
                'employee_id': str(leave.employee.id),
                'employee_name': leave.employee.full_name,
                'leave_type': leave.leave_type.name,
                'start_date': leave.start_date,
                'end_date': leave.end_date,
            })

        return Response({
            'team_size': team_size,
            'on_leave_today': on_leave_data,
            'on_leave_count': len(on_leave_data),
            'pending_approvals': pending_approvals,
            'upcoming_leave': upcoming_data,
        })
