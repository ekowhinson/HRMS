"""
Employee management models for NHIA HRMS.
"""

import base64
import mimetypes
from django.db import models
from django.conf import settings
from django.utils import timezone

from core.models import BaseModel, Region, District


class Employee(BaseModel):
    """
    Core employee record containing all biographical and employment data.
    """
    class EmploymentStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        ON_LEAVE = 'ON_LEAVE', 'On Leave'
        SUSPENDED = 'SUSPENDED', 'Suspended'
        PROBATION = 'PROBATION', 'On Probation'
        NOTICE = 'NOTICE', 'Notice Period'
        TERMINATED = 'TERMINATED', 'Terminated'
        RESIGNED = 'RESIGNED', 'Resigned'
        RETIRED = 'RETIRED', 'Retired'
        DECEASED = 'DECEASED', 'Deceased'

    class EmploymentType(models.TextChoices):
        PERMANENT = 'PERMANENT', 'Permanent'
        CONTRACT = 'CONTRACT', 'Contract'
        TEMPORARY = 'TEMPORARY', 'Temporary'
        INTERN = 'INTERN', 'Intern'
        CONSULTANT = 'CONSULTANT', 'Consultant'
        PART_TIME = 'PART_TIME', 'Part Time'
        SECONDMENT = 'SECONDMENT', 'Secondment'

    class AssignmentStatus(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active Assignment'
        SUSPENDED = 'SUSPENDED', 'Suspended Assignment'
        ENDED = 'ENDED', 'Ended Assignment'
        PENDING = 'PENDING', 'Pending Assignment'

    class Gender(models.TextChoices):
        MALE = 'M', 'Male'
        FEMALE = 'F', 'Female'

    class MaritalStatus(models.TextChoices):
        SINGLE = 'SINGLE', 'Single'
        MARRIED = 'MARRIED', 'Married'
        DIVORCED = 'DIVORCED', 'Divorced'
        WIDOWED = 'WIDOWED', 'Widowed'
        SEPARATED = 'SEPARATED', 'Separated'

    # Link to user account
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee'
    )

    # Employee identification
    employee_number = models.CharField(max_length=20, unique=True, db_index=True)
    legacy_employee_id = models.CharField(max_length=50, null=True, blank=True, db_index=True)
    old_staff_number = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        db_index=True,
        help_text='Previous staff number from legacy system'
    )

    # Personal information
    title = models.CharField(max_length=20, null=True, blank=True)
    first_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100, null=True, blank=True)
    last_name = models.CharField(max_length=100)
    maiden_name = models.CharField(max_length=100, null=True, blank=True)
    preferred_name = models.CharField(max_length=100, null=True, blank=True)

    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=Gender.choices)
    marital_status = models.CharField(
        max_length=20,
        choices=MaritalStatus.choices,
        default=MaritalStatus.SINGLE
    )
    nationality = models.CharField(max_length=50, default='Ghanaian')

    # National IDs
    ghana_card_number = models.CharField(max_length=20, null=True, blank=True, unique=True)
    ssnit_number = models.CharField(max_length=20, null=True, blank=True, unique=True)
    tin_number = models.CharField(max_length=20, null=True, blank=True, unique=True)
    voter_id = models.CharField(max_length=20, null=True, blank=True)
    passport_number = models.CharField(max_length=20, null=True, blank=True)
    passport_expiry = models.DateField(null=True, blank=True)

    # Contact information
    personal_email = models.EmailField(null=True, blank=True)
    work_email = models.EmailField(null=True, blank=True)
    mobile_phone = models.CharField(max_length=20)
    home_phone = models.CharField(max_length=20, null=True, blank=True)
    work_phone = models.CharField(max_length=20, null=True, blank=True)

    # Address
    residential_address = models.TextField()
    residential_city = models.CharField(max_length=100)
    residential_region = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='residents'
    )
    residential_district = models.ForeignKey(
        District,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='residents'
    )
    postal_address = models.TextField(null=True, blank=True)
    digital_address = models.CharField(max_length=20, null=True, blank=True)

    # Employment details
    status = models.CharField(
        max_length=20,
        choices=EmploymentStatus.choices,
        default=EmploymentStatus.ACTIVE,
        db_index=True
    )
    employment_type = models.CharField(
        max_length=20,
        choices=EmploymentType.choices,
        default=EmploymentType.PERMANENT
    )
    date_of_joining = models.DateField(db_index=True)
    date_of_confirmation = models.DateField(null=True, blank=True)
    probation_end_date = models.DateField(null=True, blank=True)
    contract_start_date = models.DateField(null=True, blank=True)
    contract_end_date = models.DateField(null=True, blank=True)
    date_of_exit = models.DateField(null=True, blank=True)
    exit_reason = models.CharField(max_length=200, null=True, blank=True)
    retirement_date = models.DateField(null=True, blank=True)

    # Organization assignment
    division = models.ForeignKey(
        'organization.Division',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    directorate = models.ForeignKey(
        'organization.Directorate',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    department = models.ForeignKey(
        'organization.Department',
        on_delete=models.PROTECT,
        related_name='employees'
    )
    position = models.ForeignKey(
        'organization.JobPosition',
        on_delete=models.PROTECT,
        related_name='employees'
    )
    grade = models.ForeignKey(
        'organization.JobGrade',
        on_delete=models.PROTECT,
        related_name='employees'
    )
    work_location = models.ForeignKey(
        'organization.WorkLocation',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    cost_center = models.ForeignKey(
        'organization.CostCenter',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )

    # Staff category and salary structure
    staff_category = models.ForeignKey(
        'payroll.StaffCategory',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees',
        help_text='Staff category for payroll grouping (e.g., District, HQ)'
    )
    salary_notch = models.ForeignKey(
        'payroll.SalaryNotch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees',
        help_text='Current salary notch (Band/Level/Notch)'
    )

    # Assignment status (different from employment status)
    assignment_status = models.CharField(
        max_length=20,
        choices=AssignmentStatus.choices,
        default=AssignmentStatus.ACTIVE,
        help_text='Current assignment status'
    )

    # Reporting
    supervisor = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='direct_reports'
    )

    # Photo (stored as binary data)
    photo_data = models.BinaryField(null=True, blank=True)
    photo_name = models.CharField(max_length=255, null=True, blank=True)
    photo_mime = models.CharField(max_length=100, null=True, blank=True)

    # Medical
    blood_group = models.CharField(max_length=5, null=True, blank=True)
    medical_conditions = models.TextField(null=True, blank=True)
    disability = models.TextField(null=True, blank=True)

    # Notes
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'employees'
        ordering = ['employee_number']
        indexes = [
            models.Index(fields=['status', 'department']),
            models.Index(fields=['date_of_joining']),
            models.Index(fields=['last_name', 'first_name']),
        ]

    def __str__(self):
        return f"{self.employee_number} - {self.full_name}"

    @property
    def full_name(self):
        """Return employee's full name."""
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        parts.append(self.last_name)
        return ' '.join(parts)

    @property
    def age(self):
        """Calculate employee's age."""
        today = timezone.now().date()
        born = self.date_of_birth
        return today.year - born.year - ((today.month, today.day) < (born.month, born.day))

    @property
    def years_of_service(self):
        """Calculate years of service."""
        end_date = self.date_of_exit or timezone.now().date()
        start_date = self.date_of_joining
        return (end_date - start_date).days / 365.25

    def calculate_retirement_date(self, retirement_age=60):
        """Calculate expected retirement date."""
        return self.date_of_birth.replace(year=self.date_of_birth.year + retirement_age)

    def set_photo(self, file_obj):
        """Store photo as binary data."""
        if file_obj is None:
            self.photo_data = None
            self.photo_name = None
            self.photo_mime = None
            return

        content = file_obj.read() if hasattr(file_obj, 'read') else file_obj
        self.photo_data = content
        self.photo_name = getattr(file_obj, 'name', 'photo.jpg')

        if hasattr(file_obj, 'content_type'):
            self.photo_mime = file_obj.content_type
        else:
            mime_type, _ = mimetypes.guess_type(self.photo_name)
            self.photo_mime = mime_type or 'image/jpeg'

    def get_photo_base64(self):
        """Return photo as base64 string."""
        if self.photo_data:
            return base64.b64encode(self.photo_data).decode('utf-8')
        return None

    def get_photo_data_uri(self):
        """Return photo as data URI."""
        if self.photo_data and self.photo_mime:
            b64 = base64.b64encode(self.photo_data).decode('utf-8')
            return f"data:{self.photo_mime};base64,{b64}"
        return None

    @property
    def has_photo(self):
        """Check if employee has a photo."""
        return self.photo_data is not None


class EmergencyContact(BaseModel):
    """
    Emergency contact information for employees.
    """
    class Relationship(models.TextChoices):
        SPOUSE = 'SPOUSE', 'Spouse'
        PARENT = 'PARENT', 'Parent'
        SIBLING = 'SIBLING', 'Sibling'
        CHILD = 'CHILD', 'Child'
        RELATIVE = 'RELATIVE', 'Other Relative'
        FRIEND = 'FRIEND', 'Friend'
        OTHER = 'OTHER', 'Other'

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='emergency_contacts'
    )
    name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=20, choices=Relationship.choices)
    phone_primary = models.CharField(max_length=20)
    phone_secondary = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = 'emergency_contacts'
        ordering = ['-is_primary', 'name']

    def __str__(self):
        return f"{self.name} ({self.relationship})"


class Dependent(BaseModel):
    """
    Employee dependents for benefits and tax purposes.
    """
    class Relationship(models.TextChoices):
        SPOUSE = 'SPOUSE', 'Spouse'
        CHILD = 'CHILD', 'Child'
        PARENT = 'PARENT', 'Parent'
        SIBLING = 'SIBLING', 'Sibling'
        OTHER = 'OTHER', 'Other'

    class Gender(models.TextChoices):
        MALE = 'M', 'Male'
        FEMALE = 'F', 'Female'

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='dependents'
    )
    name = models.CharField(max_length=200)
    relationship = models.CharField(max_length=20, choices=Relationship.choices)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=1, choices=Gender.choices)
    ghana_card_number = models.CharField(max_length=20, null=True, blank=True)
    is_disabled = models.BooleanField(default=False)
    is_student = models.BooleanField(default=False)
    school_name = models.CharField(max_length=200, null=True, blank=True)
    is_eligible_for_benefits = models.BooleanField(default=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'dependents'
        ordering = ['relationship', 'date_of_birth']

    def __str__(self):
        return f"{self.name} ({self.relationship})"

    @property
    def age(self):
        """Calculate dependent's age."""
        today = timezone.now().date()
        return today.year - self.date_of_birth.year - (
            (today.month, today.day) < (self.date_of_birth.month, self.date_of_birth.day)
        )


class Education(BaseModel):
    """
    Employee education history.
    """
    class QualificationLevel(models.TextChoices):
        PHD = 'PHD', 'Doctorate (PhD)'
        MASTERS = 'MASTERS', 'Masters Degree'
        BACHELORS = 'BACHELORS', 'Bachelors Degree'
        HND = 'HND', 'Higher National Diploma'
        DIPLOMA = 'DIPLOMA', 'Diploma'
        CERTIFICATE = 'CERTIFICATE', 'Certificate'
        A_LEVEL = 'A_LEVEL', 'A Level'
        O_LEVEL = 'O_LEVEL', 'O Level / WASSCE'
        BASIC = 'BASIC', 'Basic Education'
        OTHER = 'OTHER', 'Other'

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='education_history'
    )
    qualification_level = models.CharField(
        max_length=20,
        choices=QualificationLevel.choices
    )
    qualification_name = models.CharField(max_length=200)
    field_of_study = models.CharField(max_length=200, null=True, blank=True)
    institution = models.CharField(max_length=200)
    institution_country = models.CharField(max_length=50, default='Ghana')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    grade = models.CharField(max_length=50, null=True, blank=True)
    certificate_number = models.CharField(max_length=100, null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='verified_education'
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'employee_education'
        ordering = ['-end_date', 'qualification_level']
        verbose_name = 'Education'
        verbose_name_plural = 'Education Records'

    def __str__(self):
        return f"{self.qualification_name} - {self.institution}"


class WorkExperience(BaseModel):
    """
    Employee previous work experience.
    """
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='work_experience'
    )
    company_name = models.CharField(max_length=200)
    position = models.CharField(max_length=200)
    department = models.CharField(max_length=200, null=True, blank=True)
    location = models.CharField(max_length=200, null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    is_current = models.BooleanField(default=False)
    responsibilities = models.TextField(null=True, blank=True)
    reason_for_leaving = models.TextField(null=True, blank=True)
    reference_name = models.CharField(max_length=200, null=True, blank=True)
    reference_contact = models.CharField(max_length=100, null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'work_experience'
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.position} at {self.company_name}"

    @property
    def duration_months(self):
        """Calculate duration in months."""
        end = self.end_date or timezone.now().date()
        return (end.year - self.start_date.year) * 12 + (end.month - self.start_date.month)


class Certification(BaseModel):
    """
    Professional certifications and licenses.
    """
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='certifications'
    )
    name = models.CharField(max_length=200)
    issuing_organization = models.CharField(max_length=200)
    credential_id = models.CharField(max_length=100, null=True, blank=True)
    issue_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    does_not_expire = models.BooleanField(default=False)
    verification_url = models.URLField(null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'certifications'
        ordering = ['-issue_date']

    def __str__(self):
        return f"{self.name} - {self.issuing_organization}"

    @property
    def is_expired(self):
        """Check if certification has expired."""
        if self.does_not_expire:
            return False
        if not self.expiry_date:
            return False
        return self.expiry_date < timezone.now().date()


class Skill(BaseModel):
    """
    Employee skills inventory.
    """
    class ProficiencyLevel(models.TextChoices):
        BEGINNER = 'BEGINNER', 'Beginner'
        INTERMEDIATE = 'INTERMEDIATE', 'Intermediate'
        ADVANCED = 'ADVANCED', 'Advanced'
        EXPERT = 'EXPERT', 'Expert'

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='skills'
    )
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=50, null=True, blank=True)
    proficiency = models.CharField(
        max_length=20,
        choices=ProficiencyLevel.choices,
        default=ProficiencyLevel.INTERMEDIATE
    )
    years_of_experience = models.PositiveSmallIntegerField(null=True, blank=True)
    last_used = models.DateField(null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'employee_skills'
        ordering = ['-is_primary', 'name']
        unique_together = ['employee', 'name']

    def __str__(self):
        return f"{self.name} ({self.proficiency})"


class BankAccount(BaseModel):
    """
    Employee bank account details for salary payment.
    Links to Bank and BankBranch setup tables.
    """
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='bank_accounts'
    )
    # Link to setup tables
    bank = models.ForeignKey(
        'payroll.Bank',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='employee_accounts'
    )
    branch = models.ForeignKey(
        'payroll.BankBranch',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_accounts'
    )
    # Keep legacy fields for backward compatibility and imports
    bank_name = models.CharField(max_length=100, null=True, blank=True)
    bank_code = models.CharField(max_length=20, null=True, blank=True)
    branch_name = models.CharField(max_length=100, null=True, blank=True)
    branch_code = models.CharField(max_length=20, null=True, blank=True)
    account_name = models.CharField(max_length=200)
    account_number = models.CharField(max_length=50)
    account_type = models.CharField(
        max_length=20,
        choices=[
            ('SAVINGS', 'Savings'),
            ('CURRENT', 'Current'),
            ('OTHER', 'Other'),
        ],
        default='SAVINGS'
    )
    swift_code = models.CharField(max_length=20, null=True, blank=True)
    is_primary = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=False)
    verified_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'bank_accounts'
        ordering = ['-is_primary', 'bank__name', 'bank_name']

    def __str__(self):
        name = self.bank.name if self.bank else self.bank_name
        return f"{name} - {self.account_number[-4:]}"

    @property
    def display_bank_name(self):
        """Return bank name from FK or legacy field."""
        return self.bank.name if self.bank else self.bank_name

    @property
    def display_branch_name(self):
        """Return branch name from FK or legacy field."""
        return self.branch.name if self.branch else self.branch_name


class EmploymentHistory(BaseModel):
    """
    Track changes in employee's position, department, grade, etc.
    """
    class ChangeType(models.TextChoices):
        HIRE = 'HIRE', 'New Hire'
        PROMOTION = 'PROMOTION', 'Promotion'
        DEMOTION = 'DEMOTION', 'Demotion'
        TRANSFER = 'TRANSFER', 'Transfer'
        GRADE_CHANGE = 'GRADE_CHANGE', 'Grade Change'
        POSITION_CHANGE = 'POSITION_CHANGE', 'Position Change'
        DEPARTMENT_CHANGE = 'DEPT_CHANGE', 'Department Change'
        SALARY_REVISION = 'SALARY_REVISION', 'Salary Revision'
        CONFIRMATION = 'CONFIRMATION', 'Confirmation'
        CONTRACT_RENEWAL = 'CONTRACT_RENEWAL', 'Contract Renewal'
        ACTING = 'ACTING', 'Acting Appointment'
        SECONDMENT = 'SECONDMENT', 'Secondment'
        EXIT = 'EXIT', 'Exit'
        REINSTATEMENT = 'REINSTATEMENT', 'Reinstatement'

    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='employment_history'
    )
    change_type = models.CharField(max_length=20, choices=ChangeType.choices)
    effective_date = models.DateField(db_index=True)
    end_date = models.DateField(null=True, blank=True)

    # Previous values
    previous_department = models.ForeignKey(
        'organization.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    previous_position = models.ForeignKey(
        'organization.JobPosition',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    previous_grade = models.ForeignKey(
        'organization.JobGrade',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    previous_supervisor = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    previous_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # New values
    new_department = models.ForeignKey(
        'organization.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    new_position = models.ForeignKey(
        'organization.JobPosition',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    new_grade = models.ForeignKey(
        'organization.JobGrade',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    new_supervisor = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='+'
    )
    new_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    reason = models.TextField(null=True, blank=True)
    reference_number = models.CharField(max_length=50, null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_employment_changes'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'employment_history'
        ordering = ['-effective_date']
        verbose_name = 'Employment History'
        verbose_name_plural = 'Employment History Records'

    def __str__(self):
        return f"{self.employee.employee_number} - {self.change_type} - {self.effective_date}"
