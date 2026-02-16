"""
Email event definitions mapping events to templates, subjects, and categories.

Each EmailEvent maps to:
- A template path under templates/email/
- A default subject line (may be overridden with context)
- A category for email preference opt-out checks
- Whether it's critical (bypasses user preferences)
"""

from enum import Enum


class EmailEvent(Enum):
    """
    All email events in the HRMS system.
    Format: (template_name, default_subject, category, is_critical)
    """

    # ── Accounts ─────────────────────────────────────────────────
    WELCOME = ('accounts/welcome.html', 'Welcome to {org_name}', 'employee', False)
    PASSWORD_CHANGED = ('accounts/password_changed.html', 'Your Password Has Been Changed', 'employee', True)
    PASSWORD_RESET = ('accounts/password_reset.html', 'Password Reset Request', 'employee', True)
    ADMIN_PASSWORD_RESET = ('accounts/admin_password_reset.html', 'Your Password Has Been Reset', 'employee', True)
    ACCOUNT_DEACTIVATED = ('accounts/account_deactivated.html', 'Account Deactivated', 'employee', True)
    ROLE_CHANGED = ('accounts/role_changed.html', 'Your Account Role Has Been Updated', 'employee', False)
    TWO_FACTOR_CODE = ('accounts/two_factor_code.html', 'Your Verification Code', 'employee', True)
    SIGNUP_VERIFICATION = ('accounts/signup_verification.html', 'Complete Your Account Registration', 'employee', True)

    # ── Leave ────────────────────────────────────────────────────
    LEAVE_SUBMITTED = ('leave/leave_submitted.html', 'Leave Request Submitted', 'leave', False)
    LEAVE_APPROVED = ('leave/leave_approved.html', 'Leave Request Approved', 'leave', False)
    LEAVE_REJECTED = ('leave/leave_rejected.html', 'Leave Request Rejected', 'leave', False)
    LEAVE_CANCELLED = ('leave/leave_cancelled.html', 'Leave Request Cancelled', 'leave', False)

    # ── Recruitment ──────────────────────────────────────────────
    APPLICATION_RECEIVED = ('recruitment/application_received.html', 'Application Received - {position}', 'recruitment', False)
    SHORTLISTED = ('recruitment/shortlisted.html', 'Application Update - Shortlisted', 'recruitment', False)
    INTERVIEW_SCHEDULED = ('recruitment/interview_scheduled.html', 'Interview Scheduled - {position}', 'recruitment', False)
    OFFER_MADE = ('recruitment/offer_made.html', 'Job Offer - {position}', 'recruitment', False)
    OFFER_ACCEPTED = ('recruitment/offer_accepted.html', 'Offer Accepted - {applicant_name}', 'recruitment', False)
    OFFER_DECLINED = ('recruitment/offer_declined.html', 'Offer Declined - {applicant_name}', 'recruitment', False)
    APPLICATION_REJECTED = ('recruitment/application_rejected.html', 'Application Update', 'recruitment', False)

    # ── Workflow ──────────────────────────────────────────────────
    APPROVAL_REQUESTED = ('workflow/approval_requested.html', 'Approval Required: {request_type}', 'workflow', False)
    WORKFLOW_APPROVED = ('workflow/approved.html', 'Request Approved: {request_type}', 'workflow', False)
    WORKFLOW_REJECTED = ('workflow/rejected.html', 'Request Rejected: {request_type}', 'workflow', False)
    WORKFLOW_DELEGATED = ('workflow/delegated.html', 'Approval Delegated to You', 'workflow', False)
    WORKFLOW_ESCALATED = ('workflow/escalated.html', 'Approval Escalated', 'workflow', False)
    WORKFLOW_COMPLETED = ('workflow/completed.html', 'Workflow Completed: {request_type}', 'workflow', False)

    # ── Payroll ──────────────────────────────────────────────────
    PAYSLIP_READY = ('payroll/payslip_ready.html', 'Your Payslip is Ready - {period}', 'payroll', False)
    SALARY_ADJUSTMENT = ('payroll/salary_adjustment.html', 'Salary Adjustment Notification', 'payroll', False)

    # ── Performance ──────────────────────────────────────────────
    APPRAISAL_SCHEDULED = ('performance/appraisal_scheduled.html', 'Performance Appraisal Scheduled', 'performance', False)
    APPRAISAL_SUBMITTED = ('performance/appraisal_submitted.html', 'Appraisal Submitted for Review', 'performance', False)
    APPRAISAL_APPROVED = ('performance/appraisal_approved.html', 'Appraisal Completed', 'performance', False)
    TRAINING_NEED_IDENTIFIED = ('performance/training_need_identified.html', 'Training Need Identified', 'performance', False)
    PROBATION_DUE = ('performance/probation_due.html', 'Probation Assessment Due: {employee_name}', 'performance', False)

    # ── Discipline ───────────────────────────────────────────────
    GRIEVANCE_SUBMITTED = ('discipline/grievance_submitted.html', 'Grievance Submitted: {grievance_number}', 'discipline', False)
    GRIEVANCE_ACKNOWLEDGED = ('discipline/grievance_acknowledged.html', 'Grievance Acknowledged: {grievance_number}', 'discipline', False)
    INVESTIGATION_STARTED = ('discipline/investigation_started.html', 'Investigation Started: {case_number}', 'discipline', False)
    HEARING_SCHEDULED = ('discipline/hearing_scheduled.html', 'Hearing Scheduled: {case_number}', 'discipline', False)
    GRIEVANCE_RESOLVED = ('discipline/grievance_resolved.html', 'Grievance Resolved: {grievance_number}', 'discipline', False)
    DISCIPLINARY_ACTION = ('discipline/disciplinary_action.html', 'Disciplinary Action: {case_number}', 'discipline', False)

    # ── Finance ──────────────────────────────────────────────────
    BUDGET_APPROVAL_REQUESTED = ('finance/budget_approval_requested.html', 'Budget Approval Required', 'finance', False)
    BUDGET_APPROVED = ('finance/budget_approved.html', 'Budget Approved', 'finance', False)
    BUDGET_REJECTED = ('finance/budget_rejected.html', 'Budget Not Approved', 'finance', False)
    INVOICE_APPROVED = ('finance/invoice_approved.html', 'Invoice Approved: {invoice_number}', 'finance', False)
    PAYMENT_PROCESSED = ('finance/payment_processed.html', 'Payment Processed: {payment_number}', 'finance', False)

    # ── Procurement ──────────────────────────────────────────────
    REQUISITION_SUBMITTED = ('procurement/requisition_submitted.html', 'Purchase Requisition Submitted', 'procurement', False)
    PO_APPROVED = ('procurement/po_approved.html', 'Purchase Order Approved: {po_number}', 'procurement', False)
    PO_REJECTED = ('procurement/po_rejected.html', 'Purchase Order Rejected: {po_number}', 'procurement', False)
    GOODS_RECEIVED = ('procurement/goods_received.html', 'Goods Received: {grn_number}', 'procurement', False)

    # ── Employees ────────────────────────────────────────────────
    WELCOME_ONBOARDING = ('employees/welcome_onboarding.html', 'Welcome to {org_name} - Onboarding', 'employee', False)
    PROMOTION = ('employees/promotion.html', 'Congratulations on Your Promotion', 'employee', False)
    TRANSFER = ('employees/transfer.html', 'Transfer Notification', 'employee', False)
    CONTRACT_RENEWAL = ('employees/contract_renewal.html', 'Contract Renewal Notification', 'employee', False)
    EXIT_INITIATED_EMPLOYEE = ('employees/exit_initiated.html', 'Exit Process Initiated', 'employee', False)

    # ── Benefits ─────────────────────────────────────────────────
    LOAN_APPROVED = ('benefits/loan_approved.html', 'Loan Application Approved', 'benefits', False)
    LOAN_REJECTED = ('benefits/loan_rejected.html', 'Loan Application Not Approved', 'benefits', False)
    CLAIM_APPROVED = ('benefits/claim_approved.html', 'Benefit Claim Approved', 'benefits', False)
    CLAIM_REJECTED = ('benefits/claim_rejected.html', 'Benefit Claim Not Approved', 'benefits', False)

    # ── Training ─────────────────────────────────────────────────
    TRAINING_SCHEDULED = ('training/training_scheduled.html', 'Training Session Scheduled: {training_name}', 'training', False)
    TRAINING_COMPLETED = ('training/training_completed.html', 'Training Completed: {training_name}', 'training', False)
    CERTIFICATE_ISSUED = ('training/certificate_issued.html', 'Training Certificate Issued', 'training', False)

    # ── Exits ────────────────────────────────────────────────────
    EXIT_INITIATED = ('exits/exit_initiated.html', 'Exit Request Submitted', 'exits', False)
    EXIT_INTERVIEW_SCHEDULED = ('exits/exit_interview_scheduled.html', 'Exit Interview Scheduled', 'exits', False)
    CLEARANCE_COMPLETED = ('exits/clearance_completed.html', 'Clearance Process Completed', 'exits', False)

    # ── Generic ──────────────────────────────────────────────────
    GENERIC_NOTIFICATION = ('generic_notification.html', '{subject}', 'employee', False)

    @property
    def template(self):
        return self.value[0]

    @property
    def default_subject(self):
        return self.value[1]

    @property
    def category(self):
        return self.value[2]

    @property
    def is_critical(self):
        return self.value[3]

    def get_subject(self, **kwargs):
        """Format subject with context variables."""
        try:
            return self.default_subject.format(**kwargs)
        except KeyError:
            return self.default_subject
