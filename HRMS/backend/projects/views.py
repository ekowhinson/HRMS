"""ViewSets for project management."""

from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from django.db.models import Count, Sum, Q

from .models import (
    Project, ProjectTask, Resource, Timesheet,
    ProjectBudget, Milestone, ProjectBilling,
)
from .serializers import (
    ProjectSerializer, ProjectListSerializer,
    ProjectTaskSerializer, ResourceSerializer,
    TimesheetSerializer, ProjectBudgetSerializer,
    MilestoneSerializer, ProjectBillingSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    """ViewSet for Project CRUD and status transitions."""
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'priority', 'project_manager', 'department', 'customer']
    search_fields = ['code', 'name', 'description']
    ordering_fields = ['code', 'name', 'start_date', 'end_date', 'priority', 'status', 'budget_amount']
    ordering = ['-start_date']

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        return ProjectSerializer

    def get_queryset(self):
        qs = Project.objects.select_related(
            'project_manager', 'department', 'customer',
        )
        if self.action == 'list':
            qs = qs.annotate(
                _task_count=Count('tasks', distinct=True),
                _resource_count=Count('resources', distinct=True),
            )
        elif self.action in ('retrieve', 'update', 'partial_update'):
            qs = qs.prefetch_related(
                'tasks__assigned_to',
                'tasks__parent',
                'resources__employee',
                'milestones',
                'budget_lines__account',
                'billings__milestone',
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Transition project to Active status."""
        project = self.get_object()
        if project.status not in (Project.Status.PLANNING, Project.Status.ON_HOLD):
            return Response(
                {'error': 'Only Planning or On Hold projects can be activated.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project.status = Project.Status.ACTIVE
        project.updated_by = request.user
        project.save(update_fields=['status', 'updated_by', 'updated_at'])
        return Response({'message': 'Project activated successfully.'})

    @action(detail=True, methods=['post'])
    def hold(self, request, pk=None):
        """Put project on hold."""
        project = self.get_object()
        if project.status != Project.Status.ACTIVE:
            return Response(
                {'error': 'Only active projects can be put on hold.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project.status = Project.Status.ON_HOLD
        project.updated_by = request.user
        project.save(update_fields=['status', 'updated_by', 'updated_at'])
        return Response({'message': 'Project put on hold.'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Mark project as completed."""
        project = self.get_object()
        if project.status not in (Project.Status.ACTIVE, Project.Status.ON_HOLD):
            return Response(
                {'error': 'Only Active or On Hold projects can be completed.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project.status = Project.Status.COMPLETED
        project.completion_percentage = 100
        project.end_date = project.end_date or timezone.now().date()
        project.updated_by = request.user
        project.save(update_fields=['status', 'completion_percentage', 'end_date', 'updated_by', 'updated_at'])
        return Response({'message': 'Project marked as completed.'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel the project."""
        project = self.get_object()
        if project.status == Project.Status.COMPLETED:
            return Response(
                {'error': 'Completed projects cannot be cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        project.status = Project.Status.CANCELLED
        project.updated_by = request.user
        project.save(update_fields=['status', 'updated_by', 'updated_at'])
        return Response({'message': 'Project cancelled.'})

    @action(detail=True, methods=['get'])
    def summary(self, request, pk=None):
        """Get project summary with aggregated metrics."""
        project = self.get_object()

        tasks = project.tasks.all()
        timesheets = project.timesheets.filter(status=Timesheet.Status.APPROVED)

        total_estimated_hours = tasks.aggregate(total=Sum('estimated_hours'))['total'] or 0
        total_actual_hours = timesheets.aggregate(total=Sum('hours'))['total'] or 0
        total_billed = project.billings.aggregate(total=Sum('amount'))['total'] or 0
        total_budget_lines = project.budget_lines.aggregate(
            budget=Sum('budget_amount'),
            spent=Sum('spent_amount'),
        )

        task_status_counts = dict(
            tasks.values_list('status').annotate(count=Count('id')).values_list('status', 'count')
        )

        return Response({
            'project_id': str(project.id),
            'code': project.code,
            'name': project.name,
            'status': project.status,
            'completion_percentage': project.completion_percentage,
            'budget_amount': project.budget_amount,
            'actual_cost': project.actual_cost,
            'total_estimated_hours': total_estimated_hours,
            'total_actual_hours': total_actual_hours,
            'total_billed': total_billed,
            'budget_lines_total': total_budget_lines['budget'] or 0,
            'budget_lines_spent': total_budget_lines['spent'] or 0,
            'total_tasks': tasks.count(),
            'task_status_counts': task_status_counts,
            'total_resources': project.resources.count(),
            'total_milestones': project.milestones.count(),
        })


class ProjectTaskViewSet(viewsets.ModelViewSet):
    """ViewSet for project tasks (WBS)."""
    serializer_class = ProjectTaskSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'status', 'priority', 'assigned_to', 'parent']
    search_fields = ['name', 'description']
    ordering_fields = ['sort_order', 'start_date', 'end_date', 'priority', 'status']
    ordering = ['sort_order', 'start_date']

    def get_queryset(self):
        return ProjectTask.objects.select_related(
            'project', 'assigned_to', 'parent',
        ).annotate(
            _subtask_count=Count('subtasks'),
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class ResourceViewSet(viewsets.ModelViewSet):
    """ViewSet for project resource allocations."""
    serializer_class = ResourceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'employee', 'role']
    search_fields = ['employee__first_name', 'employee__last_name', 'employee__employee_number', 'notes']
    ordering_fields = ['project', 'employee', 'allocation_percent', 'start_date']
    ordering = ['project', 'employee']

    def get_queryset(self):
        return Resource.objects.select_related('project', 'employee')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class TimesheetViewSet(viewsets.ModelViewSet):
    """ViewSet for timesheet entries with submit/approve/reject workflow."""
    serializer_class = TimesheetSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'employee', 'task', 'status', 'date']
    search_fields = ['description', 'employee__first_name', 'employee__last_name', 'project__code']
    ordering_fields = ['date', 'hours', 'status', 'project']
    ordering = ['-date']

    def get_queryset(self):
        return Timesheet.objects.select_related(
            'employee', 'project', 'task', 'approved_by',
        )

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit a draft timesheet for approval."""
        timesheet = self.get_object()
        if timesheet.status != Timesheet.Status.DRAFT:
            return Response(
                {'error': 'Only draft timesheets can be submitted.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        timesheet.status = Timesheet.Status.SUBMITTED
        timesheet.updated_by = request.user
        timesheet.save(update_fields=['status', 'updated_by', 'updated_at'])
        serializer = self.get_serializer(timesheet)
        return Response({'message': 'Timesheet submitted for approval.', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a submitted timesheet."""
        timesheet = self.get_object()
        if timesheet.status != Timesheet.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted timesheets can be approved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        timesheet.status = Timesheet.Status.APPROVED
        timesheet.approved_by = request.user
        timesheet.approved_at = timezone.now()
        timesheet.updated_by = request.user
        timesheet.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_by', 'updated_at'])
        serializer = self.get_serializer(timesheet)
        return Response({'message': 'Timesheet approved.', 'data': serializer.data})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a submitted timesheet."""
        timesheet = self.get_object()
        if timesheet.status != Timesheet.Status.SUBMITTED:
            return Response(
                {'error': 'Only submitted timesheets can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        timesheet.status = Timesheet.Status.REJECTED
        timesheet.updated_by = request.user
        timesheet.save(update_fields=['status', 'updated_by', 'updated_at'])
        serializer = self.get_serializer(timesheet)
        return Response({'message': 'Timesheet rejected.', 'data': serializer.data})

    @action(detail=False, methods=['get'])
    def my_timesheets(self, request):
        """Get current user's timesheets."""
        if not hasattr(request.user, 'employee') or request.user.employee is None:
            return Response(
                {'error': 'User has no employee record.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        queryset = self.filter_queryset(
            self.get_queryset().filter(employee=request.user.employee)
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def pending_approval(self, request):
        """Get timesheets pending approval (for managers)."""
        queryset = self.filter_queryset(
            self.get_queryset().filter(status=Timesheet.Status.SUBMITTED)
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class ProjectBudgetViewSet(viewsets.ModelViewSet):
    """ViewSet for project budget line items."""
    serializer_class = ProjectBudgetSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'account']
    search_fields = ['description', 'project__code', 'account__code', 'account__name']
    ordering_fields = ['project', 'account', 'budget_amount', 'spent_amount']
    ordering = ['project', 'account']

    def get_queryset(self):
        return ProjectBudget.objects.select_related('project', 'account')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class MilestoneViewSet(viewsets.ModelViewSet):
    """ViewSet for project milestones."""
    serializer_class = MilestoneSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'status']
    search_fields = ['name', 'description', 'project__code']
    ordering_fields = ['due_date', 'amount', 'status', 'completion_date']
    ordering = ['due_date']

    def get_queryset(self):
        return Milestone.objects.select_related('project')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class ProjectBillingViewSet(viewsets.ModelViewSet):
    """ViewSet for project billing records."""
    serializer_class = ProjectBillingSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project', 'billing_type', 'milestone', 'customer_invoice']
    search_fields = ['description', 'project__code']
    ordering_fields = ['billing_date', 'amount', 'billing_type']
    ordering = ['-billing_date']

    def get_queryset(self):
        return ProjectBilling.objects.select_related('project', 'milestone', 'customer_invoice')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
