"""
Consolidated payroll report views that span a period range.

Reports:
1. Consolidated Payroll Summary - Aggregated by dimension (department/staff_category)
2. Labour Cost Report - Cost breakdown by department
3. SSF Contribution Statement - Per-employee monthly SSF
4. Income Tax Statement - Per-employee monthly tax
5. Allowance Statement - Per-employee monthly allowances
"""

from collections import defaultdict
from decimal import Decimal

from django.db.models import Sum, Count, F, Q
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from payroll.models import PayrollPeriod, PayrollItem, PayrollItemDetail
from reports.exports import ReportExporter


# =============================================================================
# Shared Utilities
# =============================================================================

def get_items_for_period_range(from_period_id, to_period_id, filters=None):
    """
    Returns (PayrollItem queryset, periods queryset, from_period, to_period).
    Shared utility for all consolidated report views.
    """
    from_period = PayrollPeriod.objects.get(id=from_period_id)
    to_period = PayrollPeriod.objects.get(id=to_period_id)

    periods = PayrollPeriod.objects.filter(
        start_date__gte=from_period.start_date,
        start_date__lte=to_period.start_date,
    ).order_by('start_date')

    items = PayrollItem.objects.filter(
        payroll_run__payroll_period__in=periods,
        payroll_run__status__in=['COMPUTED', 'APPROVED', 'PAID'],
    ).select_related(
        'employee',
        'employee__department',
        'employee__staff_category',
        'employee__division',
        'employee__directorate',
        'employee__residential_region',
        'employee__residential_district',
        'payroll_run__payroll_period',
    )

    if filters:
        if filters.get('department'):
            items = items.filter(employee__department_id=filters['department'])
        if filters.get('staff_category'):
            items = items.filter(employee__staff_category_id=filters['staff_category'])
        if filters.get('employee'):
            items = items.filter(employee_id=filters['employee'])
        if filters.get('search'):
            search = filters['search']
            items = items.filter(
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search) |
                Q(employee__employee_number__icontains=search)
            )

    return items, periods, from_period, to_period


def _build_employee_statements(items, periods, columns_config):
    """
    Build per-employee monthly breakdown with yearly subtotals.
    Used by SSF, Tax, and Allowance statement views.

    columns_config: list of dicts with 'key' and 'item_field' (field on PayrollItem)
    Returns list of employee statement dicts.
    """
    # Group items by employee
    employee_items = defaultdict(list)
    for item in items:
        employee_items[item.employee_id].append(item)

    employees = []
    for emp_id, emp_items in employee_items.items():
        emp = emp_items[0].employee
        period_data = []
        yearly_sums = defaultdict(lambda: defaultdict(Decimal))

        for item in sorted(emp_items, key=lambda x: x.payroll_run.payroll_period.start_date):
            period = item.payroll_run.payroll_period
            row = {
                'period_name': period.name,
                'year': period.year,
            }
            for col in columns_config:
                val = getattr(item, col['item_field'], 0) or Decimal('0')
                row[col['key']] = float(val)
                yearly_sums[period.year][col['key']] += val

            period_data.append(row)

        # Compute grand total
        grand_total = {}
        yearly_subtotals = {}
        for year, sums in sorted(yearly_sums.items()):
            yearly_subtotals[str(year)] = {k: float(v) for k, v in sums.items()}
            for k, v in sums.items():
                grand_total[k] = grand_total.get(k, 0) + float(v)

        employees.append({
            'employee_number': emp.employee_number,
            'full_name': f"{emp.first_name or ''} {emp.last_name or ''}".strip(),
            'department': emp.department.name if emp.department else '',
            'ssf_number': getattr(emp, 'ssnit_number', '') or '',
            'tin': getattr(emp, 'tin_number', '') or '',
            'dob': str(emp.date_of_birth) if emp.date_of_birth else '',
            'hire_date': str(emp.date_of_joining) if emp.date_of_joining else '',
            'periods': period_data,
            'yearly_subtotals': yearly_subtotals,
            'grand_total': grand_total,
        })

    # Sort by employee number
    employees.sort(key=lambda e: e['employee_number'])
    return employees


def _get_period_range_params(request):
    """Extract common period range params from request."""
    return (
        request.query_params.get('from_period'),
        request.query_params.get('to_period'),
        request.query_params.get('file_format', 'csv'),
    )


GROUP_BY_OPTIONS = {
    'department': ('employee__department__name', 'Department'),
    'staff_category': ('employee__staff_category__name', 'Staff Category'),
    'division': ('employee__division__name', 'Division'),
    'directorate': ('employee__directorate__name', 'Directorate'),
    'region': ('employee__residential_region__name', 'Region'),
    'district': ('employee__residential_district__name', 'District'),
}


def _resolve_group_field(group_by):
    """Return (orm_field, display_label) for a group_by value."""
    return GROUP_BY_OPTIONS.get(group_by, GROUP_BY_OPTIONS['department'])


# =============================================================================
# Data Computation Functions (Single Responsibility)
# Each function owns the query + aggregation logic for one report type.
# Both data views and export views delegate to these.
# =============================================================================

def _compute_consolidated_summary(from_period_id, to_period_id, group_by='department', filters=None):
    """Compute consolidated summary rows and grand totals."""
    items, _periods, from_period, to_period = get_items_for_period_range(
        from_period_id, to_period_id, filters
    )

    group_field, _label = _resolve_group_field(group_by)

    rows = items.values(
        group_name=F(group_field)
    ).annotate(
        employee_count=Count('employee', distinct=True),
        total_earnings=Sum('gross_earnings'),
        total_deductions=Sum('total_deductions'),
        total_net=Sum('net_salary'),
        total_employer_cost=Sum('employer_cost'),
    ).order_by('group_name')

    rows_list = []
    for row in rows:
        rows_list.append({
            'group_name': row['group_name'] or 'Unassigned',
            'employee_count': row['employee_count'],
            'total_earnings': float(row['total_earnings'] or 0),
            'total_deductions': float(row['total_deductions'] or 0),
            'total_net': float(row['total_net'] or 0),
            'total_employer_cost': float(row['total_employer_cost'] or 0),
        })

    grand_totals = {
        'employee_count': sum(r['employee_count'] for r in rows_list),
        'total_earnings': sum(r['total_earnings'] for r in rows_list),
        'total_deductions': sum(r['total_deductions'] for r in rows_list),
        'total_net': sum(r['total_net'] for r in rows_list),
        'total_employer_cost': sum(r['total_employer_cost'] for r in rows_list),
    }

    return rows_list, grand_totals, from_period, to_period


def _compute_labour_cost(from_period_id, to_period_id, group_by='department', filters=None):
    """Compute labour cost breakdown rows and grand totals."""
    items, _periods, from_period, to_period = get_items_for_period_range(
        from_period_id, to_period_id, filters
    )

    group_field, _label = _resolve_group_field(group_by)

    rows = items.values(
        group_name=F(group_field)
    ).annotate(
        basic_salary=Sum('basic_salary'),
        company_ssf=Sum('ssnit_employer'),
        company_pf=Sum('tier2_employer'),
        overtime=Sum('total_overtime'),
        total_gross=Sum('gross_earnings'),
        total_employer_cost=Sum('employer_cost'),
    ).order_by('group_name')

    rows_list = []
    for row in rows:
        basic = float(row['basic_salary'] or 0)
        ssf = float(row['company_ssf'] or 0)
        pf = float(row['company_pf'] or 0)
        overtime = float(row['overtime'] or 0)
        gross = float(row['total_gross'] or 0)
        other_allowances = gross - basic - overtime

        base_cost = basic + ssf + pf
        overtime_pct = (overtime / base_cost * 100) if base_cost > 0 else 0
        allowances_pct = (other_allowances / base_cost * 100) if base_cost > 0 else 0

        rows_list.append({
            'group_name': row['group_name'] or 'Unassigned',
            'basic_salary': basic,
            'company_ssf': ssf,
            'company_pf': pf,
            'overtime': overtime,
            'other_allowances': round(other_allowances, 2),
            'total': round(gross + ssf + pf, 2),
            'overtime_pct': round(overtime_pct, 1),
            'allowances_pct': round(allowances_pct, 1),
        })

    grand_totals = {
        'basic_salary': sum(r['basic_salary'] for r in rows_list),
        'company_ssf': sum(r['company_ssf'] for r in rows_list),
        'company_pf': sum(r['company_pf'] for r in rows_list),
        'overtime': sum(r['overtime'] for r in rows_list),
        'other_allowances': sum(r['other_allowances'] for r in rows_list),
        'total': sum(r['total'] for r in rows_list),
    }

    base_total = grand_totals['basic_salary'] + grand_totals['company_ssf'] + grand_totals['company_pf']
    grand_totals['overtime_pct'] = round((grand_totals['overtime'] / base_total * 100) if base_total > 0 else 0, 1)
    grand_totals['allowances_pct'] = round((grand_totals['other_allowances'] / base_total * 100) if base_total > 0 else 0, 1)

    return rows_list, grand_totals, from_period, to_period


def _compute_ssf_data(from_period_id, to_period_id, filters=None):
    """Compute SSF contribution statement data."""
    items, periods, from_period, to_period = get_items_for_period_range(
        from_period_id, to_period_id, filters
    )

    columns_config = [
        {'key': 'basic', 'item_field': 'basic_salary'},
        {'key': 'employee_ssf', 'item_field': 'ssnit_employee'},
        {'key': 'employer_ssf', 'item_field': 'ssnit_employer'},
    ]

    employees = _build_employee_statements(items, periods, columns_config)

    # Add 'total' to each period and subtotals
    for emp in employees:
        for period in emp['periods']:
            period['total'] = period.get('employee_ssf', 0) + period.get('employer_ssf', 0)
        for year, subs in emp['yearly_subtotals'].items():
            subs['total'] = subs.get('employee_ssf', 0) + subs.get('employer_ssf', 0)
        emp['grand_total']['total'] = emp['grand_total'].get('employee_ssf', 0) + emp['grand_total'].get('employer_ssf', 0)

    return employees, columns_config, from_period, to_period


def _compute_tax_data(from_period_id, to_period_id, filters=None):
    """Compute income tax statement data."""
    items, periods, from_period, to_period = get_items_for_period_range(
        from_period_id, to_period_id, filters
    )

    columns_config = [
        {'key': 'basic', 'item_field': 'basic_salary'},
        {'key': 'taxable', 'item_field': 'taxable_income'},
        {'key': 'paye', 'item_field': 'paye'},
    ]

    employees = _build_employee_statements(items, periods, columns_config)
    return employees, columns_config, from_period, to_period


def _compute_allowance_data(from_period_id, to_period_id, filters=None):
    """Compute allowance statement data."""
    items, _periods, from_period, to_period = get_items_for_period_range(
        from_period_id, to_period_id, filters
    )

    items_list = list(items.prefetch_related('details', 'details__pay_component'))

    # Group by employee
    employee_items = defaultdict(list)
    for item in items_list:
        employee_items[item.employee_id].append(item)

    # Collect all unique allowance names across all items
    all_allowance_names = set()
    for emp_items in employee_items.values():
        for item in emp_items:
            for detail in item.details.all():
                if detail.pay_component.category == 'ALLOWANCE':
                    all_allowance_names.add(detail.pay_component.name)

    allowance_names = sorted(all_allowance_names)

    employees = []
    for emp_id, emp_items in employee_items.items():
        emp = emp_items[0].employee
        period_data = []
        yearly_sums = defaultdict(lambda: defaultdict(Decimal))

        for item in sorted(emp_items, key=lambda x: x.payroll_run.payroll_period.start_date):
            period = item.payroll_run.payroll_period
            row = {
                'period_name': period.name,
                'year': period.year,
                'basic': float(item.basic_salary or 0),
                'allowances': {},
                'total_allowances': 0,
            }

            # Get allowance details
            total_allowances = Decimal('0')
            for detail in item.details.all():
                if detail.pay_component.category == 'ALLOWANCE':
                    name = detail.pay_component.name
                    amt = detail.amount or Decimal('0')
                    row['allowances'][name] = float(amt)
                    total_allowances += amt

            row['total_allowances'] = float(total_allowances)

            yearly_sums[period.year]['basic'] += item.basic_salary or Decimal('0')
            yearly_sums[period.year]['total_allowances'] += total_allowances
            for name in allowance_names:
                yearly_sums[period.year][name] += Decimal(str(row['allowances'].get(name, 0)))

            period_data.append(row)

        # Compute grand total and yearly subtotals
        grand_total = {}
        yearly_subtotals = {}
        for year, sums in sorted(yearly_sums.items()):
            yearly_subtotals[str(year)] = {k: float(v) for k, v in sums.items()}
            for k, v in sums.items():
                grand_total[k] = grand_total.get(k, 0) + float(v)

        employees.append({
            'employee_number': emp.employee_number,
            'full_name': f"{emp.first_name or ''} {emp.last_name or ''}".strip(),
            'department': emp.department.name if emp.department else '',
            'ssf_number': getattr(emp, 'ssnit_number', '') or '',
            'tin': getattr(emp, 'tin_number', '') or '',
            'dob': str(emp.date_of_birth) if emp.date_of_birth else '',
            'hire_date': str(emp.date_of_joining) if emp.date_of_joining else '',
            'periods': period_data,
            'yearly_subtotals': yearly_subtotals,
            'grand_total': grand_total,
        })

    employees.sort(key=lambda e: e['employee_number'])
    return employees, allowance_names, from_period, to_period


# =============================================================================
# Helper to extract common filter params from request
# =============================================================================

def _get_summary_filters(request):
    """Extract department/staff_category filters from request."""
    return {
        'department': request.query_params.get('department'),
        'staff_category': request.query_params.get('staff_category'),
    }


def _get_statement_filters(request):
    """Extract department/employee/search filters from request."""
    return {
        'department': request.query_params.get('department'),
        'employee': request.query_params.get('employee'),
        'search': request.query_params.get('search'),
    }


# =============================================================================
# Data Views (thin wrappers around computation functions)
# =============================================================================

class ConsolidatedPayrollSummaryView(APIView):
    """Consolidated payroll summary aggregated by department or staff category."""

    def get(self, request):
        from_period_id = request.query_params.get('from_period')
        to_period_id = request.query_params.get('to_period')

        if not from_period_id or not to_period_id:
            return Response({
                'rows': [],
                'grand_totals': {},
                'from_period_name': '',
                'to_period_name': '',
            })

        group_by = request.query_params.get('group_by', 'department')
        filters = _get_summary_filters(request)

        rows_list, grand_totals, from_period, to_period = _compute_consolidated_summary(
            from_period_id, to_period_id, group_by, filters
        )

        return Response({
            'rows': rows_list,
            'grand_totals': grand_totals,
            'from_period_name': from_period.name,
            'to_period_name': to_period.name,
            'group_by': group_by,
        })


class LabourCostReportView(APIView):
    """Labour cost breakdown by department."""

    def get(self, request):
        from_period_id = request.query_params.get('from_period')
        to_period_id = request.query_params.get('to_period')

        if not from_period_id or not to_period_id:
            return Response({
                'rows': [],
                'grand_totals': {},
                'from_period_name': '',
                'to_period_name': '',
            })

        group_by = request.query_params.get('group_by', 'department')
        filters = _get_summary_filters(request)

        rows_list, grand_totals, from_period, to_period = _compute_labour_cost(
            from_period_id, to_period_id, group_by, filters
        )

        return Response({
            'rows': rows_list,
            'grand_totals': grand_totals,
            'from_period_name': from_period.name,
            'to_period_name': to_period.name,
        })


class SSFContributionStatementView(APIView):
    """SSF contribution statement per employee over a period range."""

    def get(self, request):
        from_period_id = request.query_params.get('from_period')
        to_period_id = request.query_params.get('to_period')

        if not from_period_id or not to_period_id:
            return Response({
                'employees': [],
                'from_period_name': '',
                'to_period_name': '',
            })

        filters = _get_statement_filters(request)
        employees, _columns_config, from_period, to_period = _compute_ssf_data(
            from_period_id, to_period_id, filters
        )

        return Response({
            'employees': employees,
            'from_period_name': from_period.name,
            'to_period_name': to_period.name,
        })


class IncomeTaxStatementView(APIView):
    """Income tax statement per employee over a period range."""

    def get(self, request):
        from_period_id = request.query_params.get('from_period')
        to_period_id = request.query_params.get('to_period')

        if not from_period_id or not to_period_id:
            return Response({
                'employees': [],
                'from_period_name': '',
                'to_period_name': '',
            })

        filters = _get_statement_filters(request)
        employees, _columns_config, from_period, to_period = _compute_tax_data(
            from_period_id, to_period_id, filters
        )

        return Response({
            'employees': employees,
            'from_period_name': from_period.name,
            'to_period_name': to_period.name,
        })


class AllowanceStatementView(APIView):
    """Allowance statement per employee over a period range."""

    def get(self, request):
        from_period_id = request.query_params.get('from_period')
        to_period_id = request.query_params.get('to_period')

        if not from_period_id or not to_period_id:
            return Response({
                'employees': [],
                'from_period_name': '',
                'to_period_name': '',
            })

        filters = _get_statement_filters(request)
        employees, allowance_names, from_period, to_period = _compute_allowance_data(
            from_period_id, to_period_id, filters
        )

        return Response({
            'employees': employees,
            'allowance_names': allowance_names,
            'from_period_name': from_period.name,
            'to_period_name': to_period.name,
        })


# =============================================================================
# Export Views (thin wrappers: format data from computation functions for export)
# =============================================================================

def _flatten_statement_for_export(employees, columns_config, col_headers):
    """Flatten per-employee statement data into flat rows for export."""
    data = []
    for emp in employees:
        for period in emp['periods']:
            row = {
                'Employee #': emp['employee_number'],
                'Name': emp['full_name'],
                'Department': emp['department'],
                'Period': period['period_name'],
            }
            for i, col in enumerate(columns_config):
                row[col_headers[i]] = period.get(col['key'], 0)
            data.append(row)
    return data


class ExportConsolidatedSummaryView(APIView):
    """Export consolidated payroll summary to CSV/Excel/PDF."""

    def get(self, request):
        from_period_id, to_period_id, file_format = _get_period_range_params(request)
        if not from_period_id or not to_period_id:
            return Response({'error': 'from_period and to_period are required'}, status=400)

        group_by = request.query_params.get('group_by', 'department')
        filters = _get_summary_filters(request)

        rows_list, _grand_totals, from_period, to_period = _compute_consolidated_summary(
            from_period_id, to_period_id, group_by, filters
        )

        _field, group_label = _resolve_group_field(group_by)
        data = [{
            group_label: r['group_name'],
            'Employees': r['employee_count'],
            'Total Earnings': r['total_earnings'],
            'Total Deductions': r['total_deductions'],
            'Net Pay': r['total_net'],
            'Employer Cost': r['total_employer_cost'],
        } for r in rows_list]

        headers = [group_label, 'Employees', 'Total Earnings', 'Total Deductions', 'Net Pay', 'Employer Cost']
        title = f'Consolidated Payroll Summary ({from_period.name} - {to_period.name})'
        return ReportExporter.export_data(data, headers, 'consolidated_summary', file_format, title=title)


class ExportLabourCostView(APIView):
    """Export labour cost report to CSV/Excel/PDF."""

    def get(self, request):
        from_period_id, to_period_id, file_format = _get_period_range_params(request)
        if not from_period_id or not to_period_id:
            return Response({'error': 'from_period and to_period are required'}, status=400)

        group_by = request.query_params.get('group_by', 'department')
        filters = _get_summary_filters(request)

        rows_list, _grand_totals, from_period, to_period = _compute_labour_cost(
            from_period_id, to_period_id, group_by, filters
        )

        _field, group_label = _resolve_group_field(group_by)
        data = [{
            group_label: r['group_name'],
            'Basic Salary': r['basic_salary'],
            'Company SSF': r['company_ssf'],
            'Company PF': r['company_pf'],
            'Overtime': r['overtime'],
            'Other Allowances': r['other_allowances'],
            'Total': r['total'],
            'Overtime %': r['overtime_pct'],
            'Allowances %': r['allowances_pct'],
        } for r in rows_list]

        headers = [group_label, 'Basic Salary', 'Company SSF', 'Company PF', 'Overtime', 'Other Allowances', 'Total', 'Overtime %', 'Allowances %']
        title = f'Labour Cost Report ({from_period.name} - {to_period.name})'
        return ReportExporter.export_data(data, headers, 'labour_cost', file_format, title=title)


class ExportSSFStatementView(APIView):
    """Export SSF contribution statement to CSV/Excel/PDF."""

    def get(self, request):
        from_period_id, to_period_id, file_format = _get_period_range_params(request)
        if not from_period_id or not to_period_id:
            return Response({'error': 'from_period and to_period are required'}, status=400)

        filters = _get_statement_filters(request)
        employees, columns_config, from_period, to_period = _compute_ssf_data(
            from_period_id, to_period_id, filters
        )

        col_headers = ['Basic Salary', 'Employee SSF', 'Employer SSF']
        headers = ['Employee #', 'Name', 'Department', 'Period'] + col_headers
        data = _flatten_statement_for_export(employees, columns_config, col_headers)

        title = f'SSF Contribution Statement ({from_period.name} - {to_period.name})'
        return ReportExporter.export_data(data, headers, 'ssf_statement', file_format, title=title)


class ExportTaxStatementView(APIView):
    """Export income tax statement to CSV/Excel/PDF."""

    def get(self, request):
        from_period_id, to_period_id, file_format = _get_period_range_params(request)
        if not from_period_id or not to_period_id:
            return Response({'error': 'from_period and to_period are required'}, status=400)

        filters = _get_statement_filters(request)
        employees, columns_config, from_period, to_period = _compute_tax_data(
            from_period_id, to_period_id, filters
        )

        col_headers = ['Basic Salary', 'Taxable Income', 'PAYE Tax']
        headers = ['Employee #', 'Name', 'Department', 'Period'] + col_headers
        data = _flatten_statement_for_export(employees, columns_config, col_headers)

        title = f'Income Tax Statement ({from_period.name} - {to_period.name})'
        return ReportExporter.export_data(data, headers, 'tax_statement', file_format, title=title)


class ExportAllowanceStatementView(APIView):
    """Export allowance statement to CSV/Excel/PDF."""

    def get(self, request):
        from_period_id, to_period_id, file_format = _get_period_range_params(request)
        if not from_period_id or not to_period_id:
            return Response({'error': 'from_period and to_period are required'}, status=400)

        filters = _get_statement_filters(request)
        employees, allowance_names, from_period, to_period = _compute_allowance_data(
            from_period_id, to_period_id, filters
        )

        headers = ['Employee #', 'Name', 'Department', 'Period', 'Basic Salary'] + allowance_names + ['Total Allowances']
        data = []
        for emp in employees:
            for period in emp['periods']:
                row = {
                    'Employee #': emp['employee_number'],
                    'Name': emp['full_name'],
                    'Department': emp['department'],
                    'Period': period['period_name'],
                    'Basic Salary': period['basic'],
                }
                for name in allowance_names:
                    row[name] = period['allowances'].get(name, 0)
                row['Total Allowances'] = period['total_allowances']
                data.append(row)

        title = f'Allowance Statement ({from_period.name} - {to_period.name})'
        return ReportExporter.export_data(data, headers, 'allowance_statement', file_format, title=title)


def _compute_payslip_data(from_period_id, to_period_id, filters=None):
    """
    Compute payslip statement data with dynamic earnings and deductions columns.
    Returns (employees, earning_names, deduction_names, from_period, to_period).
    """
    items, _periods, from_period, to_period = get_items_for_period_range(
        from_period_id, to_period_id, filters
    )

    items_list = list(items.prefetch_related('details', 'details__pay_component'))

    # Group by employee
    employee_items = defaultdict(list)
    for item in items_list:
        employee_items[item.employee_id].append(item)

    # Collect unique earning and deduction names across all items
    all_earning_names = set()
    all_deduction_names = set()
    for emp_items in employee_items.values():
        for item in emp_items:
            for detail in item.details.all():
                comp = detail.pay_component
                if comp.component_type == 'EARNING':
                    all_earning_names.add(comp.name)
                elif comp.component_type == 'DEDUCTION':
                    all_deduction_names.add(comp.name)

    earning_names = sorted(all_earning_names)
    deduction_names = sorted(all_deduction_names)

    employees = []
    for emp_id, emp_items in employee_items.items():
        emp = emp_items[0].employee
        period_data = []
        yearly_sums = defaultdict(lambda: defaultdict(Decimal))

        for item in sorted(emp_items, key=lambda x: x.payroll_run.payroll_period.start_date):
            period = item.payroll_run.payroll_period
            row = {
                'period_name': period.name,
                'year': period.year,
                'earnings': {},
                'deductions': {},
                'total_earnings': float(item.gross_earnings or 0),
                'total_deductions': float(item.total_deductions or 0),
                'net_salary': float(item.net_salary or 0),
            }

            for detail in item.details.all():
                comp = detail.pay_component
                amt = detail.amount or Decimal('0')
                if comp.component_type == 'EARNING':
                    row['earnings'][comp.name] = float(amt)
                elif comp.component_type == 'DEDUCTION':
                    row['deductions'][comp.name] = float(amt)

            yearly_sums[period.year]['total_earnings'] += item.gross_earnings or Decimal('0')
            yearly_sums[period.year]['total_deductions'] += item.total_deductions or Decimal('0')
            yearly_sums[period.year]['net_salary'] += item.net_salary or Decimal('0')
            for name in earning_names:
                yearly_sums[period.year][f'e_{name}'] += Decimal(str(row['earnings'].get(name, 0)))
            for name in deduction_names:
                yearly_sums[period.year][f'd_{name}'] += Decimal(str(row['deductions'].get(name, 0)))

            period_data.append(row)

        # Compute grand total and yearly subtotals
        grand_total = {}
        yearly_subtotals = {}
        for year, sums in sorted(yearly_sums.items()):
            yearly_subtotals[str(year)] = {k: float(v) for k, v in sums.items()}
            for k, v in sums.items():
                grand_total[k] = grand_total.get(k, 0) + float(v)

        employees.append({
            'employee_number': emp.employee_number,
            'full_name': f"{emp.first_name or ''} {emp.last_name or ''}".strip(),
            'department': emp.department.name if emp.department else '',
            'periods': period_data,
            'yearly_subtotals': yearly_subtotals,
            'grand_total': grand_total,
        })

    employees.sort(key=lambda e: e['employee_number'])
    return employees, earning_names, deduction_names, from_period, to_period


class PayslipStatementView(APIView):
    """Per-employee payslip statement with earnings and deductions breakdown."""

    def get(self, request):
        from_period_id = request.query_params.get('from_period')
        to_period_id = request.query_params.get('to_period')

        if not from_period_id or not to_period_id:
            return Response({
                'employees': [],
                'earning_names': [],
                'deduction_names': [],
                'from_period_name': '',
                'to_period_name': '',
            })

        filters = _get_statement_filters(request)
        employees, earning_names, deduction_names, from_period, to_period = _compute_payslip_data(
            from_period_id, to_period_id, filters
        )

        return Response({
            'employees': employees,
            'earning_names': earning_names,
            'deduction_names': deduction_names,
            'from_period_name': from_period.name,
            'to_period_name': to_period.name,
        })


class ExportPayslipStatementView(APIView):
    """Export payslip statement to CSV/Excel/PDF."""

    def get(self, request):
        from_period_id, to_period_id, file_format = _get_period_range_params(request)
        if not from_period_id or not to_period_id:
            return Response({'error': 'from_period and to_period are required'}, status=400)

        filters = _get_statement_filters(request)
        employees, earning_names, deduction_names, from_period, to_period = _compute_payslip_data(
            from_period_id, to_period_id, filters
        )

        headers = (
            ['Employee #', 'Name', 'Department', 'Period']
            + earning_names
            + ['Total Earnings']
            + deduction_names
            + ['Total Deductions', 'Net Salary']
        )
        data = []
        for emp in employees:
            for period in emp['periods']:
                row = {
                    'Employee #': emp['employee_number'],
                    'Name': emp['full_name'],
                    'Department': emp['department'],
                    'Period': period['period_name'],
                }
                for name in earning_names:
                    row[name] = period['earnings'].get(name, 0)
                row['Total Earnings'] = period['total_earnings']
                for name in deduction_names:
                    row[name] = period['deductions'].get(name, 0)
                row['Total Deductions'] = period['total_deductions']
                row['Net Salary'] = period['net_salary']
                data.append(row)

        title = f'Payslip Statement ({from_period.name} - {to_period.name})'
        return ReportExporter.export_data(data, headers, 'payslip_statement', file_format, title=title)
