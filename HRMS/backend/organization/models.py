"""
Organization structure models for HRMS.
"""

from django.db import models
from django.conf import settings

from core.models import BaseModel, Region, UUIDModel, TimeStampedModel


class Organization(UUIDModel, TimeStampedModel):
    """
    Top-level tenant model. Every data record belongs to one Organization.
    This is the multi-tenancy boundary.
    """
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    slug = models.SlugField(max_length=50, unique=True)

    # Branding
    logo_data = models.BinaryField(null=True, blank=True)
    logo_name = models.CharField(max_length=255, null=True, blank=True)
    logo_mime_type = models.CharField(max_length=100, null=True, blank=True)
    primary_color = models.CharField(max_length=7, default='#1a365d')

    # Configuration
    country = models.CharField(max_length=3, blank=True)
    currency = models.CharField(max_length=3, default='USD')
    currency_symbol = models.CharField(max_length=5, default='$')
    timezone = models.CharField(max_length=50, default='UTC')
    date_format = models.CharField(max_length=20, default='DD/MM/YYYY')
    financial_year_start_month = models.PositiveSmallIntegerField(default=1)
    leave_year_start_month = models.PositiveSmallIntegerField(default=1)
    payroll_processing_day = models.PositiveSmallIntegerField(default=25)

    # Contact
    email_domain = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    address = models.TextField(blank=True)
    phone = models.CharField(max_length=20, blank=True)

    # Email settings
    from_email = models.EmailField(default='noreply@example.com')

    # Subscription/Status
    is_active = models.BooleanField(default=True)
    subscription_plan = models.CharField(
        max_length=20,
        choices=[
            ('FREE', 'Free'),
            ('STANDARD', 'Standard'),
            ('PREMIUM', 'Premium'),
            ('ENTERPRISE', 'Enterprise'),
        ],
        default='STANDARD'
    )
    max_employees = models.PositiveIntegerField(default=500)
    max_users = models.PositiveIntegerField(default=100)
    trial_expires_at = models.DateTimeField(null=True, blank=True)

    # Feature flags
    modules_enabled = models.JSONField(default=list)

    # Metadata
    setup_completed = models.BooleanField(default=False)

    class Meta:
        db_table = 'organizations'
        ordering = ['name']

    def __str__(self):
        return f"{self.code} - {self.name}"

    def save(self, *args, **kwargs):
        if not self.slug:
            from django.utils.text import slugify
            self.slug = slugify(self.code)
        super().save(*args, **kwargs)


class Division(BaseModel):
    """
    Top-level organizational division (e.g., ADMIN & HR, EXECUTIVE, OPERATIONS).
    """
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    head = models.ForeignKey(
        'employees.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='headed_divisions'
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'divisions'
        ordering = ['sort_order', 'name']
        verbose_name = 'Division'
        verbose_name_plural = 'Divisions'
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"


class Directorate(BaseModel):
    """
    Directorate within a Division (e.g., MEMBERSHIP & REGIONAL OPERATIONS, INTERNAL AUDIT).
    """
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    division = models.ForeignKey(
        Division,
        on_delete=models.PROTECT,
        related_name='directorates'
    )
    description = models.TextField(null=True, blank=True)
    head = models.ForeignKey(
        'employees.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='headed_directorates'
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'directorates'
        ordering = ['division__sort_order', 'sort_order', 'name']
        verbose_name = 'Directorate'
        verbose_name_plural = 'Directorates'
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def full_path(self):
        """Return full path including division."""
        return f"{self.division.name} > {self.name}"


class OrganizationUnit(BaseModel):
    """
    Hierarchical organization unit (regions, divisions, departments, units).
    """
    class UnitType(models.TextChoices):
        HEADQUARTERS = 'HQ', 'Headquarters'
        REGION = 'REGION', 'Regional Office'
        DIVISION = 'DIVISION', 'Division'
        DEPARTMENT = 'DEPARTMENT', 'Department'
        UNIT = 'UNIT', 'Unit'
        TEAM = 'TEAM', 'Team'

    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    unit_type = models.CharField(
        max_length=20,
        choices=UnitType.choices,
        default=UnitType.DEPARTMENT
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='children'
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='organization_units'
    )
    head = models.ForeignKey(
        'employees.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='headed_units'
    )
    cost_center_code = models.CharField(max_length=20, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    address = models.TextField(null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    level = models.PositiveSmallIntegerField(default=0)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'organization_units'
        ordering = ['level', 'sort_order', 'name']
        verbose_name = 'Organization Unit'
        verbose_name_plural = 'Organization Units'
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"

    def get_ancestors(self):
        """Get all parent units up to root."""
        ancestors = []
        current = self.parent
        while current:
            ancestors.append(current)
            current = current.parent
        return ancestors

    def get_descendants(self):
        """Get all child units recursively."""
        descendants = []
        for child in self.children.all():
            descendants.append(child)
            descendants.extend(child.get_descendants())
        return descendants

    @property
    def full_path(self):
        """Return full path from root to this unit."""
        ancestors = self.get_ancestors()
        path = [a.name for a in reversed(ancestors)] + [self.name]
        return ' > '.join(path)


class Department(BaseModel):
    """
    Department (simplified alias for OrganizationUnit of type DEPARTMENT).
    This can be used alongside OrganizationUnit for simpler queries.
    Links to Directorate for organizational hierarchy.
    """
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    short_name = models.CharField(max_length=50, null=True, blank=True)
    directorate = models.ForeignKey(
        Directorate,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='departments'
    )
    organization_unit = models.OneToOneField(
        OrganizationUnit,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='department'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='sub_departments'
    )
    head = models.ForeignKey(
        'employees.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='headed_departments'
    )
    cost_center_code = models.CharField(max_length=20, null=True, blank=True)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'departments'
        ordering = ['name']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"

    @property
    def full_path(self):
        """Return full organizational path."""
        if self.directorate:
            return f"{self.directorate.division.name} > {self.directorate.name} > {self.name}"
        return self.name


class JobGrade(BaseModel):
    """
    Job grades/levels for salary and hierarchy.
    """
    code = models.CharField(max_length=10, db_index=True)
    name = models.CharField(max_length=100)
    level = models.PositiveSmallIntegerField(db_index=True)
    description = models.TextField(null=True, blank=True)

    # Link to salary structure
    salary_band = models.ForeignKey(
        'payroll.SalaryBand',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='job_grades',
        help_text='Salary band applicable to this job grade'
    )
    salary_level = models.ForeignKey(
        'payroll.SalaryLevel',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='job_grades',
        help_text='Default salary level for this job grade'
    )

    # Salary range (can be auto-populated from salary_band)
    min_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    max_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    mid_salary = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)

    # Leave entitlements
    annual_leave_days = models.PositiveSmallIntegerField(default=21)
    sick_leave_days = models.PositiveSmallIntegerField(default=10)

    is_management = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'job_grades'
        ordering = ['level']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"


class JobCategory(BaseModel):
    """
    Job categories/families (e.g., Administrative, Technical, Medical).
    """
    code = models.CharField(max_length=10, db_index=True)
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'job_categories'
        ordering = ['name']
        verbose_name = 'Job Category'
        verbose_name_plural = 'Job Categories'
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return self.name


class JobPosition(BaseModel):
    """
    Job positions/titles within the organization.
    """
    code = models.CharField(max_length=20, db_index=True)
    title = models.CharField(max_length=200)
    short_title = models.CharField(max_length=100, null=True, blank=True)
    grade = models.ForeignKey(
        JobGrade,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='positions'
    )
    category = models.ForeignKey(
        JobCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='positions'
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='positions'
    )
    reports_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='direct_reports'
    )
    description = models.TextField(null=True, blank=True)
    responsibilities = models.TextField(null=True, blank=True)
    requirements = models.TextField(null=True, blank=True)
    headcount_budget = models.PositiveSmallIntegerField(default=1)
    is_supervisor = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'job_positions'
        ordering = ['grade__level', 'title']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.title}"

    @property
    def current_headcount(self):
        """Return current number of employees in this position."""
        return self.employees.filter(
            status='ACTIVE',
            is_deleted=False
        ).count()

    @property
    def vacancy_count(self):
        """Return number of vacancies."""
        return max(0, self.headcount_budget - self.current_headcount)


class CostCenter(BaseModel):
    """
    Cost centers for financial tracking.
    """
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    description = models.TextField(null=True, blank=True)
    organization_unit = models.ForeignKey(
        OrganizationUnit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='cost_centers'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sub_cost_centers'
    )
    manager = models.ForeignKey(
        'employees.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='managed_cost_centers'
    )
    budget_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    fiscal_year = models.PositiveSmallIntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'cost_centers'
        ordering = ['code']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.code} - {self.name}"


class WorkLocation(BaseModel):
    """
    Physical work locations.
    """
    code = models.CharField(max_length=20, db_index=True)
    name = models.CharField(max_length=200)
    address = models.TextField()
    city = models.CharField(max_length=100)
    region = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_locations'
    )
    organization_unit = models.ForeignKey(
        OrganizationUnit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='work_locations'
    )
    latitude = models.DecimalField(max_digits=10, decimal_places=8, null=True, blank=True)
    longitude = models.DecimalField(max_digits=11, decimal_places=8, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    is_headquarters = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'work_locations'
        ordering = ['name']
        unique_together = [('tenant', 'code')]

    def __str__(self):
        return f"{self.name} ({self.city})"


class Holiday(BaseModel):
    """
    Public holidays and organizational holidays.
    """
    class HolidayType(models.TextChoices):
        PUBLIC = 'PUBLIC', 'Public Holiday'
        ORGANIZATIONAL = 'ORG', 'Organizational Holiday'
        REGIONAL = 'REGIONAL', 'Regional Holiday'

    name = models.CharField(max_length=200)
    date = models.DateField(db_index=True)
    holiday_type = models.CharField(
        max_length=20,
        choices=HolidayType.choices,
        default=HolidayType.PUBLIC
    )
    region = models.ForeignKey(
        Region,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='holidays'
    )
    description = models.TextField(null=True, blank=True)
    is_paid = models.BooleanField(default=True)
    year = models.PositiveSmallIntegerField(db_index=True)

    class Meta:
        db_table = 'holidays'
        ordering = ['date']
        unique_together = ['name', 'date']

    def __str__(self):
        return f"{self.name} - {self.date}"

    def save(self, *args, **kwargs):
        self.year = self.date.year
        super().save(*args, **kwargs)
