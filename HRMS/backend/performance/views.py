"""
Views for performance management.
"""

from django.db.models import Avg, Count, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    AppraisalCycle, RatingScale, Competency, GoalCategory,
    Appraisal, Goal, GoalUpdate, CompetencyAssessment,
    PeerFeedback, PerformanceImprovementPlan, PIPReview,
    DevelopmentPlan, DevelopmentActivity
)
from .serializers import (
    AppraisalCycleListSerializer, AppraisalCycleSerializer,
    RatingScaleSerializer, CompetencySerializer, GoalCategorySerializer,
    AppraisalListSerializer, AppraisalSerializer, AppraisalCreateSerializer,
    GoalSerializer, GoalCreateSerializer, GoalUpdateSerializer,
    CompetencyAssessmentSerializer, PeerFeedbackSerializer,
    PIPListSerializer, PIPSerializer, PIPReviewSerializer,
    DevelopmentPlanListSerializer, DevelopmentPlanSerializer,
    DevelopmentActivitySerializer
)


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
    )
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
        appraisal.status = Appraisal.Status.MANAGER_REVIEW
        appraisal.self_assessment_date = timezone.now()
        appraisal.save()
        serializer = AppraisalSerializer(appraisal)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def complete_review(self, request, pk=None):
        """Complete manager review."""
        appraisal = self.get_object()
        appraisal.status = Appraisal.Status.COMPLETED
        appraisal.manager_review_date = timezone.now()
        appraisal.completion_date = timezone.now()
        appraisal.save()
        serializer = AppraisalSerializer(appraisal)
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
