"""
Training & Development models.
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from core.models import BaseModel


class TrainingProgram(BaseModel):
    """Training program definition."""

    class ProgramCategory(models.TextChoices):
        TECHNICAL = 'TECHNICAL', 'Technical'
        LEADERSHIP = 'LEADERSHIP', 'Leadership'
        COMPLIANCE = 'COMPLIANCE', 'Compliance'
        SOFT_SKILLS = 'SOFT_SKILLS', 'Soft Skills'
        ONBOARDING = 'ONBOARDING', 'Onboarding'
        OTHER = 'OTHER', 'Other'

    class TrainingType(models.TextChoices):
        INTERNAL = 'INTERNAL', 'Internal'
        EXTERNAL = 'EXTERNAL', 'External'
        ONLINE = 'ONLINE', 'Online'
        WORKSHOP = 'WORKSHOP', 'Workshop'
        CONFERENCE = 'CONFERENCE', 'Conference'
        CERTIFICATION = 'CERTIFICATION', 'Certification'

    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    category = models.CharField(
        max_length=20, choices=ProgramCategory.choices, default=ProgramCategory.OTHER
    )
    training_type = models.CharField(
        max_length=20, choices=TrainingType.choices, default=TrainingType.INTERNAL
    )
    duration_hours = models.DecimalField(max_digits=6, decimal_places=1, default=0)
    max_participants = models.PositiveIntegerField(null=True, blank=True)
    is_mandatory = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    cost_per_person = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    provider = models.CharField(max_length=200, blank=True)
    objectives = models.TextField(blank=True)
    prerequisites = models.TextField(blank=True)
    target_departments = models.ManyToManyField(
        'organization.Department', blank=True, related_name='targeted_programs'
    )
    target_positions = models.ManyToManyField(
        'organization.JobPosition', blank=True, related_name='targeted_programs'
    )

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class TrainingSession(BaseModel):
    """A scheduled session of a training program."""

    class SessionStatus(models.TextChoices):
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    program = models.ForeignKey(
        TrainingProgram, on_delete=models.CASCADE, related_name='sessions'
    )
    title = models.CharField(max_length=200)
    facilitator = models.CharField(max_length=200, blank=True)
    venue = models.CharField(max_length=200, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=SessionStatus.choices, default=SessionStatus.SCHEDULED
    )
    notes = models.TextField(blank=True)
    max_participants = models.PositiveIntegerField(
        null=True, blank=True,
        help_text='Overrides program default if set'
    )

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.title} ({self.start_date})"

    @property
    def capacity(self):
        return self.max_participants or self.program.max_participants

    @property
    def enrollment_count(self):
        return self.enrollments.count()


class TrainingEnrollment(BaseModel):
    """Employee enrollment in a training session."""

    class EnrollmentStatus(models.TextChoices):
        ENROLLED = 'ENROLLED', 'Enrolled'
        ATTENDED = 'ATTENDED', 'Attended'
        COMPLETED = 'COMPLETED', 'Completed'
        NO_SHOW = 'NO_SHOW', 'No Show'
        CANCELLED = 'CANCELLED', 'Cancelled'

    session = models.ForeignKey(
        TrainingSession, on_delete=models.CASCADE, related_name='enrollments'
    )
    employee = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE, related_name='training_enrollments'
    )
    status = models.CharField(
        max_length=20, choices=EnrollmentStatus.choices, default=EnrollmentStatus.ENROLLED
    )
    attendance_date = models.DateField(null=True, blank=True)
    score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True,
        help_text='Evaluation score as percentage'
    )
    feedback = models.TextField(blank=True)
    certificate_issued = models.BooleanField(default=False)
    certificate_date = models.DateField(null=True, blank=True)

    class Meta:
        unique_together = ['session', 'employee']
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.employee} - {self.session.title}"


class PostTrainingReport(BaseModel):
    """Employee's post-training report."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        REVIEWED = 'REVIEWED', 'Reviewed'

    enrollment = models.OneToOneField(
        TrainingEnrollment, on_delete=models.CASCADE, related_name='post_training_report'
    )
    key_learnings = models.TextField()
    skills_acquired = models.TextField()
    knowledge_application = models.TextField(
        help_text='How the knowledge will be applied to the job'
    )
    action_plan = models.TextField()
    recommendations = models.TextField(blank=True)
    challenges = models.TextField(blank=True)
    overall_rating = models.PositiveIntegerField(
        help_text='Overall training rating (1-5)'
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Report: {self.enrollment}"


class TrainingImpactAssessment(BaseModel):
    """Supervisor's evaluation of training impact on employee performance."""

    class ImpactRating(models.TextChoices):
        SIGNIFICANT = 'SIGNIFICANT', 'Significant Improvement'
        MODERATE = 'MODERATE', 'Moderate Improvement'
        MINIMAL = 'MINIMAL', 'Minimal Improvement'
        NO_CHANGE = 'NO_CHANGE', 'No Change'
        DECLINED = 'DECLINED', 'Performance Declined'

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'

    enrollment = models.OneToOneField(
        TrainingEnrollment, on_delete=models.CASCADE, related_name='impact_assessment'
    )
    assessor = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE, related_name='training_impact_assessments'
    )
    assessment_date = models.DateField()
    assessment_period_start = models.DateField()
    assessment_period_end = models.DateField()

    performance_before = models.TextField()
    performance_after = models.TextField()
    skills_application = models.TextField()
    skills_application_rating = models.PositiveIntegerField(
        help_text='Rating of skills application (1-5)'
    )
    impact_rating = models.CharField(
        max_length=20, choices=ImpactRating.choices
    )
    recommendations = models.TextField(blank=True)
    follow_up_actions = models.TextField(blank=True)
    further_training_needed = models.BooleanField(default=False)
    further_training_details = models.TextField(blank=True)
    overall_effectiveness_score = models.PositiveIntegerField(
        help_text='Overall effectiveness score (1-5)'
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Impact Assessment: {self.enrollment}"
