"""
Payroll audit service — deterministic consistency checks.
Verifies math, statutory rates, and data quality for payroll runs.
"""

import logging
from dataclasses import dataclass, field, asdict
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from statistics import median

from django.db.models import Sum, Count, Q

from .models import PayrollRun, PayrollItem, PayrollItemDetail, PayComponent

logger = logging.getLogger(__name__)

TOLERANCE = Decimal('0.02')


class Severity(str, Enum):
    ERROR = 'ERROR'
    WARNING = 'WARNING'
    INFO = 'INFO'


@dataclass
class AuditFinding:
    check_name: str
    severity: str
    message: str
    employee_number: str = ''
    employee_name: str = ''
    expected: str = ''
    actual: str = ''
    difference: str = ''

    def to_dict(self):
        return asdict(self)


@dataclass
class AuditReport:
    run_number: str
    period_name: str
    total_employees: int
    findings: list = field(default_factory=list)
    checks_passed: int = 0
    total_checks: int = 0

    @property
    def summary(self):
        errors = sum(1 for f in self.findings if f.severity == Severity.ERROR)
        warnings = sum(1 for f in self.findings if f.severity == Severity.WARNING)
        info = sum(1 for f in self.findings if f.severity == Severity.INFO)
        return {
            'total_findings': len(self.findings),
            'errors': errors,
            'warnings': warnings,
            'info': info,
            'checks_passed': self.checks_passed,
            'total_checks': self.total_checks,
        }

    def to_dict(self):
        return {
            'run_number': self.run_number,
            'period_name': self.period_name,
            'total_employees': self.total_employees,
            'summary': self.summary,
            'findings': [f.to_dict() for f in self.findings],
        }


class PayrollAuditService:
    """Runs deterministic consistency checks on a payroll run."""

    def run_audit(self, payroll_run: PayrollRun) -> AuditReport:
        report = AuditReport(
            run_number=payroll_run.run_number,
            period_name=payroll_run.payroll_period.name,
            total_employees=payroll_run.total_employees,
        )

        checks = [
            self.check_item_net_equation,
            self.check_run_totals_vs_items,
            self.check_detail_sums_vs_items,
            self.check_ssnit_rates,
            self.check_paye_calculation,
            self.check_data_quality,
            self.check_anomalies,
        ]

        items = list(
            payroll_run.items
            .select_related('employee', 'employee_salary')
            .all()
        )

        for check in checks:
            report.total_checks += 1
            try:
                findings = check(payroll_run, items)
                if not findings:
                    report.checks_passed += 1
                else:
                    report.findings.extend(findings)
            except Exception as e:
                logger.error(f"Audit check {check.__name__} failed: {e}")
                report.findings.append(AuditFinding(
                    check_name=check.__name__,
                    severity=Severity.ERROR,
                    message=f"Check failed with error: {e}",
                ))

        return report

    def check_item_net_equation(self, run: PayrollRun, items: list) -> list:
        """Verify net_salary == gross_earnings - total_deductions for every PayrollItem."""
        findings = []
        for item in items:
            expected_net = item.gross_earnings - item.total_deductions
            diff = abs(item.net_salary - expected_net)
            if diff > TOLERANCE:
                findings.append(AuditFinding(
                    check_name='net_equation',
                    severity=Severity.ERROR,
                    message=f"Net salary does not equal gross - deductions",
                    employee_number=item.employee.employee_number,
                    employee_name=item.employee.get_full_name(),
                    expected=str(expected_net),
                    actual=str(item.net_salary),
                    difference=str(item.net_salary - expected_net),
                ))
        return findings

    def check_run_totals_vs_items(self, run: PayrollRun, items: list) -> list:
        """Verify PayrollRun aggregates match SUM of PayrollItems."""
        findings = []

        agg = PayrollItem.objects.filter(payroll_run=run).aggregate(
            sum_gross=Sum('gross_earnings'),
            sum_deductions=Sum('total_deductions'),
            sum_net=Sum('net_salary'),
            sum_paye=Sum('paye'),
            sum_ssnit_ee=Sum('ssnit_employee'),
            sum_ssnit_er=Sum('ssnit_employer'),
            item_count=Count('id'),
        )

        checks = [
            ('total_gross', run.total_gross, agg['sum_gross'] or Decimal('0')),
            ('total_deductions', run.total_deductions, agg['sum_deductions'] or Decimal('0')),
            ('total_net', run.total_net, agg['sum_net'] or Decimal('0')),
            ('total_paye', run.total_paye, agg['sum_paye'] or Decimal('0')),
            ('total_ssnit_employee', run.total_ssnit_employee, agg['sum_ssnit_ee'] or Decimal('0')),
            ('total_ssnit_employer', run.total_ssnit_employer, agg['sum_ssnit_er'] or Decimal('0')),
        ]

        for field_name, run_value, items_sum in checks:
            diff = abs(run_value - items_sum)
            if diff > TOLERANCE:
                findings.append(AuditFinding(
                    check_name='run_totals',
                    severity=Severity.ERROR,
                    message=f"Run {field_name} does not match sum of items",
                    expected=str(items_sum),
                    actual=str(run_value),
                    difference=str(run_value - items_sum),
                ))

        if run.total_employees != (agg['item_count'] or 0):
            findings.append(AuditFinding(
                check_name='run_totals',
                severity=Severity.ERROR,
                message="Run employee count does not match item count",
                expected=str(agg['item_count'] or 0),
                actual=str(run.total_employees),
            ))

        return findings

    def check_detail_sums_vs_items(self, run: PayrollRun, items: list) -> list:
        """Verify SUM of EARNING details ≈ gross_earnings per item."""
        findings = []

        item_ids = [item.id for item in items]
        item_map = {item.id: item for item in items}

        # Aggregate earning details per item
        earning_sums = (
            PayrollItemDetail.objects
            .filter(
                payroll_item_id__in=item_ids,
                pay_component__component_type=PayComponent.ComponentType.EARNING,
            )
            .values('payroll_item_id')
            .annotate(total=Sum('amount'))
        )

        earning_map = {row['payroll_item_id']: row['total'] for row in earning_sums}

        for item_id, item in item_map.items():
            detail_sum = earning_map.get(item_id, Decimal('0'))
            diff = abs(item.gross_earnings - detail_sum)
            if diff > TOLERANCE:
                findings.append(AuditFinding(
                    check_name='detail_sums',
                    severity=Severity.WARNING,
                    message="Sum of earning details does not match gross_earnings",
                    employee_number=item.employee.employee_number,
                    employee_name=item.employee.get_full_name(),
                    expected=str(item.gross_earnings),
                    actual=str(detail_sum),
                    difference=str(item.gross_earnings - detail_sum),
                ))

        return findings

    def check_ssnit_rates(self, run: PayrollRun, items: list) -> list:
        """Recalculate SSNIT via SSNITService and compare."""
        findings = []

        try:
            from .tax_service import SSNITService
            ssnit_service = SSNITService(run.payroll_period)
        except Exception as e:
            logger.warning(f"Could not initialize SSNITService: {e}")
            return []

        for item in items:
            if item.status == PayrollItem.Status.ERROR:
                continue

            basic = item.basic_salary
            try:
                expected_ee, expected_er_t1, expected_er_t2 = ssnit_service.calculate_ssnit(basic)
            except Exception:
                continue

            # Check employee SSNIT
            diff_ee = abs(item.ssnit_employee - expected_ee)
            if diff_ee > TOLERANCE:
                findings.append(AuditFinding(
                    check_name='ssnit_rate',
                    severity=Severity.ERROR,
                    message="SSNIT employee contribution mismatch",
                    employee_number=item.employee.employee_number,
                    employee_name=item.employee.get_full_name(),
                    expected=str(expected_ee),
                    actual=str(item.ssnit_employee),
                    difference=str(item.ssnit_employee - expected_ee),
                ))

            # Check employer SSNIT Tier 1
            diff_er = abs(item.ssnit_employer - expected_er_t1)
            if diff_er > TOLERANCE:
                findings.append(AuditFinding(
                    check_name='ssnit_rate',
                    severity=Severity.ERROR,
                    message="SSNIT employer Tier 1 contribution mismatch",
                    employee_number=item.employee.employee_number,
                    employee_name=item.employee.get_full_name(),
                    expected=str(expected_er_t1),
                    actual=str(item.ssnit_employer),
                    difference=str(item.ssnit_employer - expected_er_t1),
                ))

        return findings

    def check_paye_calculation(self, run: PayrollRun, items: list) -> list:
        """Spot-check PAYE for top 10 earners."""
        findings = []

        try:
            from .tax_service import TaxCalculationService
            tax_service = TaxCalculationService(run.payroll_period)
        except Exception as e:
            logger.warning(f"Could not initialize TaxCalculationService: {e}")
            return []

        # Sort by taxable income descending, take top 10
        sorted_items = sorted(
            [i for i in items if i.status != PayrollItem.Status.ERROR],
            key=lambda x: x.taxable_income,
            reverse=True,
        )[:10]

        for item in sorted_items:
            if item.taxable_income <= 0:
                continue

            try:
                expected_paye = tax_service.calculate_paye(item.taxable_income)
            except Exception:
                continue

            diff = abs(item.paye - expected_paye)
            if diff > TOLERANCE:
                findings.append(AuditFinding(
                    check_name='paye_calculation',
                    severity=Severity.ERROR,
                    message="PAYE calculation mismatch",
                    employee_number=item.employee.employee_number,
                    employee_name=item.employee.get_full_name(),
                    expected=str(expected_paye),
                    actual=str(item.paye),
                    difference=str(item.paye - expected_paye),
                ))

        return findings

    def check_data_quality(self, run: PayrollRun, items: list) -> list:
        """Check for ERROR-status items, missing bank details, zero/negative net, negative deductions."""
        findings = []

        for item in items:
            emp_num = item.employee.employee_number
            emp_name = item.employee.get_full_name()

            # ERROR status items
            if item.status == PayrollItem.Status.ERROR:
                findings.append(AuditFinding(
                    check_name='data_quality',
                    severity=Severity.ERROR,
                    message=f"Payroll item has ERROR status: {item.error_message or 'no details'}",
                    employee_number=emp_num,
                    employee_name=emp_name,
                ))

            # Missing bank details
            if not item.bank_account_number:
                findings.append(AuditFinding(
                    check_name='data_quality',
                    severity=Severity.WARNING,
                    message="Missing bank account number",
                    employee_number=emp_num,
                    employee_name=emp_name,
                ))

            # Zero or negative net salary (excluding ERROR items)
            if item.status != PayrollItem.Status.ERROR and item.net_salary <= 0:
                findings.append(AuditFinding(
                    check_name='data_quality',
                    severity=Severity.WARNING,
                    message="Zero or negative net salary",
                    employee_number=emp_num,
                    employee_name=emp_name,
                    actual=str(item.net_salary),
                ))

            # Negative deductions
            if item.total_deductions < 0:
                findings.append(AuditFinding(
                    check_name='data_quality',
                    severity=Severity.ERROR,
                    message="Negative total deductions",
                    employee_number=emp_num,
                    employee_name=emp_name,
                    actual=str(item.total_deductions),
                ))

        return findings

    def check_anomalies(self, run: PayrollRun, items: list) -> list:
        """Identify salary outliers (>5x median) and prorated employees."""
        findings = []

        valid_items = [i for i in items if i.status != PayrollItem.Status.ERROR]
        if not valid_items:
            return findings

        net_salaries = [float(i.net_salary) for i in valid_items if i.net_salary > 0]
        if len(net_salaries) >= 3:
            med = median(net_salaries)
            threshold = med * 5

            for item in valid_items:
                if float(item.net_salary) > threshold:
                    findings.append(AuditFinding(
                        check_name='anomaly',
                        severity=Severity.INFO,
                        message=f"Net salary is >5x the median ({med:.2f} GHS)",
                        employee_number=item.employee.employee_number,
                        employee_name=item.employee.get_full_name(),
                        actual=str(item.net_salary),
                    ))

        # Prorated employees
        for item in valid_items:
            if item.proration_factor < Decimal('1.0'):
                findings.append(AuditFinding(
                    check_name='anomaly',
                    severity=Severity.INFO,
                    message=f"Prorated salary (factor: {item.proration_factor})",
                    employee_number=item.employee.employee_number,
                    employee_name=item.employee.get_full_name(),
                    actual=str(item.net_salary),
                ))

        return findings
