"""
Discipline and Grievance models.
"""

import base64
import hashlib
import mimetypes
from django.db import models
from django.conf import settings

from core.models import BaseModel


class MisconductCategory(BaseModel):
    """Categories of misconduct."""

    class Severity(models.TextChoices):
        MINOR = 'MINOR', 'Minor'
        MODERATE = 'MODERATE', 'Moderate'
        MAJOR = 'MAJOR', 'Major'
        GROSS = 'GROSS', 'Gross Misconduct'

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField()
    severity = models.CharField(
        max_length=20, choices=Severity.choices, default=Severity.MINOR
    )
    recommended_action = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'Misconduct Categories'
        ordering = ['severity', 'name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class DisciplinaryCase(BaseModel):
    """Disciplinary case/incident."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        REPORTED = 'REPORTED', 'Reported'
        UNDER_INVESTIGATION = 'UNDER_INVESTIGATION', 'Under Investigation'
        SHOW_CAUSE_ISSUED = 'SHOW_CAUSE_ISSUED', 'Show Cause Issued'
        SHOW_CAUSE_RECEIVED = 'SHOW_CAUSE_RECEIVED', 'Show Cause Received'
        HEARING_SCHEDULED = 'HEARING_SCHEDULED', 'Hearing Scheduled'
        HEARING_COMPLETED = 'HEARING_COMPLETED', 'Hearing Completed'
        PENDING_DECISION = 'PENDING_DECISION', 'Pending Decision'
        DECISION_ISSUED = 'DECISION_ISSUED', 'Decision Issued'
        APPEAL_FILED = 'APPEAL_FILED', 'Appeal Filed'
        CLOSED = 'CLOSED', 'Closed'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn'

    case_number = models.CharField(max_length=20, unique=True)
    employee = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE, related_name='disciplinary_cases'
    )
    misconduct_category = models.ForeignKey(
        MisconductCategory, on_delete=models.PROTECT
    )

    # Incident Details
    incident_date = models.DateField()
    incident_location = models.CharField(max_length=200, blank=True)
    incident_description = models.TextField()

    # Reporting
    reported_date = models.DateField()
    reported_by = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, related_name='reported_cases'
    )

    # Status and Assignment
    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.DRAFT
    )
    assigned_investigator = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='investigating_cases'
    )
    hr_representative = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='hr_disciplinary_cases'
    )

    # Investigation
    investigation_start_date = models.DateField(null=True, blank=True)
    investigation_end_date = models.DateField(null=True, blank=True)
    investigation_findings = models.TextField(blank=True)
    is_substantiated = models.BooleanField(null=True)

    # Show Cause
    show_cause_issued_date = models.DateField(null=True, blank=True)
    show_cause_response_date = models.DateField(null=True, blank=True)
    show_cause_response = models.TextField(blank=True)

    # Final Decision
    final_decision = models.TextField(blank=True)
    decision_date = models.DateField(null=True, blank=True)
    decision_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='decided_cases'
    )

    # Closure
    closure_date = models.DateField(null=True, blank=True)
    closure_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-reported_date']
        indexes = [
            models.Index(fields=['employee', 'status']),
        ]

    def __str__(self):
        return f"{self.case_number} - {self.employee}"


class DisciplinaryAction(BaseModel):
    """Actions taken for disciplinary cases."""

    class ActionType(models.TextChoices):
        VERBAL_WARNING = 'VERBAL_WARNING', 'Verbal Warning'
        WRITTEN_WARNING = 'WRITTEN_WARNING', 'Written Warning'
        FINAL_WARNING = 'FINAL_WARNING', 'Final Written Warning'
        SUSPENSION_WITH_PAY = 'SUSPENSION_WITH_PAY', 'Suspension with Pay'
        SUSPENSION_WITHOUT_PAY = 'SUSPENSION_WITHOUT_PAY', 'Suspension without Pay'
        DEMOTION = 'DEMOTION', 'Demotion'
        TRANSFER = 'TRANSFER', 'Transfer'
        SALARY_REDUCTION = 'SALARY_REDUCTION', 'Salary Reduction'
        TERMINATION = 'TERMINATION', 'Termination'
        DISMISSAL = 'DISMISSAL', 'Summary Dismissal'
        NO_ACTION = 'NO_ACTION', 'No Action'
        COUNSELING = 'COUNSELING', 'Counseling'
        TRAINING = 'TRAINING', 'Mandatory Training'

    case = models.ForeignKey(
        DisciplinaryCase, on_delete=models.CASCADE, related_name='actions'
    )
    action_type = models.CharField(max_length=30, choices=ActionType.choices)
    action_date = models.DateField()
    effective_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)

    description = models.TextField()
    conditions = models.TextField(blank=True)

    # For suspensions
    suspension_days = models.PositiveIntegerField(null=True, blank=True)

    # For salary reductions
    reduction_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    reduction_duration_months = models.PositiveIntegerField(null=True, blank=True)

    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='issued_actions'
    )
    acknowledged_by_employee = models.BooleanField(default=False)
    acknowledged_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-action_date']


class DisciplinaryHearing(BaseModel):
    """Disciplinary hearing/committee."""

    class Status(models.TextChoices):
        SCHEDULED = 'SCHEDULED', 'Scheduled'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        ADJOURNED = 'ADJOURNED', 'Adjourned'
        CANCELLED = 'CANCELLED', 'Cancelled'

    case = models.ForeignKey(
        DisciplinaryCase, on_delete=models.CASCADE, related_name='hearings'
    )
    hearing_number = models.PositiveIntegerField(default=1)

    scheduled_date = models.DateField()
    scheduled_time = models.TimeField()
    location = models.CharField(max_length=200)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.SCHEDULED
    )

    # Attendance
    employee_present = models.BooleanField(null=True)
    employee_representation = models.CharField(max_length=200, blank=True)

    # Minutes
    minutes = models.TextField(blank=True)
    findings = models.TextField(blank=True)
    recommendations = models.TextField(blank=True)

    actual_start_time = models.TimeField(null=True, blank=True)
    actual_end_time = models.TimeField(null=True, blank=True)

    next_hearing_date = models.DateField(null=True, blank=True)
    adjournment_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['case', 'hearing_number']
        unique_together = ['case', 'hearing_number']


class HearingCommitteeMember(BaseModel):
    """Members of the disciplinary hearing committee."""

    class Role(models.TextChoices):
        CHAIR = 'CHAIR', 'Chairperson'
        MEMBER = 'MEMBER', 'Committee Member'
        HR_REP = 'HR_REP', 'HR Representative'
        SECRETARY = 'SECRETARY', 'Secretary'

    hearing = models.ForeignKey(
        DisciplinaryHearing, on_delete=models.CASCADE, related_name='committee_members'
    )
    employee = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE
    )
    role = models.CharField(max_length=20, choices=Role.choices)
    attended = models.BooleanField(null=True)

    class Meta:
        unique_together = ['hearing', 'employee']


class DisciplinaryEvidence(BaseModel):
    """Evidence for disciplinary cases."""

    class EvidenceType(models.TextChoices):
        DOCUMENT = 'DOCUMENT', 'Document'
        PHOTO = 'PHOTO', 'Photo'
        VIDEO = 'VIDEO', 'Video'
        AUDIO = 'AUDIO', 'Audio'
        STATEMENT = 'STATEMENT', 'Witness Statement'
        EMAIL = 'EMAIL', 'Email/Communication'
        REPORT = 'REPORT', 'Report'
        OTHER = 'OTHER', 'Other'

    case = models.ForeignKey(
        DisciplinaryCase, on_delete=models.CASCADE, related_name='evidence'
    )
    evidence_type = models.CharField(max_length=20, choices=EvidenceType.choices)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    # Binary file storage
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, null=True, blank=True)
    file_checksum = models.CharField(max_length=64, null=True, blank=True)
    submitted_by = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL, null=True
    )
    submitted_date = models.DateField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Disciplinary Evidence'

    def set_file(self, file_obj, filename=None):
        """Store evidence file as binary data."""
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
            self.file_name = 'evidence'

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
    def has_file(self):
        """Check if file data exists."""
        return self.file_data is not None


class DisciplinaryAppeal(BaseModel):
    """Appeals for disciplinary decisions."""

    class Status(models.TextChoices):
        FILED = 'FILED', 'Filed'
        UNDER_REVIEW = 'UNDER_REVIEW', 'Under Review'
        HEARING_SCHEDULED = 'HEARING_SCHEDULED', 'Hearing Scheduled'
        DECISION_PENDING = 'DECISION_PENDING', 'Decision Pending'
        UPHELD = 'UPHELD', 'Appeal Upheld (Decision Overturned)'
        PARTIALLY_UPHELD = 'PARTIALLY_UPHELD', 'Partially Upheld'
        DISMISSED = 'DISMISSED', 'Appeal Dismissed'
        WITHDRAWN = 'WITHDRAWN', 'Appeal Withdrawn'

    case = models.ForeignKey(
        DisciplinaryCase, on_delete=models.CASCADE, related_name='appeals'
    )
    appeal_number = models.PositiveIntegerField(default=1)

    filed_date = models.DateField()
    grounds_for_appeal = models.TextField()
    # Binary file storage for supporting documents
    document_data = models.BinaryField(null=True, blank=True)
    document_name = models.CharField(max_length=255, null=True, blank=True)
    document_size = models.PositiveIntegerField(null=True, blank=True)
    document_mime = models.CharField(max_length=100, null=True, blank=True)
    document_checksum = models.CharField(max_length=64, null=True, blank=True)

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.FILED
    )

    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True
    )
    decision = models.TextField(blank=True)
    decision_date = models.DateField(null=True, blank=True)
    decision_rationale = models.TextField(blank=True)

    class Meta:
        unique_together = ['case', 'appeal_number']
        ordering = ['case', 'appeal_number']

    def set_document(self, file_obj, filename=None):
        """Store supporting document as binary data."""
        if file_obj is None:
            self.document_data = None
            self.document_name = None
            self.document_size = None
            self.document_mime = None
            self.document_checksum = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj

        if filename:
            self.document_name = filename
        elif hasattr(file_obj, 'name'):
            self.document_name = file_obj.name
        else:
            self.document_name = 'document'

        self.document_data = content
        self.document_size = len(content)

        if hasattr(file_obj, 'content_type'):
            self.document_mime = file_obj.content_type
        else:
            mime, _ = mimetypes.guess_type(self.document_name)
            self.document_mime = mime or 'application/octet-stream'

        self.document_checksum = hashlib.sha256(content).hexdigest()

    def get_document_base64(self):
        """Return document data as base64 encoded string."""
        if self.document_data:
            return base64.b64encode(self.document_data).decode('utf-8')
        return None

    def get_document_data_uri(self):
        """Return document as a data URI."""
        if self.document_data and self.document_mime:
            b64_data = base64.b64encode(self.document_data).decode('utf-8')
            return f"data:{self.document_mime};base64,{b64_data}"
        return None

    @property
    def has_document(self):
        """Check if document data exists."""
        return self.document_data is not None


class GrievanceCategory(BaseModel):
    """Categories for grievances."""

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, unique=True)
    description = models.TextField()
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'Grievance Categories'
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"


class Grievance(BaseModel):
    """Employee grievance."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        ACKNOWLEDGED = 'ACKNOWLEDGED', 'Acknowledged'
        UNDER_INVESTIGATION = 'UNDER_INVESTIGATION', 'Under Investigation'
        MEDIATION = 'MEDIATION', 'Mediation'
        PENDING_RESOLUTION = 'PENDING_RESOLUTION', 'Pending Resolution'
        RESOLVED = 'RESOLVED', 'Resolved'
        ESCALATED = 'ESCALATED', 'Escalated'
        CLOSED = 'CLOSED', 'Closed'
        WITHDRAWN = 'WITHDRAWN', 'Withdrawn'

    class Priority(models.TextChoices):
        LOW = 'LOW', 'Low'
        MEDIUM = 'MEDIUM', 'Medium'
        HIGH = 'HIGH', 'High'
        URGENT = 'URGENT', 'Urgent'

    grievance_number = models.CharField(max_length=20, unique=True)
    employee = models.ForeignKey(
        'employees.Employee', on_delete=models.CASCADE, related_name='grievances'
    )
    category = models.ForeignKey(
        GrievanceCategory, on_delete=models.PROTECT
    )

    # Grievance Details
    subject = models.CharField(max_length=200)
    description = models.TextField()
    incident_date = models.DateField(null=True, blank=True)
    desired_outcome = models.TextField(blank=True)

    # Against
    against_employee = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='grievances_against'
    )
    against_department = models.ForeignKey(
        'organization.Department', on_delete=models.SET_NULL,
        null=True, blank=True
    )
    against_manager = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='manager_grievances_against'
    )

    # Status and Priority
    status = models.CharField(
        max_length=30, choices=Status.choices, default=Status.DRAFT
    )
    priority = models.CharField(
        max_length=20, choices=Priority.choices, default=Priority.MEDIUM
    )
    is_confidential = models.BooleanField(default=False)
    is_anonymous = models.BooleanField(default=False)

    # Dates
    submitted_date = models.DateField(null=True, blank=True)
    acknowledged_date = models.DateField(null=True, blank=True)
    target_resolution_date = models.DateField(null=True, blank=True)
    resolution_date = models.DateField(null=True, blank=True)

    # Assignment
    assigned_to = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_grievances'
    )
    hr_representative = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='hr_grievances'
    )

    # Resolution
    resolution = models.TextField(blank=True)
    resolution_accepted = models.BooleanField(null=True)
    resolution_feedback = models.TextField(blank=True)

    # Escalation
    escalation_level = models.PositiveIntegerField(default=0)
    escalated_to = models.ForeignKey(
        'employees.Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='escalated_grievances'
    )
    escalation_reason = models.TextField(blank=True)
    escalated_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['-submitted_date']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['status', 'priority']),
        ]

    def __str__(self):
        return f"{self.grievance_number} - {self.subject}"


class GrievanceNote(BaseModel):
    """Notes and updates on grievances."""

    grievance = models.ForeignKey(
        Grievance, on_delete=models.CASCADE, related_name='notes'
    )
    note = models.TextField()
    is_internal = models.BooleanField(default=False)
    added_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )

    class Meta:
        ordering = ['-created_at']


class GrievanceAttachment(BaseModel):
    """Attachments for grievances."""

    grievance = models.ForeignKey(
        Grievance, on_delete=models.CASCADE, related_name='attachments'
    )
    title = models.CharField(max_length=200)
    # Binary file storage
    file_data = models.BinaryField(null=True, blank=True)
    file_name = models.CharField(max_length=255, null=True, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    mime_type = models.CharField(max_length=100, null=True, blank=True)
    file_checksum = models.CharField(max_length=64, null=True, blank=True)
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )

    class Meta:
        ordering = ['-created_at']

    def set_file(self, file_obj, filename=None):
        """Store attachment file as binary data."""
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
    def has_file(self):
        """Check if file data exists."""
        return self.file_data is not None
