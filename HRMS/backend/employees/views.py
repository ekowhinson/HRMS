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
    WorkExperience, Certification, Skill, BankAccount, EmploymentHistory,
    DataUpdateRequest, DataUpdateDocument,
    ServiceRequestType, ServiceRequest, ServiceRequestComment, ServiceRequestDocument
)
from .serializers import (
    EmployeeSerializer, EmployeeListSerializer, EmployeeCreateSerializer,
    EmergencyContactSerializer, DependentSerializer, EducationSerializer,
    WorkExperienceSerializer, CertificationSerializer, SkillSerializer,
    BankAccountSerializer, EmploymentHistorySerializer,
    EmployeeProfileSerializer, EmployeeProfileUpdateSerializer, MyTeamMemberSerializer,
    DataUpdateRequestSerializer, DataUpdateRequestCreateSerializer,
    DataUpdateDocumentSerializer,
    ServiceRequestTypeSerializer, ServiceRequestSerializer, ServiceRequestCreateSerializer,
    ServiceRequestListSerializer, ServiceRequestCommentSerializer, ServiceRequestDocumentSerializer
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


# ========================================
# Data Update Request Views
# ========================================

class DataUpdateRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for employee data update requests.
    Supports self-service workflow with HR approval.
    """
    queryset = DataUpdateRequest.objects.select_related(
        'employee', 'reviewed_by', 'applied_by'
    ).prefetch_related('documents')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'request_type', 'employee']
    search_fields = ['request_number', 'employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return DataUpdateRequestCreateSerializer
        return DataUpdateRequestSerializer

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

        # Regular employees see their own requests
        if hasattr(user, 'employee'):
            return queryset.filter(employee=user.employee)

        return queryset.none()

    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's data update requests."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(employee=request.user.employee)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft data update request for review."""
        dur = self.get_object()

        if dur.status != DataUpdateRequest.Status.DRAFT:
            return Response(
                {'error': 'Only draft requests can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        dur.status = DataUpdateRequest.Status.PENDING
        dur.submitted_at = timezone.now()
        dur.save()

        serializer = self.get_serializer(dur)
        return Response({'message': 'Request submitted for review', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a data update request and apply changes."""
        dur = self.get_object()

        if dur.status not in [DataUpdateRequest.Status.PENDING, DataUpdateRequest.Status.UNDER_REVIEW]:
            return Response(
                {'error': 'Only pending or under-review requests can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        comments = request.data.get('comments', '')
        apply_changes = request.data.get('apply_changes', True)

        dur.status = DataUpdateRequest.Status.APPROVED
        dur.reviewed_by = request.user
        dur.reviewed_at = timezone.now()
        dur.review_comments = comments
        dur.save()

        # Apply the changes to employee record
        if apply_changes:
            self._apply_changes(dur, request.user)

        serializer = self.get_serializer(dur)
        return Response({'message': 'Request approved', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a data update request."""
        dur = self.get_object()

        if dur.status not in [DataUpdateRequest.Status.PENDING, DataUpdateRequest.Status.UNDER_REVIEW]:
            return Response(
                {'error': 'Only pending or under-review requests can be rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', '')
        if not reason:
            return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        dur.status = DataUpdateRequest.Status.REJECTED
        dur.reviewed_by = request.user
        dur.reviewed_at = timezone.now()
        dur.rejection_reason = reason
        dur.save()

        serializer = self.get_serializer(dur)
        return Response({'message': 'Request rejected', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a data update request (by employee)."""
        dur = self.get_object()

        if dur.status not in [DataUpdateRequest.Status.DRAFT, DataUpdateRequest.Status.PENDING]:
            return Response(
                {'error': 'Only draft or pending requests can be cancelled'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Only allow owner to cancel
        if hasattr(request.user, 'employee') and dur.employee != request.user.employee:
            if not (request.user.is_superuser or request.user.is_staff):
                return Response({'error': 'Not authorized to cancel this request'}, status=status.HTTP_403_FORBIDDEN)

        dur.status = DataUpdateRequest.Status.CANCELLED
        dur.save()

        serializer = self.get_serializer(dur)
        return Response({'message': 'Request cancelled', 'data': serializer.data})

    @action(detail=False, methods=['get'])
    def pending_review(self, request):
        """Get requests pending HR review."""
        queryset = self.get_queryset().filter(
            status__in=[DataUpdateRequest.Status.PENDING, DataUpdateRequest.Status.UNDER_REVIEW]
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    def _apply_changes(self, dur, user):
        """Apply the approved changes to the employee record."""
        from django.db import transaction

        with transaction.atomic():
            employee = dur.employee
            request_type = dur.request_type
            new_values = dur.new_values

            if request_type == DataUpdateRequest.RequestType.NAME_CHANGE:
                for field in ['title', 'first_name', 'middle_name', 'last_name', 'maiden_name']:
                    if field in new_values:
                        setattr(employee, field, new_values[field])
                employee.save()

            elif request_type == DataUpdateRequest.RequestType.ADDRESS:
                for field in ['residential_address', 'residential_city', 'postal_address', 'digital_address']:
                    if field in new_values:
                        setattr(employee, field, new_values[field])
                employee.save()

            elif request_type == DataUpdateRequest.RequestType.CONTACT:
                for field in ['personal_email', 'mobile_phone', 'home_phone']:
                    if field in new_values:
                        setattr(employee, field, new_values[field])
                employee.save()

            elif request_type == DataUpdateRequest.RequestType.BANK_DETAILS:
                # Create or update bank account
                bank_data = new_values
                if 'bank_account_id' in bank_data:
                    # Update existing
                    try:
                        bank_account = BankAccount.objects.get(
                            id=bank_data['bank_account_id'],
                            employee=employee
                        )
                        for field in ['bank_name', 'branch_name', 'account_number', 'account_name', 'account_type']:
                            if field in bank_data:
                                setattr(bank_account, field, bank_data[field])
                        bank_account.save()
                    except BankAccount.DoesNotExist:
                        pass
                else:
                    # Create new bank account
                    BankAccount.objects.create(
                        employee=employee,
                        bank_name=bank_data.get('bank_name', ''),
                        branch_name=bank_data.get('branch_name', ''),
                        account_name=bank_data.get('account_name', ''),
                        account_number=bank_data.get('account_number', ''),
                        account_type=bank_data.get('account_type', 'SAVINGS'),
                        is_primary=bank_data.get('is_primary', False)
                    )

            elif request_type == DataUpdateRequest.RequestType.EMERGENCY_CONTACT:
                action = new_values.get('action', 'ADD')
                if action == 'ADD':
                    EmergencyContact.objects.create(
                        employee=employee,
                        name=new_values.get('name'),
                        relationship=new_values.get('relationship'),
                        phone_primary=new_values.get('phone_primary'),
                        phone_secondary=new_values.get('phone_secondary', ''),
                        email=new_values.get('email', ''),
                        address=new_values.get('address', ''),
                        is_primary=new_values.get('is_primary', False)
                    )
                elif action == 'UPDATE' and 'contact_id' in new_values:
                    try:
                        contact = EmergencyContact.objects.get(
                            id=new_values['contact_id'],
                            employee=employee
                        )
                        for field in ['name', 'relationship', 'phone_primary', 'phone_secondary', 'email', 'address', 'is_primary']:
                            if field in new_values:
                                setattr(contact, field, new_values[field])
                        contact.save()
                    except EmergencyContact.DoesNotExist:
                        pass
                elif action == 'DELETE' and 'contact_id' in new_values:
                    EmergencyContact.objects.filter(
                        id=new_values['contact_id'],
                        employee=employee
                    ).delete()

            elif request_type == DataUpdateRequest.RequestType.DEPENDENT:
                action = new_values.get('action', 'ADD')
                if action == 'ADD':
                    Dependent.objects.create(
                        employee=employee,
                        first_name=new_values.get('first_name'),
                        last_name=new_values.get('last_name'),
                        relationship=new_values.get('relationship'),
                        date_of_birth=new_values.get('date_of_birth'),
                        gender=new_values.get('gender'),
                        phone=new_values.get('phone', ''),
                        is_beneficiary=new_values.get('is_beneficiary', False)
                    )
                elif action == 'UPDATE' and 'dependent_id' in new_values:
                    try:
                        dependent = Dependent.objects.get(
                            id=new_values['dependent_id'],
                            employee=employee
                        )
                        for field in ['first_name', 'last_name', 'relationship', 'date_of_birth', 'gender', 'phone', 'is_beneficiary']:
                            if field in new_values:
                                setattr(dependent, field, new_values[field])
                        dependent.save()
                    except Dependent.DoesNotExist:
                        pass
                elif action == 'DELETE' and 'dependent_id' in new_values:
                    Dependent.objects.filter(
                        id=new_values['dependent_id'],
                        employee=employee
                    ).delete()

            dur.applied_at = timezone.now()
            dur.applied_by = user
            dur.save()


class DataUpdateDocumentViewSet(viewsets.ModelViewSet):
    """ViewSet for data update supporting documents."""
    queryset = DataUpdateDocument.objects.select_related('data_update_request', 'uploaded_by')
    serializer_class = DataUpdateDocumentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['data_update_request', 'document_type']

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
            return queryset.filter(data_update_request__employee=user.employee)

        return queryset.none()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class MyDataUpdateRequestsView(generics.ListCreateAPIView):
    """
    List and create data update requests for current user.
    GET /employees/me/data-updates/
    POST /employees/me/data-updates/
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return DataUpdateRequestCreateSerializer
        return DataUpdateRequestSerializer

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'employee') or user.employee is None:
            return DataUpdateRequest.objects.none()
        return DataUpdateRequest.objects.filter(
            employee=user.employee
        ).prefetch_related('documents').order_by('-created_at')


# ========================================
# HR Service Request Views
# ========================================

class ServiceRequestTypeViewSet(viewsets.ModelViewSet):
    """ViewSet for service request types configuration."""
    queryset = ServiceRequestType.objects.all()
    serializer_class = ServiceRequestTypeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['category', 'is_active', 'requires_approval']
    search_fields = ['name', 'code', 'description']
    ordering = ['sort_order', 'name']


class ServiceRequestViewSet(viewsets.ModelViewSet):
    """
    ViewSet for HR service requests.
    Supports full workflow: submit, acknowledge, assign, resolve, escalate.
    """
    queryset = ServiceRequest.objects.select_related(
        'employee', 'request_type', 'assigned_to', 'resolved_by', 'escalated_to'
    ).prefetch_related('comments', 'documents')
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'request_type', 'priority', 'sla_status', 'employee', 'assigned_to']
    search_fields = ['request_number', 'subject', 'employee__employee_number', 'employee__first_name', 'employee__last_name']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return ServiceRequestCreateSerializer
        if self.action == 'list':
            return ServiceRequestListSerializer
        return ServiceRequestSerializer

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

        # Regular employees see their own requests
        if hasattr(user, 'employee'):
            return queryset.filter(employee=user.employee)

        return queryset.none()

    @action(detail=False, methods=['get'])
    def my_requests(self, request):
        """Get current user's service requests."""
        if not hasattr(request.user, 'employee'):
            return Response({'error': 'User has no employee record'}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(employee=request.user.employee)
        serializer = ServiceRequestListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def assigned_to_me(self, request):
        """Get service requests assigned to current user (for HR staff)."""
        queryset = self.get_queryset().filter(assigned_to=request.user)
        serializer = ServiceRequestListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending(self, request):
        """Get all pending/unassigned service requests."""
        queryset = self.get_queryset().filter(
            status__in=[ServiceRequest.Status.SUBMITTED, ServiceRequest.Status.ACKNOWLEDGED]
        )
        serializer = ServiceRequestListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def escalated(self, request):
        """Get all escalated service requests."""
        queryset = self.get_queryset().filter(status=ServiceRequest.Status.ESCALATED)
        serializer = ServiceRequestListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def sla_breached(self, request):
        """Get service requests with breached SLA."""
        queryset = self.get_queryset().filter(sla_status=ServiceRequest.SLAStatus.RED)
        serializer = ServiceRequestListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def dashboard(self, request):
        """Get service request dashboard statistics."""
        queryset = self.get_queryset()

        # Status counts
        status_counts = queryset.values('status').annotate(count=Count('id'))
        status_dict = {item['status']: item['count'] for item in status_counts}

        # SLA status counts
        sla_counts = queryset.exclude(
            status__in=[ServiceRequest.Status.COMPLETED, ServiceRequest.Status.CANCELLED]
        ).values('sla_status').annotate(count=Count('id'))
        sla_dict = {item['sla_status']: item['count'] for item in sla_counts}

        # Priority counts
        priority_counts = queryset.exclude(
            status__in=[ServiceRequest.Status.COMPLETED, ServiceRequest.Status.CANCELLED]
        ).values('priority').annotate(count=Count('id'))
        priority_dict = {item['priority']: item['count'] for item in priority_counts}

        # Type counts
        type_counts = queryset.values('request_type__name').annotate(count=Count('id'))

        return Response({
            'total': queryset.count(),
            'by_status': status_dict,
            'by_sla': sla_dict,
            'by_priority': priority_dict,
            'by_type': list(type_counts),
            'open_requests': queryset.exclude(
                status__in=[ServiceRequest.Status.COMPLETED, ServiceRequest.Status.CANCELLED]
            ).count(),
        })

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft service request."""
        sr = self.get_object()

        if sr.status != ServiceRequest.Status.DRAFT:
            return Response(
                {'error': 'Only draft requests can be submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sr.status = ServiceRequest.Status.SUBMITTED
        sr.submitted_at = timezone.now()
        sr.save()

        serializer = self.get_serializer(sr)
        return Response({'message': 'Request submitted successfully', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def acknowledge(self, request, pk=None):
        """Acknowledge receipt of a service request."""
        sr = self.get_object()

        if sr.status != ServiceRequest.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted requests can be acknowledged'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sr.status = ServiceRequest.Status.ACKNOWLEDGED
        sr.acknowledged_at = timezone.now()
        sr.save()

        # Add internal comment
        ServiceRequestComment.objects.create(
            service_request=sr,
            commented_by=request.user,
            comment='Request acknowledged and under review.',
            comment_type=ServiceRequestComment.CommentType.INTERNAL,
            is_visible_to_employee=False
        )

        serializer = self.get_serializer(sr)
        return Response({'message': 'Request acknowledged', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def assign(self, request, pk=None):
        """Assign a service request to an HR staff member."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        sr = self.get_object()

        if sr.status in [ServiceRequest.Status.COMPLETED, ServiceRequest.Status.CANCELLED]:
            return Response(
                {'error': 'Cannot assign completed or cancelled requests'},
                status=status.HTTP_400_BAD_REQUEST
            )

        assignee_id = request.data.get('assignee_id')
        if not assignee_id:
            return Response({'error': 'Assignee ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        # assignee_id can be a User ID or Employee ID - try both
        try:
            assignee_user = User.objects.get(id=assignee_id)
        except User.DoesNotExist:
            # Try by employee ID
            try:
                assignee = Employee.objects.get(id=assignee_id)
                assignee_user = assignee.user
                if not assignee_user:
                    return Response({'error': 'Employee has no user account'}, status=status.HTTP_400_BAD_REQUEST)
            except Employee.DoesNotExist:
                return Response({'error': 'Assignee not found'}, status=status.HTTP_404_NOT_FOUND)

        assignee_name = assignee_user.get_full_name() or assignee_user.username
        sr.assigned_to = assignee_user
        if sr.status in [ServiceRequest.Status.SUBMITTED, ServiceRequest.Status.ACKNOWLEDGED]:
            sr.status = ServiceRequest.Status.IN_PROGRESS
        sr.save()

        # Add internal comment
        ServiceRequestComment.objects.create(
            service_request=sr,
            commented_by=request.user,
            comment=f'Request assigned to {assignee_name}.',
            comment_type=ServiceRequestComment.CommentType.INTERNAL,
            is_visible_to_employee=False
        )

        serializer = self.get_serializer(sr)
        return Response({'message': f'Request assigned to {assignee_name}', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def start_work(self, request, pk=None):
        """Start working on a service request."""
        sr = self.get_object()

        if sr.status not in [ServiceRequest.Status.ACKNOWLEDGED, ServiceRequest.Status.SUBMITTED]:
            return Response(
                {'error': 'Can only start work on acknowledged or submitted requests'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sr.status = ServiceRequest.Status.IN_PROGRESS
        if not sr.assigned_to:
            sr.assigned_to = request.user
        sr.save()

        serializer = self.get_serializer(sr)
        return Response({'message': 'Work started on request', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def request_approval(self, request, pk=None):
        """Send request for approval."""
        sr = self.get_object()

        if sr.status != ServiceRequest.Status.IN_PROGRESS:
            return Response(
                {'error': 'Only in-progress requests can be sent for approval'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not sr.request_type.requires_hr_approval and not sr.request_type.requires_manager_approval:
            return Response(
                {'error': 'This request type does not require approval'},
                status=status.HTTP_400_BAD_REQUEST
            )

        sr.status = ServiceRequest.Status.PENDING_APPROVAL
        sr.save()

        serializer = self.get_serializer(sr)
        return Response({'message': 'Request sent for approval', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a service request."""
        sr = self.get_object()

        if sr.status != ServiceRequest.Status.PENDING_APPROVAL:
            return Response(
                {'error': 'Only requests pending approval can be approved'},
                status=status.HTTP_400_BAD_REQUEST
            )

        comments = request.data.get('comments', '')
        sr.status = ServiceRequest.Status.APPROVED
        sr.save()

        # Add approval comment
        if comments:
            ServiceRequestComment.objects.create(
                service_request=sr,
                commented_by=request.user,
                comment=f'Approved: {comments}',
                comment_type=ServiceRequestComment.CommentType.INTERNAL,
                is_visible_to_employee=False
            )

        serializer = self.get_serializer(sr)
        return Response({'message': 'Request approved', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a service request."""
        sr = self.get_object()

        if sr.status not in [ServiceRequest.Status.PENDING_APPROVAL, ServiceRequest.Status.IN_PROGRESS]:
            return Response(
                {'error': 'Only pending approval or in-progress requests can be rejected'},
                status=status.HTTP_400_BAD_REQUEST
            )

        reason = request.data.get('reason', '')
        if not reason:
            return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        sr.status = ServiceRequest.Status.REJECTED
        sr.resolution_notes = f'Rejected: {reason}'
        sr.resolved_at = timezone.now()
        sr.resolved_by = request.user
        sr.save()

        serializer = self.get_serializer(sr)
        return Response({'message': 'Request rejected', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def resolve(self, request, pk=None):
        """Resolve/complete a service request."""
        sr = self.get_object()

        if sr.status in [ServiceRequest.Status.COMPLETED, ServiceRequest.Status.CANCELLED]:
            return Response(
                {'error': 'Request is already completed or cancelled'},
                status=status.HTTP_400_BAD_REQUEST
            )

        resolution_notes = request.data.get('resolution_notes', '')
        if not resolution_notes:
            return Response({'error': 'Resolution notes are required'}, status=status.HTTP_400_BAD_REQUEST)

        sr.status = ServiceRequest.Status.COMPLETED
        sr.resolution_notes = resolution_notes
        sr.resolved_at = timezone.now()
        sr.resolved_by = request.user
        sr.save()

        serializer = self.get_serializer(sr)
        return Response({'message': 'Request resolved successfully', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def escalate(self, request, pk=None):
        """Escalate a service request."""
        from django.contrib.auth import get_user_model
        User = get_user_model()

        sr = self.get_object()

        if sr.status in [ServiceRequest.Status.COMPLETED, ServiceRequest.Status.CANCELLED]:
            return Response(
                {'error': 'Cannot escalate completed or cancelled requests'},
                status=status.HTTP_400_BAD_REQUEST
            )

        escalate_to_id = request.data.get('escalate_to_id')
        reason = request.data.get('reason', '')

        if not reason:
            return Response({'error': 'Escalation reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        sr.status = ServiceRequest.Status.ESCALATED
        sr.is_escalated = True
        sr.escalated_at = timezone.now()
        sr.escalation_reason = reason

        if escalate_to_id:
            # Try as User ID first, then Employee ID
            try:
                escalate_to_user = User.objects.get(id=escalate_to_id)
                sr.escalated_to = escalate_to_user
            except User.DoesNotExist:
                try:
                    escalate_to_emp = Employee.objects.get(id=escalate_to_id)
                    if escalate_to_emp.user:
                        sr.escalated_to = escalate_to_emp.user
                except Employee.DoesNotExist:
                    pass

        sr.save()

        # Add escalation comment
        ServiceRequestComment.objects.create(
            service_request=sr,
            commented_by=request.user,
            comment=f'Request escalated. Reason: {reason}',
            comment_type=ServiceRequestComment.CommentType.INTERNAL,
            is_visible_to_employee=False
        )

        serializer = self.get_serializer(sr)
        return Response({'message': 'Request escalated', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a service request."""
        sr = self.get_object()

        if sr.status == ServiceRequest.Status.COMPLETED:
            return Response(
                {'error': 'Cannot cancel a completed request'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Only allow owner or admin to cancel
        if hasattr(request.user, 'employee') and sr.employee != request.user.employee:
            if not (request.user.is_superuser or request.user.is_staff):
                return Response({'error': 'Not authorized to cancel this request'}, status=status.HTTP_403_FORBIDDEN)

        reason = request.data.get('reason', '')
        sr.status = ServiceRequest.Status.CANCELLED
        sr.resolution_notes = f'Cancelled: {reason}' if reason else 'Cancelled by user'
        sr.resolved_at = timezone.now()
        sr.save()

        serializer = self.get_serializer(sr)
        return Response({'message': 'Request cancelled', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def add_comment(self, request, pk=None):
        """Add a comment to a service request."""
        sr = self.get_object()

        comment_text = request.data.get('comment', '')
        if not comment_text:
            return Response({'error': 'Comment is required'}, status=status.HTTP_400_BAD_REQUEST)

        is_internal = request.data.get('is_internal', False)
        comment_type = request.data.get('comment_type', ServiceRequestComment.CommentType.USER)

        if is_internal:
            comment_type = ServiceRequestComment.CommentType.INTERNAL

        comment = ServiceRequestComment.objects.create(
            service_request=sr,
            commented_by=request.user,
            comment=comment_text,
            comment_type=comment_type,
            is_visible_to_employee=not is_internal
        )

        serializer = ServiceRequestCommentSerializer(comment)
        return Response({'message': 'Comment added', 'data': serializer.data})

    @action(detail=True, methods=['get'])
    def comments(self, request, pk=None):
        """Get all comments for a service request."""
        sr = self.get_object()

        # Regular employees only see visible comments
        is_hr = request.user.is_superuser or request.user.is_staff
        if not is_hr:
            hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
            user_roles = list(request.user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
            is_hr = any(role in hr_roles for role in user_roles)

        comments = sr.comments.all()
        if not is_hr:
            comments = comments.filter(is_visible_to_employee=True)

        serializer = ServiceRequestCommentSerializer(comments, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def update_sla(self, request, pk=None):
        """Manually update SLA status."""
        sr = self.get_object()

        # Calculate SLA based on current state
        sr.update_sla_status()

        serializer = self.get_serializer(sr)
        return Response({'message': 'SLA status updated', 'data': serializer.data})


class ServiceRequestCommentViewSet(viewsets.ModelViewSet):
    """ViewSet for service request comments."""
    queryset = ServiceRequestComment.objects.select_related('service_request', 'commented_by')
    serializer_class = ServiceRequestCommentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['service_request', 'comment_type', 'is_visible_to_employee']

    def get_queryset(self):
        user = self.request.user
        queryset = super().get_queryset()

        # HR sees all comments
        if user.is_superuser or user.is_staff:
            return queryset

        hr_roles = ['HR', 'HR_ADMIN', 'HR_MANAGER', 'ADMIN']
        user_roles = list(user.user_roles.filter(is_active=True).values_list('role__code', flat=True))
        if any(role in hr_roles for role in user_roles):
            return queryset

        # Regular employees see only their own requests' visible comments
        if hasattr(user, 'employee'):
            return queryset.filter(
                service_request__employee=user.employee,
                is_visible_to_employee=True
            )

        return queryset.none()

    def perform_create(self, serializer):
        serializer.save(commented_by=self.request.user)


class ServiceRequestDocumentViewSet(viewsets.ModelViewSet):
    """ViewSet for service request documents."""
    queryset = ServiceRequestDocument.objects.select_related('service_request', 'uploaded_by')
    serializer_class = ServiceRequestDocumentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['service_request', 'document_type']

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
            return queryset.filter(service_request__employee=user.employee)

        return queryset.none()

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)


class MyServiceRequestsView(generics.ListCreateAPIView):
    """
    List and create service requests for current user.
    GET /employees/me/service-requests/
    POST /employees/me/service-requests/
    """
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ServiceRequestCreateSerializer
        return ServiceRequestListSerializer

    def get_queryset(self):
        user = self.request.user
        if not hasattr(user, 'employee') or user.employee is None:
            return ServiceRequest.objects.none()
        return ServiceRequest.objects.filter(
            employee=user.employee
        ).select_related('request_type').order_by('-created_at')
