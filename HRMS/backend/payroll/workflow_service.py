"""
Payroll workflow services — approval, rejection, and payment processing.
"""

from django.db import transaction
from django.utils import timezone

from .models import (
    PayrollRun, PayrollPeriod, PayrollItem, PayrollApproval, AdHocPayment,
)


class PayrollWorkflowService:
    """Service for payroll approval workflow and payment processing."""

    def __init__(self, payroll_run: PayrollRun):
        self.payroll_run = payroll_run
        self.period = payroll_run.payroll_period

    @transaction.atomic
    def approve_payroll(self, user, comments: str = None) -> dict:
        """Approve the payroll run."""
        if self.payroll_run.status != PayrollRun.Status.COMPUTED:
            raise ValueError(f'Cannot approve payroll in status: {self.payroll_run.status}')

        error_items = PayrollItem.objects.filter(
            payroll_run=self.payroll_run,
            status=PayrollItem.Status.ERROR
        ).count()

        if error_items > 0:
            raise ValueError(f'Cannot approve payroll with {error_items} items in error')

        PayrollApproval.objects.create(
            payroll_run=self.payroll_run,
            level=1,
            approver=user,
            action='APPROVE',
            comments=comments
        )

        PayrollItem.objects.filter(
            payroll_run=self.payroll_run,
            status=PayrollItem.Status.COMPUTED
        ).update(status=PayrollItem.Status.APPROVED)

        self.payroll_run.status = PayrollRun.Status.APPROVED
        self.payroll_run.approved_by = user
        self.payroll_run.approved_at = timezone.now()
        self.payroll_run.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])

        # Update period status to APPROVED
        if self.period.status in [PayrollPeriod.Status.OPEN, PayrollPeriod.Status.PROCESSING, PayrollPeriod.Status.COMPUTED]:
            self.period.status = PayrollPeriod.Status.APPROVED
            self.period.save(update_fields=['status', 'updated_at'])

        return {
            'status': 'approved',
            'approved_by': user.email,
            'approved_at': self.payroll_run.approved_at.isoformat(),
        }

    @transaction.atomic
    def reject_payroll(self, user, comments: str) -> dict:
        """Reject the payroll run and return for correction."""
        if self.payroll_run.status not in [PayrollRun.Status.COMPUTED, PayrollRun.Status.REVIEWING]:
            raise ValueError(f'Cannot reject payroll in status: {self.payroll_run.status}')

        PayrollApproval.objects.create(
            payroll_run=self.payroll_run,
            level=1,
            approver=user,
            action='REJECT',
            comments=comments
        )

        self.payroll_run.status = PayrollRun.Status.REJECTED
        self.payroll_run.save(update_fields=['status', 'updated_at'])

        # Revert period status to OPEN since run was rejected
        if self.period.status in [PayrollPeriod.Status.COMPUTED, PayrollPeriod.Status.APPROVED]:
            self.period.status = PayrollPeriod.Status.OPEN
            self.period.save(update_fields=['status', 'updated_at'])

        return {
            'status': 'rejected',
            'rejected_by': user.email,
            'comments': comments,
        }

    @transaction.atomic
    def process_payment(self, user, payment_reference: str = None) -> dict:
        """Mark the payroll as paid."""
        if self.payroll_run.status != PayrollRun.Status.APPROVED:
            raise ValueError(f'Cannot process payment for payroll in status: {self.payroll_run.status}')

        self.payroll_run.status = PayrollRun.Status.PROCESSING_PAYMENT
        self.payroll_run.save(update_fields=['status', 'updated_at'])

        payment_date = timezone.now().date()
        reference = payment_reference or f'PAY-{self.payroll_run.run_number}-{payment_date.strftime("%Y%m%d")}'

        PayrollItem.objects.filter(
            payroll_run=self.payroll_run,
            status=PayrollItem.Status.APPROVED
        ).update(
            status=PayrollItem.Status.PAID,
            payment_date=payment_date,
            payment_reference=reference
        )

        AdHocPayment.objects.filter(
            payroll_period=self.period,
            status='APPROVED'
        ).update(
            status='PROCESSED',
            processed_at=timezone.now()
        )

        self.payroll_run.status = PayrollRun.Status.PAID
        self.payroll_run.paid_at = timezone.now()
        self.payroll_run.save(update_fields=['status', 'paid_at', 'updated_at'])

        self.period.status = PayrollPeriod.Status.PAID
        self.period.payment_date = payment_date
        self.period.save(update_fields=['status', 'payment_date', 'updated_at'])

        paid_count = PayrollItem.objects.filter(
            payroll_run=self.payroll_run,
            status=PayrollItem.Status.PAID
        ).count()

        return {
            'status': 'paid',
            'payment_date': payment_date.isoformat(),
            'payment_reference': reference,
            'employees_paid': paid_count,
            'total_amount': str(self.payroll_run.total_net),
        }
