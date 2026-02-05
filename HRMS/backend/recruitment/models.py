"""
Recruitment models for vacancy, applicant, interview, and offer management.
"""

import base64
import hashlib
import mimetypes
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
