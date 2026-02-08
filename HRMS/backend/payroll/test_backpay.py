"""
Tests for the Backpay & Retroactive Pay system.

Covers:
  - BackpayService.calculate() for Scenario A (salary revision)
  - BackpayService.calculate() for Scenario B (backdated joining)
  - Per-period salary/transaction resolution
  - Grade change tracking via signals
  - Transaction versioning (version-on-update)
  - Overlap prevention
  - apply_to_payroll integration
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from unittest.mock import Mock, patch, MagicMock, PropertyMock

from django.test import TestCase

from payroll.backpay_service import BackpayService
from payroll.models import BackpayRequest


# ──────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────

def make_period(start_date, end_date, name=None, status='PAID'):
    """Create a mock PayrollPeriod."""
    period = Mock()
    period.id = uuid.uuid4()
    period.start_date = start_date
    period.end_date = end_date
    period.name = name or f"{start_date.strftime('%B %Y')}"
    period.status = status
    period.is_supplementary = False
    return period


def make_component(code, component_type='EARNING', is_arrears_applicable=True,
                   is_prorated=True, is_taxable=True, is_active=True,
                   reduces_taxable=False):
    """Create a mock PayComponent."""
    comp = Mock()
    comp.id = uuid.uuid4()
    comp.code = code
    comp.name = code.replace('_', ' ').title()
    comp.component_type = component_type
    comp.is_arrears_applicable = is_arrears_applicable
    comp.is_prorated = is_prorated
    comp.is_taxable = is_taxable
    comp.is_active = is_active
    comp.reduces_taxable = reduces_taxable
    comp.display_order = 0
    return comp


def make_employee(employee_number='EMP001', date_of_joining=None,
                  grade=None, salary_notch=None):
    """Create a mock Employee."""
    emp = Mock()
    emp.id = uuid.uuid4()
    emp.employee_number = employee_number
    emp.full_name = 'Test Employee'
    emp.date_of_joining = date_of_joining
    emp.date_of_exit = None
    emp.grade = grade
    emp.grade_id = grade.id if grade else None
    emp.salary_notch = salary_notch
    return emp


def make_salary(basic_salary, effective_from, salary_structure=None):
    """Create a mock EmployeeSalary."""
    sal = Mock()
    sal.id = uuid.uuid4()
    sal.basic_salary = Decimal(str(basic_salary))
    sal.effective_from = effective_from
    sal.salary_structure = salary_structure
    return sal


def make_payroll_item(employee, period, basic_salary=Decimal('0'),
                      gross_earnings=Decimal('0'), total_deductions=Decimal('0'),
                      net_salary=Decimal('0'), proration_factor=Decimal('1'),
                      details=None):
    """Create a mock PayrollItem with associated details."""
    item = Mock()
    item.id = uuid.uuid4()
    item.employee = employee
    item.basic_salary = basic_salary
    item.gross_earnings = gross_earnings
    item.total_deductions = total_deductions
    item.net_salary = net_salary
    item.proration_factor = proration_factor
    item.status = 'PAID'

    run = Mock()
    run.payroll_period = period
    run.status = 'PAID'
    item.payroll_run = run

    # Mock details queryset
    detail_objects = details or []
    details_qs = MagicMock()
    details_qs.all.return_value = detail_objects
    details_qs.__iter__ = Mock(return_value=iter(detail_objects))
    item.details = details_qs

    return item


def make_detail(component, amount, is_arrear=False):
    """Create a mock PayrollItemDetail."""
    detail = Mock()
    detail.id = uuid.uuid4()
    detail.pay_component = component
    detail.amount = Decimal(str(amount))
    detail.is_arrear = is_arrear
    return detail


def make_transaction(component, override_type='FIXED', override_amount=None,
                     is_recurring=True, effective_from=None, effective_to=None,
                     target_type='INDIVIDUAL', status='ACTIVE'):
    """Create a mock EmployeeTransaction."""
    txn = Mock()
    txn.id = uuid.uuid4()
    txn.pay_component = component
    txn.override_type = override_type
    txn.override_amount = Decimal(str(override_amount)) if override_amount else None
    txn.is_recurring = is_recurring
    txn.effective_from = effective_from
    txn.effective_to = effective_to
    txn.target_type = target_type
    txn.status = status

    # calculate_amount returns override_amount for FIXED type
    if override_type == 'FIXED' and override_amount:
        txn.calculate_amount = Mock(return_value=Decimal(str(override_amount)))
    else:
        txn.calculate_amount = Mock(return_value=Decimal('0'))

    return txn


def make_grade(code='G10', level=10, salary_band=None):
    """Create a mock JobGrade."""
    grade = Mock()
    grade.id = uuid.uuid4()
    grade.code = code
    grade.level = level
    grade.salary_band = salary_band
    grade.salary_band_id = salary_band.id if salary_band else None
    return grade


# ──────────────────────────────────────────────────────────────────
# Tests: BackpayService — Scenario A (Salary Revision)
# ──────────────────────────────────────────────────────────────────

class BackpayServiceScenarioATest(TestCase):
    """Test salary revision / promotion scenario where employee was on payroll."""

    def setUp(self):
        self.basic_comp = make_component('BASIC', 'EARNING')
        self.employee = make_employee(date_of_joining=date(2024, 1, 1))

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_basic_salary_increase_6_months(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """
        Employee basic salary increased from 3000 to 4000 effective 6 months ago.
        Expect 6 x 1000 = 6000 earnings arrears for BASIC component.
        """
        # Setup 6 periods
        periods = []
        for i in range(6):
            month = i + 1  # Jan-Jun
            start = date(2025, month, 1)
            if month == 2:
                end = date(2025, 2, 28)
            elif month in (4, 6):
                end = date(2025, month, 30)
            else:
                end = date(2025, month, 31)
            periods.append(make_period(start, end, f"{start.strftime('%B %Y')}"))

        period_qs = MagicMock()
        period_qs.order_by.return_value = periods
        mock_period_qs.filter.return_value = period_qs

        # Old salary was 3000, new salary is 4000
        new_salary = make_salary(4000, date(2025, 1, 1))
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = new_salary

        # No employment history → fallback to employee.grade
        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None

        # No transactions
        mock_txn_qs.filter.return_value.filter.return_value.filter.return_value \
            .select_related.return_value = []

        # Each period has a PayrollItem with BASIC=3000
        def make_item_for_period(period):
            detail = make_detail(self.basic_comp, 3000)
            return make_payroll_item(
                self.employee, period,
                basic_salary=Decimal('3000'),
                gross_earnings=Decimal('3000'),
                details=[detail]
            )

        mock_item_qs.filter.return_value.select_related.return_value \
            .prefetch_related.return_value.first.side_effect = [
                make_item_for_period(p) for p in periods
            ]

        # No salary components beyond BASIC
        esc_qs = MagicMock()
        esc_qs.__iter__ = Mock(return_value=iter([]))
        esc_qs.select_related.return_value = esc_qs
        mock_esc_qs.filter.return_value = esc_qs

        # BASIC component lookup
        mock_comp_qs.filter.return_value.first.return_value = self.basic_comp

        # Mock PayrollService for statutory recalculation
        mock_run_cls.objects.filter.return_value.first.return_value = Mock()
        mock_payroll_svc = Mock()
        mock_payroll_svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
        mock_payroll_svc.calculate_paye.return_value = Decimal('0')
        mock_svc_cls.return_value = mock_payroll_svc

        # No overlap
        mock_bp_qs.filter.return_value.exists.return_value = False

        # Run calculation
        service = BackpayService(self.employee, 'SALARY_REVISION')
        result = service.calculate(date(2025, 1, 1), date(2025, 6, 30))

        # Verify
        self.assertEqual(result['totals']['periods_covered'], 6)
        self.assertEqual(result['totals']['total_arrears_earnings'], Decimal('6000'))

        # Each period should have 1000 difference
        for period_data in result['periods']:
            self.assertEqual(period_data['earnings_diff'], Decimal('1000'))

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_component_not_arrears_applicable_excluded(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """Components with is_arrears_applicable=False should be excluded."""
        # One period
        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        period_qs = MagicMock()
        period_qs.order_by.return_value = [period]
        mock_period_qs.filter.return_value = period_qs

        # Non-applicable component
        housing_comp = make_component('HOUSING', 'EARNING', is_arrears_applicable=False)

        new_salary = make_salary(4000, date(2025, 1, 1))
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = new_salary

        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_txn_qs.filter.return_value.filter.return_value.filter.return_value \
            .select_related.return_value = []

        # PayrollItem had BASIC=3000 and HOUSING=500 (not applicable)
        basic_detail = make_detail(self.basic_comp, 3000)
        housing_detail = make_detail(housing_comp, 500)
        item = make_payroll_item(
            self.employee, period,
            basic_salary=Decimal('3000'),
            details=[basic_detail, housing_detail]
        )
        mock_item_qs.filter.return_value.select_related.return_value \
            .prefetch_related.return_value.first.return_value = item

        esc_qs = MagicMock()
        esc_qs.__iter__ = Mock(return_value=iter([]))
        esc_qs.select_related.return_value = esc_qs
        mock_esc_qs.filter.return_value = esc_qs

        mock_comp_qs.filter.return_value.first.return_value = self.basic_comp

        mock_run_cls.objects.filter.return_value.first.return_value = Mock()
        mock_payroll_svc = Mock()
        mock_payroll_svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
        mock_payroll_svc.calculate_paye.return_value = Decimal('0')
        mock_svc_cls.return_value = mock_payroll_svc

        mock_bp_qs.filter.return_value.exists.return_value = False

        service = BackpayService(self.employee, 'SALARY_REVISION')
        result = service.calculate(date(2025, 1, 1), date(2025, 1, 31))

        # Only BASIC difference should appear (1000), HOUSING excluded
        period_data = result['periods'][0]
        component_codes = [d['pay_component'].code for d in period_data['details']]
        self.assertIn('BASIC', component_codes)
        self.assertNotIn('HOUSING', component_codes)
        self.assertEqual(period_data['earnings_diff'], Decimal('1000'))

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_prorated_period_uses_same_factor(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """For prorated periods, arrears should use the same proration factor."""
        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        period_qs = MagicMock()
        period_qs.order_by.return_value = [period]
        mock_period_qs.filter.return_value = period_qs

        new_salary = make_salary(4000, date(2025, 1, 1))
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = new_salary

        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_txn_qs.filter.return_value.filter.return_value.filter.return_value \
            .select_related.return_value = []

        # Employee had prorated period (joined mid-month): factor=0.5
        proration = Decimal('0.5')
        basic_detail = make_detail(self.basic_comp, 1500)  # 3000 * 0.5
        item = make_payroll_item(
            self.employee, period,
            basic_salary=Decimal('1500'),
            proration_factor=proration,
            details=[basic_detail]
        )
        mock_item_qs.filter.return_value.select_related.return_value \
            .prefetch_related.return_value.first.return_value = item

        esc_qs = MagicMock()
        esc_qs.__iter__ = Mock(return_value=iter([]))
        esc_qs.select_related.return_value = esc_qs
        mock_esc_qs.filter.return_value = esc_qs

        mock_comp_qs.filter.return_value.first.return_value = self.basic_comp

        mock_run_cls.objects.filter.return_value.first.return_value = Mock()
        mock_payroll_svc = Mock()
        mock_payroll_svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
        mock_payroll_svc.calculate_paye.return_value = Decimal('0')
        mock_svc_cls.return_value = mock_payroll_svc

        mock_bp_qs.filter.return_value.exists.return_value = False

        service = BackpayService(self.employee, 'SALARY_REVISION')
        result = service.calculate(date(2025, 1, 1), date(2025, 1, 31))

        # New basic should be 4000 * 0.5 = 2000, old was 1500
        # Difference = 2000 - 1500 = 500
        period_data = result['periods'][0]
        basic_diff = [d for d in period_data['details'] if d['pay_component'].code == 'BASIC']
        self.assertEqual(len(basic_diff), 1)
        expected_new = (Decimal('4000') * proration).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)
        self.assertEqual(basic_diff[0]['new_amount'], expected_new)
        self.assertEqual(basic_diff[0]['old_amount'], Decimal('1500'))
        self.assertEqual(basic_diff[0]['difference'], expected_new - Decimal('1500'))


# ──────────────────────────────────────────────────────────────────
# Tests: BackpayService — Scenario B (Backdated Joining)
# ──────────────────────────────────────────────────────────────────

class BackpayServiceScenarioBTest(TestCase):
    """Test backdated joining scenario where employee was NOT on payroll."""

    def setUp(self):
        self.basic_comp = make_component('BASIC', 'EARNING')

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_backdated_joining_3_full_months(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """
        New employee with basic 4000, backdated 3 full months.
        No PayrollItems exist → old amounts are 0.
        Expect 3 x 4000 = 12000 earnings arrears.
        """
        employee = make_employee(
            employee_number='EMP002',
            date_of_joining=date(2025, 1, 1)
        )

        periods = [
            make_period(date(2025, 1, 1), date(2025, 1, 31), 'January 2025'),
            make_period(date(2025, 2, 1), date(2025, 2, 28), 'February 2025'),
            make_period(date(2025, 3, 1), date(2025, 3, 31), 'March 2025'),
        ]

        period_qs = MagicMock()
        period_qs.order_by.return_value = periods
        mock_period_qs.filter.return_value = period_qs

        salary = make_salary(4000, date(2025, 1, 1))
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = salary

        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_txn_qs.filter.return_value.filter.return_value.filter.return_value \
            .select_related.return_value = []

        # No PayrollItems for any period (employee was never on payroll)
        mock_item_qs.filter.return_value.select_related.return_value \
            .prefetch_related.return_value.first.return_value = None

        esc_qs = MagicMock()
        esc_qs.__iter__ = Mock(return_value=iter([]))
        esc_qs.select_related.return_value = esc_qs
        mock_esc_qs.filter.return_value = esc_qs

        mock_comp_qs.filter.return_value.first.return_value = self.basic_comp

        mock_run_cls.objects.filter.return_value.first.return_value = Mock()
        mock_payroll_svc = Mock()
        mock_payroll_svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
        mock_payroll_svc.calculate_paye.return_value = Decimal('0')
        mock_svc_cls.return_value = mock_payroll_svc

        mock_bp_qs.filter.return_value.exists.return_value = False

        service = BackpayService(employee, 'BACKDATED_JOINING')
        result = service.calculate(date(2025, 1, 1), date(2025, 3, 31))

        self.assertEqual(result['totals']['periods_covered'], 3)
        self.assertEqual(result['totals']['total_arrears_earnings'], Decimal('12000'))

        # Each period: old=0, new=4000, diff=4000
        for period_data in result['periods']:
            basic_details = [d for d in period_data['details'] if d['pay_component'].code == 'BASIC']
            self.assertEqual(len(basic_details), 1)
            self.assertEqual(basic_details[0]['old_amount'], Decimal('0'))
            self.assertEqual(basic_details[0]['new_amount'], Decimal('4000'))
            self.assertEqual(basic_details[0]['difference'], Decimal('4000'))

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_backdated_joining_first_period_prorated(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """
        Employee joined Jan 15 (mid-month). First period should be prorated.
        Expect: Jan = 4000 * (17/31), Feb-Mar = 4000 each.
        """
        employee = make_employee(
            employee_number='EMP003',
            date_of_joining=date(2025, 1, 15)
        )

        periods = [
            make_period(date(2025, 1, 1), date(2025, 1, 31), 'January 2025'),
            make_period(date(2025, 2, 1), date(2025, 2, 28), 'February 2025'),
        ]

        period_qs = MagicMock()
        period_qs.order_by.return_value = periods
        mock_period_qs.filter.return_value = period_qs

        salary = make_salary(4000, date(2025, 1, 1))
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = salary

        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_txn_qs.filter.return_value.filter.return_value.filter.return_value \
            .select_related.return_value = []

        # No PayrollItems
        mock_item_qs.filter.return_value.select_related.return_value \
            .prefetch_related.return_value.first.return_value = None

        esc_qs = MagicMock()
        esc_qs.__iter__ = Mock(return_value=iter([]))
        esc_qs.select_related.return_value = esc_qs
        mock_esc_qs.filter.return_value = esc_qs

        mock_comp_qs.filter.return_value.first.return_value = self.basic_comp

        mock_run_cls.objects.filter.return_value.first.return_value = Mock()
        mock_payroll_svc = Mock()
        mock_payroll_svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
        mock_payroll_svc.calculate_paye.return_value = Decimal('0')
        mock_svc_cls.return_value = mock_payroll_svc

        mock_bp_qs.filter.return_value.exists.return_value = False

        service = BackpayService(employee, 'BACKDATED_JOINING')
        result = service.calculate(date(2025, 1, 1), date(2025, 2, 28))

        # First period: prorated (joined Jan 15 → 17 days out of 31)
        jan_data = result['periods'][0]
        factor = (Decimal('17') / Decimal('31')).quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)
        expected_jan_basic = (Decimal('4000') * factor).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

        jan_basic = [d for d in jan_data['details'] if d['pay_component'].code == 'BASIC']
        self.assertEqual(len(jan_basic), 1)
        self.assertEqual(jan_basic[0]['new_amount'], expected_jan_basic)

        # Second period: full (employee already joined before Feb)
        feb_data = result['periods'][1]
        feb_basic = [d for d in feb_data['details'] if d['pay_component'].code == 'BASIC']
        self.assertEqual(len(feb_basic), 1)
        self.assertEqual(feb_basic[0]['new_amount'], Decimal('4000'))


# ──────────────────────────────────────────────────────────────────
# Tests: Per-Period Salary Resolution
# ──────────────────────────────────────────────────────────────────

class PerPeriodResolutionTest(TestCase):
    """Test that salary, grade, and transactions resolve correctly per period."""

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_salary_changed_mid_window(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """
        Salary was 3000 (Jan-Mar) then 4000 (Apr-Jun).
        Backpay promotion with new rate 5000 backdated to Jan.
        Arrears = 3x(5000-3000) + 3x(5000-4000) = 6000 + 3000 = 9000.
        """
        basic_comp = make_component('BASIC', 'EARNING')
        employee = make_employee(date_of_joining=date(2024, 1, 1))

        periods = []
        for i in range(6):
            month = i + 1
            start = date(2025, month, 1)
            if month == 2:
                end = date(2025, 2, 28)
            elif month in (4, 6):
                end = date(2025, month, 30)
            else:
                end = date(2025, month, 31)
            periods.append(make_period(start, end))

        period_qs = MagicMock()
        period_qs.order_by.return_value = periods
        mock_period_qs.filter.return_value = period_qs

        # _get_applicable_salary returns different salary per period
        salary_3000 = make_salary(3000, date(2024, 1, 1))
        salary_4000 = make_salary(4000, date(2025, 4, 1))
        # BUT the "new" salary (what should have been paid) is 5000 for all periods
        salary_5000 = make_salary(5000, date(2025, 1, 1))

        # The _get_applicable_salary query returns salary_5000 (effective from Jan 1)
        # since the new salary record is effective before all periods
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = salary_5000

        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_txn_qs.filter.return_value.filter.return_value.filter.return_value \
            .select_related.return_value = []

        # Create different PayrollItems for Jan-Mar (3000) and Apr-Jun (4000)
        items = []
        for i, period in enumerate(periods):
            old_basic = Decimal('3000') if i < 3 else Decimal('4000')
            detail = make_detail(basic_comp, old_basic)
            item = make_payroll_item(
                employee, period,
                basic_salary=old_basic,
                details=[detail]
            )
            items.append(item)

        mock_item_qs.filter.return_value.select_related.return_value \
            .prefetch_related.return_value.first.side_effect = items

        esc_qs = MagicMock()
        esc_qs.__iter__ = Mock(return_value=iter([]))
        esc_qs.select_related.return_value = esc_qs
        mock_esc_qs.filter.return_value = esc_qs

        mock_comp_qs.filter.return_value.first.return_value = basic_comp

        mock_run_cls.objects.filter.return_value.first.return_value = Mock()
        mock_payroll_svc = Mock()
        mock_payroll_svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
        mock_payroll_svc.calculate_paye.return_value = Decimal('0')
        mock_svc_cls.return_value = mock_payroll_svc

        mock_bp_qs.filter.return_value.exists.return_value = False

        service = BackpayService(employee, 'PROMOTION')
        result = service.calculate(date(2025, 1, 1), date(2025, 6, 30))

        # Jan-Mar: 5000 - 3000 = 2000 each
        for i in range(3):
            self.assertEqual(result['periods'][i]['earnings_diff'], Decimal('2000'))

        # Apr-Jun: 5000 - 4000 = 1000 each
        for i in range(3, 6):
            self.assertEqual(result['periods'][i]['earnings_diff'], Decimal('1000'))

        # Total: 3*2000 + 3*1000 = 9000
        self.assertEqual(result['totals']['total_arrears_earnings'], Decimal('9000'))


# ──────────────────────────────────────────────────────────────────
# Tests: BackpayService._get_proration_factor
# ──────────────────────────────────────────────────────────────────

class ProrationFactorTest(TestCase):
    """Test the _get_proration_factor method."""

    def test_with_existing_payroll_item(self):
        """Should reuse the payroll item's proration_factor."""
        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')
        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        item = Mock()
        item.proration_factor = Decimal('0.7')
        result = service._get_proration_factor(period, item)
        self.assertEqual(result, Decimal('0.7'))

    def test_no_payroll_item_full_period(self):
        """Employee joined before period → factor = 1."""
        employee = make_employee(date_of_joining=date(2024, 1, 1))
        service = BackpayService(employee, 'BACKDATED_JOINING')
        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        result = service._get_proration_factor(period, None)
        self.assertEqual(result, Decimal('1'))

    def test_no_payroll_item_mid_month_joining(self):
        """Employee joined mid-month (Jan 15) → prorated."""
        employee = make_employee(date_of_joining=date(2025, 1, 15))
        service = BackpayService(employee, 'BACKDATED_JOINING')
        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        result = service._get_proration_factor(period, None)

        # 17 days out of 31
        expected = (Decimal('17') / Decimal('31')).quantize(
            Decimal('0.0001'), rounding=ROUND_HALF_UP
        )
        self.assertEqual(result, expected)

    def test_no_payroll_item_no_joining_date(self):
        """Employee with no date_of_joining → factor = 1."""
        employee = make_employee(date_of_joining=None)
        service = BackpayService(employee, 'BACKDATED_JOINING')
        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        result = service._get_proration_factor(period, None)
        self.assertEqual(result, Decimal('1'))


# ──────────────────────────────────────────────────────────────────
# Tests: BackpayService._build_paid_map
# ──────────────────────────────────────────────────────────────────

class BuildPaidMapTest(TestCase):
    """Test the _build_paid_map method."""

    def test_none_payroll_item(self):
        """None → empty dict."""
        employee = make_employee()
        service = BackpayService(employee, 'BACKDATED_JOINING')
        result = service._build_paid_map(None)
        self.assertEqual(result, {})

    def test_excludes_arrear_details(self):
        """Existing arrear details should not be included in the paid map."""
        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        basic_comp = make_component('BASIC')
        normal_detail = make_detail(basic_comp, 3000, is_arrear=False)
        arrear_detail = make_detail(basic_comp, 500, is_arrear=True)

        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        item = make_payroll_item(employee, period, details=[normal_detail, arrear_detail])

        result = service._build_paid_map(item)
        self.assertEqual(result['BASIC'], Decimal('3000'))

    def test_excludes_non_arrears_applicable(self):
        """Components with is_arrears_applicable=False should be excluded."""
        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        basic_comp = make_component('BASIC', is_arrears_applicable=True)
        bonus_comp = make_component('BONUS', is_arrears_applicable=False)
        basic_detail = make_detail(basic_comp, 3000)
        bonus_detail = make_detail(bonus_comp, 1000)

        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        item = make_payroll_item(employee, period, details=[basic_detail, bonus_detail])

        result = service._build_paid_map(item)
        self.assertIn('BASIC', result)
        self.assertNotIn('BONUS', result)


# ──────────────────────────────────────────────────────────────────
# Tests: BackpayService._get_grade_for_period
# ──────────────────────────────────────────────────────────────────

class GradeForPeriodTest(TestCase):
    """Test grade resolution via 3-tier fallback."""

    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    def test_tier1_employment_history(self, mock_salary_qs, mock_hist_qs):
        """Should return grade from EmploymentHistory if available."""
        grade = make_grade('G12', 12)
        history = Mock()
        history.new_grade = grade
        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = history

        employee = make_employee()
        service = BackpayService(employee, 'PROMOTION')
        period = make_period(date(2025, 3, 1), date(2025, 3, 31))
        result = service._get_grade_for_period(period)

        self.assertEqual(result, grade)

    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    def test_tier2_salary_structure_grade(self, mock_salary_qs, mock_hist_qs):
        """Fallback to salary_structure.grade when no EmploymentHistory."""
        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None

        grade = make_grade('G10', 10)
        structure = Mock()
        structure.grade = grade
        salary = Mock()
        salary.salary_structure = structure
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = salary

        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')
        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        result = service._get_grade_for_period(period)

        self.assertEqual(result, grade)

    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    def test_tier3_current_grade(self, mock_salary_qs, mock_hist_qs):
        """Fallback to employee.grade when no history and no salary structure grade."""
        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = None

        grade = make_grade('G8', 8)
        employee = make_employee(grade=grade)
        service = BackpayService(employee, 'SALARY_REVISION')
        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        result = service._get_grade_for_period(period)

        self.assertEqual(result, grade)


# ──────────────────────────────────────────────────────────────────
# Tests: Overlap Prevention
# ──────────────────────────────────────────────────────────────────

class OverlapPreventionTest(TestCase):
    """Test that overlapping APPLIED requests are blocked."""

    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_overlap_raises_error(self, mock_bp_qs):
        """Creating a request for overlapping dates should raise ValueError."""
        mock_bp_qs.filter.return_value.exists.return_value = True

        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        with self.assertRaises(ValueError) as ctx:
            service.validate_no_overlap(date(2025, 1, 1), date(2025, 6, 30))

        self.assertIn('overlapping', str(ctx.exception).lower())

    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_no_overlap_passes(self, mock_bp_qs):
        """No overlapping dates should pass without error."""
        mock_bp_qs.filter.return_value.exists.return_value = False

        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        # Should not raise
        service.validate_no_overlap(date(2025, 1, 1), date(2025, 6, 30))


# ──────────────────────────────────────────────────────────────────
# Tests: apply_to_payroll
# ──────────────────────────────────────────────────────────────────

class ApplyToPayrollTest(TestCase):
    """Test apply_to_payroll creates correct PayrollItemDetail rows."""

    @patch('payroll.backpay_service.PayrollItemDetail.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    def test_apply_creates_arrear_details(self, mock_item_qs, mock_detail_qs):
        """Apply should create PayrollItemDetail rows with is_arrear=True."""
        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        basic_comp = make_component('BASIC', 'EARNING')
        housing_comp = make_component('HOUSING', 'EARNING')

        # Mock backpay request
        bp_request = Mock(spec=BackpayRequest)
        bp_request.status = BackpayRequest.Status.APPROVED
        bp_request.employee = employee
        bp_request.reference_number = 'BP-202501-TEST'

        # Mock details queryset
        detail1 = Mock()
        detail1.pay_component = basic_comp
        detail1.difference = Decimal('6000')
        detail2 = Mock()
        detail2.pay_component = housing_comp
        detail2.difference = Decimal('3000')
        detail3 = Mock()
        detail3.pay_component = basic_comp  # Another period with same component
        detail3.difference = Decimal('3000')

        details_qs = MagicMock()
        details_qs.select_related.return_value.all.return_value = [detail1, detail2, detail3]
        bp_request.details = details_qs

        # Mock payroll item
        payroll_item = Mock()
        payroll_item.gross_earnings = Decimal('4000')
        payroll_item.total_deductions = Decimal('500')
        payroll_item.net_salary = Decimal('3500')
        mock_item_qs.filter.return_value.first.return_value = payroll_item

        payroll_run = Mock()
        payroll_run.run_number = 'PR-2025-07'

        result = service.apply_to_payroll(bp_request, payroll_run)

        # Should have created 2 PayrollItemDetail rows (BASIC aggregated, HOUSING separate)
        self.assertEqual(mock_detail_qs.create.call_count, 2)

        # Verify BASIC aggregation (6000 + 3000 = 9000)
        create_calls = mock_detail_qs.create.call_args_list
        basic_calls = [c for c in create_calls if c.kwargs.get('pay_component') == basic_comp]
        housing_calls = [c for c in create_calls if c.kwargs.get('pay_component') == housing_comp]

        self.assertEqual(len(basic_calls), 1)
        self.assertEqual(basic_calls[0].kwargs['amount'], Decimal('9000'))
        self.assertTrue(basic_calls[0].kwargs['is_arrear'])

        self.assertEqual(len(housing_calls), 1)
        self.assertEqual(housing_calls[0].kwargs['amount'], Decimal('3000'))
        self.assertTrue(housing_calls[0].kwargs['is_arrear'])

        # Verify payroll item updated: 4000 + 9000 + 3000 = 16000 gross
        self.assertEqual(payroll_item.gross_earnings, Decimal('16000'))

    @patch('payroll.backpay_service.PayrollItem.objects')
    def test_apply_rejects_non_approved(self, mock_item_qs):
        """Apply should reject if backpay request is not APPROVED."""
        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        bp_request = Mock(spec=BackpayRequest)
        bp_request.status = BackpayRequest.Status.DRAFT

        payroll_run = Mock()

        with self.assertRaises(ValueError) as ctx:
            service.apply_to_payroll(bp_request, payroll_run)

        self.assertIn('APPROVED', str(ctx.exception))

    @patch('payroll.backpay_service.PayrollItem.objects')
    def test_apply_rejects_missing_payroll_item(self, mock_item_qs):
        """Apply should raise if employee has no payroll item in the run."""
        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        bp_request = Mock(spec=BackpayRequest)
        bp_request.status = BackpayRequest.Status.APPROVED
        bp_request.employee = employee

        mock_item_qs.filter.return_value.first.return_value = None
        payroll_run = Mock()
        payroll_run.run_number = 'PR-2025-07'

        with self.assertRaises(ValueError) as ctx:
            service.apply_to_payroll(bp_request, payroll_run)

        self.assertIn('No payroll item', str(ctx.exception))


# ──────────────────────────────────────────────────────────────────
# Tests: SSNIT/PAYE Recalculation
# ──────────────────────────────────────────────────────────────────

class StatutoryRecalculationTest(TestCase):
    """Test _recalculate_statutory diffs."""

    def test_ssnit_difference(self):
        """SSNIT diff should be calculated on old vs new basic."""
        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        mock_payroll_svc = Mock()
        # Old basic=3000: SSNIT employee=165 (5.5%)
        # New basic=4000: SSNIT employee=220 (5.5%)
        mock_payroll_svc.calculate_ssnit.side_effect = [
            (Decimal('165'), Decimal('390'), Decimal('0')),  # old
            (Decimal('220'), Decimal('520'), Decimal('0')),  # new
        ]
        mock_payroll_svc.calculate_paye.return_value = Decimal('0')

        with patch('payroll.backpay_service.PayComponent.objects') as mock_comp:
            ssnit_comp = make_component('SSNIT_EMP', 'DEDUCTION')
            mock_comp.filter.return_value.first.return_value = ssnit_comp

            result = service._recalculate_statutory(
                Decimal('3000'), Decimal('4000'),
                Decimal('0'), Decimal('0'),
                mock_payroll_svc
            )

        self.assertIn('SSNIT_EMP', result)
        self.assertEqual(result['SSNIT_EMP']['difference'], Decimal('55'))
        self.assertEqual(result['SSNIT_EMP']['old_amount'], Decimal('165'))
        self.assertEqual(result['SSNIT_EMP']['new_amount'], Decimal('220'))

    def test_paye_difference(self):
        """PAYE diff should be calculated on old vs new taxable income."""
        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        mock_payroll_svc = Mock()
        mock_payroll_svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
        # Old PAYE=200, New PAYE=350
        mock_payroll_svc.calculate_paye.side_effect = [Decimal('200'), Decimal('350')]

        with patch('payroll.backpay_service.PayComponent.objects') as mock_comp:
            paye_comp = make_component('PAYE', 'DEDUCTION')
            mock_comp.filter.return_value.first.return_value = paye_comp

            result = service._recalculate_statutory(
                Decimal('3000'), Decimal('4000'),
                Decimal('2500'), Decimal('3500'),
                mock_payroll_svc
            )

        self.assertIn('PAYE', result)
        self.assertEqual(result['PAYE']['difference'], Decimal('150'))


# ──────────────────────────────────────────────────────────────────
# Tests: Period-Specific Statutory Rates
# ──────────────────────────────────────────────────────────────────

class PeriodSpecificStatutoryRatesTest(TestCase):
    """Test that each period uses its own PayrollService for PAYE/SSNIT rates."""

    def setUp(self):
        self.basic_comp = make_component('BASIC', 'EARNING')
        self.employee = make_employee(date_of_joining=date(2024, 1, 1))

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_each_period_gets_own_payroll_service(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """
        Two periods should create two separate PayrollService instances,
        each scoped to that period's PayrollRun.
        """
        # Two periods: Jan 2024 and Jan 2025 (different tax years)
        period_2024 = make_period(date(2024, 1, 1), date(2024, 1, 31), 'January 2024')
        period_2025 = make_period(date(2025, 1, 1), date(2025, 1, 31), 'January 2025')

        period_qs = MagicMock()
        period_qs.order_by.return_value = [period_2024, period_2025]
        mock_period_qs.filter.return_value = period_qs

        # Salary: 4000 for all periods
        salary = make_salary(4000, date(2024, 1, 1))
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = salary

        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_txn_qs.filter.return_value.filter.return_value.filter.return_value \
            .select_related.return_value = []

        # Each period had BASIC=3000 paid
        def make_item_for_period(period):
            detail = make_detail(self.basic_comp, 3000)
            return make_payroll_item(
                self.employee, period,
                basic_salary=Decimal('3000'),
                gross_earnings=Decimal('3000'),
                details=[detail]
            )

        mock_item_qs.filter.return_value.select_related.return_value \
            .prefetch_related.return_value.first.side_effect = [
                make_item_for_period(period_2024),
                make_item_for_period(period_2025),
            ]

        esc_qs = MagicMock()
        esc_qs.__iter__ = Mock(return_value=iter([]))
        esc_qs.select_related.return_value = esc_qs
        mock_esc_qs.filter.return_value = esc_qs

        mock_comp_qs.filter.return_value.first.return_value = self.basic_comp

        # Return a distinct mock run per filter call so we can distinguish them
        run_2024 = Mock(name='run_2024')
        run_2024.payroll_period = period_2024
        run_2025 = Mock(name='run_2025')
        run_2025.payroll_period = period_2025
        mock_run_cls.objects.filter.return_value.first.side_effect = [run_2024, run_2025]

        # Track which PayrollService instances are created
        svc_instances = []
        def make_svc(run):
            svc = Mock()
            svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
            svc.calculate_paye.return_value = Decimal('0')
            svc._run = run  # tag for assertion
            svc_instances.append(svc)
            return svc
        mock_svc_cls.side_effect = make_svc

        mock_bp_qs.filter.return_value.exists.return_value = False

        service = BackpayService(self.employee, 'SALARY_REVISION')
        service.calculate(date(2024, 1, 1), date(2025, 1, 31))

        # PayrollService should have been created twice (once per period)
        self.assertEqual(mock_svc_cls.call_count, 2)
        self.assertEqual(len(svc_instances), 2)

        # First call should use the 2024 run, second should use the 2025 run
        self.assertEqual(mock_svc_cls.call_args_list[0][0][0], run_2024)
        self.assertEqual(mock_svc_cls.call_args_list[1][0][0], run_2025)

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_fallback_mock_run_when_no_payroll_run(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """
        When no PayrollRun exists for a period, a mock run wrapping
        the period should be created as fallback.
        """
        period = make_period(date(2025, 1, 1), date(2025, 1, 31), 'January 2025')

        period_qs = MagicMock()
        period_qs.order_by.return_value = [period]
        mock_period_qs.filter.return_value = period_qs

        salary = make_salary(4000, date(2025, 1, 1))
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = salary

        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_txn_qs.filter.return_value.filter.return_value.filter.return_value \
            .select_related.return_value = []

        detail = make_detail(self.basic_comp, 3000)
        item = make_payroll_item(
            self.employee, period,
            basic_salary=Decimal('3000'),
            details=[detail]
        )
        mock_item_qs.filter.return_value.select_related.return_value \
            .prefetch_related.return_value.first.return_value = item

        esc_qs = MagicMock()
        esc_qs.__iter__ = Mock(return_value=iter([]))
        esc_qs.select_related.return_value = esc_qs
        mock_esc_qs.filter.return_value = esc_qs

        mock_comp_qs.filter.return_value.first.return_value = self.basic_comp

        # No PayrollRun found for this period
        mock_run_cls.objects.filter.return_value.first.return_value = None

        mock_payroll_svc = Mock()
        mock_payroll_svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
        mock_payroll_svc.calculate_paye.return_value = Decimal('0')
        mock_svc_cls.return_value = mock_payroll_svc

        mock_bp_qs.filter.return_value.exists.return_value = False

        service = BackpayService(self.employee, 'SALARY_REVISION')
        service.calculate(date(2025, 1, 1), date(2025, 1, 31))

        # PayrollService should still be created (via mock run fallback)
        self.assertEqual(mock_svc_cls.call_count, 1)
        # The mock run should have payroll_period set to the period
        mock_run_arg = mock_svc_cls.call_args[0][0]
        self.assertEqual(mock_run_arg.payroll_period, period)


# ──────────────────────────────────────────────────────────────────
# Tests: Preview
# ──────────────────────────────────────────────────────────────────

class PreviewTest(TestCase):
    """Test the preview method returns JSON-serializable output."""

    @patch.object(BackpayService, 'calculate')
    def test_preview_returns_serializable(self, mock_calculate):
        """Preview should convert all objects to string IDs and amounts."""
        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        period = make_period(date(2025, 1, 1), date(2025, 1, 31), 'January 2025')
        salary = make_salary(4000, date(2025, 1, 1))
        comp = make_component('BASIC')

        mock_calculate.return_value = {
            'periods': [{
                'period': period,
                'payroll_item': Mock(),
                'applicable_salary': salary,
                'proration_factor': '1',
                'details': [{
                    'pay_component': comp,
                    'old_amount': Decimal('3000'),
                    'new_amount': Decimal('4000'),
                    'difference': Decimal('1000'),
                }],
                'earnings_diff': Decimal('1000'),
                'deductions_diff': Decimal('0'),
                'net_diff': Decimal('1000'),
            }],
            'totals': {
                'total_arrears_earnings': Decimal('1000'),
                'total_arrears_deductions': Decimal('0'),
                'net_arrears': Decimal('1000'),
                'periods_covered': 1,
            }
        }

        result = service.preview(date(2025, 1, 1), date(2025, 1, 31))

        # All values should be strings (serializable)
        self.assertEqual(result['employee_id'], str(employee.id))
        self.assertEqual(result['totals']['net_arrears'], '1000')
        self.assertEqual(result['periods'][0]['period_name'], 'January 2025')
        self.assertEqual(result['periods'][0]['details'][0]['component_code'], 'BASIC')
        self.assertEqual(result['periods'][0]['details'][0]['difference'], '1000')
        self.assertTrue(result['periods'][0]['has_payroll_item'])


# ──────────────────────────────────────────────────────────────────
# Tests: Grade Change Signal
# ──────────────────────────────────────────────────────────────────

class GradeChangeSignalTest(TestCase):
    """Test the pre_save signal for grade change tracking."""

    @patch('employees.signals.EmploymentHistory.objects')
    @patch('employees.signals.Employee.objects')
    def test_grade_change_creates_history(self, mock_emp_qs, mock_hist_qs):
        """Changing employee.grade should create an EmploymentHistory record."""
        from employees.signals import track_grade_change

        old_grade = make_grade('G10', 10)
        new_grade = make_grade('G12', 12)

        # Old employee (from DB)
        old_employee = Mock()
        old_employee.grade_id = old_grade.id
        old_employee.grade = old_grade
        old_employee.department = Mock()
        old_employee.position = Mock()
        mock_emp_qs.get.return_value = old_employee

        # Instance being saved
        instance = Mock()
        instance.pk = uuid.uuid4()
        instance.grade_id = new_grade.id
        instance.grade = new_grade
        instance.department = old_employee.department
        instance.position = old_employee.position

        track_grade_change(sender=None, instance=instance)

        mock_hist_qs.create.assert_called_once()
        call_kwargs = mock_hist_qs.create.call_args.kwargs
        self.assertEqual(call_kwargs['employee'], instance)
        self.assertEqual(call_kwargs['previous_grade'], old_grade)
        self.assertEqual(call_kwargs['new_grade_id'], new_grade.id)

    @patch('employees.signals.EmploymentHistory.objects')
    @patch('employees.signals.Employee.objects')
    def test_no_grade_change_no_history(self, mock_emp_qs, mock_hist_qs):
        """If grade doesn't change, no EmploymentHistory should be created."""
        from employees.signals import track_grade_change

        grade = make_grade('G10', 10)

        old_employee = Mock()
        old_employee.grade_id = grade.id
        mock_emp_qs.get.return_value = old_employee

        instance = Mock()
        instance.pk = uuid.uuid4()
        instance.grade_id = grade.id

        track_grade_change(sender=None, instance=instance)

        mock_hist_qs.create.assert_not_called()

    @patch('employees.signals.EmploymentHistory.objects')
    @patch('employees.signals.Employee.objects')
    def test_new_employee_no_history(self, mock_emp_qs, mock_hist_qs):
        """New employee (no pk) should not trigger grade tracking."""
        from employees.signals import track_grade_change

        instance = Mock()
        instance.pk = None

        track_grade_change(sender=None, instance=instance)

        mock_emp_qs.get.assert_not_called()
        mock_hist_qs.create.assert_not_called()


# ──────────────────────────────────────────────────────────────────
# Tests: Affected Periods
# ──────────────────────────────────────────────────────────────────

class AffectedPeriodsTest(TestCase):
    """Test get_affected_periods returns correct period set."""

    @patch('payroll.backpay_service.PayrollPeriod.objects')
    def test_filters_paid_and_closed(self, mock_period_qs):
        """Should only return PAID/CLOSED periods in range."""
        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')

        service.get_affected_periods(date(2025, 1, 1), date(2025, 6, 30))

        filter_call = mock_period_qs.filter.call_args
        self.assertIn('PAID', filter_call.kwargs['status__in'])
        self.assertIn('CLOSED', filter_call.kwargs['status__in'])
        self.assertEqual(filter_call.kwargs['start_date__lte'], date(2025, 6, 30))
        self.assertEqual(filter_call.kwargs['end_date__gte'], date(2025, 1, 1))
        self.assertFalse(filter_call.kwargs['is_supplementary'])


# ──────────────────────────────────────────────────────────────────
# Tests: Empty / Edge Cases
# ──────────────────────────────────────────────────────────────────

class EdgeCaseTest(TestCase):
    """Test edge cases for backpay calculation."""

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_no_affected_periods(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """No PAID/CLOSED periods in range → empty result with 0 arrears."""
        period_qs = MagicMock()
        period_qs.order_by.return_value = []
        mock_period_qs.filter.return_value = period_qs

        mock_run_cls.objects.filter.return_value.first.return_value = None

        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')
        result = service.calculate(date(2025, 1, 1), date(2025, 6, 30))

        self.assertEqual(result['totals']['periods_covered'], 0)
        self.assertEqual(result['totals']['total_arrears_earnings'], Decimal('0'))
        self.assertEqual(result['totals']['total_arrears_deductions'], Decimal('0'))
        self.assertEqual(result['totals']['net_arrears'], Decimal('0'))

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_no_salary_for_period(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """If no applicable salary found, should_map is empty → no arrears."""
        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        period_qs = MagicMock()
        period_qs.order_by.return_value = [period]
        mock_period_qs.filter.return_value = period_qs

        # No salary found
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_txn_qs.filter.return_value.filter.return_value.filter.return_value \
            .select_related.return_value = []

        # No payroll item either
        mock_item_qs.filter.return_value.select_related.return_value \
            .prefetch_related.return_value.first.return_value = None

        mock_run_cls.objects.filter.return_value.first.return_value = Mock()
        mock_payroll_svc = Mock()
        mock_payroll_svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
        mock_payroll_svc.calculate_paye.return_value = Decimal('0')
        mock_svc_cls.return_value = mock_payroll_svc

        employee = make_employee()
        service = BackpayService(employee, 'BACKDATED_JOINING')
        result = service.calculate(date(2025, 1, 1), date(2025, 1, 31))

        self.assertEqual(result['totals']['total_arrears_earnings'], Decimal('0'))

    @patch('payroll.backpay_service.PayrollService')
    @patch('payroll.backpay_service.PayrollRun')
    @patch('payroll.backpay_service.PayComponent.objects')
    @patch('payroll.backpay_service.EmployeeSalaryComponent.objects')
    @patch('payroll.backpay_service.PayrollItem.objects')
    @patch('payroll.backpay_service.EmployeeSalary.objects')
    @patch('payroll.backpay_service.PayrollPeriod.objects')
    @patch('payroll.backpay_service.EmployeeTransaction.objects')
    @patch('payroll.backpay_service.EmploymentHistory.objects')
    @patch('payroll.backpay_service.BackpayRequest.objects')
    def test_zero_difference_components_excluded(
        self, mock_bp_qs, mock_hist_qs, mock_txn_qs, mock_period_qs,
        mock_salary_qs, mock_item_qs, mock_esc_qs, mock_comp_qs,
        mock_run_cls, mock_svc_cls
    ):
        """Components with zero difference should not appear in details."""
        basic_comp = make_component('BASIC')
        period = make_period(date(2025, 1, 1), date(2025, 1, 31))
        period_qs = MagicMock()
        period_qs.order_by.return_value = [period]
        mock_period_qs.filter.return_value = period_qs

        # Same salary → no difference
        salary = make_salary(3000, date(2025, 1, 1))
        mock_salary_qs.filter.return_value.order_by.return_value.first.return_value = salary

        mock_hist_qs.filter.return_value.order_by.return_value.first.return_value = None
        mock_txn_qs.filter.return_value.filter.return_value.filter.return_value \
            .select_related.return_value = []

        basic_detail = make_detail(basic_comp, 3000)
        item = make_payroll_item(
            make_employee(), period,
            basic_salary=Decimal('3000'),
            details=[basic_detail]
        )
        mock_item_qs.filter.return_value.select_related.return_value \
            .prefetch_related.return_value.first.return_value = item

        esc_qs = MagicMock()
        esc_qs.__iter__ = Mock(return_value=iter([]))
        esc_qs.select_related.return_value = esc_qs
        mock_esc_qs.filter.return_value = esc_qs

        mock_comp_qs.filter.return_value.first.return_value = basic_comp

        mock_run_cls.objects.filter.return_value.first.return_value = Mock()
        mock_payroll_svc = Mock()
        mock_payroll_svc.calculate_ssnit.return_value = (Decimal('0'), Decimal('0'), Decimal('0'))
        mock_payroll_svc.calculate_paye.return_value = Decimal('0')
        mock_svc_cls.return_value = mock_payroll_svc

        employee = make_employee()
        service = BackpayService(employee, 'SALARY_REVISION')
        result = service.calculate(date(2025, 1, 1), date(2025, 1, 31))

        # No details since basic is same
        self.assertEqual(len(result['periods'][0]['details']), 0)
        self.assertEqual(result['totals']['total_arrears_earnings'], Decimal('0'))
