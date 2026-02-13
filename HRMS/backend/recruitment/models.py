"""
Recruitment models for vacancy, applicant, interview, and offer management.
"""

import base64
import hashlib
import mimetypes
import secrets
from django.db import models
from django.conf import settings

from core.models import BaseModel


class Vacancy(BaseModel):
    """Job vacancy/requisition."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        PUBLISHED = 'PUBLISHED', 'Published'
        CLOSED = 'CLOSED', 'Closed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        ON_HOLD = 'ON_HOLD', 'On Hold'

    class PostingType(models.TextChoices):
        INTERNAL = 'INTERNAL', 'Internal Only'
        EXTERNAL = 'EXTERNAL', 'External Only'
        BOTH = 'BOTH', 'Internal & External'

    vacancy_number = models.CharField(max_length=20, unique=True)
    position = models.ForeignKey(
        'organization.JobPosition', on_delete=models.PROTECT
    )
    department = models.ForeignKey(
        'organization.Department', on_delete=models.PROTECT
    )
    grade = models.ForeignKey(
        'organization.JobGrade', on_delete=models.PROTECT, null=True, blank=True
    )
    work_location = models.ForeignKey(
        'organization.WorkLocation', on_delete=models.PROTECT, null=True, blank=True
    )

    number_of_positions = models.PositiveIntegerField(default=1)
    employment_type = models.CharField(max_length=20, default='PERMANENT')

    job_title = models.CharField(max_length=200)
    job_description = models.TextField()
    requirements = models.TextField()
    responsibilities = models.TextField(blank=True)
    qualifications = models.TextField(blank=True)
    experience_required = models.CharField(max_length=100, blank=True)
    skills_required = models.TextField(blank=True)

    salary_range_min = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    salary_range_max = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    show_salary = models.BooleanField(default=False)

    posting_type = models.CharField(
        max_length=20, choices=PostingType.choices, default=PostingType.BOTH
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )

    requested_by = models.ForeignKey(
        'employees.Employee', on_delete=models.PROTECT,
        related_name='requested_vacancies', null=True, blank=True
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        related_name='approved_vacancies', null=True, blank=True
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    publish_date = models.DateField(null=True, blank=True)
    closing_date = models.DateField(null=True, blank=True)
    target_hire_date = models.DateField(null=True, blank=True)

    budget_code = models.CharField(max_length=50, blank=True)
    justification = models.TextField(blank=True)

    auto_shortlist = models.BooleanField(
        default=True,
        help_text='Automatically shortlist applicants who meet the defined criteria'
    )

    class Meta:
        verbose_name_plural = 'Vacancies'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.vacancy_number} - {self.job_title}"


class Applicant(BaseModel):
    """Job applicant."""

    class Status(models.TextChoices):
        NEW = 'NEW', 'New'
        SCREENING = 'SCREENING', 'Screening'
        SHORTLISTED = 'SHORTLISTED', 'Shortlisted'
        INTERVIEW = 'INTERVIEW', 'Interview'
        ASSESSMENT = 'ASSESSMENT', 'Assessment'
        REFERENCE_CHECK = 'REFERENCE_CHECK', 'Reference Check'
        OFFER = 'OFFER', 'Offer Stage'
        HIRED = 'HIRED', 'Hired'
        REJECTED = 'REJECTED', 'Rejected'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn'

    class Source(models.TextChoices):
        WEBSITE = 'WEBSITE', 'Company Website'
        JOB_BOARD = 'JOB_BOARD', 'Job Board'
        REFERRAL = 'REFERRAL', 'Employee Referral'
        AGENCY = 'AGENCY', 'Recruitment Agency'
        LINKEDIN = 'LINKEDIN', 'LinkedIn'
        WALK_IN = 'WALK_IN', 'Walk-in'
        INTERNAL = 'INTERNAL', 'Internal Application'
        OTHER = 'OTHER', 'Other'

    applicant_number = models.CharField(max_length=20, unique=True)
    vacancy = models.ForeignKey(
        Vacancy, on_delete=models.CASCADE, related_name='applicants'
    )

    # Personal Information
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, blank=True)
    last_name = models.CharField(max_length=100)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=10, blank=True)
    nationality = models.CharField(max_length=50, default='Ghanaian')

    # Address
    address = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    region = models.CharField(max_length=100, blank=True)

    # Application Details - Resume (binary storage)
    resume_data = models.BinaryField(null=True, blank=True)
    resume_name = models.CharField(max_length=255, null=True, blank=True)
    resume_size = models.PositiveIntegerField(null=True, blank=True)
    resume_mime = models.CharField(max_length=100, null=True, blank=True)
    resume_checksum = models.CharField(max_length=64, null=True, blank=True)
    cover_letter = models.TextField(blank=True)
    # Cover letter file (binary storage)
    cover_letter_data = models.BinaryField(null=True, blank=True)
    cover_letter_name = models.CharField(max_length=255, null=True, blank=True)
    cover_letter_size = models.PositiveIntegerField(null=True, blank=True)
    cover_letter_mime = models.CharField(max_length=100, null=True, blank=True)
    cover_letter_checksum = models.CharField(max_length=64, null=True, blank=True)

    # Qualifications
    highest_education = models.CharField(max_length=100, blank=True)
    institution = models.CharField(max_length=200, blank=True)
    graduation_year = models.IntegerField(null=True, blank=True)
    current_employer = models.CharField(max_length=200, blank=True)
    current_position = models.CharField(max_length=200, blank=True)
    years_of_experience = models.IntegerField(default=0)
    current_salary = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    expected_salary = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    notice_period = models.CharField(max_length=50, blank=True)

    # Previous employer contacts (SRS: mandatory for applications)
    previous_employer_email = models.EmailField(blank=True, help_text='Email contact of previous employer')
    previous_employer_phone = models.CharField(max_length=20, blank=True, help_text='Phone contact of previous employer')

    # Tracking
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.NEW
    )
    source = models.CharField(
        max_length=20, choices=Source.choices, default=Source.WEBSITE
    )
    referrer = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='referrals'
    )
    application_date = models.DateTimeField(auto_now_add=True)

    # Internal applicant
    is_internal = models.BooleanField(default=False)
    employee = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='applications'
    )

    # Screening
    screening_score = models.IntegerField(null=True, blank=True)
    screening_notes = models.TextField(blank=True)
    screened_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='screened_applicants'
    )
    screened_at = models.DateTimeField(null=True, blank=True)

    # Overall Assessment
    overall_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    overall_rating = models.CharField(max_length=20, blank=True)
    notes = models.TextField(blank=True)

    rejection_reason = models.TextField(blank=True)
    rejected_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-application_date']
        indexes = [
            models.Index(fields=['vacancy', 'status']),
            models.Index(fields=['email']),
        ]

    def __str__(self):
        return f"{self.applicant_number} - {self.first_name} {self.last_name}"

    @property
    def full_name(self):
        if self.middle_name:
            return f"{self.first_name} {self.middle_name} {self.last_name}"
        return f"{self.first_name} {self.last_name}"

    def set_resume(self, file_obj, filename=None):
        """Store resume as binary data."""
        if file_obj is None:
            self.resume_data = None
            self.resume_name = None
            self.resume_size = None
            self.resume_mime = None
            self.resume_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.resume_name = filename
        elif hasattr(file_obj, 'name'):
            self.resume_name = file_obj.name
        else:
            self.resume_name = 'resume'

        self.resume_data = content
        self.resume_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.resume_mime = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.resume_name)
            self.resume_mime = mime or 'application/octet-stream'

        self.resume_checksum = hashlib.sha256(content).hexdigest()

    def get_resume_base64(self):
        """Return resume data as base64 encoded string."""
        if self.resume_data:
            return base64.b64encode(self.resume_data).decode('utf-8')
        return None

    def get_resume_data_uri(self):
        """Return resume as a data URI."""
        if self.resume_data and self.resume_mime:
            b64_data = base64.b64encode(self.resume_data).decode('utf-8')
            return f"data:{self.resume_mime};base64,{b64_data}"
        return None

    @property
    def has_resume(self):
        """Check if resume exists."""
        return self.resume_data is not None

    def set_cover_letter_file(self, file_obj, filename=None):
        """Store cover letter file as binary data."""
        if file_obj is None:
            self.cover_letter_data = None
            self.cover_letter_name = None
            self.cover_letter_size = None
            self.cover_letter_mime = None
            self.cover_letter_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.cover_letter_name = filename
        elif hasattr(file_obj, 'name'):
            self.cover_letter_name = file_obj.name
        else:
            self.cover_letter_name = 'cover_letter'

        self.cover_letter_data = content
        self.cover_letter_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.cover_letter_mime = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.cover_letter_name)
            self.cover_letter_mime = mime or 'application/octet-stream'

        self.cover_letter_checksum = hashlib.sha256(content).hexdigest()

    def get_cover_letter_base64(self):
        """Return cover letter file data as base64 encoded string."""
        if self.cover_letter_data:
            return base64.b64encode(self.cover_letter_data).decode('utf-8')
        return None

    def get_cover_letter_data_uri(self):
        """Return cover letter file as a data URI."""
        if self.cover_letter_data and self.cover_letter_mime:
            b64_data = base64.b64encode(self.cover_letter_data).decode('utf-8')
            return f"data:{self.cover_letter_mime};base64,{b64_data}"
        return None

    @property
    def has_cover_letter_file(self):
        """Check if cover letter file exists."""
        return self.cover_letter_data is not None


class Interview(BaseModel):
    """Interview scheduling and feedback."""

    class Type(models.TextChoices):
        PHONE = 'PHONE', 'Phone Screen'
        VIDEO = 'VIDEO', 'Video Interview'
        IN_PERSON = 'IN_PERSON', 'In-Person'
        PANEL = 'PANEL', 'Panel Interview'
        TECHNICAL = 'TECHNICAL', 'Technical Interview'
        HR = 'HR', 'HR Interview'
        FINAL = 'FINAL', 'Final Interview'

    class Status(models.TextChoices):
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        CONFIRMED = 'CONFIRMED', 'Confirmed'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'
        NO_SHOW = 'NO_SHOW', 'No Show'
        RESCHEDULED = 'RESCHEDULED', 'Rescheduled'

    class Result(models.TextChoices):
        PASSED = 'PASSED', 'Passed'
        FAILED = 'FAILED', 'Failed'
        ON_HOLD = 'ON_HOLD', 'On Hold'
        PENDING = 'PENDING', 'Pending Decision'

    applicant = models.ForeignKey(
        Applicant, on_delete=models.CASCADE, related_name='interviews'
    )
    interview_type = models.CharField(max_length=20, choices=Type.choices)
    round_number = models.PositiveIntegerField(default=1)

    scheduled_date = models.DateField()
    scheduled_time = models.TimeField()
    duration_minutes = models.PositiveIntegerField(default=60)
    location = models.CharField(max_length=200, blank=True)
    meeting_link = models.URLField(blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SCHEDULED
    )
    result = models.CharField(
        max_length=20, choices=Result.choices, blank=True
    )

    notes = models.TextField(blank=True)
    scheduled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='scheduled_interviews'
    )

    class Meta:
        ordering = ['scheduled_date', 'scheduled_time']

    def __str__(self):
        return f"{self.applicant.full_name} - {self.interview_type} ({self.scheduled_date})"


class InterviewPanel(BaseModel):
    """Interview panel members."""

    class Role(models.TextChoices):
        LEAD = 'LEAD', 'Lead Interviewer'
        MEMBER = 'MEMBER', 'Panel Member'
        OBSERVER = 'OBSERVER', 'Observer'

    interview = models.ForeignKey(
        Interview, on_delete=models.CASCADE, related_name='panel_members'
    )
    interviewer = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE
    )
    role = models.CharField(
        max_length=20, choices=Role.choices, default=Role.MEMBER
    )
    confirmed = models.BooleanField(default=False)

    class Meta:
        unique_together = ['interview', 'interviewer']


class InterviewFeedback(BaseModel):
    """Interview feedback from panel members."""

    interview = models.ForeignKey(
        Interview, on_delete=models.CASCADE, related_name='feedback'
    )
    interviewer = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE
    )

    # Ratings (1-5 scale)
    technical_skills = models.IntegerField(null=True, blank=True)
    communication = models.IntegerField(null=True, blank=True)
    problem_solving = models.IntegerField(null=True, blank=True)
    cultural_fit = models.IntegerField(null=True, blank=True)
    leadership = models.IntegerField(null=True, blank=True)
    overall_rating = models.IntegerField(null=True, blank=True)

    strengths = models.TextField(blank=True)
    weaknesses = models.TextField(blank=True)
    comments = models.TextField(blank=True)

    recommendation = models.CharField(max_length=20, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['interview', 'interviewer']


class Reference(BaseModel):
    """Reference checks for applicants."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        UNABLE_TO_REACH = 'UNABLE_TO_REACH', 'Unable to Reach'

    applicant = models.ForeignKey(
        Applicant, on_delete=models.CASCADE, related_name='references'
    )

    # Reference Details
    name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=100)
    company = models.CharField(max_length=200)
    position = models.CharField(max_length=200)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20)

    # Check Results
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )
    verified_employment = models.BooleanField(null=True)
    verified_position = models.BooleanField(null=True)
    verified_dates = models.BooleanField(null=True)
    would_rehire = models.BooleanField(null=True)

    overall_feedback = models.TextField(blank=True)
    checked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    checked_at = models.DateTimeField(null=True, blank=True)


class JobOffer(BaseModel):
    """Job offer management."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING_APPROVAL = 'PENDING_APPROVAL', 'Pending Approval'
        APPROVED = 'APPROVED', 'Approved'
        SENT = 'SENT', 'Sent to Candidate'
        ACCEPTED = 'ACCEPTED', 'Accepted'
        DECLINED = 'DECLINED', 'Declined'
        EXPIRED = 'EXPIRED', 'Expired'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn'

    offer_number = models.CharField(max_length=20, unique=True)
    applicant = models.ForeignKey(
        Applicant, on_delete=models.CASCADE, related_name='offers'
    )
    vacancy = models.ForeignKey(Vacancy, on_delete=models.CASCADE)

    # Position Details
    position = models.ForeignKey('organization.JobPosition', on_delete=models.PROTECT)
    department = models.ForeignKey('organization.Department', on_delete=models.PROTECT)
    grade = models.ForeignKey(
        'organization.JobGrade', on_delete=models.PROTECT, null=True, blank=True
    )
    reporting_to = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL, null=True, blank=True
    )

    # Compensation
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2)
    allowances = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_compensation = models.DecimalField(max_digits=12, decimal_places=2)
    compensation_notes = models.TextField(blank=True)

    # Dates
    offer_date = models.DateField()
    response_deadline = models.DateField()
    proposed_start_date = models.DateField()

    # Status
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    # Binary file storage for offer letter
    offer_letter_data = models.BinaryField(null=True, blank=True)
    offer_letter_name = models.CharField(max_length=255, null=True, blank=True)
    offer_letter_size = models.PositiveIntegerField(null=True, blank=True)
    offer_letter_mime = models.CharField(max_length=100, null=True, blank=True)
    offer_letter_checksum = models.CharField(max_length=64, null=True, blank=True)

    # Approvals
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approved_offers'
    )
    approved_at = models.DateTimeField(null=True, blank=True)

    # Response
    sent_at = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    decline_reason = models.TextField(blank=True)

    # Negotiation
    negotiation_notes = models.TextField(blank=True)
    counter_offer_salary = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )

    class Meta:
        ordering = ['-offer_date']

    def __str__(self):
        return f"{self.offer_number} - {self.applicant.full_name}"

    def set_offer_letter(self, file_obj, filename=None):
        """Store offer letter as binary data."""
        if file_obj is None:
            self.offer_letter_data = None
            self.offer_letter_name = None
            self.offer_letter_size = None
            self.offer_letter_mime = None
            self.offer_letter_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.offer_letter_name = filename
        elif hasattr(file_obj, 'name'):
            self.offer_letter_name = file_obj.name
        else:
            self.offer_letter_name = f"offer_{self.offer_number}.pdf"

        self.offer_letter_data = content
        self.offer_letter_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.offer_letter_mime = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.offer_letter_name)
            self.offer_letter_mime = mime or 'application/pdf'

        self.offer_letter_checksum = hashlib.sha256(content).hexdigest()

    def get_offer_letter_base64(self):
        """Return offer letter data as base64 encoded string."""
        if self.offer_letter_data:
            return base64.b64encode(self.offer_letter_data).decode('utf-8')
        return None

    def get_offer_letter_data_uri(self):
        """Return offer letter as a data URI."""
        if self.offer_letter_data and self.offer_letter_mime:
            b64_data = base64.b64encode(self.offer_letter_data).decode('utf-8')
            return f"data:{self.offer_letter_mime};base64,{b64_data}"
        return None

    @property
    def has_offer_letter(self):
        """Check if offer letter exists."""
        return self.offer_letter_data is not None


class InterviewScoreTemplate(BaseModel):
    """
    Template for interview scoring sheets.
    Different templates for Recruitment, Promotion, Driver interviews, etc.
    """
    class TemplateType(models.TextChoices):
        RECRUITMENT = 'RECRUITMENT', 'Standard Recruitment Interview'
        PROMOTION = 'PROMOTION', 'Promotion Interview'
        DRIVER = 'DRIVER', 'Drivers Interview'
        TECHNICAL = 'TECHNICAL', 'Technical Assessment'
        CUSTOM = 'CUSTOM', 'Custom Template'

    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=100)
    template_type = models.CharField(
        max_length=20, choices=TemplateType.choices, default=TemplateType.RECRUITMENT
    )
    description = models.TextField(blank=True)
    max_total_score = models.PositiveIntegerField(default=100)
    pass_score = models.PositiveIntegerField(default=60)
    instructions = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'interview_score_templates'
        ordering = ['template_type', 'name']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"


class InterviewScoreCategory(BaseModel):
    """
    Scoring categories within a template.
    E.g., Technical Skills (20 pts), Communication (15 pts), etc.
    """
    template = models.ForeignKey(
        InterviewScoreTemplate,
        on_delete=models.CASCADE,
        related_name='categories'
    )
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    max_score = models.PositiveIntegerField(default=10)
    weight = models.DecimalField(
        max_digits=5, decimal_places=2, default=1.00,
        help_text='Weight multiplier for this category'
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_required = models.BooleanField(default=True)
    scoring_guide = models.TextField(
        blank=True,
        help_text='Guidance on how to score this category (e.g., 1=Poor, 5=Excellent)'
    )

    class Meta:
        db_table = 'interview_score_categories'
        ordering = ['template', 'sort_order']
        unique_together = ['template', 'name']

    def __str__(self):
        return f"{self.template.code} - {self.name} ({self.max_score} pts)"


class InterviewScoringSheet(BaseModel):
    """
    Scoring sheet filled by an interviewer for a specific interview.
    Each panel member fills their own scoring sheet.
    """
    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        REVIEWED = 'REVIEWED', 'Reviewed'

    class Recommendation(models.TextChoices):
        STRONGLY_RECOMMEND = 'STRONGLY_RECOMMEND', 'Strongly Recommend'
        RECOMMEND = 'RECOMMEND', 'Recommend'
        RECOMMEND_WITH_RESERVATIONS = 'RESERVATIONS', 'Recommend with Reservations'
        DO_NOT_RECOMMEND = 'DO_NOT_RECOMMEND', 'Do Not Recommend'
        UNDECIDED = 'UNDECIDED', 'Undecided'

    interview = models.ForeignKey(
        Interview,
        on_delete=models.CASCADE,
        related_name='scoring_sheets'
    )
    template = models.ForeignKey(
        InterviewScoreTemplate,
        on_delete=models.PROTECT,
        related_name='scoring_sheets'
    )
    interviewer = models.ForeignKey(
        'employees.Employee',
        on_delete=models.CASCADE,
        related_name='scoring_sheets'
    )

    # Total scores (computed)
    total_score = models.DecimalField(
        max_digits=7, decimal_places=2, default=0
    )
    weighted_score = models.DecimalField(
        max_digits=7, decimal_places=2, default=0
    )
    percentage_score = models.DecimalField(
        max_digits=5, decimal_places=2, default=0
    )

    # Feedback
    strengths = models.TextField(blank=True)
    weaknesses = models.TextField(blank=True)
    overall_comments = models.TextField(blank=True)
    recommendation = models.CharField(
        max_length=20, choices=Recommendation.choices, blank=True
    )
    recommendation_notes = models.TextField(blank=True)

    # Driver-specific fields (DVLA results)
    dvla_license_verified = models.BooleanField(null=True, blank=True)
    dvla_license_class = models.CharField(max_length=20, blank=True)
    dvla_expiry_date = models.DateField(null=True, blank=True)
    driving_test_passed = models.BooleanField(null=True, blank=True)
    driving_test_score = models.PositiveIntegerField(null=True, blank=True)
    dvla_notes = models.TextField(blank=True)

    # Status
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'interview_scoring_sheets'
        ordering = ['-created_at']
        unique_together = ['interview', 'interviewer']

    def __str__(self):
        return f"{self.interview} - {self.interviewer} ({self.percentage_score}%)"

    def calculate_scores(self):
        """Calculate total and weighted scores from individual category scores."""
        scores = self.scores.all()
        total = 0
        weighted = 0
        max_possible = 0

        for score in scores:
            total += score.score or 0
            weighted += (score.score or 0) * float(score.category.weight)
            max_possible += score.category.max_score * float(score.category.weight)

        self.total_score = total
        self.weighted_score = weighted
        if max_possible > 0:
            self.percentage_score = (weighted / max_possible) * 100
        else:
            self.percentage_score = 0


class InterviewScoreItem(BaseModel):
    """
    Individual score for a category on a scoring sheet.
    """
    scoring_sheet = models.ForeignKey(
        InterviewScoringSheet,
        on_delete=models.CASCADE,
        related_name='scores'
    )
    category = models.ForeignKey(
        InterviewScoreCategory,
        on_delete=models.CASCADE
    )
    score = models.PositiveIntegerField(null=True, blank=True)
    comments = models.TextField(blank=True)

    class Meta:
        db_table = 'interview_score_items'
        unique_together = ['scoring_sheet', 'category']

    def __str__(self):
        return f"{self.category.name}: {self.score}/{self.category.max_score}"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.score is not None and self.score > self.category.max_score:
            raise ValidationError(
                f"Score cannot exceed maximum of {self.category.max_score}"
            )


class InterviewReport(BaseModel):
    """
    Consolidated interview report with panel composition and final recommendation.
    Generated after all scoring sheets are submitted.
    """
    class FinalDecision(models.TextChoices):
        HIRE = 'HIRE', 'Hire'
        REJECT = 'REJECT', 'Reject'
        HOLD = 'HOLD', 'Hold for Further Review'
        PENDING = 'PENDING', 'Pending'

    interview = models.OneToOneField(
        Interview,
        on_delete=models.CASCADE,
        related_name='report'
    )

    # Panel Composition
    panel_size = models.PositiveIntegerField(default=0)
    panel_composition = models.TextField(
        blank=True,
        help_text='Description of panel members and their roles'
    )

    # Aggregated Scores
    average_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    highest_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    lowest_score = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    score_breakdown = models.JSONField(
        default=dict, blank=True,
        help_text='Category-wise score breakdown'
    )

    # Recommendations Summary
    recommendations_summary = models.JSONField(
        default=dict, blank=True,
        help_text='Count of each recommendation type'
    )

    # Final Assessment
    consensus_strengths = models.TextField(blank=True)
    consensus_weaknesses = models.TextField(blank=True)
    key_observations = models.TextField(blank=True)
    training_needs = models.TextField(blank=True)

    # Decision
    final_decision = models.CharField(
        max_length=20, choices=FinalDecision.choices, default=FinalDecision.PENDING
    )
    decision_rationale = models.TextField(blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True
    )
    decided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'interview_reports'
        ordering = ['-created_at']

    def __str__(self):
        return f"Report: {self.interview} - {self.final_decision}"

    def generate_from_scoring_sheets(self):
        """Generate report data from all submitted scoring sheets."""
        sheets = self.interview.scoring_sheets.filter(status='SUBMITTED')

        if not sheets.exists():
            return

        self.panel_size = sheets.count()

        # Panel composition
        panel_info = []
        for sheet in sheets:
            panel_member = self.interview.panel_members.filter(
                interviewer=sheet.interviewer
            ).first()
            role = panel_member.role if panel_member else 'Member'
            panel_info.append(f"{sheet.interviewer.full_name} ({role})")
        self.panel_composition = ', '.join(panel_info)

        # Score aggregation
        scores = [s.percentage_score for s in sheets]
        if scores:
            self.average_score = sum(scores) / len(scores)
            self.highest_score = max(scores)
            self.lowest_score = min(scores)

        # Category breakdown
        category_scores = {}
        for sheet in sheets:
            for item in sheet.scores.all():
                cat_name = item.category.name
                if cat_name not in category_scores:
                    category_scores[cat_name] = []
                category_scores[cat_name].append(item.score or 0)

        self.score_breakdown = {
            cat: {
                'avg': sum(scores) / len(scores) if scores else 0,
                'scores': scores
            }
            for cat, scores in category_scores.items()
        }

        # Recommendations summary
        rec_counts = {}
        for sheet in sheets:
            if sheet.recommendation:
                rec_counts[sheet.recommendation] = rec_counts.get(sheet.recommendation, 0) + 1
        self.recommendations_summary = rec_counts


# ========================================
# Vacancy URL System
# ========================================

class VacancyURL(BaseModel):
    """
    Shareable URLs for vacancy postings with optional access tokens.
    """
    class URLType(models.TextChoices):
        PUBLIC = 'PUBLIC', 'Public (Open to All)'
        TOKEN = 'TOKEN', 'Token-Protected'
        GROUP = 'GROUP', 'Group-Specific Token'
        INTERNAL = 'INTERNAL', 'Internal Only'

    vacancy = models.ForeignKey(
        Vacancy,
        on_delete=models.CASCADE,
        related_name='vacancy_urls'
    )

    url_type = models.CharField(
        max_length=20,
        choices=URLType.choices,
        default=URLType.PUBLIC
    )
    url_slug = models.CharField(max_length=100, unique=True, db_index=True)

    # Token for protected URLs
    access_token = models.CharField(max_length=64, unique=True, null=True, blank=True, db_index=True)
    token_hash = models.CharField(max_length=128, null=True, blank=True)

    # Group targeting (for GROUP type)
    target_group = models.CharField(max_length=200, blank=True)
    target_emails = models.TextField(
        blank=True,
        help_text='Comma-separated list of target email addresses'
    )

    # Usage tracking
    max_uses = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Maximum number of times this URL can be used (null = unlimited)'
    )
    current_uses = models.PositiveIntegerField(default=0)
    last_accessed = models.DateTimeField(null=True, blank=True)

    # Expiration
    expires_at = models.DateTimeField(null=True, blank=True)
    expire_on_hire = models.BooleanField(
        default=True,
        help_text='Automatically expire when position is filled'
    )
    expire_on_deadline = models.BooleanField(
        default=True,
        help_text='Automatically expire when vacancy closing date passes'
    )

    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    # Analytics
    view_count = models.PositiveIntegerField(default=0)
    application_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'vacancy_urls'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['url_slug']),
            models.Index(fields=['access_token']),
            models.Index(fields=['vacancy', 'is_active']),
        ]

    def __str__(self):
        return f"{self.vacancy.vacancy_number} - {self.url_slug}"

    def save(self, *args, **kwargs):
        import secrets
        import uuid

        if not self.url_slug:
            self.url_slug = f"{self.vacancy.vacancy_number.lower()}-{uuid.uuid4().hex[:8]}"

        if not self.access_token and self.url_type in [self.URLType.TOKEN, self.URLType.GROUP]:
            self.access_token = secrets.token_urlsafe(32)
            self.token_hash = hashlib.sha256(self.access_token.encode()).hexdigest()

        super().save(*args, **kwargs)

    @property
    def is_expired(self):
        """Check if URL has expired."""
        from django.utils import timezone

        if not self.is_active:
            return True

        # Check explicit expiration
        if self.expires_at and timezone.now() > self.expires_at:
            return True

        # Check vacancy deadline
        if self.expire_on_deadline and self.vacancy.closing_date:
            if timezone.now().date() > self.vacancy.closing_date:
                return True

        # Check max uses
        if self.max_uses and self.current_uses >= self.max_uses:
            return True

        # Check if position filled
        if self.expire_on_hire:
            hired_count = self.vacancy.applicants.filter(status='HIRED').count()
            if hired_count >= self.vacancy.number_of_positions:
                return True

        return False

    @property
    def full_url(self):
        """Generate the full application URL."""
        base_url = settings.FRONTEND_URL if hasattr(settings, 'FRONTEND_URL') else ''
        if self.url_type in [self.URLType.TOKEN, self.URLType.GROUP]:
            return f"{base_url}/careers/apply/{self.url_slug}?token={self.access_token}"
        return f"{base_url}/careers/apply/{self.url_slug}"

    def record_view(self):
        """Record a URL view."""
        from django.utils import timezone
        self.view_count += 1
        self.last_accessed = timezone.now()
        self.save(update_fields=['view_count', 'last_accessed'])

    def record_use(self):
        """Record a URL use (application submitted)."""
        self.current_uses += 1
        self.application_count += 1
        self.save(update_fields=['current_uses', 'application_count'])

    def verify_token(self, token):
        """Verify if provided token matches."""
        if self.url_type == self.URLType.PUBLIC:
            return True

        if not token or not self.access_token:
            return False

        return secrets.compare_digest(token or '', self.access_token or '')

    def verify_email(self, email):
        """Verify if email is in target list (for GROUP type)."""
        if self.url_type != self.URLType.GROUP:
            return True

        if not self.target_emails:
            return True

        target_list = [e.strip().lower() for e in self.target_emails.split(',')]
        return email.lower() in target_list


class VacancyURLView(BaseModel):
    """Track individual views/clicks on vacancy URLs."""
    vacancy_url = models.ForeignKey(
        VacancyURL,
        on_delete=models.CASCADE,
        related_name='views'
    )
    viewed_at = models.DateTimeField(auto_now_add=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    referrer = models.URLField(blank=True, null=True)
    device_type = models.CharField(max_length=50, blank=True)
    browser = models.CharField(max_length=50, blank=True)
    country = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'vacancy_url_views'
        ordering = ['-viewed_at']


class ApplicantPortalAccess(BaseModel):
    """
    Applicant portal access for status tracking.
    """
    applicant = models.OneToOneField(
        Applicant,
        on_delete=models.CASCADE,
        related_name='portal_access'
    )
    email = models.EmailField(db_index=True)
    access_token = models.CharField(max_length=64, unique=True, db_index=True)
    token_expires_at = models.DateTimeField()

    last_login = models.DateTimeField(null=True, blank=True)
    login_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'applicant_portal_access'

    def __str__(self):
        return f"{self.applicant.applicant_number} - {self.email}"

    @classmethod
    def generate_access_token(cls, applicant):
        """Generate a new portal access token for an applicant."""
        import secrets
        from django.utils import timezone
        from datetime import timedelta

        token = secrets.token_urlsafe(32)
        expires = timezone.now() + timedelta(days=30)  # 30 day token validity

        access, created = cls.objects.update_or_create(
            applicant=applicant,
            defaults={
                'email': applicant.email,
                'access_token': token,
                'token_expires_at': expires,
                'is_active': True
            }
        )
        return access

    def is_valid(self):
        """Check if access token is valid."""
        from django.utils import timezone
        return self.is_active and timezone.now() < self.token_expires_at

    def record_login(self):
        """Record a login."""
        from django.utils import timezone
        self.last_login = timezone.now()
        self.login_count += 1
        self.save(update_fields=['last_login', 'login_count'])


class ApplicantStatusHistory(BaseModel):
    """Track applicant status changes for portal display."""
    applicant = models.ForeignKey(
        Applicant,
        on_delete=models.CASCADE,
        related_name='status_history'
    )
    old_status = models.CharField(max_length=20, blank=True)
    new_status = models.CharField(max_length=20)
    changed_at = models.DateTimeField(auto_now_add=True)
    changed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    notes = models.TextField(blank=True)
    is_visible_to_applicant = models.BooleanField(
        default=True,
        help_text='Show this status change in applicant portal'
    )
    public_message = models.TextField(
        blank=True,
        help_text='Message to show applicant (if different from notes)'
    )

    class Meta:
        db_table = 'applicant_status_history'
        ordering = ['-changed_at']

    def __str__(self):
        return f"{self.applicant.applicant_number}: {self.old_status} → {self.new_status}"

    @property
    def display_message(self):
        """Get message to display to applicant."""
        return self.public_message or self._get_default_message()

    def _get_default_message(self):
        """Get default message based on status."""
        messages = {
            'NEW': 'Your application has been received.',
            'SCREENING': 'Your application is being reviewed.',
            'SHORTLISTED': 'Congratulations! You have been shortlisted.',
            'INTERVIEW': 'You have been invited for an interview.',
            'ASSESSMENT': 'You have been invited to complete an assessment.',
            'REFERENCE_CHECK': 'We are verifying your references.',
            'OFFER': 'An offer is being prepared for you.',
            'HIRED': 'Congratulations! You have been hired.',
            'REJECTED': 'Thank you for your interest. Unfortunately, we have decided to proceed with other candidates.',
            'WITHDRAWN': 'Your application has been withdrawn.',
        }
        return messages.get(self.new_status, 'Your application status has been updated.')


class ApplicantDocument(BaseModel):
    """Post-acceptance onboarding document uploads for applicants."""

    class DocumentType(models.TextChoices):
        ACCEPTANCE_LETTER = 'ACCEPTANCE_LETTER', 'Acceptance Letter'
        PERSONAL_HISTORY = 'PERSONAL_HISTORY', 'Personal History Form'
        POLICE_REPORT = 'POLICE_REPORT', 'Police Report'
        MEDICAL_REPORT = 'MEDICAL_REPORT', 'Medical Report'
        BANK_DETAILS = 'BANK_DETAILS', 'Bank Details Form'
        PROVIDENT_FUND = 'PROVIDENT_FUND', 'Provident Fund Form'
        TIER_2_FORM = 'TIER_2_FORM', 'Tier 2 Form'
        OTHER = 'OTHER', 'Other'

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        UPLOADED = 'UPLOADED', 'Uploaded'
        VERIFIED = 'VERIFIED', 'Verified'
        REJECTED = 'REJECTED', 'Rejected'

    applicant = models.ForeignKey(
        Applicant, on_delete=models.CASCADE, related_name='documents'
    )
    document_type = models.CharField(max_length=30, choices=DocumentType.choices)
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )

    # Binary file storage
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    file_mime = models.CharField(max_length=100, null=True, blank=True)
    file_checksum = models.CharField(max_length=64, null=True, blank=True)

    # Review
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reviewed_applicant_documents'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'applicant_documents'
        unique_together = ['applicant', 'document_type']
        ordering = ['document_type']

    def __str__(self):
        return f"{self.applicant.applicant_number} - {self.get_document_type_display()}"

    def set_file(self, file_obj, filename=None):
        """Store document file as binary data."""
        if file_obj is None:
            self.file_data = None
            self.file_name = None
            self.file_size = None
            self.file_mime = None
            self.file_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.file_name = filename
        elif hasattr(file_obj, 'name'):
            self.file_name = file_obj.name
        else:
            self.file_name = f'document_{self.document_type}'

        self.file_data = content
        self.file_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.file_mime = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.file_name)
            self.file_mime = mime or 'application/octet-stream'

        self.file_checksum = hashlib.sha256(content).hexdigest()
        self.status = self.Status.UPLOADED

    def get_file_base64(self):
        """Return file data as base64 encoded string."""
        if self.file_data:
            return base64.b64encode(self.file_data).decode('utf-8')
        return None


class ApplicantAttachment(BaseModel):
    """Application-phase file attachments (resume, cover letter, certificates)."""

    class AttachmentType(models.TextChoices):
        RESUME = 'RESUME', 'Resume/CV'
        COVER_LETTER = 'COVER_LETTER', 'Cover Letter'
        CERTIFICATE = 'CERTIFICATE', 'Certificate'
        OTHER = 'OTHER', 'Other'

    applicant = models.ForeignKey(
        Applicant, on_delete=models.CASCADE, related_name='attachments'
    )
    attachment_type = models.CharField(
        max_length=20, choices=AttachmentType.choices
    )
    label = models.CharField(max_length=255, blank=True)

    # Binary file storage
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    file_mime = models.CharField(max_length=100, null=True, blank=True)
    file_checksum = models.CharField(max_length=64, null=True, blank=True)

    class Meta:
        db_table = 'applicant_attachments'
        ordering = ['attachment_type', 'created_at']

    def __str__(self):
        return f"{self.applicant.applicant_number} - {self.get_attachment_type_display()} - {self.file_name or ''}"

    def set_file(self, file_obj, filename=None):
        """Store file as binary data."""
        if file_obj is None:
            self.file_data = None
            self.file_name = None
            self.file_size = None
            self.file_mime = None
            self.file_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.file_name = filename
        elif hasattr(file_obj, 'name'):
            self.file_name = file_obj.name
        else:
            self.file_name = f'attachment_{self.attachment_type}'

        self.file_data = content
        self.file_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.file_mime = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.file_name)
            self.file_mime = mime or 'application/octet-stream'

        self.file_checksum = hashlib.sha256(content).hexdigest()

    def get_file_base64(self):
        """Return file data as base64 encoded string."""
        if self.file_data:
            return base64.b64encode(self.file_data).decode('utf-8')
        return None


# ========================================
# System-Based Shortlisting
# ========================================

class ShortlistCriteria(BaseModel):
    """
    Configurable criteria for automatic applicant shortlisting.
    """
    class CriteriaType(models.TextChoices):
        EDUCATION = 'EDUCATION', 'Education Level'
        EXPERIENCE = 'EXPERIENCE', 'Years of Experience'
        SKILL = 'SKILL', 'Required Skill'
        QUALIFICATION = 'QUALIFICATION', 'Professional Qualification'
        AGE_RANGE = 'AGE_RANGE', 'Age Range'
        LOCATION = 'LOCATION', 'Location/Region'
        CUSTOM = 'CUSTOM', 'Custom Criteria'

    class MatchType(models.TextChoices):
        EXACT = 'EXACT', 'Exact Match'
        MINIMUM = 'MINIMUM', 'Minimum Requirement'
        MAXIMUM = 'MAXIMUM', 'Maximum Allowed'
        CONTAINS = 'CONTAINS', 'Contains Keyword'
        RANGE = 'RANGE', 'Within Range'

    vacancy = models.ForeignKey(
        Vacancy,
        on_delete=models.CASCADE,
        related_name='shortlist_criteria'
    )
    criteria_type = models.CharField(
        max_length=20,
        choices=CriteriaType.choices
    )
    match_type = models.CharField(
        max_length=20,
        choices=MatchType.choices,
        default=MatchType.MINIMUM
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Values for matching
    value_text = models.CharField(max_length=500, blank=True)
    value_number = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    value_min = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    value_max = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )

    # Scoring
    weight = models.DecimalField(
        max_digits=5, decimal_places=2, default=1.00,
        help_text='Weight for scoring (1.0 = standard, higher = more important)'
    )
    max_score = models.PositiveIntegerField(
        default=10,
        help_text='Maximum score for this criterion'
    )
    is_mandatory = models.BooleanField(
        default=False,
        help_text='If true, failing this criterion disqualifies applicant'
    )
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'shortlist_criteria'
        ordering = ['vacancy', 'sort_order']

    def __str__(self):
        return f"{self.vacancy.vacancy_number} - {self.name}"


class ShortlistTemplate(BaseModel):
    """
    Reusable templates for shortlisting criteria.
    """
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    job_family = models.CharField(
        max_length=100, blank=True,
        help_text='Job family this template applies to (e.g., IT, Finance, Driver)'
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'shortlist_templates'
        ordering = ['name']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"


class ShortlistTemplateCriteria(BaseModel):
    """
    Criteria within a template (reusable).
    """
    template = models.ForeignKey(
        ShortlistTemplate,
        on_delete=models.CASCADE,
        related_name='criteria'
    )
    criteria_type = models.CharField(
        max_length=20,
        choices=ShortlistCriteria.CriteriaType.choices
    )
    match_type = models.CharField(
        max_length=20,
        choices=ShortlistCriteria.MatchType.choices,
        default=ShortlistCriteria.MatchType.MINIMUM
    )
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=1.00)
    max_score = models.PositiveIntegerField(default=10)
    is_mandatory = models.BooleanField(default=False)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'shortlist_template_criteria'
        ordering = ['template', 'sort_order']


class ShortlistRun(BaseModel):
    """
    A shortlisting run/batch for a vacancy.
    """
    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        PROCESSING = 'PROCESSING', 'Processing'
        COMPLETED = 'COMPLETED', 'Completed'
        FAILED = 'FAILED', 'Failed'

    vacancy = models.ForeignKey(
        Vacancy,
        on_delete=models.CASCADE,
        related_name='shortlist_runs'
    )
    run_number = models.CharField(max_length=20)
    run_date = models.DateTimeField(auto_now_add=True)
    run_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True
    )

    # Configuration
    pass_score = models.DecimalField(
        max_digits=5, decimal_places=2, default=60,
        help_text='Minimum score to be considered qualified'
    )
    include_screening_score = models.BooleanField(
        default=True,
        help_text='Include manual screening score in final score'
    )
    screening_weight = models.DecimalField(
        max_digits=5, decimal_places=2, default=0.30,
        help_text='Weight for screening score (0-1)'
    )

    # Results
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING
    )
    total_applicants = models.PositiveIntegerField(default=0)
    qualified_count = models.PositiveIntegerField(default=0)
    disqualified_count = models.PositiveIntegerField(default=0)

    notes = models.TextField(blank=True)
    error_message = models.TextField(blank=True)

    class Meta:
        db_table = 'shortlist_runs'
        ordering = ['-run_date']

    def __str__(self):
        return f"{self.vacancy.vacancy_number} - Run {self.run_number}"

    def save(self, *args, **kwargs):
        if not self.run_number:
            import uuid
            self.run_number = f"SL-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)


class ShortlistResult(BaseModel):
    """
    Shortlisting result for each applicant in a run.
    """
    class Outcome(models.TextChoices):
        QUALIFIED = 'QUALIFIED', 'Qualified'
        NOT_QUALIFIED = 'NOT_QUALIFIED', 'Not Qualified'
        DISQUALIFIED = 'DISQUALIFIED', 'Disqualified (Mandatory Failed)'
        MANUAL_REVIEW = 'MANUAL_REVIEW', 'Requires Manual Review'

    shortlist_run = models.ForeignKey(
        ShortlistRun,
        on_delete=models.CASCADE,
        related_name='results'
    )
    applicant = models.ForeignKey(
        Applicant,
        on_delete=models.CASCADE,
        related_name='shortlist_results'
    )

    # Scores
    criteria_score = models.DecimalField(
        max_digits=7, decimal_places=2, default=0,
        help_text='Score from criteria matching'
    )
    screening_score_used = models.DecimalField(
        max_digits=7, decimal_places=2, default=0,
        help_text='Screening score factored in'
    )
    final_score = models.DecimalField(
        max_digits=7, decimal_places=2, default=0,
        help_text='Final weighted score'
    )
    percentage_score = models.DecimalField(
        max_digits=5, decimal_places=2, default=0
    )
    rank = models.PositiveIntegerField(null=True, blank=True)

    # Outcome
    outcome = models.CharField(
        max_length=20,
        choices=Outcome.choices,
        default=Outcome.MANUAL_REVIEW
    )
    score_breakdown = models.JSONField(
        default=dict,
        help_text='Detailed breakdown of scores per criterion'
    )
    failed_mandatory = models.JSONField(
        default=list,
        help_text='List of mandatory criteria that failed'
    )
    notes = models.TextField(blank=True)

    # Manual override
    is_overridden = models.BooleanField(default=False)
    override_outcome = models.CharField(
        max_length=20,
        choices=Outcome.choices,
        blank=True
    )
    override_reason = models.TextField(blank=True)
    overridden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shortlist_overrides'
    )
    overridden_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'shortlist_results'
        ordering = ['-final_score']
        unique_together = ['shortlist_run', 'applicant']

    def __str__(self):
        return f"{self.applicant.applicant_number} - {self.final_score} ({self.outcome})"

    @property
    def effective_outcome(self):
        """Return overridden outcome if applicable."""
        if self.is_overridden and self.override_outcome:
            return self.override_outcome
        return self.outcome
