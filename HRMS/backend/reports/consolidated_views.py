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
        filters = {
            'department': request.query_params.get('department'),
            'staff_category': request.query_params.get('staff_category'),
        }

        items, periods, from_period, to_period = get_items_for_period_range(
            from_period_id, to_period_id, filters
        )

        # Determine group field
        if group_by == 'staff_category':
            group_field = 'employee__staff_category__name'
        else:
            group_field = 'employee__department__name'

        # Aggregate
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

        filters = {
            'department': request.query_params.get('department'),
            'staff_category': request.query_params.get('staff_category'),
        }

        items, periods, from_period, to_period = get_items_for_period_range(
            from_period_id, to_period_id, filters
        )

        group_by = request.query_params.get('group_by', 'department')
        if group_by == 'staff_category':
            group_field = 'employee__staff_category__name'
        else:
            group_field = 'employee__department__name'

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

        return Response({
            'rows': rows_list,
            'grand_totals': grand_totals,
            'from_period_name': from_period.name,
            'to_period_name': to_period.name,
        })


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

        filters = {
            'department': request.query_params.get('department'),
            'employee': request.query_params.get('employee'),
            'search': request.query_params.get('search'),
        }

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

        filters = {
            'department': request.query_params.get('department'),
            'employee': request.query_params.get('employee'),
            'search': request.query_params.get('search'),
        }

        items, periods, from_period, to_period = get_items_for_period_range(
            from_period_id, to_period_id, filters
        )

        columns_config = [
            {'key': 'basic', 'item_field': 'basic_salary'},
            {'key': 'taxable', 'item_field': 'taxable_income'},
            {'key': 'paye', 'item_field': 'paye'},
        ]

        employees = _build_employee_statements(items, periods, columns_config)

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

        filters = {
            'department': request.query_params.get('department'),
            'employee': request.query_params.get('employee'),
            'search': request.query_params.get('search'),
        }

        items, periods, from_period, to_period = get_items_for_period_range(
            from_period_id, to_period_id, filters
        )

        # Get all items with their details for allowance breakdown
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

        return Response({
            'employees': employees,
            'allowance_names': allowance_names,
            'from_period_name': from_period.name,
            'to_period_name': to_period.name,
        })
