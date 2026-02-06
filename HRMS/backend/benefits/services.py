"""
Services for Benefits and Loans module.
"""

from datetime import date
from dateutil.relativedelta import relativedelta
from decimal import Decimal
from typing import Optional, Dict, Any, Tuple

from django.db import transaction
from django.utils import timezone

from .models import LoanType, LoanAccount, LoanSchedule, LoanTransaction


class LoanEligibilityService:
    """Service for checking loan eligibility."""

    def __init__(self, employee, loan_type: LoanType):
        self.employee = employee
        self.loan_type = loan_type
        self.errors = []
        self.warnings = []

    def check_eligibility(self) -> Tuple[bool, Dict[str, Any]]:
        """
        Check if employee is eligible for the loan type.
        Returns (is_eligible, details_dict)
        """
        self.errors = []
        self.warnings = []

        # Check service duration
        self._check_service_months()

        # Check active loans
        self._check_active_loans()

        # Check cooldown period
        self._check_cooldown_period()

        # Calculate max amount
        max_amount = self._calculate_max_amount()

        is_eligible = len(self.errors) == 0

        return is_eligible, {
            'is_eligible': is_eligible,
            'errors': self.errors,
            'warnings': self.warnings,
            'max_amount': max_amount,
            'max_tenure_months': self.loan_type.max_tenure_months,
            'interest_rate': self.loan_type.interest_rate,
            'salary_component': self.loan_type.salary_component,
            'cooldown_months': self.loan_type.cooldown_months,
        }

    def _check_service_months(self):
        """Check if employee has minimum service months."""
        if self.employee.date_of_joining:
            service_months = relativedelta(date.today(), self.employee.date_of_joining).months
            service_months += relativedelta(date.today(), self.employee.date_of_joining).years * 12

            if service_months < self.loan_type.min_service_months:
                self.errors.append(
                    f"Minimum {self.loan_type.min_service_months} months service required. "
                    f"Current: {service_months} months."
                )
        else:
            self.warnings.append("Date of joining not set - cannot verify service duration.")

    def _check_active_loans(self):
        """Check if employee has exceeded max active loans of this type."""
        active_loans = LoanAccount.objects.filter(
            employee=self.employee,
            loan_type=self.loan_type,
            status__in=[
                LoanAccount.Status.PENDING,
                LoanAccount.Status.APPROVED,
                LoanAccount.Status.DISBURSED,
                LoanAccount.Status.ACTIVE
            ]
        ).count()

        if active_loans >= self.loan_type.max_active_loans:
            self.errors.append(
                f"Maximum {self.loan_type.max_active_loans} active loan(s) allowed. "
                f"You have {active_loans} active loan(s) of this type."
            )

    def _check_cooldown_period(self):
        """Check if employee has completed cooldown period after last loan."""
        if self.loan_type.cooldown_months == 0:
            return

        # Find the last completed loan of this type
        last_loan = LoanAccount.objects.filter(
            employee=self.employee,
            loan_type=self.loan_type,
            status=LoanAccount.Status.COMPLETED
        ).order_by('-last_deduction_date').first()

        if last_loan and last_loan.last_deduction_date:
            cooldown_end = last_loan.last_deduction_date + relativedelta(months=self.loan_type.cooldown_months)

            if date.today() < cooldown_end:
                months_remaining = relativedelta(cooldown_end, date.today()).months
                months_remaining += relativedelta(cooldown_end, date.today()).years * 12
                self.errors.append(
                    f"Cooldown period not complete. You can apply again after {cooldown_end.strftime('%d %b %Y')} "
                    f"({months_remaining} month(s) remaining)."
                )

    def _calculate_max_amount(self) -> Decimal:
        """Calculate maximum loan amount based on salary."""
        if self.loan_type.max_amount:
            return self.loan_type.max_amount

        if self.loan_type.max_salary_multiplier:
            salary = self._get_salary_component()
            if salary:
                return salary * self.loan_type.max_salary_multiplier

        return Decimal('0')

    def _get_salary_component(self) -> Optional[Decimal]:
        """Get the relevant salary component for calculation."""
        # Try to get from employee's current salary
        if hasattr(self.employee, 'basic_salary') and self.employee.basic_salary:
            if self.loan_type.salary_component == LoanType.SalaryComponent.BASIC:
                return self.employee.basic_salary
            elif self.loan_type.salary_component == LoanType.SalaryComponent.GROSS:
                # Gross is typically basic + allowances
                gross = self.employee.basic_salary
                if hasattr(self.employee, 'gross_salary') and self.employee.gross_salary:
                    gross = self.employee.gross_salary
                return gross

        # Fallback: Check latest payroll record
        from payroll.models import PayrollRecord
        latest_payroll = PayrollRecord.objects.filter(
            employee=self.employee
        ).order_by('-payroll_period__start_date').first()

        if latest_payroll:
            if self.loan_type.salary_component == LoanType.SalaryComponent.BASIC:
                return latest_payroll.basic_salary
            elif self.loan_type.salary_component == LoanType.SalaryComponent.GROSS:
                return latest_payroll.gross_pay
            elif self.loan_type.salary_component == LoanType.SalaryComponent.NET:
                return latest_payroll.net_pay

        return None


class LoanApprovalService:
    """Service for loan approval and processing."""

    def __init__(self, loan_account: LoanAccount, approved_by):
        self.loan = loan_account
        self.approved_by = approved_by

    @transaction.atomic
    def approve(self, actual_last_day: Optional[date] = None) -> LoanAccount:
        """Approve the loan and generate repayment schedule."""
        if self.loan.status not in [LoanAccount.Status.DRAFT, LoanAccount.Status.PENDING]:
            raise ValueError(f"Loan cannot be approved from status: {self.loan.status}")

        # Update loan status
        self.loan.status = LoanAccount.Status.APPROVED
        self.loan.approved_by = self.approved_by
        self.loan.approved_at = timezone.now()

        # Calculate totals
        if self.loan.interest_rate == 0:
            self.loan.total_interest = Decimal('0')
            self.loan.monthly_installment = self.loan.principal_amount / self.loan.tenure_months
        else:
            self.loan.monthly_installment = Decimal(str(self.loan.calculate_emi()))
            self.loan.total_interest = (
                self.loan.monthly_installment * self.loan.tenure_months
            ) - self.loan.principal_amount

        self.loan.total_amount = self.loan.principal_amount + self.loan.total_interest
        self.loan.outstanding_balance = self.loan.total_amount

        # Set dates
        today = date.today()
        self.loan.disbursement_date = today
        self.loan.first_deduction_date = (today + relativedelta(months=1)).replace(day=1)
        self.loan.expected_completion_date = self.loan.first_deduction_date + relativedelta(
            months=self.loan.tenure_months - 1
        )

        self.loan.save()

        # Generate repayment schedule
        self._generate_schedule()

        # Auto-post to payroll if enabled
        if self.loan.loan_type.auto_post_to_payroll:
            self._create_payroll_transactions()

        return self.loan

    def _generate_schedule(self):
        """Generate loan repayment schedule."""
        # Delete existing schedule
        LoanSchedule.objects.filter(loan_account=self.loan).delete()

        balance = self.loan.principal_amount
        due_date = self.loan.first_deduction_date

        for i in range(1, self.loan.tenure_months + 1):
            if self.loan.interest_rate == 0:
                principal = self.loan.principal_amount / self.loan.tenure_months
                interest = Decimal('0')
            else:
                # For interest-bearing loans, calculate principal and interest portions
                monthly_rate = self.loan.interest_rate / 100 / 12
                interest = balance * monthly_rate
                principal = self.loan.monthly_installment - interest

            # Last installment adjustment
            if i == self.loan.tenure_months:
                principal = balance
                interest = self.loan.monthly_installment - principal if self.loan.interest_rate > 0 else Decimal('0')

            closing_balance = balance - principal

            LoanSchedule.objects.create(
                loan_account=self.loan,
                installment_number=i,
                due_date=due_date,
                principal_amount=round(principal, 2),
                interest_amount=round(interest, 2),
                total_amount=round(principal + interest, 2),
                opening_balance=round(balance, 2),
                closing_balance=round(max(closing_balance, Decimal('0')), 2),
            )

            balance = closing_balance
            due_date = due_date + relativedelta(months=1)

    def _create_payroll_transactions(self):
        """Create payroll employee transactions for loan deductions."""
        if not self.loan.loan_type.deduction_pay_component:
            return

        from payroll.models import EmployeeTransaction
        import uuid

        # Create a recurring transaction for the loan
        EmployeeTransaction.objects.create(
            employee=self.loan.employee,
            pay_component=self.loan.loan_type.deduction_pay_component,
            reference_number=f"LN-TXN-{uuid.uuid4().hex[:8].upper()}",
            override_type=EmployeeTransaction.OverrideType.FIXED,
            override_amount=self.loan.monthly_installment,
            effective_from=self.loan.first_deduction_date,
            effective_to=self.loan.expected_completion_date,
            is_recurring=True,
            status=EmployeeTransaction.Status.ACTIVE,
            description=f"Loan deduction for {self.loan.loan_type.name} - {self.loan.loan_number}",
        )

    @transaction.atomic
    def disburse(self) -> LoanAccount:
        """Mark loan as disbursed."""
        if self.loan.status != LoanAccount.Status.APPROVED:
            raise ValueError("Only approved loans can be disbursed")

        self.loan.status = LoanAccount.Status.DISBURSED
        self.loan.disbursed_amount = self.loan.principal_amount
        self.loan.disbursement_date = date.today()
        self.loan.save()

        # Create disbursement transaction
        LoanTransaction.objects.create(
            loan_account=self.loan,
            transaction_type=LoanTransaction.TransactionType.DISBURSEMENT,
            transaction_date=date.today(),
            principal_amount=self.loan.principal_amount,
            total_amount=self.loan.principal_amount,
            balance_after=self.loan.outstanding_balance,
            notes="Loan disbursement"
        )

        return self.loan

    @transaction.atomic
    def reject(self, reason: str) -> LoanAccount:
        """Reject the loan application."""
        if self.loan.status not in [LoanAccount.Status.DRAFT, LoanAccount.Status.PENDING]:
            raise ValueError(f"Loan cannot be rejected from status: {self.loan.status}")

        self.loan.status = LoanAccount.Status.REJECTED
        self.loan.rejection_reason = reason
        self.loan.save()

        return self.loan


class LoanRepaymentService:
    """Service for processing loan repayments."""

    def __init__(self, loan_account: LoanAccount):
        self.loan = loan_account

    @transaction.atomic
    def record_payment(
        self,
        amount: Decimal,
        payment_date: date,
        reference: str = None,
        payroll_period=None
    ) -> LoanTransaction:
        """Record a loan payment."""
        # Calculate principal and interest portions
        if self.loan.interest_rate == 0:
            principal = amount
            interest = Decimal('0')
        else:
            # For simplicity, assume proportional split
            interest_ratio = self.loan.total_interest / self.loan.total_amount
            interest = amount * interest_ratio
            principal = amount - interest

        # Update loan balances
        self.loan.principal_paid += principal
        self.loan.interest_paid += interest
        self.loan.outstanding_balance -= amount
        self.loan.last_deduction_date = payment_date

        # Check if loan is fully paid
        if self.loan.outstanding_balance <= 0:
            self.loan.outstanding_balance = Decimal('0')
            self.loan.status = LoanAccount.Status.COMPLETED
            self.loan.actual_completion_date = payment_date

        # Mark loan as active if this is first payment
        if self.loan.status == LoanAccount.Status.DISBURSED:
            self.loan.status = LoanAccount.Status.ACTIVE

        self.loan.save()

        # Create transaction record
        transaction = LoanTransaction.objects.create(
            loan_account=self.loan,
            transaction_type=LoanTransaction.TransactionType.DEDUCTION,
            transaction_date=payment_date,
            principal_amount=principal,
            interest_amount=interest,
            total_amount=amount,
            balance_after=self.loan.outstanding_balance,
            reference_number=reference,
            payroll_period=payroll_period,
        )

        # Update schedule
        self._update_schedule(payment_date, amount, payroll_period)

        return transaction

    def _update_schedule(self, payment_date: date, amount: Decimal, payroll_period=None):
        """Update the repayment schedule after payment."""
        # Find the next unpaid installment
        installment = LoanSchedule.objects.filter(
            loan_account=self.loan,
            is_paid=False
        ).order_by('installment_number').first()

        if installment:
            installment.is_paid = True
            installment.paid_date = payment_date
            installment.paid_amount = amount
            installment.payroll_period = payroll_period
            installment.save()
