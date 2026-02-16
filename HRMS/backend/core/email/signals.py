"""
Signal receivers for email notifications across all HRMS modules.

Uses pre_save to capture previous status, then post_save to detect
actual status transitions and trigger appropriate emails.
"""

import logging

from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver

from core.email.events import EmailEvent

logger = logging.getLogger(__name__)


def _get_email_for_employee(employee):
    """Get the best email address for an employee."""
    if hasattr(employee, 'user') and employee.user and employee.user.email:
        return employee.user.email
    if hasattr(employee, 'work_email') and employee.work_email:
        return employee.work_email
    if hasattr(employee, 'personal_email') and employee.personal_email:
        return employee.personal_email
    return None


def _get_user_for_employee(employee):
    """Get the User instance for an employee."""
    if hasattr(employee, 'user') and employee.user:
        return employee.user
    return None


def _send(event, email, context, user=None, sync=False):
    """Safe wrapper around send_email that handles import and errors."""
    if not email:
        return
    try:
        from core.email.service import send_email
        send_email(
            event=event,
            recipient_email=email,
            context=context,
            recipient_user=user,
            sync=sync,
        )
    except Exception as e:
        logger.warning("Failed to queue email %s to %s: %s", event.name, email, e)


def _capture_previous_status(sender, instance, **kwargs):
    """Generic pre_save handler to capture previous status."""
    if instance.pk:
        try:
            instance._previous_status = (
                sender.objects.all_objects.values_list('status', flat=True).get(pk=instance.pk)
            )
        except sender.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


# ── Payroll ──────────────────────────────────────────────────────────────────

@receiver(post_save, sender='payroll.Payslip')
def payslip_post_save(sender, instance, created, **kwargs):
    if not created:
        return
    payroll_item = getattr(instance, 'payroll_item', None)
    if not payroll_item:
        return
    employee = getattr(payroll_item, 'employee', None)
    if not employee:
        return
    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)
    period = getattr(payroll_item, 'payroll_period', None)
    _send(EmailEvent.PAYSLIP_READY, emp_email, {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'period': str(period) if period else '',
        'payslip_number': getattr(instance, 'payslip_number', ''),
    }, user=emp_user)


@receiver(pre_save, sender='payroll.AdHocPayment')
def adhoc_payment_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='payroll.AdHocPayment')
def adhoc_payment_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    if not prev or prev == instance.status:
        return
    if instance.status not in ('APPROVED', 'PROCESSED'):
        return
    employee = getattr(instance, 'employee', None)
    if not employee:
        return
    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)
    _send(EmailEvent.SALARY_ADJUSTMENT, emp_email, {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'payment_type': getattr(instance, 'payment_type', ''),
        'amount': str(getattr(instance, 'amount', '')),
        'description': getattr(instance, 'description', ''),
    }, user=emp_user)


# ── Employee Lifecycle ──────────────────────────────────────────────────────

@receiver(post_save, sender='employees.EmploymentHistory')
def employment_history_post_save(sender, instance, created, **kwargs):
    if not created:
        return
    employee = getattr(instance, 'employee', None)
    if not employee:
        return
    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)
    change_type = getattr(instance, 'change_type', '')

    base_ctx = {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'effective_date': str(getattr(instance, 'effective_date', '')),
    }

    if change_type == 'PROMOTION':
        _send(EmailEvent.PROMOTION, emp_email, {
            **base_ctx,
            'new_position': str(getattr(instance, 'new_position', '')),
            'new_grade': str(getattr(instance, 'new_grade', '')),
        }, user=emp_user)
    elif change_type == 'TRANSFER':
        _send(EmailEvent.TRANSFER, emp_email, {
            **base_ctx,
            'new_department': str(getattr(instance, 'new_department', '')),
            'new_position': str(getattr(instance, 'new_position', '')),
        }, user=emp_user)
    elif change_type == 'CONTRACT_RENEWAL':
        _send(EmailEvent.CONTRACT_RENEWAL, emp_email, {
            **base_ctx,
            'end_date': str(getattr(instance, 'end_date', '')),
        }, user=emp_user)
    elif change_type == 'HIRE':
        _send(EmailEvent.WELCOME_ONBOARDING, emp_email, {
            **base_ctx,
            'new_position': str(getattr(instance, 'new_position', '')),
            'new_department': str(getattr(instance, 'new_department', '')),
        }, user=emp_user)


# ── Recruitment (Offers) ────────────────────────────────────────────────────

@receiver(pre_save, sender='recruitment.JobOffer')
def job_offer_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='recruitment.JobOffer')
def job_offer_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    if not prev or prev == instance.status:
        return

    applicant = getattr(instance, 'applicant', None)
    if not applicant:
        return
    applicant_name = getattr(applicant, 'full_name', f"{getattr(applicant, 'first_name', '')} {getattr(applicant, 'last_name', '')}")
    position = str(getattr(instance, 'position', ''))

    # Offer accepted — notify HR / hiring manager
    if instance.status == 'ACCEPTED':
        created_by = getattr(instance, 'created_by', None)
        if created_by and created_by.email:
            _send(EmailEvent.OFFER_ACCEPTED, created_by.email, {
                'applicant_name': applicant_name,
                'position': position,
                'proposed_start_date': str(getattr(instance, 'proposed_start_date', '')),
            }, user=created_by)

    # Offer declined — notify HR / hiring manager
    elif instance.status == 'DECLINED':
        created_by = getattr(instance, 'created_by', None)
        if created_by and created_by.email:
            _send(EmailEvent.OFFER_DECLINED, created_by.email, {
                'applicant_name': applicant_name,
                'position': position,
                'decline_reason': getattr(instance, 'decline_reason', ''),
            }, user=created_by)


# ── Leave ────────────────────────────────────────────────────────────────────

@receiver(pre_save, sender='leave.LeaveRequest')
def leave_request_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='leave.LeaveRequest')
def leave_request_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    employee = instance.employee
    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)

    base_ctx = {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'leave_type': str(getattr(instance, 'leave_type', '')),
        'start_date': str(getattr(instance, 'start_date', '')),
        'end_date': str(getattr(instance, 'end_date', '')),
        'days': str(getattr(instance, 'total_days', getattr(instance, 'days_requested', ''))),
    }

    if created and instance.status == 'PENDING':
        # Notify supervisor
        supervisor = getattr(employee, 'supervisor', None)
        if supervisor:
            sup_email = _get_email_for_employee(supervisor)
            sup_user = _get_user_for_employee(supervisor)
            _send(EmailEvent.LEAVE_SUBMITTED, sup_email, {
                **base_ctx,
                'supervisor_name': getattr(supervisor, 'full_name', ''),
            }, user=sup_user)
    elif prev and prev != instance.status:
        if instance.status == 'APPROVED':
            _send(EmailEvent.LEAVE_APPROVED, emp_email, {
                **base_ctx,
                'approved_by': str(getattr(instance, 'approved_by', '')),
            }, user=emp_user)
        elif instance.status == 'REJECTED':
            _send(EmailEvent.LEAVE_REJECTED, emp_email, {
                **base_ctx,
                'rejection_reason': getattr(instance, 'rejection_reason', ''),
                'rejected_by': str(getattr(instance, 'approved_by', '')),
            }, user=emp_user)
        elif instance.status == 'CANCELLED':
            _send(EmailEvent.LEAVE_CANCELLED, emp_email, base_ctx, user=emp_user)


# ── Workflow ─────────────────────────────────────────────────────────────────

@receiver(pre_save, sender='workflow.ApprovalRequest')
def approval_request_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='workflow.ApprovalRequest')
def approval_request_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)

    # Get the workflow instance for context
    wf_instance = getattr(instance, 'instance', None)
    request_type = ''
    if wf_instance:
        request_type = str(getattr(wf_instance, 'content_type', getattr(wf_instance, 'workflow', '')))

    if created and instance.status == 'PENDING':
        assigned = instance.assigned_to
        if assigned and assigned.email:
            _send(EmailEvent.APPROVAL_REQUESTED, assigned.email, {
                'approver_name': assigned.get_full_name(),
                'request_type': request_type,
                'requester_name': str(getattr(wf_instance, 'initiated_by', '')),
                'description': str(getattr(wf_instance, 'description', '')),
                'due_date': str(getattr(instance, 'due_date', '')),
            }, user=assigned)
    elif prev and prev != instance.status:
        # Notify the workflow initiator
        initiator = getattr(wf_instance, 'initiated_by', None) if wf_instance else None
        if initiator and initiator.email:
            ctx = {
                'requester_name': initiator.get_full_name(),
                'request_type': request_type,
            }
            if instance.status == 'APPROVED':
                ctx['approved_by'] = str(getattr(instance, 'responded_by', ''))
                _send(EmailEvent.WORKFLOW_APPROVED, initiator.email, ctx, user=initiator)
            elif instance.status == 'REJECTED':
                ctx['rejected_by'] = str(getattr(instance, 'responded_by', ''))
                ctx['rejection_reason'] = getattr(instance, 'comments', '')
                _send(EmailEvent.WORKFLOW_REJECTED, initiator.email, ctx, user=initiator)
            elif instance.status == 'DELEGATED':
                delegated_to = getattr(instance, 'delegated_to', None)
                if delegated_to and delegated_to.email:
                    _send(EmailEvent.WORKFLOW_DELEGATED, delegated_to.email, {
                        'delegate_name': delegated_to.get_full_name(),
                        'request_type': request_type,
                        'delegated_by': str(getattr(instance, 'delegated_by', '')),
                    }, user=delegated_to)


@receiver(post_save, sender='workflow.WorkflowNotification')
def workflow_notification_post_save(sender, instance, created, **kwargs):
    if not created:
        return
    event_type = getattr(instance, 'event_type', '')
    recipient = getattr(instance, 'recipient', None)
    if not recipient or not recipient.email:
        return

    wf_instance = getattr(instance, 'instance', None)
    request_type = ''
    if wf_instance:
        request_type = str(getattr(wf_instance, 'content_type', getattr(wf_instance, 'workflow', '')))

    if event_type == 'ESCALATION':
        _send(EmailEvent.WORKFLOW_ESCALATED, recipient.email, {
            'approver_name': recipient.get_full_name(),
            'request_type': request_type,
            'escalation_reason': getattr(instance, 'message', ''),
        }, user=recipient)
    elif event_type == 'COMPLETED':
        _send(EmailEvent.WORKFLOW_COMPLETED, recipient.email, {
            'requester_name': recipient.get_full_name(),
            'request_type': request_type,
            'final_status': 'Completed',
        }, user=recipient)


# ── Recruitment ──────────────────────────────────────────────────────────────

@receiver(pre_save, sender='recruitment.Applicant')
def applicant_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='recruitment.Applicant')
def applicant_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    if not prev or prev == instance.status:
        return

    email = getattr(instance, 'email', None)
    if not email:
        return

    vacancy = getattr(instance, 'vacancy', None)
    position = str(getattr(vacancy, 'job_title', '')) if vacancy else ''
    name = f"{instance.first_name} {instance.last_name}"

    base_ctx = {'applicant_name': name, 'position': position}

    status_event_map = {
        'SHORTLISTED': EmailEvent.SHORTLISTED,
        'INTERVIEW': EmailEvent.INTERVIEW_SCHEDULED,
        'OFFER': EmailEvent.OFFER_MADE,
        'REJECTED': EmailEvent.APPLICATION_REJECTED,
    }

    event = status_event_map.get(instance.status)
    if event:
        ctx = {**base_ctx}
        if instance.status == 'INTERVIEW':
            # Get interview details from the related Interview model
            interview = instance.interviews.order_by('-scheduled_date').first() if hasattr(instance, 'interviews') else None
            ctx['interview_date'] = str(getattr(interview, 'scheduled_date', '')) if interview else ''
            ctx['interview_time'] = str(getattr(interview, 'scheduled_time', '')) if interview else ''
            ctx['interview_type'] = getattr(interview, 'interview_type', '') if interview else ''
            ctx['location'] = getattr(interview, 'location', '') if interview else ''
        _send(event, email, ctx)


# ── Performance ──────────────────────────────────────────────────────────────

@receiver(pre_save, sender='performance.Appraisal')
def appraisal_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='performance.Appraisal')
def appraisal_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    employee = getattr(instance, 'employee', None)
    manager = getattr(instance, 'manager', None)
    if not employee:
        return

    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)
    cycle = getattr(instance, 'cycle', None)
    cycle_name = str(cycle) if cycle else ''

    base_ctx = {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'cycle_name': cycle_name,
    }

    if created:
        _send(EmailEvent.APPRAISAL_SCHEDULED, emp_email, {
            **base_ctx,
            'start_date': str(getattr(cycle, 'start_date', '')) if cycle else '',
            'end_date': str(getattr(cycle, 'end_date', '')) if cycle else '',
        }, user=emp_user)
    elif prev and prev != instance.status:
        if instance.status == 'MANAGER_REVIEW' and manager:
            mgr_email = _get_email_for_employee(manager)
            mgr_user = _get_user_for_employee(manager)
            _send(EmailEvent.APPRAISAL_SUBMITTED, mgr_email, {
                **base_ctx,
                'submitted_date': str(getattr(instance, 'updated_at', '')),
            }, user=mgr_user)
        elif instance.status in ('COMPLETED', 'ACKNOWLEDGED'):
            _send(EmailEvent.APPRAISAL_APPROVED, emp_email, {
                **base_ctx,
                'overall_rating': str(getattr(instance, 'overall_rating', '')),
            }, user=emp_user)


@receiver(post_save, sender='performance.TrainingNeed')
def training_need_post_save(sender, instance, created, **kwargs):
    if not created:
        return
    employee = getattr(instance, 'employee', None)
    if not employee:
        return
    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)
    _send(EmailEvent.TRAINING_NEED_IDENTIFIED, emp_email, {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'skill_area': getattr(instance, 'title', getattr(instance, 'skill_area', '')),
        'priority': getattr(instance, 'priority', ''),
    }, user=emp_user)


# ── Discipline ───────────────────────────────────────────────────────────────

@receiver(pre_save, sender='discipline.Grievance')
def grievance_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='discipline.Grievance')
def grievance_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    employee = getattr(instance, 'employee', None)
    if not employee:
        return

    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)
    base_ctx = {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'grievance_number': getattr(instance, 'grievance_number', ''),
    }

    if created and instance.status == 'SUBMITTED':
        _send(EmailEvent.GRIEVANCE_SUBMITTED, emp_email, {
            **base_ctx,
            'subject': getattr(instance, 'subject', ''),
            'submitted_date': str(getattr(instance, 'submitted_date', '')),
        }, user=emp_user)
    elif prev and prev != instance.status:
        if instance.status == 'ACKNOWLEDGED':
            _send(EmailEvent.GRIEVANCE_ACKNOWLEDGED, emp_email, {
                **base_ctx,
                'acknowledged_by': str(getattr(instance, 'assigned_to', '')),
                'acknowledged_date': str(getattr(instance, 'acknowledged_date', '')),
            }, user=emp_user)
        elif instance.status == 'RESOLVED':
            _send(EmailEvent.GRIEVANCE_RESOLVED, emp_email, {
                **base_ctx,
                'resolution_summary': getattr(instance, 'resolution_notes', ''),
            }, user=emp_user)


@receiver(pre_save, sender='discipline.DisciplinaryCase')
def disciplinary_case_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='discipline.DisciplinaryCase')
def disciplinary_case_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    if not prev or prev == instance.status:
        return

    employee = getattr(instance, 'employee', None)
    if not employee:
        return
    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)
    case_number = getattr(instance, 'case_number', '')
    base_ctx = {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'case_number': case_number,
    }

    if instance.status == 'UNDER_INVESTIGATION':
        investigator = getattr(instance, 'assigned_investigator', None)
        _send(EmailEvent.INVESTIGATION_STARTED, emp_email, {
            **base_ctx,
            'investigator_name': getattr(investigator, 'full_name', '') if investigator else '',
        }, user=emp_user)
    elif instance.status == 'HEARING_SCHEDULED':
        # Get hearing details from the related DisciplinaryHearing model
        hearing = instance.hearings.order_by('-scheduled_date').first() if hasattr(instance, 'hearings') else None
        _send(EmailEvent.HEARING_SCHEDULED, emp_email, {
            **base_ctx,
            'hearing_date': str(getattr(hearing, 'scheduled_date', '')) if hearing else '',
            'hearing_time': str(getattr(hearing, 'scheduled_time', '')) if hearing else '',
            'venue': getattr(hearing, 'location', '') if hearing else '',
        }, user=emp_user)
    elif instance.status == 'DECISION_ISSUED':
        _send(EmailEvent.DISCIPLINARY_ACTION, emp_email, {
            **base_ctx,
            'action_type': '',
            'effective_date': str(getattr(instance, 'decision_date', '')),
        }, user=emp_user)


# ── Finance ──────────────────────────────────────────────────────────────────

@receiver(pre_save, sender='finance.Budget')
def budget_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='finance.Budget')
def budget_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    if not prev or prev == instance.status:
        return

    base_ctx = {
        'budget_name': str(instance),
        'department': str(getattr(instance, 'department', '')),
        'amount': str(getattr(instance, 'total_amount', '')),
    }

    if instance.status == 'APPROVED':
        created_by = getattr(instance, 'created_by', None)
        if created_by and created_by.email:
            _send(EmailEvent.BUDGET_APPROVED, created_by.email, {
                **base_ctx,
                'requester_name': created_by.get_full_name(),
                'approved_by': '',
            }, user=created_by)
    elif instance.status == 'CLOSED' and prev == 'DRAFT':
        # Rejected (Budget doesn't have explicit REJECTED, using CLOSED from DRAFT)
        created_by = getattr(instance, 'created_by', None)
        if created_by and created_by.email:
            _send(EmailEvent.BUDGET_REJECTED, created_by.email, {
                **base_ctx,
                'requester_name': created_by.get_full_name(),
                'rejection_reason': '',
                'rejected_by': '',
            }, user=created_by)


@receiver(pre_save, sender='finance.VendorInvoice')
def vendor_invoice_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='finance.VendorInvoice')
def vendor_invoice_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    if not prev or prev == instance.status:
        return

    if instance.status == 'APPROVED':
        created_by = getattr(instance, 'created_by', None)
        if created_by and created_by.email:
            _send(EmailEvent.INVOICE_APPROVED, created_by.email, {
                'invoice_number': getattr(instance, 'invoice_number', ''),
                'vendor_name': str(getattr(instance, 'vendor', '')),
                'amount': str(getattr(instance, 'total_amount', '')),
                'approved_by': '',
            }, user=created_by)


@receiver(post_save, sender='finance.Payment')
def payment_post_save(sender, instance, created, **kwargs):
    if not created:
        return
    created_by = getattr(instance, 'created_by', None)
    if created_by and created_by.email:
        _send(EmailEvent.PAYMENT_PROCESSED, created_by.email, {
            'payment_number': getattr(instance, 'payment_number', ''),
            'vendor_name': str(getattr(instance, 'vendor', '')),
            'amount': str(getattr(instance, 'amount', '')),
            'payment_date': str(getattr(instance, 'payment_date', '')),
            'payment_method': getattr(instance, 'payment_method', ''),
        }, user=created_by)


# ── Procurement ──────────────────────────────────────────────────────────────

@receiver(post_save, sender='procurement.PurchaseRequisition')
def purchase_requisition_post_save(sender, instance, created, **kwargs):
    if not created:
        return
    if instance.status != 'SUBMITTED':
        return
    requested_by = getattr(instance, 'requested_by', None)
    if not requested_by:
        return
    email = _get_email_for_employee(requested_by)
    user = _get_user_for_employee(requested_by)
    _send(EmailEvent.REQUISITION_SUBMITTED, email, {
        'requester_name': getattr(requested_by, 'full_name', str(requested_by)),
        'requisition_number': getattr(instance, 'requisition_number', ''),
        'description': getattr(instance, 'description', ''),
        'total_amount': str(getattr(instance, 'total_estimated_cost', '')),
    }, user=user)


@receiver(pre_save, sender='procurement.PurchaseOrder')
def purchase_order_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='procurement.PurchaseOrder')
def purchase_order_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    if not prev or prev == instance.status:
        return

    created_by = getattr(instance, 'created_by', None)
    if not created_by or not created_by.email:
        return

    base_ctx = {
        'po_number': getattr(instance, 'po_number', ''),
        'vendor_name': str(getattr(instance, 'vendor', '')),
        'total_amount': str(getattr(instance, 'total_amount', '')),
    }

    if instance.status == 'APPROVED':
        _send(EmailEvent.PO_APPROVED, created_by.email, {
            **base_ctx, 'approved_by': str(getattr(instance, 'approved_by', '')),
        }, user=created_by)
    elif instance.status == 'CANCELLED' and prev in ('SUBMITTED', 'DRAFT'):
        _send(EmailEvent.PO_REJECTED, created_by.email, {
            **base_ctx,
            'rejection_reason': '',
            'rejected_by': '',
        }, user=created_by)


@receiver(post_save, sender='procurement.GoodsReceiptNote')
def goods_receipt_post_save(sender, instance, created, **kwargs):
    if not created:
        return
    po = getattr(instance, 'purchase_order', None)
    if not po:
        return
    po_creator = getattr(po, 'created_by', None)
    if po_creator and po_creator.email:
        received_by = getattr(instance, 'received_by', None)
        _send(EmailEvent.GOODS_RECEIVED, po_creator.email, {
            'grn_number': getattr(instance, 'grn_number', ''),
            'po_number': getattr(po, 'po_number', ''),
            'vendor_name': str(getattr(po, 'vendor', '')),
            'received_by': getattr(received_by, 'full_name', '') if received_by else '',
            'receipt_date': str(getattr(instance, 'receipt_date', '')),
        }, user=po_creator)


# ── Benefits ─────────────────────────────────────────────────────────────────

@receiver(pre_save, sender='benefits.LoanAccount')
def loan_account_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='benefits.LoanAccount')
def loan_account_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    if not prev or prev == instance.status:
        return

    employee = getattr(instance, 'employee', None)
    if not employee:
        return
    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)

    if instance.status == 'APPROVED':
        _send(EmailEvent.LOAN_APPROVED, emp_email, {
            'employee_name': getattr(employee, 'full_name', str(employee)),
            'loan_number': getattr(instance, 'loan_number', ''),
            'loan_type': str(getattr(instance, 'loan_type', '')),
            'amount': str(getattr(instance, 'principal_amount', '')),
            'repayment_start': str(getattr(instance, 'disbursement_date', '')),
        }, user=emp_user)
    elif instance.status == 'REJECTED':
        _send(EmailEvent.LOAN_REJECTED, emp_email, {
            'employee_name': getattr(employee, 'full_name', str(employee)),
            'loan_type': str(getattr(instance, 'loan_type', '')),
            'amount': str(getattr(instance, 'principal_amount', '')),
            'rejection_reason': getattr(instance, 'rejection_reason', ''),
        }, user=emp_user)


@receiver(pre_save, sender='benefits.BenefitClaim')
def benefit_claim_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='benefits.BenefitClaim')
def benefit_claim_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    if not prev or prev == instance.status:
        return

    employee = getattr(instance, 'employee', None)
    if not employee:
        return
    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)

    base_ctx = {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'claim_number': getattr(instance, 'claim_number', ''),
        'claim_type': str(getattr(instance, 'benefit_type', getattr(instance, 'claim_type', ''))),
    }

    if instance.status == 'APPROVED':
        _send(EmailEvent.CLAIM_APPROVED, emp_email, {
            **base_ctx,
            'claimed_amount': str(getattr(instance, 'claimed_amount', '')),
            'approved_amount': str(getattr(instance, 'approved_amount', '')),
        }, user=emp_user)
    elif instance.status == 'REJECTED':
        _send(EmailEvent.CLAIM_REJECTED, emp_email, {
            **base_ctx,
            'rejection_reason': getattr(instance, 'rejection_reason', ''),
        }, user=emp_user)


# ── Training ─────────────────────────────────────────────────────────────────

@receiver(pre_save, sender='training.TrainingEnrollment')
def training_enrollment_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            instance._previous_status = (
                sender.objects.all_objects.values_list('status', flat=True).get(pk=instance.pk)
            )
        except sender.DoesNotExist:
            instance._previous_status = None
    else:
        instance._previous_status = None


@receiver(post_save, sender='training.TrainingEnrollment')
def training_enrollment_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    employee = getattr(instance, 'employee', None)
    if not employee:
        return

    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)
    session = getattr(instance, 'session', None)
    training_name = str(session) if session else ''

    if created:
        _send(EmailEvent.TRAINING_SCHEDULED, emp_email, {
            'employee_name': getattr(employee, 'full_name', str(employee)),
            'training_name': training_name,
            'start_date': str(getattr(session, 'start_date', '')) if session else '',
            'end_date': str(getattr(session, 'end_date', '')) if session else '',
            'venue': getattr(session, 'venue', '') if session else '',
            'trainer': str(getattr(session, 'trainer', '')) if session else '',
        }, user=emp_user)
    elif prev and prev != instance.status:
        if instance.status == 'COMPLETED':
            _send(EmailEvent.TRAINING_COMPLETED, emp_email, {
                'employee_name': getattr(employee, 'full_name', str(employee)),
                'training_name': training_name,
                'completion_date': str(getattr(instance, 'attendance_date', '')),
            }, user=emp_user)

        if getattr(instance, 'certificate_issued', False) and not getattr(prev, 'certificate_issued', True):
            _send(EmailEvent.CERTIFICATE_ISSUED, emp_email, {
                'employee_name': getattr(employee, 'full_name', str(employee)),
                'training_name': training_name,
                'certificate_date': str(getattr(instance, 'certificate_date', '')),
            }, user=emp_user)


# ── Exits ────────────────────────────────────────────────────────────────────

@receiver(pre_save, sender='exits.ExitRequest')
def exit_request_pre_save(sender, instance, **kwargs):
    _capture_previous_status(sender, instance, **kwargs)


@receiver(post_save, sender='exits.ExitRequest')
def exit_request_post_save(sender, instance, created, **kwargs):
    prev = getattr(instance, '_previous_status', None)
    employee = getattr(instance, 'employee', None)
    if not employee:
        return

    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)
    base_ctx = {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'request_number': getattr(instance, 'request_number', ''),
    }

    if created and instance.status in ('SUBMITTED', 'PENDING_APPROVAL'):
        _send(EmailEvent.EXIT_INITIATED, emp_email, {
            **base_ctx,
            'exit_type': getattr(instance, 'exit_type', ''),
            'proposed_last_day': str(getattr(instance, 'proposed_last_day', '')),
        }, user=emp_user)
    elif prev and prev != instance.status:
        if instance.status == 'COMPLETED':
            _send(EmailEvent.CLEARANCE_COMPLETED, emp_email, {
                **base_ctx,
                'completion_date': str(getattr(instance, 'completed_at', '')),
            }, user=emp_user)


@receiver(post_save, sender='exits.ExitInterview')
def exit_interview_post_save(sender, instance, created, **kwargs):
    if not created:
        return
    exit_request = getattr(instance, 'exit_request', None)
    if not exit_request:
        return
    employee = getattr(exit_request, 'employee', None)
    if not employee:
        return
    emp_email = _get_email_for_employee(employee)
    emp_user = _get_user_for_employee(employee)
    interviewer = getattr(instance, 'interviewer', None)

    _send(EmailEvent.EXIT_INTERVIEW_SCHEDULED, emp_email, {
        'employee_name': getattr(employee, 'full_name', str(employee)),
        'interview_date': str(getattr(instance, 'scheduled_date', '')),
        'interviewer_name': getattr(interviewer, 'full_name', '') if interviewer else '',
    }, user=emp_user)
