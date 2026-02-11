"""
Performance and Appraisal models.
"""

import base64
import hashlib
import mimetypes
from datetime import date
from decimal import Decimal
from django.db import models
from django.conf import settings
from django.utils import timezone

from core.models import BaseModel, BinaryFileMixin


class AppraisalCycle(BaseModel):
    """Appraisal cycle/period configuration."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        ACTIVE = 'ACTIVE', 'Active'
        GOAL_SETTING = 'GOAL_SETTING', 'Goal Setting Phase'
        MID_YEAR = 'MID_YEAR', 'Mid-Year Review'
        YEAR_END = 'YEAR_END', 'Year-End Appraisal'
        CALIBRATION = 'CALIBRATION', 'Calibration'
        COMPLETED = 'COMPLETED', 'Completed'
        CLOSED = 'CLOSED', 'Closed'

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    year = models.IntegerField()

    start_date = models.DateField()
    end_date = models.DateField()

    goal_setting_start = models.DateField(null=True, blank=True)
    goal_setting_end = models.DateField(null=True, blank=True)
    mid_year_start = models.DateField(null=True, blank=True)
    mid_year_end = models.DateField(null=True, blank=True)
    year_end_start = models.DateField(null=True, blank=True)
    year_end_end = models.DateField(null=True, blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    is_active = models.BooleanField(default=False)

    # Configuration
    allow_self_assessment = models.BooleanField(default=True)
    allow_peer_feedback = models.BooleanField(default=False)
    require_manager_approval = models.BooleanField(default=True)
    min_goals = models.PositiveIntegerField(default=3)
    max_goals = models.PositiveIntegerField(default=7)

    # Component Weights (must sum to 100)
    objectives_weight = models.DecimalField(
        max_digits=5, decimal_places=2, default=60,
        help_text='Weight percentage for objectives/goals component'
    )
    competencies_weight = models.DecimalField(
        max_digits=5, decimal_places=2, default=20,
        help_text='Weight percentage for competencies component'
    )
    values_weight = models.DecimalField(
        max_digits=5, decimal_places=2, default=20,
        help_text='Weight percentage for core values component'
    )

    # Pass Mark Configuration
    pass_mark = models.DecimalField(
        max_digits=5, decimal_places=2, default=60,
        help_text='Minimum score to pass appraisal'
    )
    increment_threshold = models.DecimalField(
        max_digits=5, decimal_places=2, default=70,
        help_text='Minimum score for salary increment eligibility'
    )
    promotion_threshold = models.DecimalField(
        max_digits=5, decimal_places=2, default=85,
        help_text='Minimum score for promotion consideration'
    )
    pip_threshold = models.DecimalField(
        max_digits=5, decimal_places=2, default=40,
        help_text='Score below which PIP is required'
    )

    class Meta:
        ordering = ['-year']

    def __str__(self):
        return f"{self.name} ({self.year})"

    def clean(self):
        from django.core.exceptions import ValidationError
        # Validate weights sum to 100
        total_weight = (
            (self.objectives_weight or Decimal('0')) +
            (self.competencies_weight or Decimal('0')) +
            (self.values_weight or Decimal('0'))
        )
        if total_weight != Decimal('100'):
            raise ValidationError(
                f'Component weights must sum to 100. Current total: {total_weight}'
            )


class AppraisalSchedule(BaseModel):
    """Per-department phase deadline overrides for appraisal cycles."""

    class Phase(models.TextChoices):
        GOAL_SETTING = 'GOAL_SETTING', 'Goal Setting'
        MID_YEAR = 'MID_YEAR', 'Mid-Year Review'
        YEAR_END = 'YEAR_END', 'Year-End Appraisal'

    appraisal_cycle = models.ForeignKey(
        AppraisalCycle, on_delete=models.CASCADE, related_name='schedules'
    )
    department = models.ForeignKey(
        'organization.Department', on_delete=models.CASCADE, related_name='appraisal_schedules'
    )
    phase = models.CharField(max_length=20, choices=Phase.choices)
    start_date = models.DateField()
    end_date = models.DateField()
    is_locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    lock_reason = models.TextField(blank=True)

    class Meta:
        unique_together = ['appraisal_cycle', 'department', 'phase']
        ordering = ['appraisal_cycle', 'department', 'phase']

    def __str__(self):
        return f"{self.department} - {self.get_phase_display()} ({self.appraisal_cycle})"

    @property
    def is_past_deadline(self):
        return date.today() > self.end_date

    def check_and_lock(self):
        """Auto-lock if past deadline."""
        if self.is_past_deadline and not self.is_locked:
            self.is_locked = True
            self.locked_at = timezone.now()
            self.lock_reason = 'Auto-locked: deadline elapsed'
            self.save()


class AppraisalDeadlineExtension(BaseModel):
    """Manager request to unlock/extend an appraisal schedule deadline."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    schedule = models.ForeignKey(
        AppraisalSchedule, on_delete=models.CASCADE, related_name='extensions'
    )
    requested_by = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE, related_name='deadline_extension_requests'
    )
    reason = models.TextField()
    new_end_date = models.DateField()
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_deadline_extensions'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Extension for {self.schedule} by {self.requested_by}"

    def approve(self, user):
        """Approve extension: unlock schedule and extend end_date."""
        self.status = self.Status.APPROVED
        self.approved_by = user
        self.approved_at = timezone.now()
        self.save()

        # Unlock and extend the schedule
        self.schedule.is_locked = False
        self.schedule.locked_at = None
        self.schedule.lock_reason = ''
        self.schedule.end_date = self.new_end_date
        self.schedule.save()


class RatingScale(BaseModel):
    """Rating scale definition."""

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class RatingScaleLevel(BaseModel):
    """Individual levels within a rating scale."""

    rating_scale = models.ForeignKey(
        RatingScale, on_delete=models.CASCADE, related_name='levels'
    )
    level = models.PositiveIntegerField()
    name = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    min_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    max_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    class Meta:
        unique_together = ['rating_scale', 'level']
        ordering = ['level']

    def __str__(self):
        return f"{self.rating_scale.name} - {self.level}: {self.name}"


class Competency(BaseModel):
    """Competency framework."""

    class Category(models.TextChoices):
        CORE = 'CORE', 'Core Competency'
        FUNCTIONAL = 'FUNCTIONAL', 'Functional Competency'
        LEADERSHIP = 'LEADERSHIP', 'Leadership Competency'
        TECHNICAL = 'TECHNICAL', 'Technical Competency'

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField()
    category = models.CharField(
        max_length=20, choices=Category.choices, default=Category.CORE
    )
    is_active = models.BooleanField(default=True)
    applicable_grades = models.ManyToManyField(
        'organization.JobGrade', blank=True, related_name='competencies'
    )

    class Meta:
        verbose_name_plural = 'Competencies'
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class CompetencyLevel(BaseModel):
    """Proficiency levels for competencies."""

    competency = models.ForeignKey(
        Competency, on_delete=models.CASCADE, related_name='proficiency_levels'
    )
    level = models.PositiveIntegerField()
    name = models.CharField(max_length=50)
    description = models.TextField()
    behavioral_indicators = models.TextField(blank=True)

    class Meta:
        unique_together = ['competency', 'level']
        ordering = ['level']


class GoalCategory(BaseModel):
    """Goal categories."""

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'Goal Categories'

    def __str__(self):
        return self.name


class Appraisal(BaseModel):
    """Individual employee appraisal."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        GOAL_SETTING = 'GOAL_SETTING', 'Goal Setting'
        GOALS_SUBMITTED = 'GOALS_SUBMITTED', 'Goals Submitted'
        GOALS_APPROVED = 'GOALS_APPROVED', 'Goals Approved'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        SELF_ASSESSMENT = 'SELF_ASSESSMENT', 'Self Assessment'
        MANAGER_REVIEW = 'MANAGER_REVIEW', 'Manager Review'
        REVIEW_MEETING = 'REVIEW_MEETING', 'Review Meeting'
        CALIBRATION = 'CALIBRATION', 'Calibration'
        COMPLETED = 'COMPLETED', 'Completed'
        ACKNOWLEDGED = 'ACKNOWLEDGED', 'Acknowledged by Employee'

    employee = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE, related_name='appraisals'
    )
    appraisal_cycle = models.ForeignKey(
        AppraisalCycle, on_delete=models.CASCADE, related_name='appraisals'
    )
    manager = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, related_name='managed_appraisals'
    )

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )

    # Goal Ratings
    goals_self_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    goals_manager_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    goals_final_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    # Competency Ratings
    competency_self_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    competency_manager_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    competency_final_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    # Core Values Ratings
    values_self_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    values_manager_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    values_final_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    # Weighted Component Scores
    weighted_objectives_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    weighted_competencies_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    weighted_values_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    # Overall Ratings
    overall_self_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    overall_manager_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    overall_final_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    final_rating_level = models.ForeignKey(
        RatingScaleLevel, on_delete=models.SET_NULL, null=True, blank=True
    )

    # Comments
    employee_comments = models.TextField(blank=True)
    manager_comments = models.TextField(blank=True)
    hr_comments = models.TextField(blank=True)

    # Dates
    self_assessment_date = models.DateTimeField(null=True, blank=True)
    manager_review_date = models.DateTimeField(null=True, blank=True)
    review_meeting_date = models.DateTimeField(null=True, blank=True)
    completion_date = models.DateTimeField(null=True, blank=True)
    acknowledgement_date = models.DateTimeField(null=True, blank=True)

    # Recommendations
    promotion_recommended = models.BooleanField(default=False)
    increment_recommended = models.BooleanField(default=False)
    training_recommended = models.BooleanField(default=False)
    pip_recommended = models.BooleanField(default=False)

    class Meta:
        unique_together = ['employee', 'appraisal_cycle']
        ordering = ['-appraisal_cycle__year']

    def __str__(self):
        return f"{self.employee} - {self.appraisal_cycle}"


class Goal(BaseModel):
    """Individual performance goals."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    appraisal = models.ForeignKey(
        Appraisal, on_delete=models.CASCADE, related_name='goals'
    )
    category = models.ForeignKey(
        GoalCategory, on_delete=models.SET_NULL, null=True, blank=True
    )

    title = models.CharField(max_length=200)
    description = models.TextField()
    success_criteria = models.TextField(blank=True)
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    target_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )

    # Progress
    progress_percentage = models.IntegerField(default=0)
    progress_notes = models.TextField(blank=True)

    # Ratings
    self_rating = models.IntegerField(null=True, blank=True)
    self_comments = models.TextField(blank=True)
    manager_rating = models.IntegerField(null=True, blank=True)
    manager_comments = models.TextField(blank=True)
    final_rating = models.IntegerField(null=True, blank=True)

    # Approval
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Cascaded from
    parent_goal = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cascaded_goals'
    )

    class Meta:
        ordering = ['category', '-weight']

    def __str__(self):
        return f"{self.appraisal.employee} - {self.title}"


class GoalUpdate(BaseModel):
    """Progress updates on goals."""

    goal = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='updates')
    update_date = models.DateField()
    progress_percentage = models.IntegerField()
    notes = models.TextField()
    # Binary file storage for attachments
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, null=True, blank=True)
    file_checksum = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        ordering = ['-update_date']

    def set_attachment(self, file_obj, filename=None):
        """Store attachment as binary data."""
        if file_obj is None:
            self.file_data = None
            self.file_name = None
            self.file_size = None
            self.mime_type = None
            self.file_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.file_name = filename
        elif hasattr(file_obj, 'name'):
            self.file_name = file_obj.name
        else:
            self.file_name = 'attachment'

        self.file_data = content
        self.file_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.mime_type = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.file_name)
            self.mime_type = mime or 'application/octet-stream'

        self.file_checksum = hashlib.sha256(content).hexdigest()

    def get_file_base64(self):
        """Return file data as base64 encoded string."""
        if self.file_data:
            return base64.b64encode(self.file_data).decode('utf-8')
        return None

    def get_file_data_uri(self):
        """Return file as a data URI."""
        if self.file_data and self.mime_type:
            b64_data = base64.b64encode(self.file_data).decode('utf-8')
            return f"data:{self.mime_type};base64,{b64_data}"
        return None

    @property
    def has_attachment(self):
        """Check if attachment exists."""
        return self.file_data is not None


class CompetencyAssessment(BaseModel):
    """Competency assessment within an appraisal."""

    appraisal = models.ForeignKey(
        Appraisal, on_delete=models.CASCADE, related_name='competency_assessments'
    )
    competency = models.ForeignKey(Competency, on_delete=models.CASCADE)

    self_rating = models.IntegerField(null=True, blank=True)
    self_comments = models.TextField(blank=True)
    manager_rating = models.IntegerField(null=True, blank=True)
    manager_comments = models.TextField(blank=True)
    final_rating = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ['appraisal', 'competency']


class PeerFeedback(BaseModel):
    """360-degree peer feedback."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        DECLINED = 'DECLINED', 'Declined'

    appraisal = models.ForeignKey(
        Appraisal, on_delete=models.CASCADE, related_name='peer_feedback'
    )
    reviewer = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE, related_name='given_feedback'
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )

    strengths = models.TextField(blank=True)
    areas_for_improvement = models.TextField(blank=True)
    overall_comments = models.TextField(blank=True)
    overall_rating = models.IntegerField(null=True, blank=True)

    requested_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    is_anonymous = models.BooleanField(default=True)

    class Meta:
        unique_together = ['appraisal', 'reviewer']


class PerformanceImprovementPlan(BaseModel):
    """Performance Improvement Plan (PIP)."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed - Successful'
        FAILED = 'FAILED', 'Completed - Unsuccessful'
        EXTENDED = 'EXTENDED', 'Extended'
        CANCELLED = 'CANCELLED', 'Cancelled'

    employee = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE, related_name='pips'
    )
    appraisal = models.ForeignKey(
        Appraisal, on_delete=models.SET_NULL, null=True, blank=True
    )

    pip_number = models.CharField(max_length=20, unique=True)
    reason = models.TextField()
    performance_issues = models.TextField()

    start_date = models.DateField()
    end_date = models.DateField()
    review_frequency = models.CharField(max_length=20, default='WEEKLY')

    objectives = models.TextField()
    success_criteria = models.TextField()
    support_provided = models.TextField(blank=True)
    consequences = models.TextField(blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )

    manager = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, related_name='managed_pips'
    )
    hr_representative = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='hr_pips'
    )

    outcome = models.TextField(blank=True)
    outcome_date = models.DateField(null=True, blank=True)

    class Meta:
        verbose_name = 'Performance Improvement Plan'
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.pip_number} - {self.employee}"


class PIPReview(BaseModel):
    """Reviews/check-ins during PIP."""

    pip = models.ForeignKey(
        PerformanceImprovementPlan, on_delete=models.CASCADE, related_name='reviews'
    )
    review_date = models.DateField()
    progress_summary = models.TextField()
    areas_improved = models.TextField(blank=True)
    areas_needing_work = models.TextField(blank=True)
    action_items = models.TextField(blank=True)
    reviewed_by = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL, null=True
    )
    employee_acknowledgement = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-review_date']


class DevelopmentPlan(BaseModel):
    """Individual Development Plan (IDP)."""

    employee = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE, related_name='development_plans'
    )
    appraisal = models.ForeignKey(
        Appraisal, on_delete=models.SET_NULL, null=True, blank=True
    )

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    career_aspiration = models.TextField(blank=True)
    strengths = models.TextField(blank=True)
    development_areas = models.TextField(blank=True)

    start_date = models.DateField()
    target_completion = models.DateField()
    is_active = models.BooleanField(default=True)

    manager_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.employee} - {self.title}"


class DevelopmentActivity(BaseModel):
    """Activities within a development plan."""

    class Type(models.TextChoices):
        TRAINING = 'TRAINING', 'Training Course'
        CERTIFICATION = 'CERTIFICATION', 'Certification'
        MENTORING = 'MENTORING', 'Mentoring'
        COACHING = 'COACHING', 'Coaching'
        JOB_ROTATION = 'JOB_ROTATION', 'Job Rotation'
        PROJECT = 'PROJECT', 'Project Assignment'
        SELF_STUDY = 'SELF_STUDY', 'Self Study'
        SHADOWING = 'SHADOWING', 'Job Shadowing'
        OTHER = 'OTHER', 'Other'

    class Status(models.TextChoices):
        PLANNED = 'PLANNED', 'Planned'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    development_plan = models.ForeignKey(
        DevelopmentPlan, on_delete=models.CASCADE, related_name='activities'
    )

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    activity_type = models.CharField(
        max_length=20, choices=Type.choices, default=Type.TRAINING
    )
    competency = models.ForeignKey(
        Competency, on_delete=models.SET_NULL, null=True, blank=True
    )

    target_date = models.DateField()
    completion_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PLANNED
    )

    resources_needed = models.TextField(blank=True)
    estimated_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    actual_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    outcome = models.TextField(blank=True)
    # Binary file storage for evidence
    evidence_data = models.BinaryField(null=True, blank=True)
    evidence_name = models.CharField(max_length=255, null=True, blank=True)
    evidence_size = models.PositiveIntegerField(null=True, blank=True)
    evidence_mime = models.CharField(max_length=100, null=True, blank=True)
    evidence_checksum = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        verbose_name_plural = 'Development Activities'
        ordering = ['target_date']

    def set_evidence(self, file_obj, filename=None):
        """Store evidence file as binary data."""
        if file_obj is None:
            self.evidence_data = None
            self.evidence_name = None
            self.evidence_size = None
            self.evidence_mime = None
            self.evidence_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.evidence_name = filename
        elif hasattr(file_obj, 'name'):
            self.evidence_name = file_obj.name
        else:
            self.evidence_name = 'evidence'

        self.evidence_data = content
        self.evidence_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.evidence_mime = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.evidence_name)
            self.evidence_mime = mime or 'application/octet-stream'

        self.evidence_checksum = hashlib.sha256(content).hexdigest()

    def get_evidence_base64(self):
        """Return evidence data as base64 encoded string."""
        if self.evidence_data:
            return base64.b64encode(self.evidence_data).decode('utf-8')
        return None

    def get_evidence_data_uri(self):
        """Return evidence as a data URI."""
        if self.evidence_data and self.evidence_mime:
            b64_data = base64.b64encode(self.evidence_data).decode('utf-8')
            return f"data:{self.evidence_mime};base64,{b64_data}"
        return None

    @property
    def has_evidence(self):
        """Check if evidence exists."""
        return self.evidence_data is not None


class CoreValue(BaseModel):
    """Organization core values for assessment."""

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField()
    behavioral_indicators = models.TextField(
        blank=True,
        help_text='Behavioral indicators that demonstrate this value'
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class CoreValueAssessment(BaseModel):
    """Core value assessment within an appraisal."""

    appraisal = models.ForeignKey(
        Appraisal, on_delete=models.CASCADE, related_name='value_assessments'
    )
    core_value = models.ForeignKey(CoreValue, on_delete=models.CASCADE)

    self_rating = models.IntegerField(null=True, blank=True)
    self_comments = models.TextField(blank=True)
    manager_rating = models.IntegerField(null=True, blank=True)
    manager_comments = models.TextField(blank=True)
    final_rating = models.IntegerField(null=True, blank=True)

    class Meta:
        unique_together = ['appraisal', 'core_value']

    def __str__(self):
        return f"{self.appraisal.employee} - {self.core_value.name}"


class ProbationAssessment(BaseModel):
    """Probation period assessment (3/6 months or 1 year for Directors)."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        REVIEWED = 'REVIEWED', 'Under Review'
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        EXTENDED = 'EXTENDED', 'Probation Extended'
        TERMINATED = 'TERMINATED', 'Employment Terminated'

    class Period(models.TextChoices):
        THREE_MONTHS = '3M', '3 Months'
        SIX_MONTHS = '6M', '6 Months'
        TWELVE_MONTHS = '12M', '12 Months'

    employee = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE,
        related_name='probation_assessments'
    )
    assessment_period = models.CharField(max_length=5, choices=Period.choices)
    assessment_date = models.DateField()
    due_date = models.DateField()

    # Performance Rating
    overall_rating = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )

    # Assessment Areas (scale 1-5)
    job_knowledge = models.IntegerField(
        null=True, blank=True,
        help_text='Understanding of job responsibilities and requirements'
    )
    work_quality = models.IntegerField(
        null=True, blank=True,
        help_text='Accuracy, thoroughness, and reliability of work'
    )
    attendance_punctuality = models.IntegerField(
        null=True, blank=True,
        help_text='Attendance record and punctuality'
    )
    teamwork = models.IntegerField(
        null=True, blank=True,
        help_text='Ability to work effectively with colleagues'
    )
    communication = models.IntegerField(
        null=True, blank=True,
        help_text='Verbal and written communication skills'
    )
    initiative = models.IntegerField(
        null=True, blank=True,
        help_text='Self-motivation and proactive approach'
    )

    # Comments
    supervisor_comments = models.TextField(blank=True)
    employee_comments = models.TextField(blank=True)
    hr_comments = models.TextField(blank=True)

    # Recommendation
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    recommendation = models.TextField(blank=True)
    extension_duration = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Extension duration in months if probation extended'
    )

    # Approval
    reviewed_by = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reviewed_probations'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_probations'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-due_date']

    def __str__(self):
        return f"{self.employee} - {self.get_assessment_period_display()}"

    def calculate_overall_rating(self):
        """Calculate overall rating from assessment areas."""
        ratings = [
            self.job_knowledge, self.work_quality, self.attendance_punctuality,
            self.teamwork, self.communication, self.initiative
        ]
        valid_ratings = [r for r in ratings if r is not None]
        if valid_ratings:
            avg = sum(valid_ratings) / len(valid_ratings)
            # Convert 1-5 scale to percentage
            self.overall_rating = (avg / 5) * 100
        return self.overall_rating


class TrainingNeed(BaseModel):
    """Training needs identified from appraisal."""

    class Priority(models.TextChoices):
        HIGH = 'HIGH', 'High'
        MEDIUM = 'MEDIUM', 'Medium'
        LOW = 'LOW', 'Low'

    class Status(models.TextChoices):
        IDENTIFIED = 'IDENTIFIED', 'Identified'
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    class Type(models.TextChoices):
        TRAINING = 'TRAINING', 'Training Course'
        CERTIFICATION = 'CERTIFICATION', 'Certification'
        WORKSHOP = 'WORKSHOP', 'Workshop'
        CONFERENCE = 'CONFERENCE', 'Conference'
        MENTORING = 'MENTORING', 'Mentoring'
        ONLINE = 'ONLINE', 'Online Course'
        ON_THE_JOB = 'ON_THE_JOB', 'On-the-Job Training'
        OTHER = 'OTHER', 'Other'

    employee = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE,
        related_name='training_needs'
    )
    appraisal = models.ForeignKey(
        Appraisal, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='training_needs'
    )

    title = models.CharField(max_length=200)
    description = models.TextField()
    training_type = models.CharField(
        max_length=20, choices=Type.choices, default=Type.TRAINING
    )
    competency = models.ForeignKey(
        Competency, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='training_needs'
    )
    priority = models.CharField(
        max_length=10, choices=Priority.choices, default=Priority.MEDIUM
    )

    # Timeline
    target_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.IDENTIFIED
    )

    # Cost & Resources
    estimated_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    actual_cost = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    training_provider = models.CharField(max_length=200, blank=True)

    # Evidence
    outcome = models.TextField(blank=True)

    class Meta:
        ordering = ['-priority', 'target_date']

    def __str__(self):
        return f"{self.employee} - {self.title}"


class PerformanceAppeal(BaseModel):
    """Appeal/grievance against appraisal results."""

    class Status(models.TextChoices):
        SUBMITTED = 'SUBMITTED', 'Submitted'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        HEARING_SCHEDULED = 'HEARING', 'Hearing Scheduled'
        UPHELD = 'UPHELD', 'Appeal Upheld'
        PARTIALLY_UPHELD = 'PARTIAL', 'Partially Upheld'
        DISMISSED = 'DISMISSED', 'Dismissed'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn'

    appraisal = models.ForeignKey(
        Appraisal, on_delete=models.CASCADE, related_name='appeals'
    )
    appeal_number = models.CharField(max_length=20, unique=True)

    # Appeal Details
    grounds = models.TextField(help_text='Reason for appeal')
    disputed_ratings = models.JSONField(
        default=dict,
        help_text='Which ratings are disputed (e.g., {"goals": true, "competencies": false})'
    )
    requested_remedy = models.TextField()
    supporting_evidence = models.TextField(blank=True)

    # Process
    submitted_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SUBMITTED
    )

    # Review
    reviewer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reviewed_performance_appeals'
    )
    review_comments = models.TextField(blank=True)
    hearing_date = models.DateTimeField(null=True, blank=True)

    # Outcome
    decision = models.TextField(blank=True)
    revised_ratings = models.JSONField(
        default=dict, blank=True,
        help_text='Revised ratings if appeal upheld'
    )
    decision_date = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='decided_performance_appeals'
    )

    class Meta:
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.appeal_number} - {self.appraisal.employee}"

    def save(self, *args, **kwargs):
        if not self.appeal_number:
            # Generate appeal number
            year = timezone.now().year
            last = PerformanceAppeal.objects.filter(
                appeal_number__startswith=f'PA{year}'
            ).order_by('-appeal_number').first()
            if last:
                last_num = int(last.appeal_number[-4:])
                self.appeal_number = f'PA{year}{last_num + 1:04d}'
            else:
                self.appeal_number = f'PA{year}0001'
        super().save(*args, **kwargs)


class TrainingDocument(BaseModel, BinaryFileMixin):
    """Documents for training needs (certificates, materials, attendance, etc.)"""

    class DocumentType(models.TextChoices):
        CERTIFICATE = 'CERTIFICATE', 'Certificate'
        MATERIAL = 'MATERIAL', 'Course Material'
        ATTENDANCE = 'ATTENDANCE', 'Attendance Record'
        EVALUATION = 'EVALUATION', 'Evaluation Form'
        COMPLETION = 'COMPLETION', 'Completion Certificate'
        INVOICE = 'INVOICE', 'Training Invoice'
        OTHER = 'OTHER', 'Other'

    training_need = models.ForeignKey(
        TrainingNeed, on_delete=models.CASCADE, related_name='documents'
    )
    document_type = models.CharField(
        max_length=20, choices=DocumentType.choices, default=DocumentType.OTHER
    )
    description = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='uploaded_training_documents'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.training_need.title} - {self.file_name or 'Document'}"


class AppraisalDocument(BaseModel, BinaryFileMixin):
    """Supporting documents for appraisals."""

    class DocumentType(models.TextChoices):
        SELF_ASSESSMENT = 'SELF_ASSESSMENT', 'Self Assessment'
        EVIDENCE = 'EVIDENCE', 'Performance Evidence'
        FEEDBACK = 'FEEDBACK', 'Feedback Document'
        GOAL_PLAN = 'GOAL_PLAN', 'Goal Plan'
        PIP = 'PIP', 'Performance Improvement Plan'
        ACHIEVEMENT = 'ACHIEVEMENT', 'Achievement Certificate'
        AWARD = 'AWARD', 'Award Document'
        OTHER = 'OTHER', 'Other'

    appraisal = models.ForeignKey(
        Appraisal, on_delete=models.CASCADE, related_name='documents'
    )
    document_type = models.CharField(
        max_length=20, choices=DocumentType.choices, default=DocumentType.OTHER
    )
    description = models.CharField(max_length=255, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='uploaded_appraisal_documents'
    )

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.appraisal} - {self.file_name or 'Document'}"
