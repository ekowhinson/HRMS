"""
Serializers for performance management.
"""

from rest_framework import serializers

from .models import (
    AppraisalCycle, RatingScale, RatingScaleLevel, Competency, CompetencyLevel,
    GoalCategory, Appraisal, Goal, GoalUpdate, CompetencyAssessment,
    PeerFeedback, PerformanceImprovementPlan, PIPReview,
    DevelopmentPlan, DevelopmentActivity
)


class RatingScaleLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = RatingScaleLevel
        fields = ['id', 'level', 'name', 'description', 'min_percentage', 'max_percentage']


class RatingScaleSerializer(serializers.ModelSerializer):
    levels = RatingScaleLevelSerializer(many=True, read_only=True)

    class Meta:
        model = RatingScale
        fields = ['id', 'name', 'description', 'is_active', 'is_default', 'levels']


class AppraisalCycleListSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppraisalCycle
        fields = [
            'id', 'name', 'year', 'start_date', 'end_date',
            'status', 'is_active'
        ]


class AppraisalCycleSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppraisalCycle
        fields = '__all__'


class CompetencyLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompetencyLevel
        fields = ['id', 'level', 'name', 'description', 'behavioral_indicators']


class CompetencySerializer(serializers.ModelSerializer):
    proficiency_levels = CompetencyLevelSerializer(many=True, read_only=True)

    class Meta:
        model = Competency
        fields = [
            'id', 'name', 'code', 'description', 'category',
            'is_active', 'proficiency_levels'
        ]


class GoalCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = GoalCategory
        fields = ['id', 'name', 'description', 'weight', 'is_active']


class GoalUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoalUpdate
        fields = ['id', 'update_date', 'progress_percentage', 'notes', 'created_at']


class GoalSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)
    updates = GoalUpdateSerializer(many=True, read_only=True)

    class Meta:
        model = Goal
        fields = [
            'id', 'category', 'category_name', 'title', 'description',
            'success_criteria', 'weight', 'target_date', 'status',
            'progress_percentage', 'progress_notes',
            'self_rating', 'self_comments',
            'manager_rating', 'manager_comments',
            'final_rating', 'approved_by', 'approved_at',
            'updates', 'created_at', 'updated_at'
        ]


class GoalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Goal
        fields = [
            'appraisal', 'category', 'title', 'description',
            'success_criteria', 'weight', 'target_date'
        ]


class CompetencyAssessmentSerializer(serializers.ModelSerializer):
    competency_name = serializers.CharField(source='competency.name', read_only=True)
    competency_code = serializers.CharField(source='competency.code', read_only=True)
    competency_category = serializers.CharField(source='competency.category', read_only=True)

    class Meta:
        model = CompetencyAssessment
        fields = [
            'id', 'competency', 'competency_name', 'competency_code',
            'competency_category', 'self_rating', 'self_comments',
            'manager_rating', 'manager_comments', 'final_rating'
        ]


class PeerFeedbackSerializer(serializers.ModelSerializer):
    reviewer_name = serializers.CharField(source='reviewer.full_name', read_only=True)

    class Meta:
        model = PeerFeedback
        fields = [
            'id', 'reviewer', 'reviewer_name', 'status',
            'strengths', 'areas_for_improvement', 'overall_comments',
            'overall_rating', 'requested_at', 'submitted_at', 'is_anonymous'
        ]


class AppraisalListSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    position_title = serializers.CharField(source='employee.position.title', read_only=True)
    cycle_name = serializers.CharField(source='appraisal_cycle.name', read_only=True)
    cycle_year = serializers.IntegerField(source='appraisal_cycle.year', read_only=True)

    class Meta:
        model = Appraisal
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'department_name', 'position_title',
            'appraisal_cycle', 'cycle_name', 'cycle_year',
            'status', 'overall_final_rating', 'completion_date'
        ]


class AppraisalSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    position_title = serializers.CharField(source='employee.position.title', read_only=True)
    manager_name = serializers.CharField(source='manager.full_name', read_only=True)
    cycle_name = serializers.CharField(source='appraisal_cycle.name', read_only=True)
    goals = GoalSerializer(many=True, read_only=True)
    competency_assessments = CompetencyAssessmentSerializer(many=True, read_only=True)
    peer_feedback = PeerFeedbackSerializer(many=True, read_only=True)

    class Meta:
        model = Appraisal
        fields = '__all__'


class AppraisalCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appraisal
        fields = ['employee', 'appraisal_cycle', 'manager']


class PIPReviewSerializer(serializers.ModelSerializer):
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True)

    class Meta:
        model = PIPReview
        fields = [
            'id', 'review_date', 'progress_summary', 'areas_improved',
            'areas_needing_work', 'action_items', 'reviewed_by',
            'reviewed_by_name', 'employee_acknowledgement', 'acknowledged_at'
        ]


class PIPListSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    manager_name = serializers.CharField(source='manager.full_name', read_only=True)

    class Meta:
        model = PerformanceImprovementPlan
        fields = [
            'id', 'pip_number', 'employee', 'employee_name', 'employee_number',
            'start_date', 'end_date', 'status', 'manager_name'
        ]


class PIPSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    manager_name = serializers.CharField(source='manager.full_name', read_only=True)
    reviews = PIPReviewSerializer(many=True, read_only=True)

    class Meta:
        model = PerformanceImprovementPlan
        fields = '__all__'


class DevelopmentActivitySerializer(serializers.ModelSerializer):
    competency_name = serializers.CharField(source='competency.name', read_only=True)

    class Meta:
        model = DevelopmentActivity
        fields = [
            'id', 'title', 'description', 'activity_type',
            'competency', 'competency_name', 'target_date', 'completion_date',
            'status', 'resources_needed', 'estimated_cost', 'actual_cost',
            'outcome', 'created_at'
        ]


class DevelopmentPlanListSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)

    class Meta:
        model = DevelopmentPlan
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'title', 'start_date', 'target_completion', 'is_active',
            'manager_approved'
        ]


class DevelopmentPlanSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    activities = DevelopmentActivitySerializer(many=True, read_only=True)

    class Meta:
        model = DevelopmentPlan
        fields = '__all__'
