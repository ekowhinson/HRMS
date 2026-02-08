from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from unittest.mock import Mock, patch, MagicMock

from django.test import TestCase

from payroll.services import PayrollService, PayrollComputationResult


class PayrollComputationResultTest(TestCase):
    """Test PayrollComputationResult dataclass includes proration fields."""

    def test_default_proration_fields(self):
        result = PayrollComputationResult(success=True, employee_id=1)
        self.assertEqual(result.proration_factor, Decimal('1'))
        self.assertEqual(result.days_payable, 0)
        self.assertEqual(result.total_days, 0)

    def test_custom_proration_fields(self):
        result = PayrollComputationResult(
            success=True,
            employee_id=1,
            proration_factor=Decimal('0.5484'),
            days_payable=17,
            total_days=31,
        )
        self.assertEqual(result.proration_factor, Decimal('0.5484'))
        self.assertEqual(result.days_payable, 17)
        self.assertEqual(result.total_days, 31)


class CalculateProrationFactorTest(TestCase):
    """Test calculate_proration_factor method in isolation using mocks."""

    def _make_service(self, start_date, end_date):
        """Create a PayrollService with a mocked payroll run/period."""
        period = Mock()
        period.start_date = start_date
        period.end_date = end_date
        run = Mock()
        run.payroll_period = period
        return PayrollService(run)

    def _make_employee(self, date_of_joining=None, date_of_exit=None):
        emp = Mock()
        emp.date_of_joining = date_of_joining
        emp.date_of_exit = date_of_exit
        return emp

    # ------------------------------------------------------------------
    # Full-period (no proration)
    # ------------------------------------------------------------------

    def test_full_period_existing_employee(self):
        """Employee who joined long before the period gets factor=1."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(date_of_joining=date(2024, 3, 1))
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(factor, Decimal('1'))
        self.assertEqual(days, 31)
        self.assertEqual(total, 31)

    def test_no_joining_date(self):
        """Employee with no date_of_joining gets factor=1."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(date_of_joining=None)
        factor, _, _ = service.calculate_proration_factor(emp)
        self.assertEqual(factor, Decimal('1'))

    # ------------------------------------------------------------------
    # First working day rule
    # ------------------------------------------------------------------

    def test_join_on_first_working_day_weekday_start(self):
        """Jan 1 2026 is a Thursday — joining on Jan 1 → no proration."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(date_of_joining=date(2026, 1, 1))
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(factor, Decimal('1'))
        self.assertEqual(days, 31)

    def test_join_on_first_working_day_weekend_start(self):
        """Feb 1 2025 is a Saturday — first working day is Feb 3 (Monday).
        Joining on Feb 3 → no proration."""
        service = self._make_service(date(2025, 2, 1), date(2025, 2, 28))
        emp = self._make_employee(date_of_joining=date(2025, 2, 3))
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(factor, Decimal('1'))
        self.assertEqual(days, 28)

    def test_join_on_saturday_when_period_starts_saturday(self):
        """Feb 1 2025 is Saturday. Joining on Feb 1 (before first working day Mon)
        should still be no proration since join <= first working day."""
        service = self._make_service(date(2025, 2, 1), date(2025, 2, 28))
        emp = self._make_employee(date_of_joining=date(2025, 2, 1))
        # date_of_joining (Feb 1) is NOT > period_start (Feb 1), so no proration path
        factor, _, _ = service.calculate_proration_factor(emp)
        self.assertEqual(factor, Decimal('1'))

    def test_join_on_sunday_when_period_starts_saturday(self):
        """Feb 1 2025 is Saturday, first working day is Feb 3.
        Joining on Feb 2 (Sunday) → Feb 2 > Feb 1, but Feb 2 <= first working day (Feb 3).
        No proration."""
        service = self._make_service(date(2025, 2, 1), date(2025, 2, 28))
        emp = self._make_employee(date_of_joining=date(2025, 2, 2))
        factor, _, _ = service.calculate_proration_factor(emp)
        self.assertEqual(factor, Decimal('1'))

    # ------------------------------------------------------------------
    # Mid-period joiner
    # ------------------------------------------------------------------

    def test_join_jan_15(self):
        """Join Jan 15 in Jan 1-31 period → 17 payable days out of 31."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(date_of_joining=date(2026, 1, 15))
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(days, 17)
        self.assertEqual(total, 31)
        expected = Decimal('17') / Decimal('31')
        self.assertEqual(factor, expected)

    def test_join_last_day_of_period(self):
        """Join on Jan 31 → 1 payable day."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(date_of_joining=date(2026, 1, 31))
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(days, 1)
        self.assertEqual(total, 31)

    def test_join_second_day(self):
        """Jan 2 2026 is Friday (not first working day since Jan 1 is Thu) → prorated.
        30 days payable."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(date_of_joining=date(2026, 1, 2))
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(days, 30)
        self.assertEqual(total, 31)

    # ------------------------------------------------------------------
    # Mid-period exit
    # ------------------------------------------------------------------

    def test_exit_jan_20(self):
        """Exit Jan 20 in Jan 1-31 period → 20 payable days."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(
            date_of_joining=date(2024, 1, 1),
            date_of_exit=date(2026, 1, 20),
        )
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(days, 20)
        self.assertEqual(total, 31)

    def test_exit_first_day(self):
        """Exit on Jan 1 → 1 payable day."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(
            date_of_joining=date(2024, 1, 1),
            date_of_exit=date(2026, 1, 1),
        )
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(days, 1)
        self.assertEqual(total, 31)

    def test_exit_on_last_day_is_full(self):
        """Exit on period end date → full period."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(
            date_of_joining=date(2024, 1, 1),
            date_of_exit=date(2026, 1, 31),
        )
        factor, _, _ = service.calculate_proration_factor(emp)
        self.assertEqual(factor, Decimal('1'))

    # ------------------------------------------------------------------
    # Join + exit in same period
    # ------------------------------------------------------------------

    def test_join_and_exit_same_period(self):
        """Join Jan 10, exit Jan 20 → 11 payable days."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(
            date_of_joining=date(2026, 1, 10),
            date_of_exit=date(2026, 1, 20),
        )
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(days, 11)
        self.assertEqual(total, 31)

    # ------------------------------------------------------------------
    # February (shorter month)
    # ------------------------------------------------------------------

    def test_february_non_leap(self):
        """Feb 2026 has 28 days. Join Feb 15 → 14 payable days."""
        service = self._make_service(date(2026, 2, 1), date(2026, 2, 28))
        emp = self._make_employee(date_of_joining=date(2026, 2, 15))
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(days, 14)
        self.assertEqual(total, 28)

    def test_february_leap(self):
        """Feb 2028 is a leap year (29 days). Join Feb 15 → 15 payable days."""
        service = self._make_service(date(2028, 2, 1), date(2028, 2, 29))
        emp = self._make_employee(date_of_joining=date(2028, 2, 15))
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(days, 15)
        self.assertEqual(total, 29)

    # ------------------------------------------------------------------
    # Edge: exit date before join date (impossible overlap)
    # ------------------------------------------------------------------

    def test_zero_days_payable(self):
        """If effective_end < effective_start, days_payable should be 0."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))
        emp = self._make_employee(
            date_of_joining=date(2026, 1, 20),
            date_of_exit=date(2026, 1, 10),
        )
        factor, days, total = service.calculate_proration_factor(emp)
        self.assertEqual(days, 0)
        self.assertEqual(total, 31)


class ProrationIntegrationTest(TestCase):
    """Integration-level tests verifying proration flows through compute_employee_payroll."""

    def _make_service(self, start_date, end_date):
        period = Mock()
        period.start_date = start_date
        period.end_date = end_date
        period.year = start_date.year
        period.name = f"Test {start_date.strftime('%B %Y')}"
        run = Mock()
        run.payroll_period = period
        service = PayrollService(run)
        # Pre-cache empty lookups to avoid DB hits in tax/ssnit
        service._tax_brackets = []
        service._ssnit_rates = {}
        service._tax_reliefs = []
        service._overtime_bonus_config = None
        return service

    @patch('payroll.services.PayComponent.objects')
    @patch('payroll.services.EmployeeSalaryComponent.objects')
    def test_prorated_basic_salary(self, mock_esc_objects, mock_pc_objects):
        """A mid-period joiner should have basic salary prorated."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))

        # Mock basic component with is_prorated=True
        basic_comp = Mock()
        basic_comp.code = 'BASIC'
        basic_comp.is_active = True
        basic_comp.is_prorated = True
        basic_comp.is_taxable = True
        basic_comp.is_overtime = False
        basic_comp.is_bonus = False
        basic_comp.component_type = 'EARNING'

        mock_pc_objects.filter.return_value.first.return_value = basic_comp

        # Mock salary
        salary = Mock()
        salary.basic_salary = Decimal('3100.00')

        # Mock employee - joins Jan 15 → factor = 17/31
        employee = Mock()
        employee.id = 1
        employee.date_of_joining = date(2026, 1, 15)
        employee.date_of_exit = None
        employee.grade = None
        employee.grade_id = None
        employee.salary_notch = None

        # Mock salary components queryset (empty)
        mock_esc_qs = MagicMock()
        mock_esc_qs.__iter__ = Mock(return_value=iter([]))
        mock_esc_qs.select_related.return_value = mock_esc_qs
        mock_esc_objects.filter.return_value = mock_esc_qs

        with patch.object(service, 'get_employee_salary', return_value=salary), \
             patch.object(service, 'get_adhoc_payments', return_value=[]), \
             patch.object(service, 'get_active_transactions', return_value=[]):

            result = service.compute_employee_payroll(employee)
            computation, details = result

        expected_factor = Decimal('17') / Decimal('31')
        expected_basic = (Decimal('3100.00') * expected_factor).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )

        self.assertTrue(computation.success)
        self.assertEqual(computation.basic_salary, expected_basic)
        self.assertEqual(computation.days_payable, 17)
        self.assertEqual(computation.total_days, 31)
        self.assertLess(computation.proration_factor, Decimal('1'))

    @patch('payroll.services.PayComponent.objects')
    @patch('payroll.services.EmployeeSalaryComponent.objects')
    def test_non_prorated_component_gets_full_amount(self, mock_esc_objects, mock_pc_objects):
        """A component with is_prorated=False should get full amount even for mid-period joiner."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))

        # Basic component with is_prorated=False
        basic_comp = Mock()
        basic_comp.code = 'BASIC'
        basic_comp.is_active = True
        basic_comp.is_prorated = False
        basic_comp.is_taxable = True
        basic_comp.is_overtime = False
        basic_comp.is_bonus = False
        basic_comp.component_type = 'EARNING'

        mock_pc_objects.filter.return_value.first.return_value = basic_comp

        salary = Mock()
        salary.basic_salary = Decimal('3100.00')

        employee = Mock()
        employee.id = 1
        employee.date_of_joining = date(2026, 1, 15)
        employee.date_of_exit = None
        employee.grade = None
        employee.grade_id = None
        employee.salary_notch = None

        mock_esc_qs = MagicMock()
        mock_esc_qs.__iter__ = Mock(return_value=iter([]))
        mock_esc_qs.select_related.return_value = mock_esc_qs
        mock_esc_objects.filter.return_value = mock_esc_qs

        with patch.object(service, 'get_employee_salary', return_value=salary), \
             patch.object(service, 'get_adhoc_payments', return_value=[]), \
             patch.object(service, 'get_active_transactions', return_value=[]):

            result = service.compute_employee_payroll(employee)
            computation, details = result

        # Basic should be full amount since is_prorated=False
        self.assertEqual(computation.basic_salary, Decimal('3100.00'))

    @patch('payroll.services.PayComponent.objects')
    @patch('payroll.services.EmployeeSalaryComponent.objects')
    def test_full_period_employee_no_proration(self, mock_esc_objects, mock_pc_objects):
        """An employee who joined before the period should get full salary."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))

        basic_comp = Mock()
        basic_comp.code = 'BASIC'
        basic_comp.is_active = True
        basic_comp.is_prorated = True
        basic_comp.is_taxable = True
        basic_comp.is_overtime = False
        basic_comp.is_bonus = False
        basic_comp.component_type = 'EARNING'

        mock_pc_objects.filter.return_value.first.return_value = basic_comp

        salary = Mock()
        salary.basic_salary = Decimal('3100.00')

        employee = Mock()
        employee.id = 1
        employee.date_of_joining = date(2024, 6, 1)
        employee.date_of_exit = None
        employee.grade = None
        employee.grade_id = None
        employee.salary_notch = None

        mock_esc_qs = MagicMock()
        mock_esc_qs.__iter__ = Mock(return_value=iter([]))
        mock_esc_qs.select_related.return_value = mock_esc_qs
        mock_esc_objects.filter.return_value = mock_esc_qs

        with patch.object(service, 'get_employee_salary', return_value=salary), \
             patch.object(service, 'get_adhoc_payments', return_value=[]), \
             patch.object(service, 'get_active_transactions', return_value=[]):

            result = service.compute_employee_payroll(employee)
            computation, details = result

        self.assertEqual(computation.basic_salary, Decimal('3100.00'))
        self.assertEqual(computation.proration_factor, Decimal('1'))
        self.assertEqual(computation.days_payable, 31)

    @patch('payroll.services.PayComponent.objects')
    @patch('payroll.services.EmployeeSalaryComponent.objects')
    def test_salary_components_prorated(self, mock_esc_objects, mock_pc_objects):
        """Salary components with is_prorated=True should be prorated for mid-period joiner."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))

        basic_comp = Mock()
        basic_comp.code = 'BASIC'
        basic_comp.is_active = True
        basic_comp.is_prorated = True
        basic_comp.is_taxable = True
        basic_comp.is_overtime = False
        basic_comp.is_bonus = False
        basic_comp.component_type = 'EARNING'

        # Return basic_comp for all PayComponent.objects.filter().first() calls
        mock_pc_objects.filter.return_value.first.return_value = basic_comp

        salary = Mock()
        salary.basic_salary = Decimal('3100.00')

        # Create a salary component (housing allowance, prorated)
        housing_comp = Mock()
        housing_comp.code = 'HOUSING'
        housing_comp.is_prorated = True
        housing_comp.is_taxable = True
        housing_comp.is_overtime = False
        housing_comp.is_bonus = False
        housing_comp.component_type = 'EARNING'

        sal_comp = Mock()
        sal_comp.pay_component = housing_comp
        sal_comp.amount = Decimal('500.00')

        mock_esc_qs = MagicMock()
        mock_esc_qs.__iter__ = Mock(return_value=iter([sal_comp]))
        mock_esc_qs.select_related.return_value = mock_esc_qs
        mock_esc_objects.filter.return_value = mock_esc_qs

        employee = Mock()
        employee.id = 1
        employee.date_of_joining = date(2026, 1, 15)  # factor = 17/31
        employee.date_of_exit = None
        employee.grade = None
        employee.grade_id = None
        employee.salary_notch = None

        with patch.object(service, 'get_employee_salary', return_value=salary), \
             patch.object(service, 'get_adhoc_payments', return_value=[]), \
             patch.object(service, 'get_active_transactions', return_value=[]):

            result = service.compute_employee_payroll(employee)
            computation, details = result

        factor = Decimal('17') / Decimal('31')
        expected_housing = (Decimal('500.00') * factor).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )

        # Find the housing detail
        housing_detail = [d for d in details if d['pay_component'].code == 'HOUSING']
        self.assertEqual(len(housing_detail), 1)
        self.assertEqual(housing_detail[0]['amount'], expected_housing)

    @patch('payroll.services.PayComponent.objects')
    @patch('payroll.services.EmployeeSalaryComponent.objects')
    def test_adhoc_payments_not_prorated(self, mock_esc_objects, mock_pc_objects):
        """Ad-hoc payments should NOT be prorated regardless of proration factor."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))

        basic_comp = Mock()
        basic_comp.code = 'BASIC'
        basic_comp.is_active = True
        basic_comp.is_prorated = True
        basic_comp.is_taxable = True
        basic_comp.is_overtime = False
        basic_comp.is_bonus = False
        basic_comp.component_type = 'EARNING'

        mock_pc_objects.filter.return_value.first.return_value = basic_comp

        salary = Mock()
        salary.basic_salary = Decimal('3100.00')

        # Create an ad-hoc payment
        adhoc_comp = Mock()
        adhoc_comp.code = 'BONUS_ADHOC'
        adhoc_comp.is_prorated = True  # Even if prorated flag is set
        adhoc_comp.is_taxable = True
        adhoc_comp.is_overtime = False
        adhoc_comp.is_bonus = False
        adhoc_comp.component_type = 'EARNING'

        adhoc = Mock()
        adhoc.pay_component = adhoc_comp
        adhoc.amount = Decimal('1000.00')
        adhoc.is_taxable = True
        adhoc.description = 'One-time bonus'

        mock_esc_qs = MagicMock()
        mock_esc_qs.__iter__ = Mock(return_value=iter([]))
        mock_esc_qs.select_related.return_value = mock_esc_qs
        mock_esc_objects.filter.return_value = mock_esc_qs

        employee = Mock()
        employee.id = 1
        employee.date_of_joining = date(2026, 1, 15)
        employee.date_of_exit = None
        employee.grade = None
        employee.grade_id = None
        employee.salary_notch = None

        with patch.object(service, 'get_employee_salary', return_value=salary), \
             patch.object(service, 'get_adhoc_payments', return_value=[adhoc]), \
             patch.object(service, 'get_active_transactions', return_value=[]):

            result = service.compute_employee_payroll(employee)
            computation, details = result

        # Find the ad-hoc detail - should be full amount
        adhoc_detail = [d for d in details if d['pay_component'].code == 'BONUS_ADHOC']
        self.assertEqual(len(adhoc_detail), 1)
        self.assertEqual(adhoc_detail[0]['amount'], Decimal('1000.00'))

    @patch('payroll.services.PayComponent.objects')
    @patch('payroll.services.EmployeeSalaryComponent.objects')
    def test_exit_mid_period_proration(self, mock_esc_objects, mock_pc_objects):
        """Employee exiting mid-period should have prorated salary."""
        service = self._make_service(date(2026, 1, 1), date(2026, 1, 31))

        basic_comp = Mock()
        basic_comp.code = 'BASIC'
        basic_comp.is_active = True
        basic_comp.is_prorated = True
        basic_comp.is_taxable = True
        basic_comp.is_overtime = False
        basic_comp.is_bonus = False
        basic_comp.component_type = 'EARNING'

        mock_pc_objects.filter.return_value.first.return_value = basic_comp

        salary = Mock()
        salary.basic_salary = Decimal('3100.00')

        employee = Mock()
        employee.id = 1
        employee.date_of_joining = date(2024, 1, 1)
        employee.date_of_exit = date(2026, 1, 20)  # factor = 20/31
        employee.grade = None
        employee.grade_id = None
        employee.salary_notch = None

        mock_esc_qs = MagicMock()
        mock_esc_qs.__iter__ = Mock(return_value=iter([]))
        mock_esc_qs.select_related.return_value = mock_esc_qs
        mock_esc_objects.filter.return_value = mock_esc_qs

        with patch.object(service, 'get_employee_salary', return_value=salary), \
             patch.object(service, 'get_adhoc_payments', return_value=[]), \
             patch.object(service, 'get_active_transactions', return_value=[]):

            result = service.compute_employee_payroll(employee)
            computation, details = result

        factor = Decimal('20') / Decimal('31')
        expected_basic = (Decimal('3100.00') * factor).quantize(
            Decimal('0.01'), rounding=ROUND_HALF_UP
        )

        self.assertTrue(computation.success)
        self.assertEqual(computation.basic_salary, expected_basic)
        self.assertEqual(computation.days_payable, 20)
        self.assertEqual(computation.total_days, 31)
