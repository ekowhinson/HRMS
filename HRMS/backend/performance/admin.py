"""
Admin configuration for performance management.
"""

from django.contrib import admin

from .models import (
    AppraisalCycle, RatingScale, RatingScaleLevel, Competency, CompetencyLevel,
    GoalCategory, Appraisal, Goal, GoalUpdate, CompetencyAssessment,
    PeerFeedback, PerformanceImprovementPlan, PIPReview,
    DevelopmentPlan, DevelopmentActivity,
    CoreValue, CoreValueAssessment, ProbationAssessment,
    TrainingNeed, PerformanceAppeal
)


class RatingScaleLevelInline(admin.TabularInline):
    model = RatingScaleLevel
    extra = 1


class CompetencyLevelInline(admin.TabularInline):
    model = CompetencyLevel
    extra = 1


class GoalInline(admin.TabularInline):
    model = Goal
    extra = 0
    fields = ['title', 'weight', 'status', 'final_rating']
    readonly_fields = ['final_rating']


class CompetencyAssessmentInline(admin.TabularInline):
    model = CompetencyAssessment
    extra = 0
    fields = ['competency', 'self_rating', 'manager_rating', 'final_rating']


class CoreValueAssessmentInline(admin.TabularInline):
    model = CoreValueAssessment
    extra = 0
    fields = ['core_value', 'self_rating', 'manager_rating', 'final_rating']


class PIPReviewInline(admin.TabularInline):
    model = PIPReview
    extra = 0


class DevelopmentActivityInline(admin.TabularInline):
    model = DevelopmentActivity
    extra = 1


@admin.register(AppraisalCycle)
class AppraisalCycleAdmin(admin.ModelAdmin):
    list_display = ['name', 'year', 'status', 'is_active', 'start_date', 'end_date']
    list_filter = ['status', 'is_active', 'year']
    search_fields = ['name']
    fieldsets = (
        (None, {
            'fields': ('name', 'description', 'year', 'status', 'is_active')
        }),
        ('Dates', {
            'fields': (
                ('start_date', 'end_date'),
                ('goal_setting_start', 'goal_setting_end'),
                ('mid_year_start', 'mid_year_end'),
                ('year_end_start', 'year_end_end'),
            )
        }),
        ('Configuration', {
            'fields': (
                'allow_self_assessment', 'allow_peer_feedback',
                'require_manager_approval', ('min_goals', 'max_goals')
            )
        }),
        ('Component Weights', {
            'fields': (
                ('objectives_weight', 'competencies_weight', 'values_weight'),
            ),
            'description': 'Weights must sum to 100'
        }),
        ('Thresholds', {
            'fields': (
                ('pass_mark', 'pip_threshold'),
                ('increment_threshold', 'promotion_threshold'),
            )
        }),
    )


@admin.register(RatingScale)
class RatingScaleAdmin(admin.ModelAdmin):
    list_display = ['name', 'is_active', 'is_default']
    list_filter = ['is_active', 'is_default']
    inlines = [RatingScaleLevelInline]


@admin.register(Competency)
class CompetencyAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'category', 'is_active']
    list_filter = ['category', 'is_active']
    search_fields = ['name', 'code']
    inlines = [CompetencyLevelInline]


@admin.register(GoalCategory)
class GoalCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'weight', 'is_active']
    list_filter = ['is_active']


@admin.register(Appraisal)
class AppraisalAdmin(admin.ModelAdmin):
    list_display = [
        'employee', 'appraisal_cycle', 'status',
        'overall_final_rating', 'completion_date'
    ]
    list_filter = ['status', 'appraisal_cycle', 'employee__department']
    search_fields = ['employee__first_name', 'employee__last_name', 'employee__employee_number']
    raw_id_fields = ['employee', 'manager']
    readonly_fields = [
        'weighted_objectives_score', 'weighted_competencies_score',
        'weighted_values_score', 'overall_final_rating'
    ]
    inlines = [GoalInline, CompetencyAssessmentInline, CoreValueAssessmentInline]
    fieldsets = (
        (None, {
            'fields': ('employee', 'appraisal_cycle', 'manager', 'status')
        }),
        ('Goal Ratings', {
            'fields': (
                ('goals_self_rating', 'goals_manager_rating', 'goals_final_rating'),
            )
        }),
        ('Competency Ratings', {
            'fields': (
                ('competency_self_rating', 'competency_manager_rating', 'competency_final_rating'),
            )
        }),
        ('Core Values Ratings', {
            'fields': (
                ('values_self_rating', 'values_manager_rating', 'values_final_rating'),
            )
        }),
        ('Weighted Scores', {
            'fields': (
                ('weighted_objectives_score', 'weighted_competencies_score', 'weighted_values_score'),
            ),
            'classes': ('collapse',)
        }),
        ('Overall Ratings', {
            'fields': (
                ('overall_self_rating', 'overall_manager_rating', 'overall_final_rating'),
                'final_rating_level'
            )
        }),
        ('Comments', {
            'fields': ('employee_comments', 'manager_comments', 'hr_comments'),
            'classes': ('collapse',)
        }),
        ('Dates', {
            'fields': (
                'self_assessment_date', 'manager_review_date',
                'review_meeting_date', 'completion_date', 'acknowledgement_date'
            ),
            'classes': ('collapse',)
        }),
        ('Recommendations', {
            'fields': (
                'promotion_recommended', 'increment_recommended',
                'training_recommended', 'pip_recommended'
            )
        }),
    )


@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ['title', 'appraisal', 'weight', 'status', 'final_rating']
    list_filter = ['status', 'category']
    search_fields = ['title', 'appraisal__employee__first_name']
    raw_id_fields = ['appraisal']


@admin.register(PerformanceImprovementPlan)
class PIPAdmin(admin.ModelAdmin):
    list_display = ['pip_number', 'employee', 'status', 'start_date', 'end_date']
    list_filter = ['status']
    search_fields = ['pip_number', 'employee__first_name', 'employee__last_name']
    raw_id_fields = ['employee', 'manager', 'appraisal']
    inlines = [PIPReviewInline]


@admin.register(DevelopmentPlan)
class DevelopmentPlanAdmin(admin.ModelAdmin):
    list_display = ['title', 'employee', 'start_date', 'target_completion', 'is_active']
    list_filter = ['is_active', 'manager_approved']
    search_fields = ['title', 'employee__first_name', 'employee__last_name']
    raw_id_fields = ['employee', 'appraisal']
    inlines = [DevelopmentActivityInline]


# New NHIA models

@admin.register(CoreValue)
class CoreValueAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'is_active', 'sort_order']
    list_filter = ['is_active']
    search_fields = ['name', 'code']
    ordering = ['sort_order', 'name']


@admin.register(ProbationAssessment)
class ProbationAssessmentAdmin(admin.ModelAdmin):
    list_display = [
        'employee', 'assessment_period', 'due_date',
        'overall_rating', 'status'
    ]
    list_filter = ['status', 'assessment_period', 'employee__department']
    search_fields = ['employee__first_name', 'employee__last_name', 'employee__employee_number']
    raw_id_fields = ['employee', 'reviewed_by']
    readonly_fields = ['overall_rating']
    fieldsets = (
        (None, {
            'fields': ('employee', 'assessment_period', 'assessment_date', 'due_date', 'status')
        }),
        ('Assessment Areas', {
            'fields': (
                ('job_knowledge', 'work_quality'),
                ('attendance_punctuality', 'teamwork'),
                ('communication', 'initiative'),
                'overall_rating'
            )
        }),
        ('Comments', {
            'fields': ('supervisor_comments', 'employee_comments', 'hr_comments')
        }),
        ('Recommendation', {
            'fields': ('recommendation', 'extension_duration')
        }),
        ('Approval', {
            'fields': (
                ('reviewed_by', 'reviewed_at'),
                ('approved_by', 'approved_at')
            ),
            'classes': ('collapse',)
        }),
    )


@admin.register(TrainingNeed)
class TrainingNeedAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'employee', 'training_type', 'priority',
        'status', 'target_date'
    ]
    list_filter = ['status', 'priority', 'training_type']
    search_fields = ['title', 'employee__first_name', 'employee__last_name']
    raw_id_fields = ['employee', 'appraisal', 'competency']


@admin.register(PerformanceAppeal)
class PerformanceAppealAdmin(admin.ModelAdmin):
    list_display = [
        'appeal_number', 'get_employee', 'status',
        'submitted_at', 'decision_date'
    ]
    list_filter = ['status']
    search_fields = ['appeal_number', 'appraisal__employee__first_name']
    raw_id_fields = ['appraisal']
    readonly_fields = ['appeal_number', 'submitted_at']

    def get_employee(self, obj):
        return obj.appraisal.employee
    get_employee.short_description = 'Employee'
