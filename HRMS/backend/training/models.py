"""
Training & Development models.
"""

from django.db import models
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
