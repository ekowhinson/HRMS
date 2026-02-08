"""
Approval Engine — core service for multi-level approval workflows.
"""

import logging
from django.db import transaction
from django.contrib.contenttypes.models import ContentType
from django.utils import timezone

from .models import (
    WorkflowDefinition,
    WorkflowState,
    WorkflowInstance,
    ApprovalLevel,
    ApprovalRequest,
    ApprovalDelegation,
    WorkflowTransitionLog,
    ApproverType,
)

logger = logging.getLogger(__name__)


class ApprovalEngineError(Exception):
    pass


class ApprovalEngine:
    """
    Service class that drives multi-level approval workflows.
    """

    # ── Public API ────────────────────────────────────────────────

    @classmethod
    @transaction.atomic
    def start_approval(cls, obj, workflow_code, started_by):
        """
        Start an approval workflow for *obj*.

        Creates a WorkflowInstance, auto-generates states if needed,
        and assigns the first ApprovalRequest.

        Returns the WorkflowInstance.
        """
        workflow = WorkflowDefinition.objects.filter(
            code=workflow_code, is_active=True
        ).order_by('-version').first()

        if not workflow:
            raise ApprovalEngineError(f"No active workflow with code '{workflow_code}'")

        ct = ContentType.objects.get_for_model(obj)

        # Abort if there's already an active workflow for this object
        existing = WorkflowInstance.objects.filter(
            workflow=workflow,
            content_type=ct,
            object_id=str(obj.pk),
            status=WorkflowInstance.Status.ACTIVE,
        ).first()
        if existing:
            raise ApprovalEngineError(
                f"An active workflow already exists for this object (instance {existing.pk})"
            )

        levels = workflow.approval_levels.order_by('level')
        if not levels.exists():
            raise ApprovalEngineError(
                f"Workflow '{workflow_code}' has no approval levels configured"
            )

        # Ensure workflow states exist (auto-create for approval workflows)
        start_state = cls._ensure_states(workflow)

        # Find the first approval state
        first_approval_state = WorkflowState.objects.filter(
            workflow=workflow,
            state_type=WorkflowState.StateType.APPROVAL,
        ).order_by('sequence').first()

        instance = WorkflowInstance.objects.create(
            workflow=workflow,
            content_type=ct,
            object_id=str(obj.pk),
            current_state=first_approval_state or start_state,
            status=WorkflowInstance.Status.ACTIVE,
            started_by=started_by,
            current_approval_level=1,
        )

        # Resolve the requesting employee (for approver resolution)
        employee = cls._get_employee_for_user(started_by)

        # Create the first approval request, skipping levels as needed
        cls._create_next_request(instance, employee, start_level=1)

        return instance

    @classmethod
    def resolve_approver(cls, employee, approval_level):
        """
        Given a requesting employee and an ApprovalLevel, resolve
        the actual User who should approve.  Returns None if unresolvable.
        """
        approver_type = approval_level.approver_type

        try:
            if approver_type == ApproverType.SUPERVISOR:
                if employee and employee.supervisor:
                    return employee.supervisor.user
                return None

            elif approver_type == ApproverType.DEPARTMENT_HEAD:
                if employee and employee.department and employee.department.head:
                    return employee.department.head.user
                return None

            elif approver_type == ApproverType.DISTRICT_HEAD:
                if (employee and employee.work_location
                        and employee.work_location.organization_unit
                        and employee.work_location.organization_unit.head):
                    return employee.work_location.organization_unit.head.user
                return None

            elif approver_type == ApproverType.REGIONAL_DIRECTOR:
                if employee and employee.work_location and employee.work_location.organization_unit:
                    unit = employee.work_location.organization_unit
                    # Walk up the parent chain to find unit_type=REGION
                    while unit:
                        if unit.unit_type == 'REGION' and unit.head:
                            return unit.head.user
                        unit = unit.parent
                return None

            elif approver_type == ApproverType.DIRECTORATE_HEAD:
                if employee and employee.directorate and employee.directorate.head:
                    return employee.directorate.head.user
                return None

            elif approver_type == ApproverType.DIVISION_HEAD:
                if employee and employee.division and employee.division.head:
                    return employee.division.head.user
                return None

            elif approver_type == ApproverType.DCE:
                return cls._resolve_role_user('DCE', employee)

            elif approver_type == ApproverType.CEO:
                return cls._resolve_role_user('CEO')

            elif approver_type == ApproverType.ROLE:
                if approval_level.approver_role:
                    return cls._resolve_role_user(approval_level.approver_role.code)
                return None

            elif approver_type == ApproverType.USER:
                return approval_level.approver_user

            elif approver_type == ApproverType.DYNAMIC:
                if approval_level.approver_field and employee:
                    return cls._resolve_dynamic_field(employee, approval_level.approver_field)
                return None

            return None

        except Exception:
            logger.exception(
                "Error resolving approver for level %s (type=%s)",
                approval_level.level, approver_type,
            )
            return None

    @classmethod
    @transaction.atomic
    def process_action(cls, approval_request_id, action, user, comments=''):
        """
        Process an APPROVE / REJECT / DELEGATE / RETURN action.
        """
        try:
            request = ApprovalRequest.objects.select_related(
                'instance', 'instance__workflow', 'approval_level',
            ).get(pk=approval_request_id)
        except ApprovalRequest.DoesNotExist:
            raise ApprovalEngineError("Approval request not found")

        if request.status != ApprovalRequest.Status.PENDING:
            raise ApprovalEngineError(
                f"Cannot process action on request with status '{request.status}'"
            )

        instance = request.instance
        if instance.status != WorkflowInstance.Status.ACTIVE:
            raise ApprovalEngineError("Workflow instance is not active")

        # Verify the user is authorized to act
        if not cls._user_can_act(request, user):
            raise ApprovalEngineError("You are not authorized to act on this request")

        action = action.upper()

        if action == 'APPROVE':
            return cls._handle_approve(request, instance, user, comments)
        elif action == 'REJECT':
            return cls._handle_reject(request, instance, user, comments)
        elif action == 'RETURN':
            return cls._handle_return(request, instance, user, comments)
        elif action == 'DELEGATE':
            raise ApprovalEngineError("Use the delegate() method for delegation")
        else:
            raise ApprovalEngineError(f"Unknown action '{action}'")

    @classmethod
    def get_pending_for_user(cls, user):
        """
        Return all PENDING ApprovalRequests assigned to *user*,
        including those via delegation.
        """
        from django.db.models import Q
        now = timezone.now().date()

        # Direct assignments
        q = Q(assigned_to=user, status=ApprovalRequest.Status.PENDING)

        # Delegated assignments: check active delegations where user is the delegate
        delegations = ApprovalDelegation.objects.filter(
            delegate=user,
            is_active=True,
            start_date__lte=now,
            end_date__gte=now,
        ).values_list('delegator_id', flat=True)

        if delegations:
            q |= Q(assigned_to__in=delegations, status=ApprovalRequest.Status.PENDING)

        # Role-based: requests assigned to a role the user has
        user_role_ids = cls._get_user_role_ids(user)
        if user_role_ids:
            q |= Q(
                assigned_role__in=user_role_ids,
                assigned_to__isnull=True,
                status=ApprovalRequest.Status.PENDING,
            )

        return (
            ApprovalRequest.objects
            .filter(q, instance__status=WorkflowInstance.Status.ACTIVE)
            .select_related(
                'instance', 'instance__workflow', 'instance__content_type',
                'approval_level', 'assigned_to',
            )
            .order_by('-requested_at')
        )

    @classmethod
    def get_approval_status(cls, content_type_str, object_id):
        """
        Return the WorkflowInstance for a given object,
        together with its approval_requests timeline.
        """
        try:
            app_label, model = content_type_str.split('.')
            ct = ContentType.objects.get(app_label=app_label, model=model)
        except (ValueError, ContentType.DoesNotExist):
            return None

        return (
            WorkflowInstance.objects
            .filter(content_type=ct, object_id=str(object_id))
            .prefetch_related('approval_requests', 'approval_requests__assigned_to')
            .order_by('-started_at')
            .first()
        )

    @classmethod
    @transaction.atomic
    def delegate(cls, approval_request_id, from_user, to_user, reason=''):
        """
        Delegate a pending approval request to another user.
        """
        try:
            request = ApprovalRequest.objects.select_related('instance').get(
                pk=approval_request_id,
            )
        except ApprovalRequest.DoesNotExist:
            raise ApprovalEngineError("Approval request not found")

        if request.status != ApprovalRequest.Status.PENDING:
            raise ApprovalEngineError("Can only delegate pending requests")

        if not cls._user_can_act(request, from_user):
            raise ApprovalEngineError("You are not authorized to delegate this request")

        request.status = ApprovalRequest.Status.DELEGATED
        request.delegated_to = to_user
        request.delegated_by = from_user
        request.delegation_reason = reason
        request.responded_at = timezone.now()
        request.responded_by = from_user
        request.save()

        # Create a new pending request for the delegate
        new_request = ApprovalRequest.objects.create(
            instance=request.instance,
            approval_level=request.approval_level,
            level_number=request.level_number,
            assigned_to=to_user,
            status=ApprovalRequest.Status.PENDING,
            comments=f"Delegated from {from_user.full_name}: {reason}",
        )
        return new_request

    @classmethod
    @transaction.atomic
    def cancel(cls, content_type_str, object_id, user):
        """
        Cancel a running workflow instance.
        """
        try:
            app_label, model = content_type_str.split('.')
            ct = ContentType.objects.get(app_label=app_label, model=model)
        except (ValueError, ContentType.DoesNotExist):
            raise ApprovalEngineError("Invalid content type")

        instance = WorkflowInstance.objects.filter(
            content_type=ct,
            object_id=str(object_id),
            status=WorkflowInstance.Status.ACTIVE,
        ).first()

        if not instance:
            raise ApprovalEngineError("No active workflow instance found")

        # Cancel all pending requests
        instance.approval_requests.filter(
            status=ApprovalRequest.Status.PENDING,
        ).update(status=ApprovalRequest.Status.SKIPPED)

        cancelled_state = WorkflowState.objects.filter(
            workflow=instance.workflow,
            state_type=WorkflowState.StateType.CANCELLED,
        ).first()

        old_state = instance.current_state
        if cancelled_state:
            instance.current_state = cancelled_state

        instance.status = WorkflowInstance.Status.CANCELLED
        instance.completed_at = timezone.now()
        instance.save()

        WorkflowTransitionLog.objects.create(
            instance=instance,
            from_state=old_state,
            to_state=cancelled_state,
            transitioned_by=user,
            comments='Workflow cancelled',
        )

        return instance

    # ── Internal Helpers ──────────────────────────────────────────

    @classmethod
    def _ensure_states(cls, workflow):
        """
        For APPROVAL-type workflows, auto-create the standard
        START / APPROVAL / END / REJECTED / CANCELLED states if missing.
        """
        defaults = [
            ('START', 'Submitted', WorkflowState.StateType.START, 0),
            ('APPROVAL', 'Pending Approval', WorkflowState.StateType.APPROVAL, 10),
            ('END', 'Approved', WorkflowState.StateType.END, 90),
            ('REJECTED', 'Rejected', WorkflowState.StateType.REJECTED, 95),
            ('CANCELLED', 'Cancelled', WorkflowState.StateType.CANCELLED, 99),
        ]
        start_state = None
        for code, name, stype, seq in defaults:
            state, _ = WorkflowState.objects.get_or_create(
                workflow=workflow, code=code,
                defaults={'name': name, 'state_type': stype, 'sequence': seq},
            )
            if stype == WorkflowState.StateType.START:
                start_state = state
        return start_state

    @classmethod
    def _get_employee_for_user(cls, user):
        """Return the Employee linked to a user, or None."""
        if user is None:
            return None
        try:
            return user.employee
        except Exception:
            return None

    @classmethod
    def _create_next_request(cls, instance, employee, start_level=1):
        """
        Create an ApprovalRequest for the next applicable level,
        auto-skipping levels that resolve to None or same approver.
        """
        levels = instance.workflow.approval_levels.filter(
            level__gte=start_level,
        ).order_by('level')

        prev_approver = None
        # Get the approver from the previous level if we're past level 1
        if start_level > 1:
            prev_req = instance.approval_requests.filter(
                status=ApprovalRequest.Status.APPROVED,
            ).order_by('-level_number').first()
            if prev_req:
                prev_approver = prev_req.responded_by or prev_req.assigned_to

        for level in levels:
            approver = cls.resolve_approver(employee, level)

            # Skip logic
            if approver is None and level.can_skip:
                cls._record_skip(instance, level, 'No approver resolved')
                continue

            if (
                approver and prev_approver
                and approver.pk == prev_approver.pk
                and level.skip_if_same_as_previous
            ):
                cls._record_skip(instance, level, 'Same as previous approver')
                prev_approver = approver
                continue

            if approver is None and not level.can_skip:
                # Can't skip and no approver — assign to role if available
                pass

            # Determine the approval state
            approval_state = WorkflowState.objects.filter(
                workflow=instance.workflow,
                state_type=WorkflowState.StateType.APPROVAL,
            ).first()

            if approval_state and instance.current_state != approval_state:
                instance.current_state = approval_state
            instance.current_approval_level = level.level
            instance.save(update_fields=['current_state', 'current_approval_level', 'updated_at'])

            ApprovalRequest.objects.create(
                instance=instance,
                approval_level=level,
                level_number=level.level,
                assigned_to=approver,
                assigned_role=level.approver_role if not approver else None,
                status=ApprovalRequest.Status.PENDING,
            )
            return  # Created a request, done

        # If we reach here, all levels were skipped — complete the workflow
        cls._complete_workflow(instance, auto=True)

    @classmethod
    def _record_skip(cls, instance, level, reason):
        """Record a skipped approval level."""
        ApprovalRequest.objects.create(
            instance=instance,
            approval_level=level,
            level_number=level.level,
            status=ApprovalRequest.Status.SKIPPED,
            comments=reason,
        )

    @classmethod
    def _handle_approve(cls, request, instance, user, comments):
        """Handle an APPROVE action."""
        request.status = ApprovalRequest.Status.APPROVED
        request.responded_at = timezone.now()
        request.responded_by = user
        request.comments = comments
        request.save()

        # Log transition
        WorkflowTransitionLog.objects.create(
            instance=instance,
            from_state=instance.current_state,
            to_state=instance.current_state,
            transitioned_by=user,
            comments=f"Level {request.level_number} approved: {comments}",
        )

        # Check if there are more levels
        max_level = instance.workflow.approval_levels.order_by('-level').first()
        if max_level and request.level_number < max_level.level:
            employee = cls._get_employee_for_user(instance.started_by)
            cls._create_next_request(
                instance, employee, start_level=request.level_number + 1
            )
        else:
            cls._complete_workflow(instance)

        return request

    @classmethod
    def _handle_reject(cls, request, instance, user, comments):
        """Handle a REJECT action."""
        request.status = ApprovalRequest.Status.REJECTED
        request.responded_at = timezone.now()
        request.responded_by = user
        request.comments = comments
        request.save()

        rejected_state = WorkflowState.objects.filter(
            workflow=instance.workflow,
            state_type=WorkflowState.StateType.REJECTED,
        ).first()

        old_state = instance.current_state
        if rejected_state:
            instance.current_state = rejected_state

        instance.status = WorkflowInstance.Status.REJECTED
        instance.completed_at = timezone.now()
        instance.save()

        WorkflowTransitionLog.objects.create(
            instance=instance,
            from_state=old_state,
            to_state=rejected_state,
            transitioned_by=user,
            comments=f"Rejected at level {request.level_number}: {comments}",
        )

        return request

    @classmethod
    def _handle_return(cls, request, instance, user, comments):
        """Handle a RETURN action — send back to previous level or originator."""
        request.status = ApprovalRequest.Status.REJECTED
        request.responded_at = timezone.now()
        request.responded_by = user
        request.comments = f"Returned: {comments}"
        request.save()

        # If level 1, treat like reject
        if request.level_number <= 1:
            return cls._handle_reject(request, instance, user, comments)

        # Otherwise, go back one level
        employee = cls._get_employee_for_user(instance.started_by)
        cls._create_next_request(
            instance, employee, start_level=request.level_number - 1
        )

        WorkflowTransitionLog.objects.create(
            instance=instance,
            from_state=instance.current_state,
            to_state=instance.current_state,
            transitioned_by=user,
            comments=f"Returned from level {request.level_number}: {comments}",
        )

        return request

    @classmethod
    def _complete_workflow(cls, instance, auto=False):
        """Mark a workflow instance as completed."""
        end_state = WorkflowState.objects.filter(
            workflow=instance.workflow,
            state_type=WorkflowState.StateType.END,
        ).first()

        old_state = instance.current_state
        if end_state:
            instance.current_state = end_state
        instance.status = WorkflowInstance.Status.COMPLETED
        instance.completed_at = timezone.now()
        instance.save()

        WorkflowTransitionLog.objects.create(
            instance=instance,
            from_state=old_state,
            to_state=end_state,
            transitioned_by=instance.started_by,
            comments='All approval levels completed' if not auto else 'Auto-completed (all levels skipped)',
            is_automatic=auto,
        )

    @classmethod
    def _user_can_act(cls, request, user):
        """Check if *user* is authorized to act on this request."""
        # Direct assignment
        if request.assigned_to and request.assigned_to.pk == user.pk:
            return True

        # Role-based assignment
        if request.assigned_role and not request.assigned_to:
            user_role_ids = cls._get_user_role_ids(user)
            if request.assigned_role.pk in user_role_ids:
                return True

        # Active delegation
        now = timezone.now().date()
        if request.assigned_to:
            has_delegation = ApprovalDelegation.objects.filter(
                delegator=request.assigned_to,
                delegate=user,
                is_active=True,
                start_date__lte=now,
                end_date__gte=now,
            ).exists()
            if has_delegation:
                return True

        # Superuser can always act
        if user.is_superuser:
            return True

        return False

    @classmethod
    def _resolve_role_user(cls, role_code, employee=None):
        """
        Find a User who holds the given role code.
        If employee is provided, try to scope to the employee's division.
        """
        from accounts.models import UserRole

        qs = UserRole.objects.filter(
            role__code=role_code,
            role__is_active=True,
            is_active=True,
        ).select_related('user')

        # Try scoped first
        if employee and employee.division:
            scoped = qs.filter(scope_id=employee.division.pk).first()
            if scoped:
                return scoped.user

        # Fallback to global
        global_match = qs.filter(scope_type='global').first()
        if global_match:
            return global_match.user

        # Any match
        first = qs.first()
        return first.user if first else None

    @classmethod
    def _resolve_dynamic_field(cls, employee, field_path):
        """
        Walk a dot-separated field path on the employee to find a User.
        e.g. 'supervisor.user' → employee.supervisor.user
        """
        obj = employee
        for part in field_path.split('.'):
            if obj is None:
                return None
            obj = getattr(obj, part, None)
        return obj

    @classmethod
    def _get_user_role_ids(cls, user):
        """Return a list of Role PKs the user currently holds."""
        from accounts.models import UserRole
        return list(
            UserRole.objects.filter(
                user=user, is_active=True,
            ).values_list('role_id', flat=True)
        )
