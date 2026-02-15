"""
Payroll data provider and context formatter for AI assistant.

PayrollDataProvider: fetches data (queries)
PayrollContextFormatter: formats data into plain text for LLM context
"""

import logging
from decimal import Decimal

from django.db.models import Sum, Count

from payroll.models import PayrollRun, PayrollItem, PayrollItemDetail, PayComponent

logger = logging.getLogger(__name__)

MAX_EMPLOYEE_DETAILS = 20
MAX_FINDINGS_PER_SEVERITY = 30


# ── Formatter ────────────────────────────────────────────────────────────────

class PayrollContextFormatter:
    """Turns raw payroll objects into plain-text sections for LLM context."""

    def format_run_summary(self, run: PayrollRun) -> str:
        lines = [
            "=== PAYROLL RUN SUMMARY ===",
            f"Run Number: {run.run_number}",
            f"Period: {run.payroll_period.name}",
            f"Status: {run.status}",
            f"Total Employees: {run.total_employees}",
            f"Total Gross Earnings: GHS {run.total_gross:,.2f}",
            f"Total Deductions: GHS {run.total_deductions:,.2f}",
            f"Total Net Salary: GHS {run.total_net:,.2f}",
            f"Total Employer Cost: GHS {run.total_employer_cost:,.2f}",
        ]
        return '\n'.join(lines)

    def format_statutory_summary(self, run: PayrollRun) -> str:
        lines = [
            "=== STATUTORY DEDUCTIONS SUMMARY ===",
            f"Total PAYE: GHS {run.total_paye:,.2f}",
            f"Total Overtime Tax: GHS {run.total_overtime_tax:,.2f}",
            f"Total Bonus Tax: GHS {run.total_bonus_tax:,.2f}",
            f"Total SSNIT (Employee): GHS {run.total_ssnit_employee:,.2f}",
            f"Total SSNIT (Employer): GHS {run.total_ssnit_employer:,.2f}",
            f"Total Tier 2 (Employer): GHS {run.total_tier2_employer:,.2f}",
        ]
        return '\n'.join(lines)

    def format_audit_findings(self, audit_report) -> str:
        lines = [
            "=== AUTOMATED AUDIT RESULTS ===",
            f"Total Checks: {audit_report.total_checks}",
            f"Checks Passed: {audit_report.checks_passed}",
            f"Total Findings: {len(audit_report.findings)}",
            f"  Errors: {audit_report.summary['errors']}",
            f"  Warnings: {audit_report.summary['warnings']}",
            f"  Info: {audit_report.summary['info']}",
        ]

        if not audit_report.findings:
            lines.append("\nAll checks passed — no issues found.")
            return '\n'.join(lines)

        for severity in ['ERROR', 'WARNING', 'INFO']:
            severity_findings = [
                f for f in audit_report.findings if f.severity == severity
            ]
            if not severity_findings:
                continue

            lines.append(f"\n--- {severity} findings ({len(severity_findings)}) ---")
            for f in severity_findings[:MAX_FINDINGS_PER_SEVERITY]:
                parts = [f"[{f.check_name}] {f.message}"]
                if f.employee_number:
                    parts.append(f"  Employee: {f.employee_number} ({f.employee_name})")
                if f.expected:
                    parts.append(f"  Expected: {f.expected}, Actual: {f.actual}")
                if f.difference:
                    parts.append(f"  Difference: {f.difference}")
                lines.append('\n'.join(parts))

            remaining = len(severity_findings) - MAX_FINDINGS_PER_SEVERITY
            if remaining > 0:
                lines.append(f"  ... and {remaining} more {severity} findings")

        return '\n'.join(lines)

    def format_employee_details(self, items: list) -> str:
        lines = [
            f"=== TOP {MAX_EMPLOYEE_DETAILS} EMPLOYEES BY NET SALARY ===",
        ]

        for item in items[:MAX_EMPLOYEE_DETAILS]:
            emp = item.employee
            lines.append(
                f"\n{emp.employee_number} - {emp.get_full_name()}"
                f"\n  Basic: GHS {item.basic_salary:,.2f}"
                f"  |  Gross: GHS {item.gross_earnings:,.2f}"
                f"  |  Deductions: GHS {item.total_deductions:,.2f}"
                f"  |  Net: GHS {item.net_salary:,.2f}"
                f"\n  PAYE: GHS {item.paye:,.2f}"
                f"  |  SSNIT(EE): GHS {item.ssnit_employee:,.2f}"
                f"  |  SSNIT(ER): GHS {item.ssnit_employer:,.2f}"
                f"  |  Tier2(ER): GHS {item.tier2_employer:,.2f}"
                f"\n  Taxable Income: GHS {item.taxable_income:,.2f}"
                f"  |  Proration: {item.proration_factor}"
                f"  |  Status: {item.status}"
                f"  |  Bank: {item.bank_name or 'N/A'} - {item.bank_account_number or 'N/A'}"
            )

        remaining = len(items) - MAX_EMPLOYEE_DETAILS
        if remaining > 0:
            lines.append(f"\n... and {remaining} more employees")

        return '\n'.join(lines)

    def format_component_breakdown(self, run: PayrollRun) -> str:
        details = (
            PayrollItemDetail.objects
            .filter(payroll_item__payroll_run=run)
            .values(
                'pay_component__code',
                'pay_component__name',
                'pay_component__component_type',
            )
            .annotate(
                total_amount=Sum('amount'),
                employee_count=Count('payroll_item', distinct=True),
            )
            .order_by('pay_component__component_type', '-total_amount')
        )

        lines = ["=== COMPONENT BREAKDOWN ==="]

        current_type = None
        for row in details:
            comp_type = row['pay_component__component_type']
            if comp_type != current_type:
                current_type = comp_type
                lines.append(f"\n-- {comp_type} --")

            lines.append(
                f"  {row['pay_component__code']}: {row['pay_component__name']}"
                f"  |  Total: GHS {row['total_amount']:,.2f}"
                f"  |  Employees: {row['employee_count']}"
            )

        return '\n'.join(lines)


# ── Data provider ────────────────────────────────────────────────────────────

class PayrollDataProvider:
    """Fetches payroll data + audit results and formats as LLM context text."""

    def __init__(self, audit_service=None, formatter=None):
        if audit_service is None:
            from payroll.audit_service import PayrollAuditService
            audit_service = PayrollAuditService()
        self.audit_service = audit_service
        self.formatter = formatter or PayrollContextFormatter()

    def get_payroll_context(self, payroll_run_id) -> dict:
        try:
            run = (
                PayrollRun.objects
                .select_related('payroll_period')
                .get(pk=payroll_run_id)
            )
        except PayrollRun.DoesNotExist:
            return {
                'context_text': 'Error: Payroll run not found.',
                'audit_summary': None,
                'run_number': '',
                'period_name': '',
            }

        audit_report = self.audit_service.run_audit(run)

        items = list(
            run.items
            .select_related('employee')
            .order_by('-net_salary')
        )

        sections = [
            self.formatter.format_run_summary(run),
            self.formatter.format_statutory_summary(run),
            self.formatter.format_audit_findings(audit_report),
            self.formatter.format_employee_details(items),
            self.formatter.format_component_breakdown(run),
        ]

        context_text = '\n\n'.join(s for s in sections if s)

        return {
            'context_text': context_text,
            'audit_summary': audit_report.summary,
            'run_number': run.run_number,
            'period_name': run.payroll_period.name,
        }
