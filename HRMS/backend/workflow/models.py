"""
Workflow Engine models for state machine and approval workflows.
"""

from django.db import models
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

from core.models import BaseModel


class WorkflowDefinition(BaseModel):
    """Workflow definition/template."""

    class Type(models.TextChoices):
        APPROVAL = 'APPROVAL', 'Approval Workflow'
        STATE_MACHINE = 'STATE_MACHINE', 'State Machine'
        SEQUENTIAL = 'SEQUENTIAL', 'Sequential'
        PARALLEL = 'PARALLEL', 'Parallel'

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)
    workflow_type = models.CharField(
        max_length=20, choices=Type.choices, default=Type.APPROVAL
    )

    # Associated model
    content_type = models.ForeignKey(
        ContentType, on_delete=models.CASCADE,
        help_text='The model this workflow applies to'
    )

    version = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)

    # Configuration
    require_all_approvers = models.BooleanField(default=False)
    allow_parallel_approval = models.BooleanField(default=False)
    auto_approve_timeout_days = models.PositiveIntegerField(null=True, blank=True)
    notify_on_status_change = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        unique_together = ['code', 'version']

    def __str__(self):
        return f"{self.name} v{self.version}"


class WorkflowState(BaseModel):
    """States in a workflow."""

    class StateType(models.TextChoices):
        START = 'START', 'Start State'
        INTERMEDIATE = 'INTERMEDIATE', 'Intermediate State'
        APPROVAL = 'APPROVAL', 'Approval Required'
        END = 'END', 'End State'
        REJECTED = 'REJECTED', 'Rejected State'
        CANCELLED = 'CANCELLED', 'Cancelled State'

    workflow = models.ForeignKey(
        WorkflowDefinition, on_delete=models.CASCADE, related_name='states'
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    state_type = models.CharField(
        max_length=20, choices=StateType.choices, default=StateType.INTERMEDIATE
    )
    sequence = models.PositiveIntegerField(default=0)

    # Visual positioning (for workflow designer)
    position_x = models.IntegerField(default=0)
    position_y = models.IntegerField(default=0)

    # Actions when entering this state
    on_enter_action = models.TextField(
        blank=True, help_text='Python code or function name to execute on enter'
    )
    on_exit_action = models.TextField(
        blank=True, help_text='Python code or function name to execute on exit'
    )

    # Notifications
    notify_roles = models.JSONField(
        default=list, blank=True,
        help_text='List of role codes to notify when entering this state'
    )
    notify_users = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name='notified_states'
    )

    class Meta:
        ordering = ['workflow', 'sequence']
        unique_together = ['workflow', 'code']

    def __str__(self):
        return f"{self.workflow.name} - {self.name}"


class WorkflowTransition(BaseModel):
    """Transitions between workflow states."""

    workflow = models.ForeignKey(
        WorkflowDefinition, on_delete=models.CASCADE, related_name='transitions'
    )
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50)

    from_state = models.ForeignKey(
        WorkflowState, on_delete=models.CASCADE, related_name='outgoing_transitions'
    )
    to_state = models.ForeignKey(
        WorkflowState, on_delete=models.CASCADE, related_name='incoming_transitions'
    )

    # Conditions
    condition = models.TextField(
        blank=True, help_text='Python expression that must evaluate to True'
    )

    # Permissions
    allowed_roles = models.JSONField(
        default=list, blank=True,
        help_text='List of role codes that can trigger this transition'
    )
    require_comment = models.BooleanField(default=False)

    # Actions
    on_transition_action = models.TextField(
        blank=True, help_text='Python code or function name to execute on transition'
    )

    class Meta:
        ordering = ['workflow', 'from_state', 'to_state']
        unique_together = ['workflow', 'from_state', 'to_state', 'code']

    def __str__(self):
        return f"{self.from_state.name} -> {self.to_state.name} ({self.name})"


class ApprovalLevel(BaseModel):
    """Approval levels for approval workflows."""

    workflow = models.ForeignKey(
        WorkflowDefinition, on_delete=models.CASCADE, related_name='approval_levels'
    )
    state = models.ForeignKey(
        WorkflowState, on_delete=models.CASCADE, related_name='approval_levels'
    )
    level = models.PositiveIntegerField()
    name = models.CharField(max_length=100)

    # Who can approve
    approver_type = models.CharField(
        max_length=20,
        choices=[
            ('ROLE', 'By Role'),
            ('USER', 'Specific User'),
            ('SUPERVISOR', 'Direct Supervisor'),
            ('DEPARTMENT_HEAD', 'Department Head'),
            ('DYNAMIC', 'Dynamic (Field-based)'),
        ]
    )
    approver_role = models.ForeignKey(
        'accounts.Role', on_delete=models.SET_NULL, null=True, blank=True
    )
    approver_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='approval_levels'
    )
    approver_field = models.CharField(
        max_length=100, blank=True,
        help_text='Field path on the object to get approver (e.g., employee.supervisor)'
    )

    # Thresholds
    amount_threshold_min = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True
    )
    amount_threshold_max = models.DecimalField(
        max_digits=15, decimal_places=2, null=True, blank=True
    )
    amount_field = models.CharField(
        max_length=100, blank=True,
        help_text='Field path to the amount field for threshold check'
    )

    # Configuration
    required_approvals = models.PositiveIntegerField(default=1)
    allow_self_approval = models.BooleanField(default=False)
    can_skip = models.BooleanField(default=False)
    skip_if_same_as_previous = models.BooleanField(default=True)

    class Meta:
        ordering = ['workflow', 'level']
        unique_together = ['workflow', 'level']

    def __str__(self):
        return f"{self.workflow.name} - Level {self.level}: {self.name}"


class WorkflowInstance(BaseModel):
    """Instance of a workflow for a specific object."""

    class Status(models.TextChoices):
        ACTIVE = 'ACTIVE', 'Active'
        COMPLETED = 'COMPLETED', 'Completed'
        REJECTED = 'REJECTED', 'Rejected'
        CANCELLED = 'CANCELLED', 'Cancelled'
        SUSPENDED = 'SUSPENDED', 'Suspended'

    workflow = models.ForeignKey(
        WorkflowDefinition, on_delete=models.PROTECT, related_name='instances'
    )

    # Generic relation to any model
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.CharField(max_length=50)
    content_object = GenericForeignKey('content_type', 'object_id')

    current_state = models.ForeignKey(
        WorkflowState, on_delete=models.PROTECT, related_name='current_instances'
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.ACTIVE
    )

    started_at = models.DateTimeField(auto_now_add=True)
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='started_workflows'
    )
    completed_at = models.DateTimeField(null=True, blank=True)

    # Current approval level (for approval workflows)
    current_approval_level = models.PositiveIntegerField(null=True, blank=True)

    # Context data
    context_data = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['content_type', 'object_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.workflow.name} - {self.content_object}"


class WorkflowTransitionLog(BaseModel):
    """Log of state transitions."""

    instance = models.ForeignKey(
        WorkflowInstance, on_delete=models.CASCADE, related_name='transition_logs'
    )
    transition = models.ForeignKey(
        WorkflowTransition, on_delete=models.SET_NULL, null=True, blank=True
    )

    from_state = models.ForeignKey(
        WorkflowState, on_delete=models.SET_NULL,
        null=True, related_name='transition_logs_from'
    )
    to_state = models.ForeignKey(
        WorkflowState, on_delete=models.SET_NULL,
        null=True, related_name='transition_logs_to'
    )

    transitioned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='workflow_transitions'
    )
    transitioned_at = models.DateTimeField(auto_now_add=True)

    comments = models.TextField(blank=True)
    is_automatic = models.BooleanField(default=False)

    class Meta:
        ordering = ['-transitioned_at']


class ApprovalRequest(BaseModel):
    """Approval request within a workflow."""

    class Status(models.TextChoices):
        PENDING = 'PENDING', 'Pending'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        DELEGATED = 'DELEGATED', 'Delegated'
        SKIPPED = 'SKIPPED', 'Skipped'
        EXPIRED = 'EXPIRED', 'Expired'

    instance = models.ForeignKey(
        WorkflowInstance, on_delete=models.CASCADE, related_name='approval_requests'
    )
    approval_level = models.ForeignKey(
        ApprovalLevel, on_delete=models.SET_NULL, null=True
    )
    level_number = models.PositiveIntegerField()

    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, related_name='assigned_approvals'
    )
    assigned_role = models.ForeignKey(
        'accounts.Role', on_delete=models.SET_NULL, null=True, blank=True
    )

    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING
    )

    requested_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateTimeField(null=True, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    responded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='responded_approvals'
    )

    comments = models.TextField(blank=True)

    # Delegation
    delegated_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='delegated_approvals'
    )
    delegated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='delegated_from_approvals'
    )
    delegation_reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-requested_at']
        indexes = [
            models.Index(fields=['assigned_to', 'status']),
        ]


class ApprovalDelegation(BaseModel):
    """Delegation settings for approvals."""

    delegator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='delegations_given'
    )
    delegate = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='delegations_received'
    )

    workflow = models.ForeignKey(
        WorkflowDefinition, on_delete=models.CASCADE,
        null=True, blank=True,
        help_text='If null, applies to all workflows'
    )

    start_date = models.DateField()
    end_date = models.DateField()
    is_active = models.BooleanField(default=True)
    reason = models.TextField(blank=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.delegator} -> {self.delegate}"


class WorkflowNotification(BaseModel):
    """Notifications for workflow events."""

    class EventType(models.TextChoices):
        STATE_CHANGE = 'STATE_CHANGE', 'State Changed'
        APPROVAL_REQUIRED = 'APPROVAL_REQUIRED', 'Approval Required'
        APPROVED = 'APPROVED', 'Approved'
        REJECTED = 'REJECTED', 'Rejected'
        COMPLETED = 'COMPLETED', 'Workflow Completed'
        REMINDER = 'REMINDER', 'Reminder'
        ESCALATION = 'ESCALATION', 'Escalation'

    instance = models.ForeignKey(
        WorkflowInstance, on_delete=models.CASCADE, related_name='notifications'
    )
    event_type = models.CharField(max_length=20, choices=EventType.choices)

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='workflow_notifications'
    )
    message = models.TextField()

    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    is_email_sent = models.BooleanField(default=False)
    email_sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']


class EscalationRule(BaseModel):
    """Rules for escalating pending approvals."""

    approval_level = models.ForeignKey(
        ApprovalLevel, on_delete=models.CASCADE, related_name='escalation_rules'
    )

    hours_until_escalation = models.PositiveIntegerField(default=48)
    escalate_to_type = models.CharField(
        max_length=20,
        choices=[
            ('NEXT_LEVEL', 'Next Approval Level'),
            ('SUPERVISOR', 'Supervisor'),
            ('SPECIFIC_USER', 'Specific User'),
            ('ROLE', 'Role'),
        ]
    )
    escalate_to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='escalation_targets'
    )
    escalate_to_role = models.ForeignKey(
        'accounts.Role', on_delete=models.SET_NULL, null=True, blank=True
    )

    max_escalations = models.PositiveIntegerField(default=3)
    notify_original_approver = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['approval_level', 'hours_until_escalation']
