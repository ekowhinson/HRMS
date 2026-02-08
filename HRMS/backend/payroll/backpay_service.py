"""
Backpay & Retroactive Pay computation service.

Handles two scenarios:
  A. Salary revision / promotion — employee was on payroll, compare old vs new
  B. Backdated joining — employee was NOT on payroll, old amounts are 0

For each affected period, the service resolves the complete payroll picture
(salary, structure, grade/band, transactions) as it should have been at that time.
"""

from decimal import Decimal, ROUND_HALF_UP
from datetime import timedelta
from typing import Optional

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from employees.models import Employee, EmploymentHistory
from .models import (
    BackpayRequest, BackpayDetail, PayrollPeriod, PayrollItem, PayrollItemDetail,
    PayrollRun, PayComponent, EmployeeSalary, EmployeeSalaryComponent,
    EmployeeTransaction, PayrollSettings,
)
from .services import PayrollService


class BackpayService:
    """Service for computing and applying backpay/retroactive pay arrears."""

    def __init__(self, employee, reason, new_salary=None, old_salary=None, reference_period=None):
        self.employee = employee
        self.reason = reason
        self.new_salary = new_salary
        self.old_salary = old_salary
        self.reference_period = reference_period

    # ── Per-Period Resolution ──

    def _get_applicable_salary(self, period) -> Optional[EmployeeSalary]:
        """
        Find the EmployeeSalary effective for a given period.
        When a reference_period is set, uses its start_date for the lookup
        so the "new" salary figures come from that specific period.
        """
        lookup_date = period.start_date
        if self.reference_period:
            lookup_date = self.reference_period.start_date
        return EmployeeSalary.objects.filter(
            employee=self.employee,
            effective_from__lte=lookup_date
        ).order_by('-effective_from').first()

    def _get_grade_for_period(self, period):
        """
        Resolve the employee's grade at a historical period using EmploymentHistory.
        3-tier fallback:
          1. EmploymentHistory (most recent grade change at/before period start)
          2. salary_structure.grade from applicable salary
          3. employee.grade (current)
        """
        history = EmploymentHistory.objects.filter(
            employee=self.employee,
            change_type__in=[
                EmploymentHistory.ChangeType.GRADE_CHANGE,
                EmploymentHistory.ChangeType.PROMOTION,
                EmploymentHistory.ChangeType.DEMOTION,
                EmploymentHistory.ChangeType.HIRE,
            ],
            effective_date__lte=period.start_date
        ).order_by('-effective_date').first()

        if history and history.new_grade:
            return history.new_grade

        # Fallback: salary structure grade
        salary = self._get_applicable_salary(period)
        if salary and salary.salary_structure and salary.salary_structure.grade:
            return salary.salary_structure.grade

        # Fallback: current grade
        return self.employee.grade

    def _get_applicable_transactions(self, period, salary) -> list:
        """
        Get all transactions applicable to this employee for a historical period.
        Mirrors PayrollService.get_active_transactions() but uses the period's
        grade/band instead of the employee's current grade.
        When reference_period is set, uses its dates for grade/transaction lookups.
        """
        ref = self.reference_period or period
        grade = self._get_grade_for_period(ref)

        # Build filter for which transactions apply
        employee_filter = Q(target_type='INDIVIDUAL', employee=self.employee)

        if grade:
            employee_filter |= Q(target_type='GRADE', job_grade=grade)
            if hasattr(grade, 'salary_band') and grade.salary_band_id:
                employee_filter |= Q(target_type='BAND', salary_band_id=grade.salary_band_id)

        # Also check via salary_notch if grade has no band
        if not (grade and hasattr(grade, 'salary_band') and grade.salary_band_id):
            if self.employee.salary_notch and self.employee.salary_notch.level:
                employee_filter |= Q(
                    target_type='BAND',
                    salary_band_id=self.employee.salary_notch.level.band_id
                )

        return list(EmployeeTransaction.objects.filter(
            employee_filter,
            status__in=['ACTIVE', 'COMPLETED'],
            effective_from__lte=period.end_date
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=period.start_date)
        ).filter(
            Q(is_recurring=True) | Q(payroll_period=period)
        ).select_related('pay_component'))

    # ── Paid vs Should-Have-Paid ──

    def get_actually_paid(self, period) -> Optional[PayrollItem]:
        """Get the PayrollItem for employee in this period (from any PAID/CLOSED run)."""
        return PayrollItem.objects.filter(
            employee=self.employee,
            payroll_run__payroll_period=period,
            payroll_run__status__in=['PAID', 'APPROVED', 'COMPUTED'],
            status__in=['PAID', 'APPROVED', 'COMPUTED']
        ).select_related('payroll_run').prefetch_related(
            'details', 'details__pay_component'
        ).first()

    def _build_paid_map(self, payroll_item) -> dict:
        """
        Extract {component_code: amount} from PayrollItemDetail rows.
        Only includes components where is_arrears_applicable=True.
        If payroll_item is None → returns empty dict (all amounts = 0).
        """
        if payroll_item is None:
            return {}

        paid_map = {}
        for detail in payroll_item.details.all():
            if detail.pay_component.is_arrears_applicable and not detail.is_arrear:
                paid_map[detail.pay_component.code] = detail.amount
        return paid_map

    def _build_should_have_paid_map(self, period, salary, transactions, proration_factor) -> dict:
        """
        Compute what should have been paid for this period.
        Returns {component_code: amount}.
        Only includes components where is_arrears_applicable=True.
        """
        should_map = {}

        if not salary:
            return should_map

        basic_salary = salary.basic_salary

        # 1. Basic salary
        basic_component = PayComponent.objects.filter(code='BASIC', is_active=True).first()
        if basic_component and basic_component.is_arrears_applicable:
            prorated_basic = basic_salary
            if basic_component.is_prorated and proration_factor < Decimal('1'):
                prorated_basic = (basic_salary * proration_factor).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
            should_map['BASIC'] = prorated_basic

        prorated_basic = should_map.get('BASIC', basic_salary)

        # 2. EmployeeSalaryComponent records
        salary_components = EmployeeSalaryComponent.objects.filter(
            employee_salary=salary,
            is_active=True
        ).select_related('pay_component')

        salary_comp_codes = set()
        gross_earnings = prorated_basic

        for comp in salary_components:
            if comp.pay_component.code == 'BASIC':
                continue
            if not comp.pay_component.is_arrears_applicable:
                continue

            amount = comp.amount
            if comp.pay_component.is_prorated and proration_factor < Decimal('1'):
                amount = (amount * proration_factor).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )
            should_map[comp.pay_component.code] = amount
            salary_comp_codes.add(comp.pay_component.code)

            if comp.pay_component.component_type == 'EARNING':
                gross_earnings += amount

        # 3. Transaction amounts (skip components already covered by salary components)
        for txn in transactions:
            if txn.pay_component.code in salary_comp_codes:
                continue
            if not txn.pay_component.is_arrears_applicable:
                continue

            txn_amount = txn.calculate_amount(basic_salary, gross_earnings)

            if txn.is_recurring and txn.pay_component.is_prorated and proration_factor < Decimal('1'):
                txn_amount = (txn_amount * proration_factor).quantize(
                    Decimal('0.01'), rounding=ROUND_HALF_UP
                )

            if txn_amount > 0:
                # Accumulate if multiple transactions for same component
                if txn.pay_component.code in should_map:
                    should_map[txn.pay_component.code] += txn_amount
                else:
                    should_map[txn.pay_component.code] = txn_amount

                if txn.pay_component.component_type == 'EARNING':
                    gross_earnings += txn_amount

        return should_map

    # ── Proration & Statutory ──

    def _get_proration_factor(self, period, payroll_item=None) -> Decimal:
        """
        Get the proration factor for a period.
        If payroll_item exists, reuse its proration_factor.
        For backdated joining (no payroll_item), calculate from date_of_joining.
        """
        if payroll_item is not None:
            return payroll_item.proration_factor

        # Backdated joining: calculate proration for first period
        if self.employee.date_of_joining and self.employee.date_of_joining > period.start_date:
            total_days = (period.end_date - period.start_date).days + 1
            days_payable = (period.end_date - self.employee.date_of_joining).days + 1
            days_payable = max(0, days_payable)

            if days_payable >= total_days:
                return Decimal('1')
            return (Decimal(str(days_payable)) / Decimal(str(total_days))).quantize(
                Decimal('0.0001'), rounding=ROUND_HALF_UP
            )

        return Decimal('1')

    def _recalculate_statutory(self, old_basic, new_basic, old_taxable, new_taxable, payroll_service):
        """
        Recalculate SSNIT and PAYE differences.
        Returns dict with ssnit_diff, paye_diff components.
        """
        result = {}

        # SSNIT difference
        old_ssnit_emp, old_ssnit_er, old_tier2 = payroll_service.calculate_ssnit(old_basic)
        new_ssnit_emp, new_ssnit_er, new_tier2 = payroll_service.calculate_ssnit(new_basic)
        ssnit_diff = new_ssnit_emp - old_ssnit_emp

        if ssnit_diff != 0:
            ssnit_component = PayComponent.objects.filter(code='SSNIT_EMP', is_active=True).first()
            if ssnit_component:
                result['SSNIT_EMP'] = {
                    'component': ssnit_component,
                    'old_amount': old_ssnit_emp,
                    'new_amount': new_ssnit_emp,
                    'difference': ssnit_diff,
                }

        # PAYE difference
        old_paye = payroll_service.calculate_paye(max(old_taxable, Decimal('0')))
        new_paye = payroll_service.calculate_paye(max(new_taxable, Decimal('0')))
        paye_diff = new_paye - old_paye

        if paye_diff != 0:
            paye_component = PayComponent.objects.filter(code='PAYE', is_active=True).first()
            if paye_component:
                result['PAYE'] = {
                    'component': paye_component,
                    'old_amount': old_paye,
                    'new_amount': new_paye,
                    'difference': paye_diff,
                }

        return result

    # ── Period-Specific PayrollService ──

    def _get_payroll_service_for_period(self, period):
        """
        Get a PayrollService scoped to a specific period for accurate
        PAYE/SSNIT rate resolution. Tax brackets and SSNIT rates have
        effective_from/effective_to and may differ between periods.

        Strategy:
          1. Use the actual PayrollRun for this period (best — exact rates used originally)
          2. Fall back to a mock run wrapping the period (still gets correct rates via date filtering)
        """
        run = PayrollRun.objects.filter(
            payroll_period=period,
            status__in=['PAID', 'APPROVED', 'COMPUTED']
        ).first()

        if run:
            return PayrollService(run)

        # Fallback: create a minimal mock run so PayrollService can resolve rates
        # by filtering on period dates
        mock_run = type('MockRun', (), {
            'payroll_period': period,
        })()
        return PayrollService(mock_run)

    # ── Validation & Orchestration ──

    def get_affected_periods(self, eff_from, eff_to):
        """Get PAID/CLOSED periods in the date range."""
        return PayrollPeriod.objects.filter(
            status__in=['PAID', 'CLOSED'],
            start_date__lte=eff_to,
            end_date__gte=eff_from,
            is_supplementary=False
        ).order_by('start_date')

    def validate_no_overlap(self, eff_from, eff_to):
        """Check no APPLIED BackpayRequest overlaps these dates for this employee."""
        overlapping = BackpayRequest.objects.filter(
            employee=self.employee,
            status='APPLIED',
            effective_from__lte=eff_to,
            effective_to__gte=eff_from,
        ).exists()

        if overlapping:
            raise ValueError(
                'An applied backpay request already exists for overlapping dates. '
                'Cannot create a new request for the same period.'
            )

    def calculate(self, eff_from, eff_to) -> dict:
        """
        Main backpay calculation algorithm.

        For each affected period:
          1. Get what was actually paid (PayrollItem or None for backdated joining)
          2. Resolve the applicable salary, transactions for this specific period
          3. Compute what should have been paid
          4. Calculate differences per component
          5. Recalculate SSNIT/PAYE differences
          6. Aggregate totals

        Returns: {periods: [...], totals: {...}}
        """
        affected_periods = self.get_affected_periods(eff_from, eff_to)

        periods_data = []
        total_earnings_arrears = Decimal('0')
        total_deductions_arrears = Decimal('0')

        for period in affected_periods:
            payroll_item = self.get_actually_paid(period)
            salary = self._get_applicable_salary(period)
            transactions = self._get_applicable_transactions(period, salary)
            proration = self._get_proration_factor(period, payroll_item)

            # Get period-specific PayrollService for correct PAYE/SSNIT rates
            payroll_service = self._get_payroll_service_for_period(period)

            paid_map = self._build_paid_map(payroll_item)
            should_map = self._build_should_have_paid_map(period, salary, transactions, proration)

            # Calculate differences per component
            all_codes = set(list(paid_map.keys()) + list(should_map.keys()))
            period_details = []
            period_earnings_diff = Decimal('0')
            period_deductions_diff = Decimal('0')

            old_basic = paid_map.get('BASIC', Decimal('0'))
            new_basic = should_map.get('BASIC', Decimal('0'))

            # Track old/new taxable income for PAYE recalculation
            old_taxable = Decimal('0')
            new_taxable = Decimal('0')

            for code in all_codes:
                # Skip statutory components - they'll be recalculated
                if code in ('SSNIT_EMP', 'PAYE', 'OVERTIME_TAX', 'BONUS_TAX'):
                    continue

                old_amount = paid_map.get(code, Decimal('0'))
                new_amount = should_map.get(code, Decimal('0'))
                diff = new_amount - old_amount

                if diff == Decimal('0'):
                    continue

                component = PayComponent.objects.filter(code=code, is_active=True).first()
                if not component:
                    continue

                period_details.append({
                    'pay_component': component,
                    'old_amount': old_amount,
                    'new_amount': new_amount,
                    'difference': diff,
                })

                if component.component_type == 'EARNING':
                    period_earnings_diff += diff
                    if component.is_taxable:
                        old_taxable += old_amount
                        new_taxable += new_amount
                elif component.component_type == 'DEDUCTION':
                    period_deductions_diff += diff
                    if component.reduces_taxable:
                        old_taxable -= old_amount
                        new_taxable -= new_amount

            # Recalculate statutory deductions
            if payroll_service:
                # Compute old/new SSNIT to adjust taxable income
                old_ssnit_emp, _, _ = payroll_service.calculate_ssnit(old_basic)
                new_ssnit_emp, _, _ = payroll_service.calculate_ssnit(new_basic)

                # Adjust taxable income for SSNIT
                old_taxable_adjusted = old_taxable - old_ssnit_emp
                new_taxable_adjusted = new_taxable - new_ssnit_emp

                statutory = self._recalculate_statutory(
                    old_basic, new_basic,
                    old_taxable_adjusted, new_taxable_adjusted,
                    payroll_service
                )

                for code, data in statutory.items():
                    period_details.append({
                        'pay_component': data['component'],
                        'old_amount': data['old_amount'],
                        'new_amount': data['new_amount'],
                        'difference': data['difference'],
                    })
                    period_deductions_diff += data['difference']

            total_earnings_arrears += period_earnings_diff
            total_deductions_arrears += period_deductions_diff

            periods_data.append({
                'period': period,
                'payroll_item': payroll_item,
                'applicable_salary': salary,
                'proration_factor': str(proration),
                'details': period_details,
                'earnings_diff': period_earnings_diff,
                'deductions_diff': period_deductions_diff,
                'net_diff': period_earnings_diff - period_deductions_diff,
            })

        net_arrears = total_earnings_arrears - total_deductions_arrears

        return {
            'periods': periods_data,
            'totals': {
                'total_arrears_earnings': total_earnings_arrears,
                'total_arrears_deductions': total_deductions_arrears,
                'net_arrears': net_arrears,
                'periods_covered': len(periods_data),
            }
        }

    def preview(self, eff_from, eff_to) -> dict:
        """Calculate and return JSON-serializable preview."""
        result = self.calculate(eff_from, eff_to)

        preview_periods = []
        for p in result['periods']:
            preview_details = []
            for d in p['details']:
                preview_details.append({
                    'component_code': d['pay_component'].code,
                    'component_name': d['pay_component'].name,
                    'component_type': d['pay_component'].component_type,
                    'old_amount': str(d['old_amount']),
                    'new_amount': str(d['new_amount']),
                    'difference': str(d['difference']),
                })

            preview_periods.append({
                'period_id': str(p['period'].id),
                'period_name': p['period'].name,
                'has_payroll_item': p['payroll_item'] is not None,
                'applicable_salary_id': str(p['applicable_salary'].id) if p['applicable_salary'] else None,
                'proration_factor': p['proration_factor'],
                'details': preview_details,
                'earnings_diff': str(p['earnings_diff']),
                'deductions_diff': str(p['deductions_diff']),
                'net_diff': str(p['net_diff']),
            })

        return {
            'employee_id': str(self.employee.id),
            'employee_number': self.employee.employee_number,
            'employee_name': self.employee.full_name,
            'periods': preview_periods,
            'totals': {
                'total_arrears_earnings': str(result['totals']['total_arrears_earnings']),
                'total_arrears_deductions': str(result['totals']['total_arrears_deductions']),
                'net_arrears': str(result['totals']['net_arrears']),
                'periods_covered': result['totals']['periods_covered'],
            }
        }

    @transaction.atomic
    def create_request(self, eff_from, eff_to, reason, description, user) -> BackpayRequest:
        """
        Run calculate(), create BackpayRequest + BackpayDetail records.
        Status transitions to PREVIEWED.
        """
        self.validate_no_overlap(eff_from, eff_to)
        result = self.calculate(eff_from, eff_to)
        totals = result['totals']

        bp_request = BackpayRequest.objects.create(
            employee=self.employee,
            new_salary=self.new_salary,
            old_salary=self.old_salary,
            reason=reason,
            description=description,
            effective_from=eff_from,
            effective_to=eff_to,
            total_arrears_earnings=totals['total_arrears_earnings'],
            total_arrears_deductions=totals['total_arrears_deductions'],
            net_arrears=totals['net_arrears'],
            periods_covered=totals['periods_covered'],
            status=BackpayRequest.Status.PREVIEWED,
            created_by=user,
        )

        # Create detail records
        for period_data in result['periods']:
            for detail in period_data['details']:
                BackpayDetail.objects.create(
                    backpay_request=bp_request,
                    payroll_period=period_data['period'],
                    original_payroll_item=period_data['payroll_item'],
                    applicable_salary=period_data['applicable_salary'],
                    pay_component=detail['pay_component'],
                    old_amount=detail['old_amount'],
                    new_amount=detail['new_amount'],
                    difference=detail['difference'],
                )

        return bp_request

    @transaction.atomic
    def apply_to_payroll(self, backpay_request, payroll_run):
        """
        Apply backpay arrears to a payroll run.
        Creates PayrollItemDetail rows with is_arrear=True on the employee's PayrollItem.
        Updates PayrollItem totals and marks BackpayRequest as APPLIED.
        """
        if backpay_request.status != BackpayRequest.Status.APPROVED:
            raise ValueError('Backpay request must be APPROVED before applying.')

        payroll_item = PayrollItem.objects.filter(
            payroll_run=payroll_run,
            employee=backpay_request.employee
        ).first()

        if not payroll_item:
            raise ValueError(
                f'No payroll item found for employee {backpay_request.employee.employee_number} '
                f'in payroll run {payroll_run.run_number}'
            )

        # Group details by component
        details = backpay_request.details.select_related('pay_component').all()

        # Aggregate differences by component across all periods
        component_totals = {}
        for detail in details:
            code = detail.pay_component.code
            if code not in component_totals:
                component_totals[code] = {
                    'component': detail.pay_component,
                    'total_difference': Decimal('0'),
                    'period_count': 0,
                }
            component_totals[code]['total_difference'] += detail.difference
            component_totals[code]['period_count'] += 1

        total_earnings_arrears = Decimal('0')
        total_deductions_arrears = Decimal('0')

        for code, data in component_totals.items():
            if data['total_difference'] == Decimal('0'):
                continue

            PayrollItemDetail.objects.create(
                payroll_item=payroll_item,
                pay_component=data['component'],
                amount=data['total_difference'],
                quantity=Decimal('1'),
                is_arrear=True,
                arrear_months=data['period_count'],
                backpay_request=backpay_request,
                notes=f"Backpay {backpay_request.reference_number}: "
                      f"{data['period_count']} period(s) arrears",
            )

            if data['component'].component_type == 'EARNING':
                total_earnings_arrears += data['total_difference']
            elif data['component'].component_type == 'DEDUCTION':
                total_deductions_arrears += data['total_difference']

        # Update PayrollItem totals
        payroll_item.gross_earnings += total_earnings_arrears
        payroll_item.total_deductions += total_deductions_arrears
        payroll_item.net_salary = payroll_item.gross_earnings - payroll_item.total_deductions
        payroll_item.save(update_fields=[
            'gross_earnings', 'total_deductions', 'net_salary', 'updated_at'
        ])

        # Mark backpay request as applied
        backpay_request.status = BackpayRequest.Status.APPLIED
        backpay_request.applied_to_run = payroll_run
        backpay_request.applied_at = timezone.now()
        backpay_request.save(update_fields=[
            'status', 'applied_to_run', 'applied_at', 'updated_at'
        ])

        return backpay_request


class RetropayDetectionService:
    """Detect records with retroactive pay implications for paid/closed periods."""

    def detect(self):
        """
        Scan for backdated changes affecting PAID/CLOSED periods.
        Only detects records created/updated during the current active period.
        Returns list of detected implications grouped by employee.
        """
        active_period = PayrollSettings.get_active_period()
        if not active_period:
            return []

        paid_periods = PayrollPeriod.objects.filter(
            status__in=['PAID', 'CLOSED'],
            is_supplementary=False
        ).order_by('start_date')

        if not paid_periods.exists():
            return []

        # Only detect records created during the current active period
        self._active_period_start = active_period.start_date
        self._active_period_end = active_period.end_date

        covered = self._get_covered_employees()
        detections = {}

        for period in paid_periods:
            self._detect_salary_changes(period, covered, detections)
            self._detect_grade_changes(period, covered, detections)
            self._detect_transaction_changes(period, covered, detections)

        return list(detections.values())

    def _get_covered_employees(self):
        """Get employee IDs that already have non-cancelled backpay requests."""
        return set(BackpayRequest.objects.filter(
            status__in=['DRAFT', 'PREVIEWED', 'APPROVED', 'APPLIED']
        ).values_list('employee_id', flat=True))

    def _detect_salary_changes(self, period, covered, detections):
        """Find salary records created during the active period but effective in a past period.

        A salary change with no end date is effective from its effective_from
        through the current active period, so it affects every PAID/CLOSED
        period from effective_from onward.
        """
        salaries = EmployeeSalary.objects.filter(
            effective_from__lte=period.end_date,  # Started on or before this period
            created_at__date__gt=period.end_date,  # Created after this period ended
            created_at__date__gte=self._active_period_start,  # Created during active period
            created_at__date__lte=self._active_period_end,
        ).select_related('employee')

        for sal in salaries:
            emp_id = sal.employee_id
            if emp_id in covered:
                continue
            self._add_detection(
                detections, sal.employee, 'SALARY_CHANGE',
                f'Salary revised to {sal.basic_salary} effective {sal.effective_from}',
                period, sal.created_at,
            )

    def _detect_grade_changes(self, period, covered, detections):
        """Find grade/promotion changes created during the active period but effective in a past period.

        Grade changes have no end date — they are effective from their
        effective_date onward, affecting all subsequent periods.
        """
        changes = EmploymentHistory.objects.filter(
            change_type__in=['PROMOTION', 'GRADE_CHANGE', 'SALARY_REVISION', 'DEMOTION'],
            effective_date__lte=period.end_date,  # Effective on or before this period
            created_at__date__gt=period.end_date,  # Created after this period ended
            created_at__date__gte=self._active_period_start,  # Created during active period
            created_at__date__lte=self._active_period_end,
        ).select_related('employee', 'new_grade', 'previous_grade')

        for ch in changes:
            if ch.employee_id in covered:
                continue
            desc = f'{ch.get_change_type_display()}'
            if ch.previous_grade and ch.new_grade:
                desc += f': {ch.previous_grade.code} \u2192 {ch.new_grade.code}'
            desc += f' effective {ch.effective_date}'
            self._add_detection(
                detections, ch.employee, ch.change_type,
                desc, period, ch.created_at,
            )

    def _detect_transaction_changes(self, period, covered, detections):
        """Find transactions created during the active period but effective in a past period.

        Transactions have effective_from and optional effective_to. If effective_to
        is null, the transaction is ongoing from effective_from.
        """
        txns = EmployeeTransaction.objects.filter(
            effective_from__lte=period.end_date,  # Started on or before this period
            created_at__date__gt=period.end_date,  # Created after this period ended
            created_at__date__gte=self._active_period_start,  # Created during active period
            created_at__date__lte=self._active_period_end,
            is_current_version=True,
            status__in=['ACTIVE', 'APPROVED'],
            target_type='INDIVIDUAL',
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=period.start_date)
        ).select_related('employee', 'pay_component')

        for txn in txns:
            if not txn.employee_id or txn.employee_id in covered:
                continue
            desc = f'{txn.pay_component.name} ({txn.pay_component.code}) effective {txn.effective_from}'
            self._add_detection(
                detections, txn.employee, 'TRANSACTION_CHANGE',
                desc, period, txn.created_at,
            )

    def _add_detection(self, detections, employee, change_type, description, period, created_at):
        """Add or merge a detection for an employee."""
        emp_id = employee.id
        if emp_id not in detections:
            detections[emp_id] = {
                'employee_id': str(emp_id),
                'employee_number': employee.employee_number,
                'employee_name': employee.full_name,
                'changes': [],
                'affected_periods': [],
                'earliest_from': period.start_date,
                'latest_to': period.end_date,
            }

        det = detections[emp_id]
        det['changes'].append({
            'type': change_type,
            'description': description,
            'affected_period': period.name,
            'created_at': created_at.isoformat(),
        })

        period_id = str(period.id)
        if period_id not in [p['id'] for p in det['affected_periods']]:
            det['affected_periods'].append({
                'id': period_id,
                'name': period.name,
            })

        if period.start_date < det['earliest_from']:
            det['earliest_from'] = period.start_date
        if period.end_date > det['latest_to']:
            det['latest_to'] = period.end_date
