"""
Serializers for performance management.
"""

from rest_framework import serializers

from .models import (
    AppraisalCycle, AppraisalSchedule, AppraisalDeadlineExtension,
    RatingScale, RatingScaleLevel, Competency, CompetencyLevel,
    GoalCategory, Appraisal, Goal, GoalUpdate, CompetencyAssessment,
    PeerFeedback, PerformanceImprovementPlan, PIPReview,
    DevelopmentPlan, DevelopmentActivity,
    CoreValue, CoreValueAssessment, ProbationAssessment,
    TrainingNeed, PerformanceAppeal, TrainingDocument, AppraisalDocument
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

    def validate(self, data):
        """Validate that weights sum to 100."""
        objectives_weight = data.get('objectives_weight', self.instance.objectives_weight if self.instance else 60)
        competencies_weight = data.get('competencies_weight', self.instance.competencies_weight if self.instance else 20)
        values_weight = data.get('values_weight', self.instance.values_weight if self.instance else 20)

        total = objectives_weight + competencies_weight + values_weight
        if total != 100:
            raise serializers.ValidationError(
                f'Component weights must sum to 100. Current total: {total}'
            )
        return data


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
    department_name = serializers.CharField(source='employee.department.name', read_only=True, allow_null=True)
    position_title = serializers.CharField(source='employee.position.title', read_only=True, allow_null=True)
    cycle_name = serializers.CharField(source='appraisal_cycle.name', read_only=True)
    cycle_year = serializers.IntegerField(source='appraisal_cycle.year', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    overall_self_rating = serializers.DecimalField(max_digits=5, decimal_places=2, read_only=True)

    class Meta:
        model = Appraisal
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'department_name', 'position_title',
            'appraisal_cycle', 'cycle_name', 'cycle_year',
            'status', 'status_display', 'overall_self_rating',
            'overall_final_rating', 'completion_date'
        ]


class AppraisalSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True, allow_null=True)
    position_title = serializers.CharField(source='employee.position.title', read_only=True, allow_null=True)
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


# Core Value Serializers
class CoreValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoreValue
        fields = [
            'id', 'name', 'code', 'description', 'behavioral_indicators',
            'is_active', 'sort_order', 'created_at', 'updated_at'
        ]


class CoreValueAssessmentSerializer(serializers.ModelSerializer):
    core_value_name = serializers.CharField(source='core_value.name', read_only=True)
    core_value_code = serializers.CharField(source='core_value.code', read_only=True)

    class Meta:
        model = CoreValueAssessment
        fields = [
            'id', 'appraisal', 'core_value', 'core_value_name', 'core_value_code',
            'self_rating', 'self_comments', 'manager_rating', 'manager_comments',
            'final_rating', 'created_at', 'updated_at'
        ]


# Probation Assessment Serializers
class ProbationAssessmentListSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    position_title = serializers.CharField(source='employee.position.title', read_only=True)
    period_display = serializers.CharField(source='get_assessment_period_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ProbationAssessment
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'department_name', 'position_title',
            'assessment_period', 'period_display', 'assessment_date', 'due_date',
            'overall_rating', 'status', 'status_display'
        ]


class ProbationAssessmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    position_title = serializers.CharField(source='employee.position.title', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.full_name', read_only=True)
    period_display = serializers.CharField(source='get_assessment_period_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = ProbationAssessment
        fields = '__all__'


class ProbationAssessmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProbationAssessment
        fields = [
            'employee', 'assessment_period', 'assessment_date', 'due_date',
            'job_knowledge', 'work_quality', 'attendance_punctuality',
            'teamwork', 'communication', 'initiative',
            'supervisor_comments', 'recommendation'
        ]


# Training Need Serializers
class TrainingNeedListSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    competency_name = serializers.CharField(source='competency.name', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_training_type_display', read_only=True)

    class Meta:
        model = TrainingNeed
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'title', 'training_type', 'type_display',
            'competency', 'competency_name',
            'priority', 'priority_display',
            'target_date', 'status', 'status_display'
        ]


class TrainingNeedSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    competency_name = serializers.CharField(source='competency.name', read_only=True)
    appraisal_cycle = serializers.CharField(
        source='appraisal.appraisal_cycle.name', read_only=True
    )
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    type_display = serializers.CharField(source='get_training_type_display', read_only=True)

    class Meta:
        model = TrainingNeed
        fields = '__all__'


class TrainingNeedCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrainingNeed
        fields = [
            'employee', 'appraisal', 'title', 'description', 'training_type',
            'competency', 'priority', 'target_date', 'estimated_cost',
            'training_provider'
        ]


# Performance Appeal Serializers
class PerformanceAppealListSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source='appraisal.employee.full_name', read_only=True
    )
    employee_number = serializers.CharField(
        source='appraisal.employee.employee_number', read_only=True
    )
    appraisal_cycle = serializers.CharField(
        source='appraisal.appraisal_cycle.name', read_only=True
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PerformanceAppeal
        fields = [
            'id', 'appeal_number', 'appraisal', 'employee_name', 'employee_number',
            'appraisal_cycle', 'submitted_at', 'status', 'status_display',
            'hearing_date', 'decision_date'
        ]


class PerformanceAppealSerializer(serializers.ModelSerializer):
    employee_name = serializers.CharField(
        source='appraisal.employee.full_name', read_only=True
    )
    employee_number = serializers.CharField(
        source='appraisal.employee.employee_number', read_only=True
    )
    appraisal_cycle = serializers.CharField(
        source='appraisal.appraisal_cycle.name', read_only=True
    )
    reviewer_name = serializers.CharField(source='reviewer.get_full_name', read_only=True)
    decided_by_name = serializers.CharField(source='decided_by.get_full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PerformanceAppeal
        fields = '__all__'


class PerformanceAppealCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = PerformanceAppeal
        fields = [
            'appraisal', 'grounds', 'disputed_ratings',
            'requested_remedy', 'supporting_evidence'
        ]


class PerformanceAppealDecisionSerializer(serializers.Serializer):
    """Serializer for recording appeal decisions."""
    decision = serializers.CharField()
    status = serializers.ChoiceField(choices=[
        ('UPHELD', 'Appeal Upheld'),
        ('PARTIAL', 'Partially Upheld'),
        ('DISMISSED', 'Dismissed'),
    ])
    revised_ratings = serializers.DictField(required=False)


# Enhanced Appraisal Serializer with value assessments
class AppraisalDetailSerializer(serializers.ModelSerializer):
    """Extended serializer with all assessment components."""
    employee_name = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    position_title = serializers.CharField(source='employee.position.title', read_only=True)
    manager_name = serializers.CharField(source='manager.full_name', read_only=True)
    cycle_name = serializers.CharField(source='appraisal_cycle.name', read_only=True)
    goals = GoalSerializer(many=True, read_only=True)
    competency_assessments = CompetencyAssessmentSerializer(many=True, read_only=True)
    value_assessments = CoreValueAssessmentSerializer(many=True, read_only=True)
    peer_feedback = PeerFeedbackSerializer(many=True, read_only=True)
    training_needs = TrainingNeedListSerializer(many=True, read_only=True)
    appeals = PerformanceAppealListSerializer(many=True, read_only=True)

    # Cycle configuration for frontend reference
    objectives_weight = serializers.DecimalField(
        source='appraisal_cycle.objectives_weight',
        max_digits=5, decimal_places=2, read_only=True
    )
    competencies_weight = serializers.DecimalField(
        source='appraisal_cycle.competencies_weight',
        max_digits=5, decimal_places=2, read_only=True
    )
    values_weight = serializers.DecimalField(
        source='appraisal_cycle.values_weight',
        max_digits=5, decimal_places=2, read_only=True
    )
    pass_mark = serializers.DecimalField(
        source='appraisal_cycle.pass_mark',
        max_digits=5, decimal_places=2, read_only=True
    )

    class Meta:
        model = Appraisal
        fields = '__all__'


# Document Serializers
class TrainingDocumentSerializer(serializers.ModelSerializer):
    """Serializer for training documents with file support."""
    file = serializers.FileField(write_only=True, required=False)
    file_url = serializers.SerializerMethodField()
    file_info = serializers.SerializerMethodField()
    document_type_display = serializers.CharField(
        source='get_document_type_display', read_only=True
    )
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name', read_only=True, allow_null=True
    )

    class Meta:
        model = TrainingDocument
        fields = [
            'id', 'training_need', 'document_type', 'document_type_display',
            'description', 'file', 'file_name', 'file_size', 'mime_type',
            'file_checksum', 'file_url', 'file_info',
            'uploaded_by', 'uploaded_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['file_name', 'file_size', 'mime_type', 'file_checksum', 'uploaded_by']

    def get_file_url(self, obj):
        """Return file as data URI for embedding/download."""
        if hasattr(obj, 'has_file') and obj.has_file:
            return obj.get_file_data_uri()
        return None

    def get_file_info(self, obj):
        """Return file metadata."""
        if hasattr(obj, 'has_file') and obj.has_file:
            return {
                'name': obj.file_name,
                'size': obj.file_size,
                'type': obj.mime_type,
                'checksum': obj.file_checksum,
                'is_image': obj.is_image,
                'is_pdf': obj.is_pdf,
                'is_document': obj.is_document,
            }
        return None

    def create(self, validated_data):
        file_obj = validated_data.pop('file', None)
        instance = super().create(validated_data)
        if file_obj:
            instance.set_file(file_obj)
            instance.save()
        return instance


class AppraisalDocumentSerializer(serializers.ModelSerializer):
    """Serializer for appraisal documents with file support."""
    file = serializers.FileField(write_only=True, required=False)
    file_url = serializers.SerializerMethodField()
    file_info = serializers.SerializerMethodField()
    document_type_display = serializers.CharField(
        source='get_document_type_display', read_only=True
    )
    uploaded_by_name = serializers.CharField(
        source='uploaded_by.get_full_name', read_only=True, allow_null=True
    )

    class Meta:
        model = AppraisalDocument
        fields = [
            'id', 'appraisal', 'document_type', 'document_type_display',
            'description', 'file', 'file_name', 'file_size', 'mime_type',
            'file_checksum', 'file_url', 'file_info',
            'uploaded_by', 'uploaded_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['file_name', 'file_size', 'mime_type', 'file_checksum', 'uploaded_by']

    def get_file_url(self, obj):
        """Return file as data URI for embedding/download."""
        if hasattr(obj, 'has_file') and obj.has_file:
            return obj.get_file_data_uri()
        return None

    def get_file_info(self, obj):
        """Return file metadata."""
        if hasattr(obj, 'has_file') and obj.has_file:
            return {
                'name': obj.file_name,
                'size': obj.file_size,
                'type': obj.mime_type,
                'checksum': obj.file_checksum,
                'is_image': obj.is_image,
                'is_pdf': obj.is_pdf,
                'is_document': obj.is_document,
            }
        return None

    def create(self, validated_data):
        file_obj = validated_data.pop('file', None)
        instance = super().create(validated_data)
        if file_obj:
            instance.set_file(file_obj)
            instance.save()
        return instance


# Appraisal Schedule Serializers
class AppraisalScheduleSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    phase_display = serializers.CharField(source='get_phase_display', read_only=True)
    cycle_name = serializers.CharField(source='appraisal_cycle.name', read_only=True)
    is_past_deadline = serializers.BooleanField(read_only=True)

    class Meta:
        model = AppraisalSchedule
        fields = [
            'id', 'appraisal_cycle', 'cycle_name', 'department', 'department_name',
            'phase', 'phase_display', 'start_date', 'end_date',
            'is_locked', 'locked_at', 'lock_reason', 'is_past_deadline',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['locked_at']


class AppraisalScheduleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppraisalSchedule
        fields = ['appraisal_cycle', 'department', 'phase', 'start_date', 'end_date']


class AppraisalScheduleBulkCreateSerializer(serializers.Serializer):
    """Serializer for bulk creating schedules for multiple departments."""
    appraisal_cycle = serializers.UUIDField()
    department_ids = serializers.ListField(child=serializers.UUIDField())
    phase = serializers.ChoiceField(choices=AppraisalSchedule.Phase.choices)
    start_date = serializers.DateField()
    end_date = serializers.DateField()


class AppraisalDeadlineExtensionSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    schedule_department = serializers.CharField(source='schedule.department.name', read_only=True)
    schedule_phase = serializers.CharField(source='schedule.get_phase_display', read_only=True)

    class Meta:
        model = AppraisalDeadlineExtension
        fields = [
            'id', 'schedule', 'schedule_department', 'schedule_phase',
            'requested_by', 'requested_by_name', 'reason', 'new_end_date',
            'status', 'status_display', 'approved_by', 'approved_by_name',
            'approved_at', 'rejection_reason',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['approved_by', 'approved_at']


class AppraisalDeadlineExtensionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppraisalDeadlineExtension
        fields = ['schedule', 'reason', 'new_end_date']
