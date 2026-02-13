"""
Payroll computation services for HRMS.
Handles Ghana PAYE tax calculation, SSNIT contributions, and payroll processing.

Decomposed into focused sub-services:
- TaxCalculationService, SSNITService (tax_service.py) — statutory calculations
- PayrollWorkflowService (workflow_service.py) — approve/reject/pay
- PayrollExportService (export_service.py) — bank files & payslips
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
from typing import Optional
from dataclasses import dataclass

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.core.cache import cache

from employees.models import Employee, BankAccount
from .models import (
    PayrollRun, PayrollPeriod, PayrollItem, PayrollItemDetail,
    EmployeeSalary, EmployeeSalaryComponent, PayComponent, AdHocPayment,
    EmployeeTransaction, BackpayRequest
)
from .tax_service import TaxCalculationService, SSNITService


@dataclass
class PayrollComputationResult:
    """Result of payroll computation for an employee."""
    success: bool
    employee_id: int
    basic_salary: Decimal = Decimal('0')
    gross_earnings: Decimal = Decimal('0')
    total_deductions: Decimal = Decimal('0')
    net_salary: Decimal = Decimal('0')
    taxable_income: Decimal = Decimal('0')
    paye: Decimal = Decimal('0')
    overtime_tax: Decimal = Decimal('0')
    bonus_tax: Decimal = Decimal('0')
    total_overtime: Decimal = Decimal('0')
    total_bonus: Decimal = Decimal('0')
    ssnit_employee: Decimal = Decimal('0')
    ssnit_employer: Decimal = Decimal('0')
    tier2_employer: Decimal = Decimal('0')
    employer_cost: Decimal = Decimal('0')
    proration_factor: Decimal = Decimal('1')
    days_payable: int = 0
    total_days: int = 0
    error_message: Optional[str] = None


class PayrollService:
    """
    Service class for payroll computation and processing.

    Delegates statutory calculations to TaxCalculationService and SSNITService.
    Workflow and export operations are in separate service modules.
    """

    def __init__(self, payroll_run: PayrollRun):
        self.payroll_run = payroll_run
        self.period = payroll_run.payroll_period
        self.tax_service = TaxCalculationService(self.period)
        self.ssnit_service = SSNITService(self.period)

    # ------------------------------------------------------------------
    # Delegate properties for backward compatibility (BackpayService, tests)
    # ------------------------------------------------------------------

    @property
    def overtime_bonus_config(self):
        return self.tax_service.overtime_bonus_config

    @property
    def tax_brackets(self):
        return self.tax_service.tax_brackets

    @property
    def ssnit_rates(self):
        return self.ssnit_service.ssnit_rates

    @property
    def tax_reliefs(self):
        return self.tax_service.tax_reliefs

    # ------------------------------------------------------------------
    # Delegate methods for backward compatibility (BackpayService, tests)
    # ------------------------------------------------------------------

    def calculate_paye(self, taxable_income: Decimal) -> Decimal:
        return self.tax_service.calculate_paye(taxable_income)

    def calculate_overtime_tax(self, overtime_amount, basic_salary, annual_salary, is_resident=True):
        return self.tax_service.calculate_overtime_tax(overtime_amount, basic_salary, annual_salary, is_resident)

    def calculate_bonus_tax(self, bonus_amount, annual_basic_salary, is_resident=True):
        return self.tax_service.calculate_bonus_tax(bonus_amount, annual_basic_salary, is_resident)

    def calculate_tax_relief(self, gross_salary: Decimal) -> Decimal:
        return self.tax_service.calculate_tax_relief(gross_salary)

    def calculate_ssnit(self, basic_salary: Decimal) -> tuple[Decimal, Decimal, Decimal]:
        return self.ssnit_service.calculate_ssnit(basic_salary)

    # ------------------------------------------------------------------
    # Employee data retrieval
    # ------------------------------------------------------------------

    def get_eligible_employees(self):
        """Get all employees eligible for this payroll run, excluding flagged employees."""
        from .models import PayrollValidation, EmployeePayrollFlag

        qs = Employee.objects.filter(
            status__in=['ACTIVE', 'ON_LEAVE', 'PROBATION', 'NOTICE'],
            date_of_joining__lte=self.period.end_date
        ).select_related(
            'department', 'position', 'grade'
        ).prefetch_related(
            'salaries', 'bank_accounts'
        )

        # Exclude employees flagged for removal in validated payroll validations
        flagged_ids = EmployeePayrollFlag.objects.filter(
            validation__payroll_period=self.period,
            status=EmployeePayrollFlag.Status.FLAGGED,
        ).values_list('employee_id', flat=True)

        if flagged_ids:
            qs = qs.exclude(id__in=flagged_ids)

        return qs

    def get_employee_salary(self, employee: Employee) -> Optional[EmployeeSalary]:
        """Get the current salary for an employee.

        Prefers the record effective within the period, but falls back to the
        most recent current record if none match (e.g. when a forecast creates
        salary records with a future effective date).
        """
        salary = EmployeeSalary.objects.filter(
            employee=employee,
            is_current=True,
            effective_from__lte=self.period.end_date
        ).order_by('-effective_from').first()

        if not salary:
            salary = EmployeeSalary.objects.filter(
                employee=employee,
                is_current=True,
            ).order_by('-effective_from').first()

        return salary

    def get_adhoc_payments(self, employee: Employee) -> list[AdHocPayment]:
        """Get approved ad-hoc payments for the employee in this period."""
        return list(AdHocPayment.objects.filter(
            employee=employee,
            payroll_period=self.period,
            status='APPROVED'
        ).select_related('pay_component'))

    def get_active_transactions(self, employee: Employee) -> list[EmployeeTransaction]:
        """
        Get all active employee transactions effective for this payroll period.

        Includes:
        - Individual transactions for the employee (target_type='INDIVIDUAL')
        - Grade-based transactions for the employee's grade (target_type='GRADE')
        - Band-based transactions for the employee's salary band (target_type='BAND')
        - ACTIVE status transactions
        - Recurring transactions where effective_from <= period end
        - One-time transactions specifically for this period
        """
        # Build filter for which transactions apply to this employee
        employee_filter = Q(target_type='INDIVIDUAL', employee=employee)

        # Add grade-based transactions if employee has a grade
        if employee.grade_id:
            employee_filter |= Q(target_type='GRADE', job_grade_id=employee.grade_id)

        # Add band-based transactions if employee's grade has a salary band
        if employee.grade and hasattr(employee.grade, 'salary_band') and employee.grade.salary_band_id:
            employee_filter |= Q(target_type='BAND', salary_band_id=employee.grade.salary_band_id)
        # Also check via salary_notch -> level -> band
        elif employee.salary_notch and employee.salary_notch.level and employee.salary_notch.level.band_id:
            employee_filter |= Q(target_type='BAND', salary_band_id=employee.salary_notch.level.band_id)

        return list(EmployeeTransaction.objects.filter(
            employee_filter,
            status='ACTIVE',
            effective_from__lte=self.period.end_date
        ).filter(
            # Either no end date (ongoing) or end date is after period start
            Q(effective_to__isnull=True) | Q(effective_to__gte=self.period.start_date)
        ).filter(
            # Recurring transactions (date range already checked above)
            Q(is_recurring=True)
            # One-time: linked to this specific period
            | Q(is_recurring=False, payroll_period=self.period)
            # One-time: linked to matching calendar month/year
            | Q(is_recurring=False, calendar__year=self.period.year, calendar__month=self.period.month)
            # One-time: no period/calendar set, but date range falls within this period
            | Q(is_recurring=False, payroll_period__isnull=True, calendar__isnull=True)
        ).select_related('pay_component'))

    # ------------------------------------------------------------------
    # Proration
    # ------------------------------------------------------------------

    def calculate_proration_factor(self, employee: Employee) -> tuple[Decimal, int, int]:
        """
        Calculate proration factor for mid-period joiners/exiters.

        Returns: (factor, days_payable, total_days)
        - factor=1.0 means full salary (no proration needed)
        - Uses calendar days (holidays are paid per SRS)
        """
        period_start = self.period.start_date
        period_end = self.period.end_date
        total_days = (period_end - period_start).days + 1

        effective_start = period_start
        effective_end = period_end

        # New hire joining mid-period
        if employee.date_of_joining and employee.date_of_joining > period_start:
            # Find the first working day of the period (skip Sat/Sun)
            first_working_day = period_start
            while first_working_day.weekday() >= 5:  # 5=Saturday, 6=Sunday
                first_working_day += timedelta(days=1)

            if employee.date_of_joining <= first_working_day:
                pass  # No proration — joined on or before first working day
            else:
                effective_start = employee.date_of_joining

        # Employee exiting mid-period
        if employee.date_of_exit and employee.date_of_exit < period_end:
            effective_end = employee.date_of_exit

        days_payable = (effective_end - effective_start).days + 1
        days_payable = max(0, days_payable)

        if days_payable >= total_days:
            return Decimal('1'), total_days, total_days

        factor = Decimal(str(days_payable)) / Decimal(str(total_days))
        return factor, days_payable, total_days

    # ------------------------------------------------------------------
    # Per-employee computation
    # ------------------------------------------------------------------

    def compute_employee_payroll(self, employee: Employee) -> PayrollComputationResult:
        """
        Compute payroll for a single employee.

        Ghana Payroll Tax Rules Applied:
        1. Regular earnings: Taxed progressively via PAYE brackets
        2. Overtime: Taxed separately at flat rates (5%/10% for residents, 20% for non-residents)
        3. Bonus: 5% flat tax up to 15% of annual basic; excess added to PAYE
        4. Non-taxable earnings: Excluded from taxable income
        5. Pre-tax deductions (reduces_taxable): Reduce taxable income before PAYE
        6. Tax reliefs: Applied to reduce taxable income
        """
        salary = self.get_employee_salary(employee)
        if not salary:
            return PayrollComputationResult(
                success=False,
                employee_id=employee.id,
                error_message='No active salary record found'
            )

        basic_salary = salary.basic_salary
        annual_basic_salary = basic_salary * Decimal('12')

        # Calculate proration factor for mid-period joiners/exiters
        proration_factor, days_payable, total_days = self.calculate_proration_factor(employee)

        # Determine if employee is a tax resident (default to True if not specified)
        is_resident = getattr(employee, 'is_tax_resident', True)

        # Track earnings by category for proper tax treatment
        regular_taxable_earnings = Decimal('0')  # Subject to progressive PAYE
        non_taxable_earnings = Decimal('0')  # Exempt from all tax
        overtime_earnings = Decimal('0')  # Subject to overtime tax rates
        bonus_earnings = Decimal('0')  # Subject to bonus tax rates
        pre_tax_deductions = Decimal('0')  # Deductions that reduce taxable income
        other_deductions = Decimal('0')  # Regular deductions (after tax)
        employer_contributions = Decimal('0')  # Track employer contributions separately
        details = []

        # Helper function to categorize earnings
        def add_earning(component, amount):
            nonlocal regular_taxable_earnings, non_taxable_earnings, overtime_earnings, bonus_earnings

            if component.is_overtime:
                overtime_earnings += amount
            elif component.is_bonus:
                bonus_earnings += amount
            elif component.is_taxable:
                regular_taxable_earnings += amount
            else:
                non_taxable_earnings += amount

        # Helper function to categorize deductions
        def add_deduction(component, amount):
            nonlocal pre_tax_deductions, other_deductions

            if component.reduces_taxable:
                pre_tax_deductions += amount
            else:
                other_deductions += amount

        # Process basic salary (apply proration if component is prorated)
        basic_component = PayComponent.objects.filter(code='BASIC', is_active=True).first()
        prorated_basic = basic_salary  # default if no basic component found
        if basic_component:
            if basic_component.is_prorated and proration_factor < Decimal('1'):
                prorated_basic = (basic_salary * proration_factor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
            else:
                prorated_basic = basic_salary
            details.append({
                'pay_component': basic_component,
                'amount': prorated_basic,
                'quantity': Decimal('1'),
            })
            add_earning(basic_component, prorated_basic)

        # Process salary components
        salary_components = EmployeeSalaryComponent.objects.filter(
            employee_salary=salary,
            is_active=True
        ).select_related('pay_component')

        for comp in salary_components:
            if comp.pay_component.code == 'BASIC':
                continue

            amount = comp.amount
            # Apply proration to components flagged as prorated
            if comp.pay_component.is_prorated and proration_factor < Decimal('1'):
                amount = (amount * proration_factor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            details.append({
                'pay_component': comp.pay_component,
                'amount': amount,
                'quantity': Decimal('1'),
            })

            if comp.pay_component.component_type == 'EARNING':
                add_earning(comp.pay_component, amount)
            elif comp.pay_component.component_type == 'DEDUCTION':
                add_deduction(comp.pay_component, amount)
            elif comp.pay_component.component_type == 'EMPLOYER':
                employer_contributions += amount

        # Calculate gross earnings (all earnings regardless of tax treatment)
        earnings = regular_taxable_earnings + non_taxable_earnings + overtime_earnings + bonus_earnings

        # Process ad-hoc payments
        adhoc_payments = self.get_adhoc_payments(employee)
        for adhoc in adhoc_payments:
            details.append({
                'pay_component': adhoc.pay_component,
                'amount': adhoc.amount,
                'quantity': Decimal('1'),
                'notes': adhoc.description,
            })

            if adhoc.pay_component.component_type == 'EARNING':
                # Check special tax treatment flags first, then fall back to is_taxable
                if adhoc.pay_component.is_overtime:
                    overtime_earnings += adhoc.amount
                elif adhoc.pay_component.is_bonus:
                    bonus_earnings += adhoc.amount
                elif adhoc.is_taxable:  # Ad-hoc payments have their own is_taxable flag
                    regular_taxable_earnings += adhoc.amount
                else:
                    non_taxable_earnings += adhoc.amount
                earnings += adhoc.amount
            elif adhoc.pay_component.component_type == 'DEDUCTION':
                add_deduction(adhoc.pay_component, adhoc.amount)
            elif adhoc.pay_component.component_type == 'EMPLOYER':
                employer_contributions += adhoc.amount

        # Process active employee transactions (recurring and one-time)
        active_transactions = self.get_active_transactions(employee)
        for txn in active_transactions:
            # Skip if component is already handled by salary components (avoid duplicates)
            existing_codes = {comp.pay_component.code for comp in salary_components}
            if txn.pay_component.code in existing_codes:
                continue

            # Calculate the transaction amount
            txn_amount = txn.calculate_amount(basic_salary, earnings)

            # Prorate recurring transactions with prorated components
            if txn.is_recurring and txn.pay_component.is_prorated and proration_factor < Decimal('1'):
                txn_amount = (txn_amount * proration_factor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

            if txn_amount > 0:
                details.append({
                    'pay_component': txn.pay_component,
                    'amount': txn_amount,
                    'quantity': txn.quantity,
                    'notes': f'{txn.reference_number}: {txn.description or ""}',
                })

                if txn.pay_component.component_type == 'EARNING':
                    add_earning(txn.pay_component, txn_amount)
                    earnings += txn_amount
                elif txn.pay_component.component_type == 'DEDUCTION':
                    add_deduction(txn.pay_component, txn_amount)
                elif txn.pay_component.component_type == 'EMPLOYER':
                    employer_contributions += txn_amount

        gross_earnings = earnings

        # Calculate SSNIT contributions (on prorated basic if applicable)
        ssnit_base = prorated_basic if basic_component and basic_component.is_prorated else basic_salary
        ssnit_employee, ssnit_employer, tier2_employer = self.calculate_ssnit(ssnit_base)

        # Calculate tax relief
        tax_relief = self.calculate_tax_relief(gross_earnings)

        # Calculate Overtime Tax (separate from PAYE for qualifying employees)
        overtime_tax, overtime_qualifies = self.calculate_overtime_tax(
            overtime_earnings, basic_salary, annual_basic_salary, is_resident
        )
        overtime_to_paye = Decimal('0')
        if not overtime_qualifies:
            overtime_to_paye = overtime_earnings

        # Calculate Bonus Tax (separate from PAYE)
        bonus_tax, bonus_excess = self.calculate_bonus_tax(bonus_earnings, annual_basic_salary, is_resident)

        # Calculate Taxable Income for PAYE
        taxable_income = (
            regular_taxable_earnings +
            overtime_to_paye +
            bonus_excess -
            ssnit_employee -
            tax_relief -
            pre_tax_deductions
        )
        taxable_income = max(taxable_income, Decimal('0'))

        # Calculate PAYE on taxable income
        paye = self.calculate_paye(taxable_income)

        # Add statutory deduction details
        ssnit_component = PayComponent.objects.filter(code='SSNIT_EMP', is_active=True).first()
        if ssnit_component:
            details.append({
                'pay_component': ssnit_component,
                'amount': ssnit_employee,
                'quantity': Decimal('1'),
            })

        paye_component = PayComponent.objects.filter(code='PAYE', is_active=True).first()
        if paye_component:
            details.append({
                'pay_component': paye_component,
                'amount': paye,
                'quantity': Decimal('1'),
            })

        # Add overtime tax as a detail if applicable
        if overtime_tax > 0:
            overtime_tax_component = PayComponent.objects.filter(code='OVERTIME_TAX', is_active=True).first()
            if overtime_tax_component:
                details.append({
                    'pay_component': overtime_tax_component,
                    'amount': overtime_tax,
                    'quantity': Decimal('1'),
                    'notes': f'Overtime: GHS {overtime_earnings} (5%/10% rate)',
                })

        # Add bonus tax as a detail if applicable
        if bonus_tax > 0:
            bonus_tax_component = PayComponent.objects.filter(code='BONUS_TAX', is_active=True).first()
            if bonus_tax_component:
                details.append({
                    'pay_component': bonus_tax_component,
                    'amount': bonus_tax,
                    'quantity': Decimal('1'),
                    'notes': f'Bonus: GHS {bonus_earnings} (5% flat rate)',
                })

        # Total deductions = Other deductions + Pre-tax deductions + SSNIT + PAYE + Overtime Tax + Bonus Tax
        total_deductions = other_deductions + pre_tax_deductions + ssnit_employee + paye + overtime_tax + bonus_tax
        net_salary = gross_earnings - total_deductions

        # Employer cost includes gross salary, SSNIT contributions, and any employer-type transactions
        employer_cost = gross_earnings + ssnit_employer + tier2_employer + employer_contributions

        return PayrollComputationResult(
            success=True,
            employee_id=employee.id,
            basic_salary=prorated_basic if basic_component else basic_salary,
            gross_earnings=gross_earnings,
            total_deductions=total_deductions,
            net_salary=net_salary,
            taxable_income=taxable_income,
            paye=paye,
            overtime_tax=overtime_tax,
            bonus_tax=bonus_tax,
            total_overtime=overtime_earnings,
            total_bonus=bonus_earnings,
            ssnit_employee=ssnit_employee,
            ssnit_employer=ssnit_employer,
            tier2_employer=tier2_employer,
            employer_cost=employer_cost,
            proration_factor=proration_factor,
            days_payable=days_payable,
            total_days=total_days,
        ), details

    # ------------------------------------------------------------------
    # Bulk payroll computation
    # ------------------------------------------------------------------

    @transaction.atomic
    def compute_payroll(self, user) -> dict:
        """
        Compute payroll for all eligible employees.
        Returns summary statistics.

        Allows recomputation for:
        - DRAFT: Initial computation
        - COMPUTED: Rerun to pick up changes (transactions, salaries, etc.)
        - REJECTED: Recompute after corrections
        """
        start_time = timezone.now()

        allowed_statuses = ['DRAFT', 'COMPUTED', 'REJECTED']
        if self.payroll_run.status not in allowed_statuses:
            raise ValueError(
                f'Cannot compute payroll in status: {self.payroll_run.status}. '
                f'Payroll must be in one of: {", ".join(allowed_statuses)}'
            )

        # Ensure the payroll period is still open for processing
        closed_period_statuses = ['PAID', 'CLOSED']
        if self.period.status in closed_period_statuses:
            raise ValueError(
                f'Cannot compute payroll for {self.period.status.lower()} period. '
                f'The payroll period must be open for recomputation.'
            )

        # Check payroll validation status — warn if not all districts validated
        from .models import PayrollValidation
        pending_validations = PayrollValidation.objects.filter(
            payroll_period=self.period,
        ).exclude(status=PayrollValidation.Status.VALIDATED)
        if pending_validations.exists() and self.period.status not in closed_period_statuses:
            # Log warning but don't block — validation is advisory
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(
                f'Computing payroll with {pending_validations.count()} unvalidated districts '
                f'for period {self.period.name}'
            )

        # Clear existing payroll items before recomputation
        PayrollItem.objects.filter(payroll_run=self.payroll_run).delete()

        self.payroll_run.status = PayrollRun.Status.COMPUTING
        self.payroll_run.save(update_fields=['status'])

        employees = list(self.get_eligible_employees())
        employee_count = len(employees)

        # Initialize progress tracking in cache
        progress_key = f'payroll_progress_{self.payroll_run.id}'
        cache.set(progress_key, {
            'status': 'computing',
            'total': employee_count,
            'processed': 0,
            'current_employee': '',
            'percentage': 0,
            'started_at': timezone.now().isoformat(),
        }, timeout=3600)  # 1 hour timeout

        total_employees = 0
        total_gross = Decimal('0')
        total_deductions = Decimal('0')
        total_net = Decimal('0')
        total_employer_cost = Decimal('0')
        total_paye = Decimal('0')
        total_overtime_tax = Decimal('0')
        total_bonus_tax = Decimal('0')
        total_ssnit_employee = Decimal('0')
        total_ssnit_employer = Decimal('0')
        total_tier2_employer = Decimal('0')
        errors = []
        processed_count = 0

        for employee in employees:
            # Update progress in cache
            processed_count += 1
            percentage = int((processed_count / employee_count) * 100) if employee_count > 0 else 0
            cache.set(progress_key, {
                'status': 'computing',
                'total': employee_count,
                'processed': processed_count,
                'current_employee': employee.full_name,
                'percentage': percentage,
                'started_at': cache.get(progress_key, {}).get('started_at', ''),
            }, timeout=3600)

            result = self.compute_employee_payroll(employee)

            if isinstance(result, tuple):
                computation, details = result
            else:
                computation = result
                details = []

            bank_account = BankAccount.objects.filter(
                employee=employee,
                is_primary=True,
                is_active=True
            ).first()

            payroll_item = PayrollItem.objects.create(
                payroll_run=self.payroll_run,
                employee=employee,
                employee_salary=self.get_employee_salary(employee),
                status=PayrollItem.Status.COMPUTED if computation.success else PayrollItem.Status.ERROR,
                basic_salary=computation.basic_salary,
                gross_earnings=computation.gross_earnings,
                total_deductions=computation.total_deductions,
                net_salary=computation.net_salary,
                employer_cost=computation.employer_cost,
                taxable_income=computation.taxable_income,
                paye=computation.paye,
                overtime_tax=computation.overtime_tax,
                bonus_tax=computation.bonus_tax,
                total_overtime=computation.total_overtime,
                total_bonus=computation.total_bonus,
                ssnit_employee=computation.ssnit_employee,
                ssnit_employer=computation.ssnit_employer,
                tier2_employer=computation.tier2_employer,
                days_worked=computation.days_payable,
                proration_factor=computation.proration_factor,
                bank_name=bank_account.bank_name if bank_account else None,
                bank_account_number=bank_account.account_number if bank_account else None,
                bank_branch=bank_account.branch_name if bank_account else None,
                error_message=computation.error_message,
            )

            for detail in details:
                PayrollItemDetail.objects.create(
                    payroll_item=payroll_item,
                    **detail
                )

            if computation.success:
                total_employees += 1
                total_gross += computation.gross_earnings
                total_deductions += computation.total_deductions
                total_net += computation.net_salary
                total_employer_cost += computation.employer_cost
                total_paye += computation.paye
                total_overtime_tax += computation.overtime_tax
                total_bonus_tax += computation.bonus_tax
                total_ssnit_employee += computation.ssnit_employee
                total_ssnit_employer += computation.ssnit_employer
                total_tier2_employer += computation.tier2_employer
            else:
                errors.append({
                    'employee_id': employee.id,
                    'employee_number': employee.employee_number,
                    'error': computation.error_message
                })

        # Apply approved backpay requests
        from .backpay_service import BackpayService
        approved_backpays = BackpayRequest.objects.filter(
            status='APPROVED',
            applied_to_run__isnull=True
        ).select_related('employee', 'new_salary', 'old_salary')

        for bp in approved_backpays:
            payroll_item = PayrollItem.objects.filter(
                payroll_run=self.payroll_run,
                employee=bp.employee
            ).first()
            if payroll_item:
                try:
                    service = BackpayService(bp.employee, bp.reason)
                    service.apply_to_payroll(bp, self.payroll_run)
                    # Update payroll item totals in running totals
                    payroll_item.refresh_from_db()
                    total_gross = total_gross + bp.total_arrears_earnings
                    total_deductions = total_deductions + bp.total_arrears_deductions
                    total_net = total_net + bp.net_arrears
                except Exception as e:
                    errors.append({
                        'employee_id': bp.employee.id,
                        'employee_number': bp.employee.employee_number,
                        'error': f'Backpay application failed: {str(e)}'
                    })

        self.payroll_run.status = PayrollRun.Status.COMPUTED
        self.payroll_run.total_employees = total_employees
        self.payroll_run.total_gross = total_gross
        self.payroll_run.total_deductions = total_deductions
        self.payroll_run.total_net = total_net
        self.payroll_run.total_employer_cost = total_employer_cost
        self.payroll_run.total_paye = total_paye
        self.payroll_run.total_overtime_tax = total_overtime_tax
        self.payroll_run.total_bonus_tax = total_bonus_tax
        self.payroll_run.total_ssnit_employee = total_ssnit_employee
        self.payroll_run.total_ssnit_employer = total_ssnit_employer
        self.payroll_run.total_tier2_employer = total_tier2_employer
        self.payroll_run.computed_by = user
        self.payroll_run.computed_at = timezone.now()
        self.payroll_run.save()

        # Update period status to COMPUTED
        if self.period.status in [PayrollPeriod.Status.OPEN, PayrollPeriod.Status.PROCESSING]:
            self.period.status = PayrollPeriod.Status.COMPUTED
            self.period.save(update_fields=['status', 'updated_at'])

        # Mark progress as complete
        cache.set(progress_key, {
            'status': 'completed',
            'total': employee_count,
            'processed': employee_count,
            'current_employee': '',
            'percentage': 100,
            'completed_at': timezone.now().isoformat(),
            'total_employees': total_employees,
            'errors_count': len(errors),
        }, timeout=300)  # Keep for 5 minutes after completion

        # Create summary audit log entry (replaces per-record signal-based audit)
        end_time = timezone.now()
        duration = (end_time - start_time).total_seconds()
        try:
            from core.models import AuditLog
            from core.middleware import get_current_user, get_current_request

            audit_user = get_current_user() or user
            ip_address = None
            user_agent = ''
            request = get_current_request()
            if request:
                x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
                ip_address = x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR')
                user_agent = request.META.get('HTTP_USER_AGENT', '')

            AuditLog.objects.create(
                user=audit_user,
                action=AuditLog.ActionType.CREATE,
                model_name='PayrollRun',
                object_id=str(self.payroll_run.pk),
                object_repr=f'Payroll computation: {self.payroll_run.run_number}'[:255],
                changes={
                    'started_at': start_time.isoformat(),
                    'completed_at': end_time.isoformat(),
                    'duration_seconds': round(duration, 2),
                    'total_employees': total_employees,
                    'total_gross': str(total_gross),
                    'total_deductions': str(total_deductions),
                    'total_net': str(total_net),
                    'error_count': len(errors),
                    'period_name': self.period.name,
                },
                ip_address=ip_address,
                user_agent=user_agent,
            )
        except Exception:
            import logging
            logging.getLogger('hrms').warning(
                'Failed to create payroll computation audit log', exc_info=True
            )

        return {
            'total_employees': total_employees,
            'total_gross': str(total_gross),
            'total_deductions': str(total_deductions),
            'total_net': str(total_net),
            'total_employer_cost': str(total_employer_cost),
            'total_paye': str(total_paye),
            'total_ssnit_employee': str(total_ssnit_employee),
            'total_ssnit_employer': str(total_ssnit_employer),
            'total_tier2_employer': str(total_tier2_employer),
            'errors': errors,
        }
