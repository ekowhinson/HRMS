"""
Recruitment admin configuration.
"""

from django.contrib import admin
from .models import (
    Vacancy, Applicant, Interview, InterviewPanel, InterviewFeedback,
    Reference, JobOffer,
    InterviewScoreTemplate, InterviewScoreCategory,
    InterviewScoringSheet, InterviewScoreItem, InterviewReport,
    VacancyURL, ApplicantPortalAccess, ApplicantStatusHistory,
    ShortlistCriteria, ShortlistTemplate, ShortlistTemplateCriteria,
    ShortlistRun, ShortlistResult
)


class ApplicantInline(admin.TabularInline):
    model = Applicant
    extra = 0
    fields = ['applicant_number', 'first_name', 'last_name', 'status']
    readonly_fields = ['applicant_number']


@admin.register(Vacancy)
class VacancyAdmin(admin.ModelAdmin):
    list_display = ['vacancy_number', 'job_title', 'department', 'status', 'number_of_positions', 'closing_date']
    list_filter = ['status', 'posting_type', 'department']
    search_fields = ['vacancy_number', 'job_title']
    ordering = ['-created_at']
    inlines = [ApplicantInline]


class InterviewInline(admin.TabularInline):
    model = Interview
    extra = 0
    fields = ['interview_type', 'scheduled_date', 'status', 'result']


@admin.register(Applicant)
class ApplicantAdmin(admin.ModelAdmin):
    list_display = ['applicant_number', 'full_name', 'vacancy', 'status', 'source', 'application_date']
    list_filter = ['status', 'source', 'is_internal']
    search_fields = ['applicant_number', 'first_name', 'last_name', 'email']
    ordering = ['-application_date']
    inlines = [InterviewInline]


class InterviewPanelInline(admin.TabularInline):
    model = InterviewPanel
    extra = 0


class InterviewFeedbackInline(admin.TabularInline):
    model = InterviewFeedback
    extra = 0


class ScoringSheetInline(admin.TabularInline):
    model = InterviewScoringSheet
    extra = 0
    fields = ['interviewer', 'template', 'status', 'percentage_score']
    readonly_fields = ['percentage_score']


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ['applicant', 'interview_type', 'scheduled_date', 'status', 'result']
    list_filter = ['status', 'interview_type', 'result']
    ordering = ['scheduled_date']
    inlines = [InterviewPanelInline, InterviewFeedbackInline, ScoringSheetInline]


@admin.register(InterviewPanel)
class InterviewPanelAdmin(admin.ModelAdmin):
    list_display = ['interview', 'interviewer', 'role', 'confirmed']
    list_filter = ['role', 'confirmed']


@admin.register(InterviewFeedback)
class InterviewFeedbackAdmin(admin.ModelAdmin):
    list_display = ['interview', 'interviewer', 'overall_rating', 'recommendation']
    list_filter = ['recommendation']


@admin.register(Reference)
class ReferenceAdmin(admin.ModelAdmin):
    list_display = ['applicant', 'name', 'company', 'status']
    list_filter = ['status']


@admin.register(JobOffer)
class JobOfferAdmin(admin.ModelAdmin):
    list_display = ['offer_number', 'applicant', 'position', 'status', 'offer_date']
    list_filter = ['status']
    search_fields = ['offer_number']
    ordering = ['-offer_date']


# Interview Scoring Admin

class InterviewScoreCategoryInline(admin.TabularInline):
    model = InterviewScoreCategory
    extra = 0
    fields = ['name', 'max_score', 'weight', 'sort_order', 'is_required']


@admin.register(InterviewScoreTemplate)
class InterviewScoreTemplateAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'template_type', 'max_total_score', 'pass_score', 'is_active']
    list_filter = ['template_type', 'is_active']
    search_fields = ['code', 'name']
    ordering = ['template_type', 'name']
    inlines = [InterviewScoreCategoryInline]


@admin.register(InterviewScoreCategory)
class InterviewScoreCategoryAdmin(admin.ModelAdmin):
    list_display = ['template', 'name', 'max_score', 'weight', 'sort_order', 'is_required']
    list_filter = ['template', 'is_required']
    ordering = ['template', 'sort_order']


class InterviewScoreItemInline(admin.TabularInline):
    model = InterviewScoreItem
    extra = 0
    fields = ['category', 'score', 'comments']


@admin.register(InterviewScoringSheet)
class InterviewScoringSheetAdmin(admin.ModelAdmin):
    list_display = ['interview', 'template', 'interviewer', 'status', 'percentage_score', 'recommendation']
    list_filter = ['status', 'template', 'recommendation']
    ordering = ['-created_at']
    readonly_fields = ['total_score', 'weighted_score', 'percentage_score']
    inlines = [InterviewScoreItemInline]


@admin.register(InterviewScoreItem)
class InterviewScoreItemAdmin(admin.ModelAdmin):
    list_display = ['scoring_sheet', 'category', 'score']
    list_filter = ['category']


@admin.register(InterviewReport)
class InterviewReportAdmin(admin.ModelAdmin):
    list_display = ['interview', 'average_score', 'final_decision', 'decided_by', 'decided_at']
    list_filter = ['final_decision']
    ordering = ['-created_at']


# Vacancy URL Admin

@admin.register(VacancyURL)
class VacancyURLAdmin(admin.ModelAdmin):
    list_display = ['url_slug', 'vacancy', 'url_type', 'is_active', 'view_count', 'application_count']
    list_filter = ['url_type', 'is_active']
    search_fields = ['url_slug', 'vacancy__vacancy_number']
    ordering = ['-created_at']


@admin.register(ApplicantPortalAccess)
class ApplicantPortalAccessAdmin(admin.ModelAdmin):
    list_display = ['applicant', 'email', 'last_login', 'login_count', 'is_active']
    list_filter = ['is_active']
    search_fields = ['applicant__applicant_number', 'email']


@admin.register(ApplicantStatusHistory)
class ApplicantStatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['applicant', 'old_status', 'new_status', 'changed_at', 'is_visible_to_applicant']
    list_filter = ['new_status', 'is_visible_to_applicant']
    ordering = ['-changed_at']


# System-Based Shortlisting Admin

class ShortlistCriteriaInline(admin.TabularInline):
    model = ShortlistCriteria
    extra = 0
    fields = ['criteria_type', 'name', 'match_type', 'weight', 'max_score', 'is_mandatory', 'sort_order']


class ShortlistTemplateCriteriaInline(admin.TabularInline):
    model = ShortlistTemplateCriteria
    extra = 0
    fields = ['criteria_type', 'name', 'match_type', 'weight', 'max_score', 'is_mandatory', 'sort_order']


@admin.register(ShortlistCriteria)
class ShortlistCriteriaAdmin(admin.ModelAdmin):
    list_display = ['vacancy', 'name', 'criteria_type', 'match_type', 'weight', 'is_mandatory']
    list_filter = ['criteria_type', 'is_mandatory']
    search_fields = ['name', 'vacancy__vacancy_number']
    ordering = ['vacancy', 'sort_order']


@admin.register(ShortlistTemplate)
class ShortlistTemplateAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'job_family', 'is_active']
    list_filter = ['job_family', 'is_active']
    search_fields = ['code', 'name']
    ordering = ['name']
    inlines = [ShortlistTemplateCriteriaInline]


class ShortlistResultInline(admin.TabularInline):
    model = ShortlistResult
    extra = 0
    fields = ['applicant', 'final_score', 'percentage_score', 'outcome', 'rank']
    readonly_fields = ['final_score', 'percentage_score']


@admin.register(ShortlistRun)
class ShortlistRunAdmin(admin.ModelAdmin):
    list_display = ['run_number', 'vacancy', 'run_date', 'status', 'total_applicants', 'qualified_count']
    list_filter = ['status']
    search_fields = ['run_number', 'vacancy__vacancy_number']
    ordering = ['-run_date']
    readonly_fields = ['run_number', 'total_applicants', 'qualified_count', 'disqualified_count']
    inlines = [ShortlistResultInline]


@admin.register(ShortlistResult)
class ShortlistResultAdmin(admin.ModelAdmin):
    list_display = ['applicant', 'shortlist_run', 'final_score', 'percentage_score', 'outcome', 'rank', 'is_overridden']
    list_filter = ['outcome', 'is_overridden']
    search_fields = ['applicant__applicant_number', 'shortlist_run__run_number']
    ordering = ['-final_score']
