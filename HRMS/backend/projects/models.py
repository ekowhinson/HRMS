"""Models for project management."""

from django.db import models
from django.conf import settings
from core.models import BaseModel


class Project(BaseModel):
    """Project master."""

    class Status(models.TextChoices):
        PLANNING = 'PLANNING', 'Planning'
        ACTIVE = 'ACTIVE', 'Active'
        ON_HOLD = 'ON_HOLD', 'On Hold'
        COMPLETED = 'COMPLETED', 'Completed'
        CANCELLED = 'CANCELLED', 'Cancelled'

    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    project_manager = models.ForeignKey('employees.Employee', on_delete=models.SET_NULL, null=True, related_name='managed_projects')
    department = models.ForeignKey('organization.Department', on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    budget_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    actual_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PLANNING)
    priority = models.PositiveSmallIntegerField(default=3)  # 1=Critical, 5=Low
    completion_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    customer = models.ForeignKey('finance.Customer', on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.code} - {self.name}"


class ProjectTask(BaseModel):
    """WBS task within a project."""

    class Status(models.TextChoices):
        NOT_STARTED = 'NOT_STARTED', 'Not Started'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        ON_HOLD = 'ON_HOLD', 'On Hold'
        CANCELLED = 'CANCELLED', 'Cancelled'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    name = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subtasks')
    assigned_to = models.ForeignKey('employees.Employee', on_delete=models.SET_NULL, null=True, blank=True, related_name='project_tasks')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    estimated_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    actual_hours = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_STARTED)
    priority = models.PositiveSmallIntegerField(default=3)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'start_date']

    def __str__(self):
        return f"{self.project.code} - {self.name}"


class Resource(BaseModel):
    """Resource allocation to a project."""

    class Role(models.TextChoices):
        MANAGER = 'MANAGER', 'Manager'
        DEVELOPER = 'DEVELOPER', 'Developer'
        ANALYST = 'ANALYST', 'Analyst'
        TESTER = 'TESTER', 'Tester'
        DESIGNER = 'DESIGNER', 'Designer'
        CONSULTANT = 'CONSULTANT', 'Consultant'
        OTHER = 'OTHER', 'Other'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='resources')
    employee = models.ForeignKey('employees.Employee', on_delete=models.CASCADE, related_name='project_allocations')
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.OTHER)
    allocation_percent = models.DecimalField(max_digits=5, decimal_places=2, default=100)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['project', 'employee']
        unique_together = ['project', 'employee']

    def __str__(self):
        return f"{self.employee} on {self.project.code} ({self.allocation_percent}%)"


class Timesheet(BaseModel):
    """Time tracking entry."""

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        SUBMITTED = 'SUBMITTED', 'Submitted'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'

    employee = models.ForeignKey('employees.Employee', on_delete=models.CASCADE, related_name='timesheets')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='timesheets')
    task = models.ForeignKey(ProjectTask, on_delete=models.SET_NULL, null=True, blank=True, related_name='timesheets')
    date = models.DateField()
    hours = models.DecimalField(max_digits=5, decimal_places=2)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_timesheets')
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.employee} - {self.project.code} ({self.date}: {self.hours}h)"


class ProjectBudget(BaseModel):
    """Project budget line items."""
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='budget_lines')
    account = models.ForeignKey('finance.Account', on_delete=models.PROTECT, related_name='project_budgets')
    description = models.CharField(max_length=300, blank=True)
    budget_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    spent_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    class Meta:
        ordering = ['project', 'account']

    def __str__(self):
        return f"{self.project.code} - {self.account.code}: {self.budget_amount}"


class Milestone(BaseModel):
    """Project milestone."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        IN_PROGRESS = 'IN_PROGRESS', 'In Progress'
        COMPLETED = 'COMPLETED', 'Completed'
        OVERDUE = 'OVERDUE', 'Overdue'
        CANCELLED = 'CANCELLED', 'Cancelled'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='milestones')
    name = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    due_date = models.DateField()
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    completion_date = models.DateField(null=True, blank=True)

    class Meta:
        ordering = ['due_date']

    def __str__(self):
        return f"{self.project.code} - {self.name}"


class ProjectBilling(BaseModel):
    """Project billing record."""

    class BillingType(models.TextChoices):
        TIME_MATERIAL = 'TIME_MATERIAL', 'Time & Material'
        FIXED = 'FIXED', 'Fixed Price'
        MILESTONE = 'MILESTONE', 'Milestone-Based'

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='billings')
    billing_type = models.CharField(max_length=20, choices=BillingType.choices)
    milestone = models.ForeignKey(Milestone, on_delete=models.SET_NULL, null=True, blank=True, related_name='billings')
    customer_invoice = models.ForeignKey('finance.CustomerInvoice', on_delete=models.SET_NULL, null=True, blank=True, related_name='project_billings')
    amount = models.DecimalField(max_digits=15, decimal_places=2)
    billing_date = models.DateField()
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['-billing_date']

    def __str__(self):
        return f"{self.project.code} - {self.billing_type} ({self.amount})"
