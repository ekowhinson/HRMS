"""
Views for performance management.
"""

from datetime import date
from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import viewsets, status, serializers as drf_serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from .models import (
    AppraisalCycle, AppraisalSchedule, AppraisalDeadlineExtension,
    RatingScale, Competency, GoalCategory,
    Appraisal, Goal, GoalUpdate, CompetencyAssessment,
    PeerFeedback, PerformanceImprovementPlan, PIPReview,
    DevelopmentPlan, DevelopmentActivity,
    CoreValue, CoreValueAssessment, ProbationAssessment,
    TrainingNeed, PerformanceAppeal, TrainingDocument, AppraisalDocument
)
from .serializers import (
    AppraisalCycleListSerializer, AppraisalCycleSerializer,
    RatingScaleSerializer, CompetencySerializer, GoalCategorySerializer,
    AppraisalListSerializer, AppraisalSerializer, AppraisalCreateSerializer,
    GoalSerializer, GoalCreateSerializer, GoalUpdateSerializer,
    CompetencyAssessmentSerializer, PeerFeedbackSerializer,
    PIPListSerializer, PIPSerializer, PIPReviewSerializer,
    DevelopmentPlanListSerializer, DevelopmentPlanSerializer,
    DevelopmentActivitySerializer,
    CoreValueSerializer, CoreValueAssessmentSerializer,
    ProbationAssessmentListSerializer, ProbationAssessmentSerializer,
    ProbationAssessmentCreateSerializer,
    TrainingNeedListSerializer, TrainingNeedSerializer, TrainingNeedCreateSerializer,
    PerformanceAppealListSerializer, PerformanceAppealSerializer,
    PerformanceAppealCreateSerializer, PerformanceAppealDecisionSerializer,
    AppraisalDetailSerializer, TrainingDocumentSerializer, AppraisalDocumentSerializer,
    AppraisalScheduleSerializer, AppraisalScheduleCreateSerializer,
    AppraisalScheduleBulkCreateSerializer,
    AppraisalDeadlineExtensionSerializer, AppraisalDeadlineExtensionCreateSerializer,
)
from .services import (
    AppraisalScoreCalculator, ProbationService,
    TrainingNeedService, PerformanceAppealService
)


def check_appraisal_deadline(appraisal, phase):
    """
    Check if the department schedule for the given phase is locked.
    Auto-locks if past deadline.
    Returns (is_locked, schedule_or_None).
    """
    if not appraisal.employee or not appraisal.employee.department:
        return False, None

    try:
        schedule = AppraisalSchedule.objects.get(
            appraisal_cycle=appraisal.appraisal_cycle,
            department=appraisal.employee.department,
            phase=phase,
        )
        # Auto-lock if past deadline
        schedule.check_and_lock()
        return schedule.is_locked, schedule
    except AppraisalSchedule.DoesNotExist:
        return False, None


class AppraisalCycleViewSet(viewsets.ModelViewSet):
    """Appraisal cycle management."""
    queryset = AppraisalCycle.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return AppraisalCycleListSerializer
        return AppraisalCycleSerializer

    @action(detail=False, methods=['get'])
    def active(self, request):
        """Get the current active appraisal cycle."""
        cycle = AppraisalCycle.objects.filter(is_active=True).first()
        if cycle:
            serializer = AppraisalCycleSerializer(cycle)
            return Response(serializer.data)
        return Response({'detail': 'No active cycle found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """Activate an appraisal cycle."""
        cycle = self.get_object()
        # Deactivate other cycles
        AppraisalCycle.objects.exclude(pk=pk).update(is_active=False)
        cycle.is_active = True
        cycle.save()
        serializer = AppraisalCycleSerializer(cycle)
        return Response(serializer.data)


class RatingScaleViewSet(viewsets.ModelViewSet):
    """Rating scale management."""
    queryset = RatingScale.objects.filter(is_active=True)
    serializer_class = RatingScaleSerializer
    permission_classes = [IsAuthenticated]


class CompetencyViewSet(viewsets.ModelViewSet):
    """Competency framework management."""
    queryset = Competency.objects.filter(is_active=True)
    serializer_class = CompetencySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        return queryset


class GoalCategoryViewSet(viewsets.ModelViewSet):
    """Goal category management."""
    queryset = GoalCategory.objects.filter(is_active=True)
    serializer_class = GoalCategorySerializer
    permission_classes = [IsAuthenticated]


class AppraisalViewSet(viewsets.ModelViewSet):
    """Employee appraisal management."""
    queryset = Appraisal.objects.select_related(
        'employee', 'employee__department', 'employee__position',
        'appraisal_cycle', 'manager'
    ).prefetch_related('goals')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return AppraisalListSerializer
        if self.action == 'create':
            return AppraisalCreateSerializer
        return AppraisalSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by cycle
        cycle_id = self.request.query_params.get('cycle')
        if cycle_id:
            queryset = queryset.filter(appraisal_cycle_id=cycle_id)

        # Filter by status
        appraisal_status = self.request.query_params.get('status')
        if appraisal_status:
            queryset = queryset.filter(status=appraisal_status)

        # Filter by department
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(employee__department_id=department)

        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search) |
                Q(employee__employee_number__icontains=search)
            )

        return queryset.order_by('-appraisal_cycle__year', 'employee__last_name')

    @action(detail=False, methods=['get'])
    def my_appraisals(self, request):
        """Get current user's appraisals."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response({'detail': 'No employee profile found'}, status=status.HTTP_404_NOT_FOUND)

        appraisals = Appraisal.objects.filter(employee=employee)
        serializer = AppraisalListSerializer(appraisals, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def team_appraisals(self, request):
        """Get appraisals for manager's direct reports."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response({'detail': 'No employee profile found'}, status=status.HTTP_404_NOT_FOUND)

        appraisals = Appraisal.objects.filter(manager=employee)
        serializer = AppraisalListSerializer(appraisals, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def submit_self_assessment(self, request, pk=None):
        """Submit self assessment."""
        appraisal = self.get_object()

        # Determine phase from appraisal status
        phase = AppraisalSchedule.Phase.YEAR_END
        if appraisal.status in [Appraisal.Status.GOAL_SETTING, Appraisal.Status.GOALS_SUBMITTED]:
            phase = AppraisalSchedule.Phase.GOAL_SETTING
        elif appraisal.status == Appraisal.Status.IN_PROGRESS:
            phase = AppraisalSchedule.Phase.MID_YEAR

        is_locked, schedule = check_appraisal_deadline(appraisal, phase)
        if is_locked:
            return Response(
                {
                    'detail': 'Department deadline has elapsed and access is locked.',
                    'locked_at': schedule.locked_at,
                    'end_date': schedule.end_date,
                    'department': schedule.department.name,
                    'phase': schedule.get_phase_display(),
                },
                status=status.HTTP_403_FORBIDDEN
            )

        appraisal.status = Appraisal.Status.MANAGER_REVIEW
        appraisal.self_assessment_date = timezone.now()
        appraisal.save()
        serializer = AppraisalSerializer(appraisal)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete_review(self, request, pk=None):
        """Complete manager review."""
        appraisal = self.get_object()

        is_locked, schedule = check_appraisal_deadline(appraisal, AppraisalSchedule.Phase.YEAR_END)
        if is_locked:
            return Response(
                {
                    'detail': 'Department deadline has elapsed and access is locked.',
                    'locked_at': schedule.locked_at,
                    'end_date': schedule.end_date,
                    'department': schedule.department.name,
                    'phase': schedule.get_phase_display(),
                },
                status=status.HTTP_403_FORBIDDEN
            )

        appraisal.status = Appraisal.Status.COMPLETED
        appraisal.manager_review_date = timezone.now()
        appraisal.completion_date = timezone.now()
        appraisal.save()
        serializer = AppraisalSerializer(appraisal)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def calculate_scores(self, request, pk=None):
        """Calculate weighted scores for appraisal."""
        appraisal = self.get_object()
        calculator = AppraisalScoreCalculator(appraisal)
        scores = calculator.calculate_weighted_score()

        # Optionally save scores
        save = request.data.get('save', False)
        if save:
            calculator.update_appraisal_scores()

        return Response(scores)

    @action(detail=True, methods=['get'], url_path='detail', url_name='detail')
    def get_detail(self, request, pk=None):
        """Get detailed appraisal with all components."""
        appraisal = self.get_object()
        serializer = AppraisalDetailSerializer(appraisal)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get appraisal statistics."""
        cycle_id = request.query_params.get('cycle')
        queryset = Appraisal.objects.all()

        if cycle_id:
            queryset = queryset.filter(appraisal_cycle_id=cycle_id)
        else:
            active_cycle = AppraisalCycle.objects.filter(is_active=True).first()
            if active_cycle:
                queryset = queryset.filter(appraisal_cycle=active_cycle)

        total = queryset.count()
        by_status = queryset.values('status').annotate(count=Count('id'))
        avg_rating = queryset.filter(
            overall_final_rating__isnull=False
        ).aggregate(avg=Avg('overall_final_rating'))

        return Response({
            'total_appraisals': total,
            'by_status': list(by_status),
            'average_rating': avg_rating['avg'],
            'completed': queryset.filter(status='COMPLETED').count(),
            'pending': queryset.exclude(status__in=['COMPLETED', 'ACKNOWLEDGED']).count()
        })


class GoalViewSet(viewsets.ModelViewSet):
    """Goal management."""
    queryset = Goal.objects.select_related('appraisal', 'category')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return GoalCreateSerializer
        return GoalSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        appraisal_id = self.request.query_params.get('appraisal')
        if appraisal_id:
            queryset = queryset.filter(appraisal_id=appraisal_id)
        return queryset

    def _check_goal_deadline(self, appraisal):
        """Check if goal setting deadline is locked for the department."""
        is_locked, schedule = check_appraisal_deadline(appraisal, AppraisalSchedule.Phase.GOAL_SETTING)
        if is_locked:
            return Response(
                {
                    'detail': 'Goal setting deadline has elapsed and access is locked.',
                    'locked_at': schedule.locked_at,
                    'end_date': schedule.end_date,
                    'department': schedule.department.name,
                },
                status=status.HTTP_403_FORBIDDEN
            )
        return None

    def create(self, request, *args, **kwargs):
        appraisal_id = request.data.get('appraisal')
        if appraisal_id:
            try:
                appraisal = Appraisal.objects.select_related('employee__department', 'appraisal_cycle').get(pk=appraisal_id)
                locked_response = self._check_goal_deadline(appraisal)
                if locked_response:
                    return locked_response
            except Appraisal.DoesNotExist:
                pass
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        goal = self.get_object()
        locked_response = self._check_goal_deadline(goal.appraisal)
        if locked_response:
            return locked_response
        return super().update(request, *args, **kwargs)

    @action(detail=True, methods=['post'])
    def update_progress(self, request, pk=None):
        """Add a progress update to a goal."""
        goal = self.get_object()
        serializer = GoalUpdateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(goal=goal)
            # Update goal progress
            goal.progress_percentage = request.data.get('progress_percentage', goal.progress_percentage)
            goal.save()
            return Response(GoalSerializer(goal).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a goal."""
        goal = self.get_object()
        goal.status = Goal.Status.APPROVED
        goal.approved_by = request.user
        goal.approved_at = timezone.now()
        goal.save()
        return Response(GoalSerializer(goal).data)


class PIPViewSet(viewsets.ModelViewSet):
    """Performance Improvement Plan management."""
    queryset = PerformanceImprovementPlan.objects.select_related(
        'employee', 'manager', 'appraisal'
    )
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return PIPListSerializer
        return PIPSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        pip_status = self.request.query_params.get('status')
        if pip_status:
            queryset = queryset.filter(status=pip_status)
        return queryset

    @action(detail=True, methods=['post'])
    def add_review(self, request, pk=None):
        """Add a review to a PIP."""
        pip = self.get_object()
        serializer = PIPReviewSerializer(data=request.data)
        if serializer.is_valid():
            employee = getattr(request.user, 'employee', None)
            serializer.save(pip=pip, reviewed_by=employee)
            return Response(PIPSerializer(pip).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class DevelopmentPlanViewSet(viewsets.ModelViewSet):
    """Development Plan management."""
    queryset = DevelopmentPlan.objects.select_related('employee', 'appraisal')
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return DevelopmentPlanListSerializer
        return DevelopmentPlanSerializer

    @action(detail=False, methods=['get'])
    def my_plans(self, request):
        """Get current user's development plans."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response({'detail': 'No employee profile found'}, status=status.HTTP_404_NOT_FOUND)

        plans = DevelopmentPlan.objects.filter(employee=employee, is_active=True)
        serializer = DevelopmentPlanListSerializer(plans, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a development plan."""
        plan = self.get_object()
        plan.manager_approved = True
        plan.approved_by = request.user
        plan.approved_at = timezone.now()
        plan.save()
        return Response(DevelopmentPlanSerializer(plan).data)


class DevelopmentActivityViewSet(viewsets.ModelViewSet):
    """Development Activity management."""
    queryset = DevelopmentActivity.objects.select_related('development_plan', 'competency')
    serializer_class = DevelopmentActivitySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        plan_id = self.request.query_params.get('plan')
        if plan_id:
            queryset = queryset.filter(development_plan_id=plan_id)
        return queryset


class CoreValueViewSet(viewsets.ModelViewSet):
    """Core values management."""
    queryset = CoreValue.objects.filter(is_active=True)
    serializer_class = CoreValueSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        include_inactive = self.request.query_params.get('include_inactive')
        if include_inactive == 'true':
            queryset = CoreValue.objects.all()
        return queryset.order_by('sort_order', 'name')


class CoreValueAssessmentViewSet(viewsets.ModelViewSet):
    """Core value assessment management."""
    queryset = CoreValueAssessment.objects.select_related('appraisal', 'core_value')
    serializer_class = CoreValueAssessmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = super().get_queryset()
        appraisal_id = self.request.query_params.get('appraisal')
        if appraisal_id:
            queryset = queryset.filter(appraisal_id=appraisal_id)
        return queryset

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create assessments for all active core values for an appraisal."""
        appraisal_id = request.data.get('appraisal')
        if not appraisal_id:
            return Response(
                {'detail': 'appraisal is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            appraisal = Appraisal.objects.get(pk=appraisal_id)
        except Appraisal.DoesNotExist:
            return Response(
                {'detail': 'Appraisal not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        core_values = CoreValue.objects.filter(is_active=True)
        created = []

        for value in core_values:
            assessment, was_created = CoreValueAssessment.objects.get_or_create(
                appraisal=appraisal,
                core_value=value
            )
            if was_created:
                created.append(assessment)

        serializer = CoreValueAssessmentSerializer(created, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class ProbationAssessmentViewSet(viewsets.ModelViewSet):
    """Probation assessment management."""
    queryset = ProbationAssessment.objects.select_related(
        'employee', 'employee__department', 'employee__position',
        'reviewed_by'
    )
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return ProbationAssessmentListSerializer
        if self.action == 'create':
            return ProbationAssessmentCreateSerializer
        return ProbationAssessmentSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by status
        assessment_status = self.request.query_params.get('status')
        if assessment_status:
            queryset = queryset.filter(status=assessment_status)

        # Filter by period
        period = self.request.query_params.get('period')
        if period:
            queryset = queryset.filter(assessment_period=period)

        # Filter by department
        department = self.request.query_params.get('department')
        if department:
            queryset = queryset.filter(employee__department_id=department)

        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search) |
                Q(employee__employee_number__icontains=search)
            )

        return queryset.order_by('due_date')

    @action(detail=False, methods=['get'])
    def due(self, request):
        """Get assessments due within specified days."""
        days = int(request.query_params.get('days', 30))
        service = ProbationService()
        due_assessments = service.get_due_assessments(days_ahead=days)

        # Format response
        result = []
        for item in due_assessments:
            result.append({
                'employee_id': item['employee'].id,
                'employee_name': item['employee'].full_name,
                'employee_number': item['employee'].employee_number,
                'period': item['period'],
                'due_date': item['due_date'].isoformat()
            })

        return Response(result)

    @action(detail=True, methods=['post'])
    def submit(self, request, pk=None):
        """Submit assessment for review."""
        assessment = self.get_object()
        assessment.status = ProbationAssessment.Status.SUBMITTED
        assessment.calculate_overall_rating()
        assessment.save()
        serializer = ProbationAssessmentSerializer(assessment)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """Confirm employee after successful probation."""
        assessment = self.get_object()
        service = ProbationService()
        assessment = service.confirm_employee(assessment)
        assessment.approved_by = request.user
        assessment.save()
        serializer = ProbationAssessmentSerializer(assessment)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def extend(self, request, pk=None):
        """Extend probation period."""
        assessment = self.get_object()
        extension_months = request.data.get('extension_months')
        reason = request.data.get('reason', '')

        if not extension_months:
            return Response(
                {'detail': 'extension_months is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service = ProbationService()
        assessment = service.extend_probation(
            assessment, int(extension_months), reason
        )
        serializer = ProbationAssessmentSerializer(assessment)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """Terminate employment after failed probation."""
        assessment = self.get_object()
        assessment.status = ProbationAssessment.Status.TERMINATED
        assessment.recommendation = request.data.get('reason', '')
        assessment.approved_by = request.user
        assessment.approved_at = timezone.now()
        assessment.save()

        # Update employee status
        assessment.employee.employment_status = 'TERMINATED'
        assessment.employee.save()

        serializer = ProbationAssessmentSerializer(assessment)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get probation assessment statistics."""
        queryset = self.get_queryset()

        total = queryset.count()
        by_status = queryset.values('status').annotate(count=Count('id'))
        by_period = queryset.values('assessment_period').annotate(count=Count('id'))

        overdue = queryset.filter(
            status__in=['DRAFT', 'SUBMITTED', 'REVIEWED'],
            due_date__lt=date.today()
        ).count()

        return Response({
            'total': total,
            'by_status': list(by_status),
            'by_period': list(by_period),
            'overdue': overdue
        })


class TrainingNeedViewSet(viewsets.ModelViewSet):
    """Training needs management."""
    queryset = TrainingNeed.objects.select_related(
        'employee', 'appraisal', 'competency'
    )
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return TrainingNeedListSerializer
        if self.action == 'create':
            return TrainingNeedCreateSerializer
        return TrainingNeedSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by status
        need_status = self.request.query_params.get('status')
        if need_status:
            queryset = queryset.filter(status=need_status)

        # Filter by priority
        priority = self.request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)

        # Filter by employee
        employee_id = self.request.query_params.get('employee')
        if employee_id:
            queryset = queryset.filter(employee_id=employee_id)

        # Filter by appraisal
        appraisal_id = self.request.query_params.get('appraisal')
        if appraisal_id:
            queryset = queryset.filter(appraisal_id=appraisal_id)

        # Filter by training type
        training_type = self.request.query_params.get('type')
        if training_type:
            queryset = queryset.filter(training_type=training_type)

        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search)
            )

        return queryset

    @action(detail=False, methods=['get'])
    def my_training_needs(self, request):
        """Get current user's training needs."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response(
                {'detail': 'No employee profile found'},
                status=status.HTTP_404_NOT_FOUND
            )

        needs = TrainingNeed.objects.filter(employee=employee)
        serializer = TrainingNeedListSerializer(needs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update training need status."""
        need = self.get_object()
        new_status = request.data.get('status')

        if new_status not in dict(TrainingNeed.Status.choices):
            return Response(
                {'detail': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        need.status = new_status

        if new_status == TrainingNeed.Status.COMPLETED:
            need.completion_date = date.today()
            need.outcome = request.data.get('outcome', '')
            need.actual_cost = request.data.get('actual_cost')

        need.save()
        serializer = TrainingNeedSerializer(need)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def identify_from_appraisal(self, request):
        """Automatically identify training needs from an appraisal."""
        appraisal_id = request.data.get('appraisal')
        if not appraisal_id:
            return Response(
                {'detail': 'appraisal is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            appraisal = Appraisal.objects.get(pk=appraisal_id)
        except Appraisal.DoesNotExist:
            return Response(
                {'detail': 'Appraisal not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        service = TrainingNeedService()
        needs = service.identify_from_appraisal(appraisal)
        serializer = TrainingNeedListSerializer(needs, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get training needs statistics."""
        queryset = self.get_queryset()

        total = queryset.count()
        by_status = queryset.values('status').annotate(count=Count('id'))
        by_priority = queryset.values('priority').annotate(count=Count('id'))
        by_type = queryset.values('training_type').annotate(count=Count('id'))

        # Cost summary
        from django.db.models import Sum
        costs = queryset.aggregate(
            estimated_total=Sum('estimated_cost'),
            actual_total=Sum('actual_cost')
        )

        return Response({
            'total': total,
            'by_status': list(by_status),
            'by_priority': list(by_priority),
            'by_type': list(by_type),
            'estimated_cost': costs['estimated_total'],
            'actual_cost': costs['actual_total']
        })


class PerformanceAppealViewSet(viewsets.ModelViewSet):
    """Performance appeal management."""
    queryset = PerformanceAppeal.objects.select_related(
        'appraisal', 'appraisal__employee', 'appraisal__appraisal_cycle',
        'reviewer', 'decided_by'
    )
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'list':
            return PerformanceAppealListSerializer
        if self.action == 'create':
            return PerformanceAppealCreateSerializer
        return PerformanceAppealSerializer

    def get_queryset(self):
        queryset = super().get_queryset()

        # Filter by status
        appeal_status = self.request.query_params.get('status')
        if appeal_status:
            queryset = queryset.filter(status=appeal_status)

        # Filter by cycle
        cycle_id = self.request.query_params.get('cycle')
        if cycle_id:
            queryset = queryset.filter(appraisal__appraisal_cycle_id=cycle_id)

        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(appeal_number__icontains=search) |
                Q(appraisal__employee__first_name__icontains=search) |
                Q(appraisal__employee__last_name__icontains=search)
            )

        return queryset

    @action(detail=False, methods=['get'])
    def my_appeals(self, request):
        """Get current user's appeals."""
        employee = getattr(request.user, 'employee', None)
        if not employee:
            return Response(
                {'detail': 'No employee profile found'},
                status=status.HTTP_404_NOT_FOUND
            )

        appeals = PerformanceAppeal.objects.filter(
            appraisal__employee=employee
        )
        serializer = PerformanceAppealListSerializer(appeals, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def assign_reviewer(self, request, pk=None):
        """Assign a reviewer to the appeal."""
        appeal = self.get_object()
        reviewer_id = request.data.get('reviewer')

        if not reviewer_id:
            return Response(
                {'detail': 'reviewer is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.contrib.auth import get_user_model
        User = get_user_model()

        try:
            reviewer = User.objects.get(pk=reviewer_id)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Reviewer not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        appeal.reviewer = reviewer
        appeal.status = PerformanceAppeal.Status.UNDER_REVIEW
        appeal.save()

        serializer = PerformanceAppealSerializer(appeal)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def schedule_hearing(self, request, pk=None):
        """Schedule appeal hearing."""
        appeal = self.get_object()
        hearing_date = request.data.get('hearing_date')

        if not hearing_date:
            return Response(
                {'detail': 'hearing_date is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        service = PerformanceAppealService()
        appeal = service.schedule_hearing(
            appeal, hearing_date, request.user
        )

        serializer = PerformanceAppealSerializer(appeal)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def decide(self, request, pk=None):
        """Record appeal decision."""
        appeal = self.get_object()
        serializer = PerformanceAppealDecisionSerializer(data=request.data)

        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        service = PerformanceAppealService()
        appeal = service.record_decision(
            appeal,
            decision=serializer.validated_data['decision'],
            status=serializer.validated_data['status'],
            revised_ratings=serializer.validated_data.get('revised_ratings'),
            decided_by=request.user
        )

        result_serializer = PerformanceAppealSerializer(appeal)
        return Response(result_serializer.data)

    @action(detail=True, methods=['post'])
    def withdraw(self, request, pk=None):
        """Withdraw an appeal."""
        appeal = self.get_object()

        if appeal.status not in ['SUBMITTED', 'UNDER_REVIEW', 'HEARING']:
            return Response(
                {'detail': 'Cannot withdraw appeal in current status'},
                status=status.HTTP_400_BAD_REQUEST
            )

        appeal.status = PerformanceAppeal.Status.WITHDRAWN
        appeal.save()

        serializer = PerformanceAppealSerializer(appeal)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get appeal statistics."""
        queryset = self.get_queryset()

        total = queryset.count()
        by_status = queryset.values('status').annotate(count=Count('id'))

        pending = queryset.filter(
            status__in=['SUBMITTED', 'UNDER_REVIEW', 'HEARING']
        ).count()

        return Response({
            'total': total,
            'by_status': list(by_status),
            'pending': pending
        })


class TrainingDocumentViewSet(viewsets.ModelViewSet):
    """Training document management with binary file storage."""
    queryset = TrainingDocument.objects.select_related('training_need', 'uploaded_by')
    serializer_class = TrainingDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        training_need_id = self.request.query_params.get('training_need')
        if training_need_id:
            queryset = queryset.filter(training_need_id=training_need_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download document with file data URI."""
        document = self.get_object()
        if not document.has_file:
            return Response(
                {'detail': 'No file attached'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = TrainingDocumentSerializer(document)
        return Response(serializer.data)


class AppraisalDocumentViewSet(viewsets.ModelViewSet):
    """Appraisal document management with binary file storage."""
    queryset = AppraisalDocument.objects.select_related('appraisal', 'uploaded_by')
    serializer_class = AppraisalDocumentSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        queryset = super().get_queryset()
        appraisal_id = self.request.query_params.get('appraisal')
        if appraisal_id:
            queryset = queryset.filter(appraisal_id=appraisal_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download document with file data URI."""
        document = self.get_object()
        if not document.has_file:
            return Response(
                {'detail': 'No file attached'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AppraisalDocumentSerializer(document)
        return Response(serializer.data)


class AppraisalScheduleViewSet(viewsets.ModelViewSet):
    """Appraisal schedule management for department-level deadline overrides."""
    queryset = AppraisalSchedule.objects.select_related(
        'appraisal_cycle', 'department'
    )
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return AppraisalScheduleCreateSerializer
        return AppraisalScheduleSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        cycle_id = self.request.query_params.get('cycle')
        if cycle_id:
            queryset = queryset.filter(appraisal_cycle_id=cycle_id)
        department_id = self.request.query_params.get('department')
        if department_id:
            queryset = queryset.filter(department_id=department_id)
        phase = self.request.query_params.get('phase')
        if phase:
            queryset = queryset.filter(phase=phase)
        return queryset

    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create schedules for multiple departments at once."""
        serializer = AppraisalScheduleBulkCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        created = []
        skipped = []

        for dept_id in data['department_ids']:
            schedule, was_created = AppraisalSchedule.objects.get_or_create(
                appraisal_cycle_id=data['appraisal_cycle'],
                department_id=dept_id,
                phase=data['phase'],
                defaults={
                    'start_date': data['start_date'],
                    'end_date': data['end_date'],
                }
            )
            if was_created:
                created.append(str(schedule.id))
            else:
                skipped.append(str(dept_id))

        schedules = AppraisalSchedule.objects.filter(id__in=created)
        result_serializer = AppraisalScheduleSerializer(schedules, many=True)
        return Response({
            'created': len(created),
            'skipped': len(skipped),
            'schedules': result_serializer.data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def lock(self, request, pk=None):
        """Manually lock a schedule."""
        schedule = self.get_object()
        reason = request.data.get('reason', 'Manually locked')
        schedule.is_locked = True
        schedule.locked_at = timezone.now()
        schedule.lock_reason = reason
        schedule.save()
        serializer = AppraisalScheduleSerializer(schedule)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def unlock(self, request, pk=None):
        """Manually unlock a schedule (line manager access)."""
        schedule = self.get_object()
        reason = request.data.get('reason', '')
        if not reason:
            return Response(
                {'detail': 'A reason is required to unlock a schedule.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        schedule.is_locked = False
        schedule.locked_at = None
        schedule.lock_reason = ''
        schedule.save()
        serializer = AppraisalScheduleSerializer(schedule)
        return Response(serializer.data)


class AppraisalDeadlineExtensionViewSet(viewsets.ModelViewSet):
    """Appraisal deadline extension request management."""
    queryset = AppraisalDeadlineExtension.objects.select_related(
        'schedule', 'schedule__department', 'schedule__appraisal_cycle',
        'requested_by', 'approved_by'
    )
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return AppraisalDeadlineExtensionCreateSerializer
        return AppraisalDeadlineExtensionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        schedule_id = self.request.query_params.get('schedule')
        if schedule_id:
            queryset = queryset.filter(schedule_id=schedule_id)
        ext_status = self.request.query_params.get('status')
        if ext_status:
            queryset = queryset.filter(status=ext_status)
        return queryset

    def perform_create(self, serializer):
        employee = getattr(self.request.user, 'employee', None)
        if not employee:
            raise drf_serializers.ValidationError('User must have an employee profile')
        serializer.save(requested_by=employee)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve an extension request."""
        extension = self.get_object()
        if extension.status != AppraisalDeadlineExtension.Status.PENDING:
            return Response(
                {'detail': 'Only pending extensions can be approved.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        extension.approve(request.user)
        serializer = AppraisalDeadlineExtensionSerializer(extension)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject an extension request."""
        extension = self.get_object()
        if extension.status != AppraisalDeadlineExtension.Status.PENDING:
            return Response(
                {'detail': 'Only pending extensions can be rejected.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        rejection_reason = request.data.get('reason', '')
        extension.status = AppraisalDeadlineExtension.Status.REJECTED
        extension.rejection_reason = rejection_reason
        extension.approved_by = request.user
        extension.approved_at = timezone.now()
        extension.save()
        serializer = AppraisalDeadlineExtensionSerializer(extension)
        return Response(serializer.data)
