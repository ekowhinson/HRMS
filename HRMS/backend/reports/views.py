"""
Reports and Analytics views.
"""

from django.db.models import Count, Sum, Avg, F, Q
from django.db.models.functions import TruncMonth
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from employees.models import Employee
from leave.models import LeaveBalance, LeaveRequest
from benefits.models import LoanAccount
from payroll.models import PayrollRun, PayrollItem, PayrollItemDetail


class DashboardView(APIView):
    """Main dashboard with overview metrics."""

    def get(self, request):
        today = timezone.now().date()
        current_year = today.year
        current_month = today.month

        # Employee metrics
        total_employees = Employee.objects.filter(
            status='ACTIVE'
        ).count()

        new_hires_this_month = Employee.objects.filter(
            date_of_joining__year=current_year,
            date_of_joining__month=current_month
        ).count()

        # Leave metrics
        pending_leave_requests = LeaveRequest.objects.filter(
            status='PENDING'
        ).count()

        # Loan metrics
        active_loans = LoanAccount.objects.filter(
            status__in=['ACTIVE', 'DISBURSED']
        ).count()

        # Payroll metrics
        latest_payroll = PayrollRun.objects.filter(
            status='APPROVED'
        ).order_by('-run_date').first()

        payroll_summary = {}
        if latest_payroll:
            payroll_summary = {
                'period': latest_payroll.payroll_period.name if latest_payroll.payroll_period else None,
                'total_employees': latest_payroll.total_employees,
                'total_gross': float(latest_payroll.total_gross or 0),
                'total_net': float(latest_payroll.total_net or 0),
            }

        return Response({
            'total_employees': total_employees,
            'new_hires_this_month': new_hires_this_month,
            'pending_leave_requests': pending_leave_requests,
            'active_loans': active_loans,
            'latest_payroll': payroll_summary,
            'generated_at': timezone.now()
        })


class HRDashboardView(APIView):
    """HR-specific dashboard."""

    def get(self, request):
        today = timezone.now().date()

        # Employee breakdown by status
        employee_by_status = Employee.objects.values(
            'status'
        ).annotate(count=Count('id'))

        # Employee by department
        employee_by_department = Employee.objects.filter(
            status='ACTIVE'
        ).values(
            department_name=F('department__name')
        ).annotate(count=Count('id')).order_by('-count')[:10]

        # Employee by grade
        employee_by_grade = Employee.objects.filter(
            status='ACTIVE'
        ).values(
            grade_name=F('grade__name')
        ).annotate(count=Count('id')).order_by('grade__level')

        # Employee by gender
        employee_by_gender = Employee.objects.filter(
            status='ACTIVE'
        ).values('gender').annotate(count=Count('id'))

        # Employees on probation (no confirmation date yet)
        on_probation = Employee.objects.filter(
            status='ACTIVE',
            date_of_confirmation__isnull=True
        ).count()

        # Pending confirmations (probation end date has passed but not confirmed)
        pending_confirmations = Employee.objects.filter(
            status='ACTIVE',
            date_of_confirmation__isnull=True,
            probation_end_date__lte=today
        ).count()

        return Response({
            'employee_by_status': list(employee_by_status),
            'employee_by_department': list(employee_by_department),
            'employee_by_grade': list(employee_by_grade),
            'employee_by_gender': list(employee_by_gender),
            'on_probation': on_probation,
            'pending_confirmations': pending_confirmations,
            'generated_at': timezone.now()
        })


class PayrollDashboardView(APIView):
    """Payroll-specific dashboard."""

    def get(self, request):
        current_year = timezone.now().year

        # Monthly payroll trends (last 12 months)
        payroll_trends = PayrollRun.objects.filter(
            status='APPROVED',
            run_date__year__gte=current_year - 1
        ).annotate(
            month=TruncMonth('run_date')
        ).values('month').annotate(
            total_gross=Sum('total_gross'),
            total_net=Sum('total_net'),
            total_paye=Sum('total_paye'),
            total_ssnit=Sum('total_ssnit_employee')
        ).order_by('month')[:12]

        # Latest payroll summary
        latest_payroll = PayrollRun.objects.filter(
            status='APPROVED'
        ).order_by('-run_date').first()

        latest_summary = {}
        if latest_payroll:
            latest_summary = {
                'run_number': latest_payroll.run_number,
                'period': latest_payroll.payroll_period.name if latest_payroll.payroll_period else None,
                'total_employees': latest_payroll.total_employees,
                'total_gross': float(latest_payroll.total_gross or 0),
                'total_deductions': float(latest_payroll.total_deductions or 0),
                'total_net': float(latest_payroll.total_net or 0),
                'total_paye': float(latest_payroll.total_paye or 0),
                'total_ssnit_employee': float(latest_payroll.total_ssnit_employee or 0),
                'total_ssnit_employer': float(latest_payroll.total_ssnit_employer or 0),
                'total_employer_cost': float(latest_payroll.total_employer_cost or 0),
            }

        # Pending payroll runs
        pending_runs = PayrollRun.objects.filter(
            status__in=['DRAFT', 'PENDING']
        ).count()

        return Response({
            'payroll_trends': list(payroll_trends),
            'latest_payroll': latest_summary,
            'pending_runs': pending_runs,
            'generated_at': timezone.now()
        })


class LeaveDashboardView(APIView):
    """Leave-specific dashboard."""

    def get(self, request):
        today = timezone.now().date()
        current_month = today.month
        current_year = today.year

        # Pending leave requests
        pending_requests = LeaveRequest.objects.filter(
            status='PENDING'
        ).count()

        # Approved today
        approved_today = LeaveRequest.objects.filter(
            status='APPROVED',
            updated_at__date=today
        ).count()

        # On leave today
        on_leave_today = LeaveRequest.objects.filter(
            status='APPROVED',
            start_date__lte=today,
            end_date__gte=today
        ).count()

        # Upcoming leave (next 7 days)
        from datetime import timedelta
        upcoming_leave = LeaveRequest.objects.filter(
            status='APPROVED',
            start_date__gt=today,
            start_date__lte=today + timedelta(days=7)
        ).count()

        # Leave by type
        leave_by_type = LeaveRequest.objects.filter(
            status='APPROVED',
            start_date__year=current_year
        ).values(
            leave_type_name=F('leave_type__name')
        ).annotate(count=Count('id')).order_by('-count')

        # Monthly trend (last 6 months)
        monthly_trend = LeaveRequest.objects.filter(
            start_date__year=current_year
        ).annotate(
            month=TruncMonth('start_date')
        ).values('month').annotate(
            approved=Count('id', filter=Q(status='APPROVED')),
            rejected=Count('id', filter=Q(status='REJECTED'))
        ).order_by('month')[:6]

        return Response({
            'pending_requests': pending_requests,
            'approved_today': approved_today,
            'on_leave_today': on_leave_today,
            'upcoming_leave': upcoming_leave,
            'leave_by_type': [{'leave_type': r['leave_type_name'], 'count': r['count']} for r in leave_by_type],
            'monthly_trend': list(monthly_trend),
            'generated_at': timezone.now()
        })


class PerformanceDashboardView(APIView):
    """Performance/appraisal dashboard."""

    def get(self, request):
        return Response({
            'active_appraisals': 0,
            'pending_reviews': 0,
            'completed_this_cycle': 0,
            'average_rating': 0,
            'rating_distribution': [],
            'completion_rate': 0,
            'generated_at': timezone.now()
        })


class EmployeeMasterReportView(APIView):
    """Employee master report."""

    def get(self, request):
        queryset = Employee.objects.select_related(
            'department', 'grade', 'position', 'supervisor'
        ).filter(status='ACTIVE')

        # Apply filters
        department = request.query_params.get('department')
        grade = request.query_params.get('grade')
        region = request.query_params.get('region')

        if department:
            queryset = queryset.filter(department_id=department)
        if grade:
            queryset = queryset.filter(grade_id=grade)
        if region:
            queryset = queryset.filter(work_location__region_id=region)

        data = queryset.values(
            'employee_number', 'first_name', 'last_name', 'email',
            'phone_primary', 'date_of_joining', 'employment_type',
            department_name=F('department__name'),
            grade_name=F('grade__name'),
            position_name=F('position__title'),
        )

        return Response({
            'total_count': queryset.count(),
            'data': list(data),
            'generated_at': timezone.now()
        })


class HeadcountReportView(APIView):
    """Headcount report with breakdown."""

    def get(self, request):
        queryset = Employee.objects.filter(status='ACTIVE')

        # By department
        by_department = queryset.values(
            department_name=F('department__name')
        ).annotate(count=Count('id')).order_by('-count')

        # By grade
        by_grade = queryset.values(
            grade_name=F('grade__name'),
            grade_level=F('grade__level')
        ).annotate(count=Count('id')).order_by('grade_level')

        # By employment type
        by_employment_type = queryset.values(
            'employment_type'
        ).annotate(count=Count('id'))

        # By location
        by_location = queryset.values(
            location_name=F('work_location__name')
        ).annotate(count=Count('id')).order_by('-count')

        return Response({
            'total_headcount': queryset.count(),
            'by_department': list(by_department),
            'by_grade': list(by_grade),
            'by_employment_type': list(by_employment_type),
            'by_location': list(by_location),
            'generated_at': timezone.now()
        })


class TurnoverReportView(APIView):
    """Employee turnover analysis."""

    def get(self, request):
        current_year = timezone.now().year
        year = request.query_params.get('year', current_year)

        # Exits by month
        exits = Employee.objects.filter(
            status='SEPARATED',
            date_of_exit__year=year
        ).annotate(
            month=TruncMonth('date_of_exit')
        ).values('month').annotate(count=Count('id')).order_by('month')

        # Exits by reason
        by_reason = Employee.objects.filter(
            status='SEPARATED',
            date_of_exit__year=year
        ).values('exit_reason').annotate(count=Count('id'))

        # Exits by department
        by_department = Employee.objects.filter(
            status='SEPARATED',
            date_of_exit__year=year
        ).values(
            department_name=F('department__name')
        ).annotate(count=Count('id')).order_by('-count')

        # New hires this year
        new_hires = Employee.objects.filter(
            date_of_joining__year=year
        ).count()

        total_exits = Employee.objects.filter(
            status='SEPARATED',
            date_of_exit__year=year
        ).count()

        # Average headcount (simplified)
        avg_headcount = Employee.objects.filter(
            status='ACTIVE'
        ).count()

        turnover_rate = (total_exits / avg_headcount * 100) if avg_headcount > 0 else 0

        return Response({
            'year': year,
            'total_exits': total_exits,
            'new_hires': new_hires,
            'turnover_rate': round(turnover_rate, 2),
            'exits_by_month': list(exits),
            'exits_by_reason': list(by_reason),
            'exits_by_department': list(by_department),
            'generated_at': timezone.now()
        })


class DemographicsReportView(APIView):
    """Employee demographics analysis."""

    def get(self, request):
        queryset = Employee.objects.filter(status='ACTIVE')
        today = timezone.now().date()

        # By gender
        by_gender = queryset.values('gender').annotate(count=Count('id'))

        # By marital status
        by_marital_status = queryset.values('marital_status').annotate(count=Count('id'))

        # By nationality
        by_nationality = queryset.values('nationality').annotate(count=Count('id'))

        # Age distribution (simplified calculation)
        # Note: For accurate age calculation, use database-specific age functions

        return Response({
            'total_employees': queryset.count(),
            'by_gender': list(by_gender),
            'by_marital_status': list(by_marital_status),
            'by_nationality': list(by_nationality),
            'generated_at': timezone.now()
        })


class LeaveBalanceReportView(APIView):
    """Leave balance report."""

    def get(self, request):
        current_year = timezone.now().year
        year = request.query_params.get('year', current_year)

        balances = LeaveBalance.objects.filter(
            year=year
        ).select_related('employee', 'leave_type').values(
            'employee__employee_number',
            'employee__first_name',
            'employee__last_name',
            'opening_balance',
            'earned',
            'taken',
            'pending',
            'carried_forward',
        ).annotate(
            leave_type_name=F('leave_type__name')
        )

        # Summary by leave type
        summary = LeaveBalance.objects.filter(
            year=year
        ).values(
            leave_type_name=F('leave_type__name')
        ).annotate(
            total_entitled=Sum('opening_balance') + Sum('earned'),
            total_taken=Sum('taken'),
            total_pending=Sum('pending')
        )

        return Response({
            'year': year,
            'balances': list(balances),
            'summary': list(summary),
            'generated_at': timezone.now()
        })


class LeaveUtilizationReportView(APIView):
    """Leave utilization analysis."""

    def get(self, request):
        current_year = timezone.now().year
        year = request.query_params.get('year', current_year)

        # Requests by month
        by_month = LeaveRequest.objects.filter(
            start_date__year=year,
            status='APPROVED'
        ).annotate(
            month=TruncMonth('start_date')
        ).values('month').annotate(
            count=Count('id'),
            total_days=Sum('number_of_days')
        ).order_by('month')

        # By leave type
        by_leave_type = LeaveRequest.objects.filter(
            start_date__year=year,
            status='APPROVED'
        ).values(
            leave_type_name=F('leave_type__name')
        ).annotate(
            count=Count('id'),
            total_days=Sum('number_of_days')
        )

        # By department
        by_department = LeaveRequest.objects.filter(
            start_date__year=year,
            status='APPROVED'
        ).values(
            department_name=F('employee__department__name')
        ).annotate(
            count=Count('id'),
            total_days=Sum('number_of_days')
        ).order_by('-total_days')

        return Response({
            'year': year,
            'by_month': list(by_month),
            'by_leave_type': list(by_leave_type),
            'by_department': list(by_department),
            'generated_at': timezone.now()
        })


class LoanOutstandingReportView(APIView):
    """Outstanding loans report."""

    def get(self, request):
        active_loans = LoanAccount.objects.filter(
            status__in=['ACTIVE', 'DISBURSED']
        ).select_related('employee', 'loan_type')

        data = active_loans.values(
            'loan_number',
            'employee__employee_number',
            'employee__first_name',
            'employee__last_name',
            'principal_amount',
            'disbursed_amount',
            'principal_paid',
            'outstanding_balance',
            'monthly_installment',
        ).annotate(
            loan_type_name=F('loan_type__name')
        )

        # Summary by loan type
        summary = active_loans.values(
            loan_type_name=F('loan_type__name')
        ).annotate(
            count=Count('id'),
            total_principal=Sum('principal_amount'),
            total_outstanding=Sum('outstanding_balance')
        )

        return Response({
            'total_loans': active_loans.count(),
            'total_outstanding': sum(l.outstanding_balance for l in active_loans),
            'loans': list(data),
            'summary': list(summary),
            'generated_at': timezone.now()
        })


class LoanDisbursementReportView(APIView):
    """Loan disbursement report."""

    def get(self, request):
        current_year = timezone.now().year
        year = request.query_params.get('year', current_year)

        disbursements = LoanAccount.objects.filter(
            disbursement_date__year=year
        ).select_related('employee', 'loan_type')

        # By month
        by_month = disbursements.annotate(
            month=TruncMonth('disbursement_date')
        ).values('month').annotate(
            count=Count('id'),
            total_amount=Sum('disbursed_amount')
        ).order_by('month')

        # By loan type
        by_loan_type = disbursements.values(
            loan_type_name=F('loan_type__name')
        ).annotate(
            count=Count('id'),
            total_amount=Sum('disbursed_amount')
        )

        return Response({
            'year': year,
            'total_disbursed': disbursements.count(),
            'total_amount': sum(l.disbursed_amount or 0 for l in disbursements),
            'by_month': list(by_month),
            'by_loan_type': list(by_loan_type),
            'generated_at': timezone.now()
        })


class PayrollSummaryView(APIView):
    """Payroll summary report."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')

        if payroll_run_id:
            try:
                payroll_run = PayrollRun.objects.get(id=payroll_run_id)
            except PayrollRun.DoesNotExist:
                return Response(
                    {'error': 'Payroll run not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            payroll_run = PayrollRun.objects.filter(
                status='APPROVED'
            ).order_by('-run_date').first()

        if not payroll_run:
            return Response({
                'message': 'No approved payroll runs found',
                'generated_at': timezone.now()
            })

        # Get payroll items
        items = PayrollItem.objects.filter(
            payroll_run=payroll_run
        ).select_related('employee')

        summary = {
            'run_number': payroll_run.run_number,
            'period': payroll_run.payroll_period.name if payroll_run.payroll_period else None,
            'run_date': payroll_run.run_date,
            'status': payroll_run.status,
            'total_employees': payroll_run.total_employees,
            'total_basic': float(items.aggregate(Sum('basic_salary'))['basic_salary__sum'] or 0),
            'total_gross': float(payroll_run.total_gross or 0),
            'total_deductions': float(payroll_run.total_deductions or 0),
            'total_net': float(payroll_run.total_net or 0),
            'total_paye': float(payroll_run.total_paye or 0),
            'total_ssnit_employee': float(payroll_run.total_ssnit_employee or 0),
            'total_ssnit_employer': float(payroll_run.total_ssnit_employer or 0),
            'total_tier2_employer': float(payroll_run.total_tier2_employer or 0),
            'total_employer_cost': float(payroll_run.total_employer_cost or 0),
        }

        return Response({
            'summary': summary,
            'generated_at': timezone.now()
        })


class PayrollMasterReportView(APIView):
    """
    Payroll Master Report - Detailed breakdown per employee showing:
    - Employee ID and full name
    - All earnings (adding up to gross salary)
    - All deductions (subtracted to get net salary)
    - Net salary
    - All employer contributions (after net salary)
    """

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        department_id = request.query_params.get('department')
        employee_id = request.query_params.get('employee')

        # Get payroll run
        if payroll_run_id:
            try:
                payroll_run = PayrollRun.objects.get(id=payroll_run_id)
            except PayrollRun.DoesNotExist:
                return Response(
                    {'error': 'Payroll run not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            # Get latest computed/approved/paid run
            payroll_run = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).order_by('-run_date').first()

        if not payroll_run:
            return Response({
                'message': 'No payroll run found',
                'generated_at': timezone.now()
            })

        # Get payroll items with all related data
        items = PayrollItem.objects.filter(
            payroll_run=payroll_run
        ).select_related(
            'employee', 'employee__department', 'employee__position', 'employee__grade'
        ).prefetch_related(
            'details', 'details__pay_component'
        ).order_by('employee__employee_number')

        # Apply filters
        if department_id:
            items = items.filter(employee__department_id=department_id)
        if employee_id:
            items = items.filter(employee_id=employee_id)

        # Build the report data
        employees_data = []

        for item in items:
            # Separate details by component type
            earnings = []
            deductions = []
            employer_contributions = []

            for detail in item.details.all():
                component_data = {
                    'code': detail.pay_component.code,
                    'name': detail.pay_component.name,
                    'amount': float(detail.amount),
                    'notes': detail.notes,
                }

                comp_type = detail.pay_component.component_type
                if comp_type == 'EARNING':
                    earnings.append(component_data)
                elif comp_type == 'DEDUCTION':
                    deductions.append(component_data)
                elif comp_type == 'EMPLOYER':
                    employer_contributions.append(component_data)

            # Add SSNIT and PAYE to deductions if they have values
            if item.ssnit_employee and item.ssnit_employee > 0:
                # Check if SSNIT_EMP is already in deductions
                ssnit_exists = any(d['code'] == 'SSNIT_EMP' for d in deductions)
                if not ssnit_exists:
                    deductions.append({
                        'code': 'SSNIT_EMP',
                        'name': 'SSNIT Employee Contribution',
                        'amount': float(item.ssnit_employee),
                        'notes': None,
                    })

            if item.paye and item.paye > 0:
                # Check if PAYE is already in deductions
                paye_exists = any(d['code'] == 'PAYE' for d in deductions)
                if not paye_exists:
                    deductions.append({
                        'code': 'PAYE',
                        'name': 'PAYE Income Tax',
                        'amount': float(item.paye),
                        'notes': None,
                    })

            # Add SSNIT employer contributions
            if item.ssnit_employer and item.ssnit_employer > 0:
                ssnit_emp_exists = any(e['code'] == 'SSNIT_EMPLOYER' for e in employer_contributions)
                if not ssnit_emp_exists:
                    employer_contributions.append({
                        'code': 'SSNIT_EMPLOYER',
                        'name': 'SSNIT Employer (Tier 1)',
                        'amount': float(item.ssnit_employer),
                        'notes': None,
                    })

            if item.tier2_employer and item.tier2_employer > 0:
                tier2_exists = any(e['code'] == 'TIER2_EMPLOYER' for e in employer_contributions)
                if not tier2_exists:
                    employer_contributions.append({
                        'code': 'TIER2_EMPLOYER',
                        'name': 'Tier 2 Employer Contribution',
                        'amount': float(item.tier2_employer),
                        'notes': None,
                    })

            # Calculate totals
            total_earnings = sum(e['amount'] for e in earnings)
            total_deductions = sum(d['amount'] for d in deductions)
            total_employer = sum(e['amount'] for e in employer_contributions)

            employee_data = {
                'employee_id': str(item.employee.id),
                'employee_number': item.employee.employee_number,
                'full_name': item.employee.full_name,
                'department': item.employee.department.name if item.employee.department else None,
                'position': item.employee.position.title if item.employee.position else None,
                'grade': item.employee.grade.name if item.employee.grade else None,
                'bank_name': item.bank_name,
                'bank_account': item.bank_account_number,

                # Earnings section
                'earnings': earnings,
                'gross_salary': float(item.gross_earnings),

                # Deductions section
                'deductions': deductions,
                'total_deductions': float(item.total_deductions),

                # Net salary
                'net_salary': float(item.net_salary),

                # Employer contributions (after net)
                'employer_contributions': employer_contributions,
                'total_employer_contributions': total_employer,

                # Total employer cost
                'employer_cost': float(item.employer_cost),
            }

            employees_data.append(employee_data)

        # Calculate totals for summary
        summary = {
            'total_employees': len(employees_data),
            'total_gross': sum(e['gross_salary'] for e in employees_data),
            'total_deductions': sum(e['total_deductions'] for e in employees_data),
            'total_net': sum(e['net_salary'] for e in employees_data),
            'total_employer_contributions': sum(e['total_employer_contributions'] for e in employees_data),
            'total_employer_cost': sum(e['employer_cost'] for e in employees_data),
        }

        return Response({
            'payroll_run': {
                'id': str(payroll_run.id),
                'run_number': payroll_run.run_number,
                'period_name': payroll_run.payroll_period.name if payroll_run.payroll_period else None,
                'status': payroll_run.status,
                'run_date': payroll_run.run_date,
            },
            'summary': summary,
            'employees': employees_data,
            'generated_at': timezone.now()
        })


class CostCenterReportView(APIView):
    """Payroll cost by cost center."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')

        if payroll_run_id:
            items = PayrollItem.objects.filter(payroll_run_id=payroll_run_id)
        else:
            latest_run = PayrollRun.objects.filter(
                status='APPROVED'
            ).order_by('-run_date').first()
            if latest_run:
                items = PayrollItem.objects.filter(payroll_run=latest_run)
            else:
                return Response({'message': 'No payroll data found'})

        by_department = items.values(
            department_name=F('employee__department__name')
        ).annotate(
            employee_count=Count('id'),
            total_gross=Sum('gross_salary'),
            total_net=Sum('net_salary'),
            total_paye=Sum('paye'),
            total_ssnit=Sum('ssnit_employee')
        ).order_by('-total_gross')

        return Response({
            'by_department': list(by_department),
            'generated_at': timezone.now()
        })


class PayrollVarianceReportView(APIView):
    """Payroll variance analysis between periods."""

    def get(self, request):
        # Get last two approved payroll runs
        runs = PayrollRun.objects.filter(
            status='APPROVED'
        ).order_by('-run_date')[:2]

        if len(runs) < 2:
            return Response({
                'message': 'Need at least two payroll runs for variance analysis',
                'generated_at': timezone.now()
            })

        current_run = runs[0]
        previous_run = runs[1]

        variance = {
            'current_period': current_run.payroll_period.name if current_run.payroll_period else current_run.run_number,
            'previous_period': previous_run.payroll_period.name if previous_run.payroll_period else previous_run.run_number,
            'employee_count_variance': (current_run.total_employees or 0) - (previous_run.total_employees or 0),
            'gross_variance': float((current_run.total_gross or 0) - (previous_run.total_gross or 0)),
            'net_variance': float((current_run.total_net or 0) - (previous_run.total_net or 0)),
            'paye_variance': float((current_run.total_paye or 0) - (previous_run.total_paye or 0)),
            'ssnit_variance': float((current_run.total_ssnit_employee or 0) - (previous_run.total_ssnit_employee or 0)),
        }

        # Calculate percentage changes
        if previous_run.total_gross and previous_run.total_gross > 0:
            variance['gross_variance_pct'] = round(
                variance['gross_variance'] / float(previous_run.total_gross) * 100, 2
            )
        else:
            variance['gross_variance_pct'] = 0

        return Response({
            'variance': variance,
            'generated_at': timezone.now()
        })


class PayrollReconciliationReportView(APIView):
    """Detailed payroll reconciliation between current and previous month."""

    def get(self, request):
        from decimal import Decimal
        from payroll.models import PayrollPeriod

        # Accept either period IDs or run IDs
        current_period_id = request.query_params.get('current_period')
        previous_period_id = request.query_params.get('previous_period')
        current_run_id = request.query_params.get('current_run')
        previous_run_id = request.query_params.get('previous_run')

        current_run = None
        previous_run = None

        # If period IDs provided, find the corresponding runs
        if current_period_id and previous_period_id:
            try:
                current_period = PayrollPeriod.objects.get(id=current_period_id)
                previous_period = PayrollPeriod.objects.get(id=previous_period_id)

                # Get the latest run for each period
                current_run = PayrollRun.objects.filter(
                    payroll_period=current_period
                ).order_by('-run_date').first()

                previous_run = PayrollRun.objects.filter(
                    payroll_period=previous_period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()

                if not current_run:
                    return Response({
                        'message': f'No payroll run found for period {current_period.name}',
                        'generated_at': timezone.now()
                    })

                if not previous_run:
                    return Response({
                        'message': f'No approved/paid payroll run found for period {previous_period.name}',
                        'generated_at': timezone.now()
                    })

            except PayrollPeriod.DoesNotExist:
                return Response({
                    'message': 'Invalid payroll period IDs',
                    'generated_at': timezone.now()
                }, status=400)

        # Fall back to run IDs if provided
        elif current_run_id and previous_run_id:
            try:
                current_run = PayrollRun.objects.get(id=current_run_id)
                previous_run = PayrollRun.objects.get(id=previous_run_id)
            except PayrollRun.DoesNotExist:
                return Response({
                    'message': 'Invalid payroll run IDs',
                    'generated_at': timezone.now()
                }, status=400)

        # Default to last two approved runs
        if not current_run or not previous_run:
            runs = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).order_by('-run_date')[:2]

            if len(runs) < 2:
                return Response({
                    'message': 'Need at least two completed payroll runs for reconciliation',
                    'generated_at': timezone.now()
                })

            current_run = runs[0]
            previous_run = runs[1]

        # Get items from both runs
        current_items = {
            item.employee_id: item
            for item in PayrollItem.objects.filter(payroll_run=current_run).select_related(
                'employee', 'employee__department', 'employee__position', 'employee__grade'
            )
        }
        previous_items = {
            item.employee_id: item
            for item in PayrollItem.objects.filter(payroll_run=previous_run).select_related(
                'employee', 'employee__department', 'employee__position', 'employee__grade'
            )
        }

        # All employee IDs from both periods
        all_employee_ids = set(current_items.keys()) | set(previous_items.keys())

        # Categorize employees
        new_employees = []  # In current but not previous
        separated_employees = []  # In previous but not current
        changed_employees = []  # In both with differences
        unchanged_employees = []  # In both with no changes

        def safe_float(val):
            if val is None:
                return 0.0
            return float(val)

        for emp_id in all_employee_ids:
            current = current_items.get(emp_id)
            previous = previous_items.get(emp_id)

            if current and not previous:
                # New employee
                emp = current.employee
                new_employees.append({
                    'employee_number': emp.employee_number,
                    'employee_name': emp.full_name,
                    'department': emp.department.name if emp.department else '',
                    'position': emp.position.title if emp.position else '',
                    'basic_salary': safe_float(current.basic_salary),
                    'gross_earnings': safe_float(current.gross_earnings),
                    'total_deductions': safe_float(current.total_deductions),
                    'net_salary': safe_float(current.net_salary),
                    'reason': 'New Hire',
                })
            elif previous and not current:
                # Separated employee
                emp = previous.employee
                separated_employees.append({
                    'employee_number': emp.employee_number,
                    'employee_name': emp.full_name,
                    'department': emp.department.name if emp.department else '',
                    'position': emp.position.title if emp.position else '',
                    'basic_salary': safe_float(previous.basic_salary),
                    'gross_earnings': safe_float(previous.gross_earnings),
                    'total_deductions': safe_float(previous.total_deductions),
                    'net_salary': safe_float(previous.net_salary),
                    'reason': emp.exit_reason or 'Separation',
                })
            else:
                # Compare current and previous
                emp = current.employee
                curr_basic = safe_float(current.basic_salary)
                prev_basic = safe_float(previous.basic_salary)
                curr_gross = safe_float(current.gross_earnings)
                prev_gross = safe_float(previous.gross_earnings)
                curr_deductions = safe_float(current.total_deductions)
                prev_deductions = safe_float(previous.total_deductions)
                curr_net = safe_float(current.net_salary)
                prev_net = safe_float(previous.net_salary)

                basic_diff = curr_basic - prev_basic
                gross_diff = curr_gross - prev_gross
                deductions_diff = curr_deductions - prev_deductions
                net_diff = curr_net - prev_net

                # Check if there's any meaningful change (>0.01)
                has_change = (
                    abs(basic_diff) > 0.01 or
                    abs(gross_diff) > 0.01 or
                    abs(deductions_diff) > 0.01 or
                    abs(net_diff) > 0.01
                )

                record = {
                    'employee_number': emp.employee_number,
                    'employee_name': emp.full_name,
                    'department': emp.department.name if emp.department else '',
                    'position': emp.position.title if emp.position else '',
                    'prev_basic': prev_basic,
                    'curr_basic': curr_basic,
                    'basic_diff': basic_diff,
                    'prev_gross': prev_gross,
                    'curr_gross': curr_gross,
                    'gross_diff': gross_diff,
                    'prev_deductions': prev_deductions,
                    'curr_deductions': curr_deductions,
                    'deductions_diff': deductions_diff,
                    'prev_net': prev_net,
                    'curr_net': curr_net,
                    'net_diff': net_diff,
                }

                if has_change:
                    # Determine change reason
                    reasons = []
                    if abs(basic_diff) > 0.01:
                        reasons.append('Salary Change')
                    if abs(gross_diff - basic_diff) > 0.01:
                        reasons.append('Allowances/Overtime')
                    if abs(deductions_diff) > 0.01:
                        reasons.append('Deductions')
                    record['change_reasons'] = ', '.join(reasons) if reasons else 'Adjustment'
                    changed_employees.append(record)
                else:
                    unchanged_employees.append(record)

        # Calculate summary totals
        curr_totals = {
            'employees': current_run.total_employees or 0,
            'gross': safe_float(current_run.total_gross),
            'deductions': safe_float(current_run.total_deductions),
            'net': safe_float(current_run.total_net),
            'paye': safe_float(current_run.total_paye),
            'ssnit_employee': safe_float(current_run.total_ssnit_employee),
            'ssnit_employer': safe_float(current_run.total_ssnit_employer),
        }
        prev_totals = {
            'employees': previous_run.total_employees or 0,
            'gross': safe_float(previous_run.total_gross),
            'deductions': safe_float(previous_run.total_deductions),
            'net': safe_float(previous_run.total_net),
            'paye': safe_float(previous_run.total_paye),
            'ssnit_employee': safe_float(previous_run.total_ssnit_employee),
            'ssnit_employer': safe_float(previous_run.total_ssnit_employer),
        }

        def calc_variance(curr, prev):
            diff = curr - prev
            pct = (diff / prev * 100) if prev > 0 else (100 if curr > 0 else 0)
            return {'current': curr, 'previous': prev, 'difference': diff, 'percentage': round(pct, 2)}

        summary = {
            'current_period': current_run.payroll_period.name if current_run.payroll_period else current_run.run_number,
            'previous_period': previous_run.payroll_period.name if previous_run.payroll_period else previous_run.run_number,
            'current_run_date': current_run.run_date.isoformat() if current_run.run_date else None,
            'previous_run_date': previous_run.run_date.isoformat() if previous_run.run_date else None,
            'employees': calc_variance(curr_totals['employees'], prev_totals['employees']),
            'gross': calc_variance(curr_totals['gross'], prev_totals['gross']),
            'deductions': calc_variance(curr_totals['deductions'], prev_totals['deductions']),
            'net': calc_variance(curr_totals['net'], prev_totals['net']),
            'paye': calc_variance(curr_totals['paye'], prev_totals['paye']),
            'ssnit_employee': calc_variance(curr_totals['ssnit_employee'], prev_totals['ssnit_employee']),
            'ssnit_employer': calc_variance(curr_totals['ssnit_employer'], prev_totals['ssnit_employer']),
        }

        # Impact summary
        impact = {
            'new_employees_count': len(new_employees),
            'new_employees_cost': sum(e['gross_earnings'] for e in new_employees),
            'separated_employees_count': len(separated_employees),
            'separated_employees_savings': sum(e['gross_earnings'] for e in separated_employees),
            'changed_employees_count': len(changed_employees),
            'net_salary_impact': sum(e['net_diff'] for e in changed_employees),
            'unchanged_employees_count': len(unchanged_employees),
        }

        return Response({
            'summary': summary,
            'impact': impact,
            'new_employees': sorted(new_employees, key=lambda x: x['employee_name']),
            'separated_employees': sorted(separated_employees, key=lambda x: x['employee_name']),
            'changed_employees': sorted(changed_employees, key=lambda x: abs(x['net_diff']), reverse=True),
            'unchanged_count': len(unchanged_employees),
            'generated_at': timezone.now()
        })


class ComprehensiveReconciliationView(APIView):
    """
    Comprehensive payroll reconciliation showing all transactions between two periods.

    Starts with previous month's gross/net and factors in all transactions
    to arrive at the current month's gross/net.
    """

    def get(self, request):
        from decimal import Decimal
        from collections import defaultdict
        from payroll.models import PayrollPeriod, PayComponent, AdHocPayment, EmployeeTransaction

        current_period_id = request.query_params.get('current_period')
        previous_period_id = request.query_params.get('previous_period')

        # Validate periods
        if not current_period_id or not previous_period_id:
            # Default to last two periods with completed runs
            runs = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).select_related('payroll_period').order_by('-payroll_period__year', '-payroll_period__month')[:2]

            if len(runs) < 2:
                return Response({
                    'error': 'Need at least two completed payroll periods for reconciliation',
                    'generated_at': timezone.now()
                }, status=400)

            current_run = runs[0]
            previous_run = runs[1]
        else:
            try:
                current_period = PayrollPeriod.objects.get(id=current_period_id)
                previous_period = PayrollPeriod.objects.get(id=previous_period_id)

                current_run = PayrollRun.objects.filter(
                    payroll_period=current_period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()

                previous_run = PayrollRun.objects.filter(
                    payroll_period=previous_period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()

                if not current_run or not previous_run:
                    return Response({
                        'error': 'No completed payroll runs found for the specified periods',
                        'generated_at': timezone.now()
                    }, status=400)

            except PayrollPeriod.DoesNotExist:
                return Response({'error': 'Invalid period IDs'}, status=400)

        def safe_decimal(val):
            if val is None:
                return Decimal('0')
            return Decimal(str(val))

        def safe_float(val):
            return float(safe_decimal(val))

        # Get all payroll items with details
        current_items = {}
        current_details = defaultdict(dict)  # emp_id -> component_code -> amount
        for item in PayrollItem.objects.filter(payroll_run=current_run).select_related(
            'employee', 'employee__department', 'employee__grade'
        ).prefetch_related('details__pay_component'):
            current_items[item.employee_id] = item
            for detail in item.details.all():
                current_details[item.employee_id][detail.pay_component.code] = safe_decimal(detail.amount)

        previous_items = {}
        previous_details = defaultdict(dict)
        for item in PayrollItem.objects.filter(payroll_run=previous_run).select_related(
            'employee', 'employee__department', 'employee__grade'
        ).prefetch_related('details__pay_component'):
            previous_items[item.employee_id] = item
            for detail in item.details.all():
                previous_details[item.employee_id][detail.pay_component.code] = safe_decimal(detail.amount)

        all_emp_ids = set(current_items.keys()) | set(previous_items.keys())

        # Starting point - Previous period totals
        prev_totals = {
            'gross': safe_decimal(previous_run.total_gross),
            'net': safe_decimal(previous_run.total_net),
            'deductions': safe_decimal(previous_run.total_deductions),
            'paye': safe_decimal(previous_run.total_paye),
            'ssnit_employee': safe_decimal(previous_run.total_ssnit_employee),
            'employees': previous_run.total_employees or 0,
        }

        # Ending point - Current period totals
        curr_totals = {
            'gross': safe_decimal(current_run.total_gross),
            'net': safe_decimal(current_run.total_net),
            'deductions': safe_decimal(current_run.total_deductions),
            'paye': safe_decimal(current_run.total_paye),
            'ssnit_employee': safe_decimal(current_run.total_ssnit_employee),
            'employees': current_run.total_employees or 0,
        }

        # Track all changes
        changes = {
            'new_employees': [],
            'separated_employees': [],
            'basic_salary_changes': [],
            'allowance_changes': defaultdict(list),
            'deduction_changes': defaultdict(list),
            'adhoc_payments': [],
        }

        # Component type lookup
        components = {c.code: c for c in PayComponent.objects.filter(is_active=True)}

        # Analyze each employee
        for emp_id in all_emp_ids:
            curr_item = current_items.get(emp_id)
            prev_item = previous_items.get(emp_id)
            curr_comps = current_details.get(emp_id, {})
            prev_comps = previous_details.get(emp_id, {})

            if curr_item and not prev_item:
                # New employee
                emp = curr_item.employee
                changes['new_employees'].append({
                    'employee_number': emp.employee_number,
                    'employee_name': emp.full_name,
                    'department': emp.department.name if emp.department else '',
                    'grade': emp.grade.code if emp.grade else '',
                    'basic_salary': safe_float(curr_item.basic_salary),
                    'gross': safe_float(curr_item.gross_earnings),
                    'deductions': safe_float(curr_item.total_deductions),
                    'net': safe_float(curr_item.net_salary),
                })

            elif prev_item and not curr_item:
                # Separated employee
                emp = prev_item.employee
                changes['separated_employees'].append({
                    'employee_number': emp.employee_number,
                    'employee_name': emp.full_name,
                    'department': emp.department.name if emp.department else '',
                    'grade': emp.grade.code if emp.grade else '',
                    'basic_salary': safe_float(prev_item.basic_salary),
                    'gross': safe_float(prev_item.gross_earnings),
                    'deductions': safe_float(prev_item.total_deductions),
                    'net': safe_float(prev_item.net_salary),
                    'reason': emp.exit_reason or 'Separation',
                })

            else:
                # Existing employee - check for changes
                emp = curr_item.employee

                # Basic salary change
                curr_basic = safe_decimal(curr_item.basic_salary)
                prev_basic = safe_decimal(prev_item.basic_salary)
                if curr_basic != prev_basic:
                    changes['basic_salary_changes'].append({
                        'employee_number': emp.employee_number,
                        'employee_name': emp.full_name,
                        'department': emp.department.name if emp.department else '',
                        'previous': safe_float(prev_basic),
                        'current': safe_float(curr_basic),
                        'difference': safe_float(curr_basic - prev_basic),
                    })

                # Component-level changes
                all_comp_codes = set(curr_comps.keys()) | set(prev_comps.keys())
                for comp_code in all_comp_codes:
                    if comp_code == 'BASIC':
                        continue  # Already handled above

                    curr_amt = curr_comps.get(comp_code, Decimal('0'))
                    prev_amt = prev_comps.get(comp_code, Decimal('0'))

                    if curr_amt != prev_amt:
                        component = components.get(comp_code)
                        if not component:
                            continue

                        change_record = {
                            'employee_number': emp.employee_number,
                            'employee_name': emp.full_name,
                            'component_code': comp_code,
                            'component_name': component.name,
                            'previous': safe_float(prev_amt),
                            'current': safe_float(curr_amt),
                            'difference': safe_float(curr_amt - prev_amt),
                        }

                        if component.component_type == 'EARNING':
                            changes['allowance_changes'][comp_code].append(change_record)
                        elif component.component_type == 'DEDUCTION':
                            changes['deduction_changes'][comp_code].append(change_record)

        # Get ad-hoc payments for current period
        adhoc_payments = AdHocPayment.objects.filter(
            payroll_period=current_run.payroll_period,
            status='APPROVED'
        ).select_related('employee', 'pay_component')

        for adhoc in adhoc_payments:
            changes['adhoc_payments'].append({
                'employee_number': adhoc.employee.employee_number,
                'employee_name': adhoc.employee.full_name,
                'component': adhoc.pay_component.name,
                'amount': safe_float(adhoc.amount),
                'description': adhoc.description,
            })

        # Build reconciliation summary (waterfall)
        reconciliation_waterfall = []

        # Starting point
        reconciliation_waterfall.append({
            'description': f'Previous Period ({previous_run.payroll_period.name})',
            'gross': safe_float(prev_totals['gross']),
            'net': safe_float(prev_totals['net']),
            'is_total': True,
        })

        # New employees impact
        new_emp_gross = sum(e['gross'] for e in changes['new_employees'])
        new_emp_net = sum(e['net'] for e in changes['new_employees'])
        if new_emp_gross != 0:
            reconciliation_waterfall.append({
                'description': f"New Employees ({len(changes['new_employees'])})",
                'gross_change': new_emp_gross,
                'net_change': new_emp_net,
                'count': len(changes['new_employees']),
            })

        # Separated employees impact
        sep_emp_gross = sum(e['gross'] for e in changes['separated_employees'])
        sep_emp_net = sum(e['net'] for e in changes['separated_employees'])
        if sep_emp_gross != 0:
            reconciliation_waterfall.append({
                'description': f"Separated Employees ({len(changes['separated_employees'])})",
                'gross_change': -sep_emp_gross,
                'net_change': -sep_emp_net,
                'count': len(changes['separated_employees']),
            })

        # Basic salary changes
        salary_change_total = sum(e['difference'] for e in changes['basic_salary_changes'])
        if salary_change_total != 0:
            reconciliation_waterfall.append({
                'description': f"Basic Salary Changes ({len(changes['basic_salary_changes'])})",
                'gross_change': salary_change_total,
                'net_change': salary_change_total * 0.7,  # Approximate after tax
                'count': len(changes['basic_salary_changes']),
            })

        # Allowance changes by component
        for comp_code, comp_changes in changes['allowance_changes'].items():
            total_change = sum(c['difference'] for c in comp_changes)
            if total_change != 0:
                comp_name = components.get(comp_code, {})
                comp_name = comp_name.name if hasattr(comp_name, 'name') else comp_code
                reconciliation_waterfall.append({
                    'description': f"{comp_name} ({len(comp_changes)} employees)",
                    'gross_change': total_change,
                    'net_change': total_change * 0.85,  # Approximate after tax
                    'count': len(comp_changes),
                    'component_code': comp_code,
                })

        # Deduction changes by component
        for comp_code, comp_changes in changes['deduction_changes'].items():
            total_change = sum(c['difference'] for c in comp_changes)
            if total_change != 0:
                comp_name = components.get(comp_code, {})
                comp_name = comp_name.name if hasattr(comp_name, 'name') else comp_code
                reconciliation_waterfall.append({
                    'description': f"{comp_name} ({len(comp_changes)} employees)",
                    'gross_change': 0,  # Deductions don't affect gross
                    'net_change': -total_change,  # Increase in deduction = decrease in net
                    'count': len(comp_changes),
                    'component_code': comp_code,
                    'is_deduction': True,
                })

        # Ad-hoc payments
        adhoc_total = sum(a['amount'] for a in changes['adhoc_payments'])
        if adhoc_total != 0:
            reconciliation_waterfall.append({
                'description': f"Ad-hoc Payments ({len(changes['adhoc_payments'])})",
                'gross_change': adhoc_total,
                'net_change': adhoc_total * 0.85,  # Approximate after tax
                'count': len(changes['adhoc_payments']),
            })

        # Ending point
        reconciliation_waterfall.append({
            'description': f'Current Period ({current_run.payroll_period.name})',
            'gross': safe_float(curr_totals['gross']),
            'net': safe_float(curr_totals['net']),
            'is_total': True,
        })

        # Calculate variance explanation
        gross_variance = curr_totals['gross'] - prev_totals['gross']
        net_variance = curr_totals['net'] - prev_totals['net']

        explained_gross = sum(
            item.get('gross_change', 0) for item in reconciliation_waterfall
            if not item.get('is_total')
        )
        explained_net = sum(
            item.get('net_change', 0) for item in reconciliation_waterfall
            if not item.get('is_total')
        )

        unexplained_gross = float(gross_variance) - explained_gross
        unexplained_net = float(net_variance) - explained_net

        if abs(unexplained_gross) > 1 or abs(unexplained_net) > 1:
            reconciliation_waterfall.insert(-1, {
                'description': 'Other Adjustments (Tax/SSNIT rate changes, rounding)',
                'gross_change': unexplained_gross,
                'net_change': unexplained_net,
            })

        # Summary statistics
        summary = {
            'previous_period': previous_run.payroll_period.name,
            'current_period': current_run.payroll_period.name,
            'previous_gross': safe_float(prev_totals['gross']),
            'current_gross': safe_float(curr_totals['gross']),
            'gross_variance': safe_float(gross_variance),
            'gross_variance_pct': float(gross_variance / prev_totals['gross'] * 100) if prev_totals['gross'] else 0,
            'previous_net': safe_float(prev_totals['net']),
            'current_net': safe_float(curr_totals['net']),
            'net_variance': safe_float(net_variance),
            'net_variance_pct': float(net_variance / prev_totals['net'] * 100) if prev_totals['net'] else 0,
            'previous_employees': prev_totals['employees'],
            'current_employees': curr_totals['employees'],
            'employee_variance': curr_totals['employees'] - prev_totals['employees'],
        }

        return Response({
            'summary': summary,
            'waterfall': reconciliation_waterfall,
            'details': {
                'new_employees': sorted(changes['new_employees'], key=lambda x: x['gross'], reverse=True),
                'separated_employees': sorted(changes['separated_employees'], key=lambda x: x['gross'], reverse=True),
                'basic_salary_changes': sorted(changes['basic_salary_changes'], key=lambda x: abs(x['difference']), reverse=True),
                'allowance_changes': {k: sorted(v, key=lambda x: abs(x['difference']), reverse=True)
                                      for k, v in changes['allowance_changes'].items()},
                'deduction_changes': {k: sorted(v, key=lambda x: abs(x['difference']), reverse=True)
                                      for k, v in changes['deduction_changes'].items()},
                'adhoc_payments': changes['adhoc_payments'],
            },
            'generated_at': timezone.now(),
        })


class ExportPayrollReconciliationView(APIView):
    """Export payroll reconciliation report."""

    def get(self, request):
        from .exports import get_payroll_reconciliation_data, generate_excel_response, generate_csv_response, generate_pdf_response
        from payroll.models import PayrollPeriod

        current_run_id = request.query_params.get('current_run')
        previous_run_id = request.query_params.get('previous_run')
        current_period_id = request.query_params.get('current_period')
        previous_period_id = request.query_params.get('previous_period')
        file_format = request.query_params.get('format', 'excel').lower()

        # If period IDs provided, find the corresponding run IDs
        if current_period_id and previous_period_id:
            try:
                current_period = PayrollPeriod.objects.get(id=current_period_id)
                previous_period = PayrollPeriod.objects.get(id=previous_period_id)

                current_run = PayrollRun.objects.filter(
                    payroll_period=current_period
                ).order_by('-run_date').first()

                previous_run = PayrollRun.objects.filter(
                    payroll_period=previous_period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()

                if current_run:
                    current_run_id = str(current_run.id)
                if previous_run:
                    previous_run_id = str(previous_run.id)
            except PayrollPeriod.DoesNotExist:
                return Response({'message': 'Invalid payroll period IDs'}, status=400)

        data, headers, title = get_payroll_reconciliation_data(current_run_id, previous_run_id)

        if not data:
            return Response({'message': 'No reconciliation data available'}, status=400)

        filename_base = f"payroll_reconciliation_{timezone.now().strftime('%Y%m%d')}"

        if file_format == 'csv':
            return generate_csv_response(data, headers, f"{filename_base}.csv")
        elif file_format == 'pdf':
            return generate_pdf_response(data, headers, f"{filename_base}.pdf", title=title, landscape_mode=True)
        else:
            return generate_excel_response(data, headers, f"{filename_base}.xlsx", title=title)


class PAYEStatutoryReportView(APIView):
    """PAYE statutory report for GRA."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')

        if payroll_run_id:
            items = PayrollItem.objects.filter(
                payroll_run_id=payroll_run_id
            ).select_related('employee')
        else:
            latest_run = PayrollRun.objects.filter(
                status='APPROVED'
            ).order_by('-run_date').first()
            if latest_run:
                items = PayrollItem.objects.filter(payroll_run=latest_run)
            else:
                return Response({'message': 'No payroll data found'})

        data = items.values(
            'employee__employee_number',
            'employee__first_name',
            'employee__last_name',
            'employee__tin_number',
            'gross_salary',
            'taxable_income',
            'paye'
        ).filter(paye__gt=0)

        total_paye = items.aggregate(Sum('paye'))['paye__sum'] or 0

        return Response({
            'total_employees': items.filter(paye__gt=0).count(),
            'total_paye': float(total_paye),
            'details': list(data),
            'generated_at': timezone.now()
        })


class SSNITStatutoryReportView(APIView):
    """SSNIT contribution report."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')

        if payroll_run_id:
            items = PayrollItem.objects.filter(
                payroll_run_id=payroll_run_id
            ).select_related('employee')
        else:
            latest_run = PayrollRun.objects.filter(
                status='APPROVED'
            ).order_by('-run_date').first()
            if latest_run:
                items = PayrollItem.objects.filter(payroll_run=latest_run)
            else:
                return Response({'message': 'No payroll data found'})

        data = items.values(
            'employee__employee_number',
            'employee__first_name',
            'employee__last_name',
            'employee__ssnit_number',
            'basic_salary',
            'ssnit_employee',
            'ssnit_employer',
            'tier2_employer'
        )

        totals = items.aggregate(
            total_employee=Sum('ssnit_employee'),
            total_employer=Sum('ssnit_employer'),
            total_tier2=Sum('tier2_employer')
        )

        return Response({
            'total_employees': items.count(),
            'total_ssnit_employee': float(totals['total_employee'] or 0),
            'total_ssnit_employer': float(totals['total_employer'] or 0),
            'total_tier2_employer': float(totals['total_tier2'] or 0),
            'total_contribution': float(
                (totals['total_employee'] or 0) +
                (totals['total_employer'] or 0) +
                (totals['total_tier2'] or 0)
            ),
            'details': list(data),
            'generated_at': timezone.now()
        })


class CustomReportView(APIView):
    """Custom report builder."""

    def get(self, request):
        # Returns available report templates and fields
        return Response({
            'available_entities': [
                'employees', 'leave', 'loans', 'payroll'
            ],
            'message': 'Custom report builder - POST with report configuration',
            'generated_at': timezone.now()
        })

    def post(self, request):
        # TODO: Implement custom report generation based on configuration
        return Response(
            {'message': 'Custom report generation endpoint'},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )


class ScheduledReportsView(APIView):
    """Manage scheduled reports."""

    def get(self, request):
        # TODO: Return list of scheduled reports
        return Response({
            'scheduled_reports': [],
            'message': 'Scheduled reports management endpoint',
            'generated_at': timezone.now()
        })

    def post(self, request):
        # TODO: Create scheduled report
        return Response(
            {'message': 'Scheduled report creation endpoint'},
            status=status.HTTP_501_NOT_IMPLEMENTED
        )


# =============================================================================
# Export Views - CSV/Excel Downloads
# =============================================================================

from .exports import (
    export_employee_master, export_headcount, export_payroll_summary,
    export_paye_report, export_ssnit_report, export_bank_advice,
    export_leave_balance, export_loan_outstanding, export_payroll_master,
    export_paye_gra_report
)


class ExportEmployeeMasterView(APIView):
    """Export employee master report to CSV/Excel/PDF."""

    def get(self, request):
        filters = {
            'employee_code': request.query_params.get('employee_code'),
            'division': request.query_params.get('division'),
            'directorate': request.query_params.get('directorate'),
            'department': request.query_params.get('department'),
            'position': request.query_params.get('position'),
            'grade': request.query_params.get('grade'),
            'salary_band': request.query_params.get('salary_band'),
            'salary_level': request.query_params.get('salary_level'),
            'staff_category': request.query_params.get('staff_category'),
            'status': request.query_params.get('status'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_employee_master(filters, format=file_format)


class ExportHeadcountView(APIView):
    """Export headcount report to CSV/Excel/PDF."""

    def get(self, request):
        filters = {
            'division': request.query_params.get('division'),
            'directorate': request.query_params.get('directorate'),
            'department': request.query_params.get('department'),
            'grade': request.query_params.get('grade'),
            'staff_category': request.query_params.get('staff_category'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_headcount(filters=filters, format=file_format)


class ExportPayrollSummaryView(APIView):
    """Export payroll summary to CSV/Excel/PDF."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        filters = {
            'employee_code': request.query_params.get('employee_code'),
            'division': request.query_params.get('division'),
            'directorate': request.query_params.get('directorate'),
            'department': request.query_params.get('department'),
            'position': request.query_params.get('position'),
            'grade': request.query_params.get('grade'),
            'salary_band': request.query_params.get('salary_band'),
            'salary_level': request.query_params.get('salary_level'),
            'staff_category': request.query_params.get('staff_category'),
            'bank': request.query_params.get('bank'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_payroll_summary(payroll_run_id, filters=filters, format=file_format)


class ExportPAYEReportView(APIView):
    """Export PAYE tax report to CSV/Excel/PDF."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        filters = {
            'employee_code': request.query_params.get('employee_code'),
            'division': request.query_params.get('division'),
            'directorate': request.query_params.get('directorate'),
            'department': request.query_params.get('department'),
            'position': request.query_params.get('position'),
            'grade': request.query_params.get('grade'),
            'salary_band': request.query_params.get('salary_band'),
            'salary_level': request.query_params.get('salary_level'),
            'staff_category': request.query_params.get('staff_category'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_paye_report(payroll_run_id, filters=filters, format=file_format)


class ExportSSNITReportView(APIView):
    """Export SSNIT contribution report to CSV/Excel/PDF."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        filters = {
            'employee_code': request.query_params.get('employee_code'),
            'division': request.query_params.get('division'),
            'directorate': request.query_params.get('directorate'),
            'department': request.query_params.get('department'),
            'position': request.query_params.get('position'),
            'grade': request.query_params.get('grade'),
            'salary_band': request.query_params.get('salary_band'),
            'salary_level': request.query_params.get('salary_level'),
            'staff_category': request.query_params.get('staff_category'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_ssnit_report(payroll_run_id, filters=filters, format=file_format)


class ExportBankAdviceView(APIView):
    """Export bank advice report to CSV/Excel/PDF."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        filters = {
            'employee_code': request.query_params.get('employee_code'),
            'division': request.query_params.get('division'),
            'directorate': request.query_params.get('directorate'),
            'department': request.query_params.get('department'),
            'position': request.query_params.get('position'),
            'grade': request.query_params.get('grade'),
            'salary_band': request.query_params.get('salary_band'),
            'salary_level': request.query_params.get('salary_level'),
            'staff_category': request.query_params.get('staff_category'),
            'bank': request.query_params.get('bank'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_bank_advice(payroll_run_id, filters=filters, format=file_format)


class ExportLeaveBalanceView(APIView):
    """Export leave balance report to CSV/Excel/PDF."""

    def get(self, request):
        filters = {
            'year': request.query_params.get('year'),
            'employee_code': request.query_params.get('employee_code'),
            'division': request.query_params.get('division'),
            'directorate': request.query_params.get('directorate'),
            'department': request.query_params.get('department'),
            'position': request.query_params.get('position'),
            'grade': request.query_params.get('grade'),
            'staff_category': request.query_params.get('staff_category'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_leave_balance(filters, format=file_format)


class ExportLoanOutstandingView(APIView):
    """Export outstanding loans report to CSV/Excel/PDF."""

    def get(self, request):
        filters = {
            'employee_code': request.query_params.get('employee_code'),
            'division': request.query_params.get('division'),
            'directorate': request.query_params.get('directorate'),
            'department': request.query_params.get('department'),
            'position': request.query_params.get('position'),
            'grade': request.query_params.get('grade'),
            'staff_category': request.query_params.get('staff_category'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_loan_outstanding(filters, format=file_format)


class ExportPayrollMasterView(APIView):
    """Export Payroll Master Report to CSV/Excel/PDF."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        filters = {
            'employee_code': request.query_params.get('employee_code'),
            'division': request.query_params.get('division'),
            'directorate': request.query_params.get('directorate'),
            'department': request.query_params.get('department'),
            'position': request.query_params.get('position'),
            'grade': request.query_params.get('grade'),
            'salary_band': request.query_params.get('salary_band'),
            'salary_level': request.query_params.get('salary_level'),
            'staff_category': request.query_params.get('staff_category'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_payroll_master(payroll_run_id, filters=filters, format=file_format)


class ExportPAYEGRAReportView(APIView):
    """
    Export PAYE report in GRA (Ghana Revenue Authority) format.
    Matches the official PAYE Monthly Tax Deductions Schedule format.
    """

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        filters = {
            'employee_code': request.query_params.get('employee_code'),
            'division': request.query_params.get('division'),
            'directorate': request.query_params.get('directorate'),
            'department': request.query_params.get('department'),
            'position': request.query_params.get('position'),
            'grade': request.query_params.get('grade'),
            'salary_band': request.query_params.get('salary_band'),
            'salary_level': request.query_params.get('salary_level'),
            'staff_category': request.query_params.get('staff_category'),
        }
        # Default to Excel since that's the GRA's preferred format
        file_format = request.query_params.get('file_format', 'excel')
        return export_paye_gra_report(payroll_run_id, filters=filters, format=file_format)


# ============================================
# Analytics KPI Endpoints
# ============================================

from .analytics import (
    RecruitmentAnalytics, DemographicsAnalytics, TrainingAnalytics,
    PerformanceAnalytics, CompensationAnalytics, ExitAnalytics, MasterDashboard
)


class MasterAnalyticsDashboardView(APIView):
    """
    Master dashboard with all key KPIs.
    GET /api/v1/reports/analytics/master/
    """

    def get(self, request):
        try:
            data = MasterDashboard.get_all_kpis()
            return Response(data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RecruitmentKPIsView(APIView):
    """
    Recruitment KPIs: FTE, hiring rate, attrition, time to fill.
    GET /api/v1/reports/analytics/recruitment/
    """

    def get(self, request):
        year = request.query_params.get('year')
        if year:
            year = int(year)

        return Response({
            'fte': RecruitmentAnalytics.get_fte_count(),
            'hiring_rate': RecruitmentAnalytics.get_hiring_rate(year),
            'attrition_rate': RecruitmentAnalytics.get_attrition_rate(year),
            'time_to_fill': RecruitmentAnalytics.get_time_to_fill(),
            'vacancy_summary': RecruitmentAnalytics.get_vacancy_summary(),
        })


class DemographicsKPIsView(APIView):
    """
    Workforce demographics: age, gender, location, education, tenure, grade.
    GET /api/v1/reports/analytics/demographics/
    """

    def get(self, request):
        return Response({
            'age_distribution': DemographicsAnalytics.get_age_distribution(),
            'gender_distribution': DemographicsAnalytics.get_gender_distribution(),
            'location_distribution': DemographicsAnalytics.get_location_distribution(),
            'education_distribution': DemographicsAnalytics.get_education_distribution(),
            'tenure_distribution': DemographicsAnalytics.get_tenure_distribution(),
            'grade_distribution': DemographicsAnalytics.get_grade_distribution(),
            'department_distribution': DemographicsAnalytics.get_department_distribution(),
        })


class TrainingKPIsView(APIView):
    """
    Training KPIs: completion rate, cost per employee.
    GET /api/v1/reports/analytics/training/
    """

    def get(self, request):
        year = request.query_params.get('year')
        if year:
            year = int(year)

        return Response({
            'completion_rate': TrainingAnalytics.get_training_completion_rate(year),
            'cost_per_employee': TrainingAnalytics.get_training_cost_per_employee(year),
            'training_needs': TrainingAnalytics.get_training_needs_summary(),
        })


class PerformanceKPIsView(APIView):
    """
    Performance KPIs: completion rate, rating distribution, high/low performers.
    GET /api/v1/reports/analytics/performance/
    """

    def get(self, request):
        year = request.query_params.get('year')
        if year:
            year = int(year)

        return Response({
            'appraisal_completion': PerformanceAnalytics.get_appraisal_completion(year),
            'rating_distribution': PerformanceAnalytics.get_performance_distribution(year),
            'performers': PerformanceAnalytics.get_high_low_performers(year),
        })


class CompensationKPIsView(APIView):
    """
    Compensation KPIs: payroll cost, variance, average salary.
    GET /api/v1/reports/analytics/compensation/
    """

    def get(self, request):
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        if year:
            year = int(year)
        if month:
            month = int(month)

        return Response({
            'payroll_summary': CompensationAnalytics.get_payroll_cost_summary(year, month),
            'payroll_variance': CompensationAnalytics.get_payroll_variance(),
            'salary_by_grade': CompensationAnalytics.get_average_salary_by_grade(),
            'salary_bands': CompensationAnalytics.get_salary_band_distribution(),
        })


class ExitKPIsView(APIView):
    """
    Exit KPIs: turnover rate, exit breakdown, retention rate.
    GET /api/v1/reports/analytics/exit/
    """

    def get(self, request):
        year = request.query_params.get('year')
        if year:
            year = int(year)

        return Response({
            'turnover_rate': ExitAnalytics.get_turnover_rate(year),
            'exit_breakdown': ExitAnalytics.get_exit_breakdown(year),
            'retention_rate': ExitAnalytics.get_retention_rate(year),
        })


# ========================================
# Specialized Payroll Reports
# ========================================

class LoanTypeReportView(APIView):
    """
    Loan report by type (Car Loan, Student Loan, etc.).
    GET /api/v1/reports/payroll/loans/by-type/?loan_type=CAR_LOAN
    """

    def get(self, request):
        from benefits.models import LoanAccount, LoanType, LoanTransaction
        from decimal import Decimal

        loan_type_code = request.query_params.get('loan_type')
        year = request.query_params.get('year', timezone.now().year)
        month = request.query_params.get('month')

        # Base query for active loans
        loans_qs = LoanAccount.objects.filter(
            status__in=['ACTIVE', 'DISBURSED']
        ).select_related('employee', 'employee__department', 'loan_type')

        if loan_type_code:
            loans_qs = loans_qs.filter(loan_type__code=loan_type_code)

        # Group by loan type
        loan_types_summary = {}
        for loan in loans_qs:
            lt_code = loan.loan_type.code
            lt_name = loan.loan_type.name

            if lt_code not in loan_types_summary:
                loan_types_summary[lt_code] = {
                    'loan_type_code': lt_code,
                    'loan_type_name': lt_name,
                    'interest_rate': float(loan.loan_type.interest_rate),
                    'total_loans': 0,
                    'total_principal': Decimal('0'),
                    'total_outstanding': Decimal('0'),
                    'total_interest': Decimal('0'),
                    'monthly_deduction': Decimal('0'),
                    'employees': []
                }

            summary = loan_types_summary[lt_code]
            summary['total_loans'] += 1
            summary['total_principal'] += loan.principal_amount or Decimal('0')
            summary['total_outstanding'] += loan.outstanding_balance or Decimal('0')
            summary['total_interest'] += loan.total_interest or Decimal('0')
            summary['monthly_deduction'] += loan.monthly_deduction or Decimal('0')

            summary['employees'].append({
                'employee_number': loan.employee.employee_number,
                'employee_name': loan.employee.full_name,
                'department': loan.employee.department.name if loan.employee.department else '',
                'loan_number': loan.loan_number,
                'principal_amount': float(loan.principal_amount or 0),
                'outstanding_balance': float(loan.outstanding_balance or 0),
                'monthly_deduction': float(loan.monthly_deduction or 0),
                'interest_rate': float(loan.loan_type.interest_rate),
                'start_date': loan.start_date,
                'end_date': loan.end_date,
                'remaining_installments': loan.remaining_installments,
            })

        # Convert Decimals to floats for JSON
        for lt_code, summary in loan_types_summary.items():
            summary['total_principal'] = float(summary['total_principal'])
            summary['total_outstanding'] = float(summary['total_outstanding'])
            summary['total_interest'] = float(summary['total_interest'])
            summary['monthly_deduction'] = float(summary['monthly_deduction'])

        return Response({
            'loan_types': list(loan_types_summary.values()),
            'filters': {
                'loan_type': loan_type_code,
                'year': int(year),
                'month': int(month) if month else None,
            },
            'generated_at': timezone.now()
        })


class DuesReportView(APIView):
    """
    Union dues and fund contributions report (PAWU, UNICOF, Credit Union, etc.).
    GET /api/v1/reports/payroll/dues/?component_code=PAWU
    """

    def get(self, request):
        from payroll.models import PayComponent, PayrollItemDetail
        from decimal import Decimal

        component_code = request.query_params.get('component_code')
        run_id = request.query_params.get('run_id')
        period_id = request.query_params.get('period_id')

        # Get deduction components of FUND category or matching code
        components_qs = PayComponent.objects.filter(
            component_type='DEDUCTION',
            is_active=True
        )

        if component_code:
            components_qs = components_qs.filter(code__icontains=component_code)
        else:
            # Get union dues and fund related components
            components_qs = components_qs.filter(
                Q(category='FUND') |
                Q(code__icontains='PAWU') |
                Q(code__icontains='UNICOF') |
                Q(code__icontains='CREDIT') |
                Q(code__icontains='UNION') |
                Q(name__icontains='dues') |
                Q(name__icontains='fund')
            )

        component_ids = list(components_qs.values_list('id', flat=True))

        # Get payroll run
        run = None
        if run_id:
            run = PayrollRun.objects.filter(id=run_id).first()
        elif period_id:
            from payroll.models import PayrollPeriod
            period = PayrollPeriod.objects.filter(id=period_id).first()
            if period:
                run = PayrollRun.objects.filter(
                    payroll_period=period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()
        else:
            # Latest approved run
            run = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).order_by('-run_date').first()

        if not run:
            return Response({
                'message': 'No payroll run found',
                'generated_at': timezone.now()
            })

        # Get deduction details for this run
        details = PayrollItemDetail.objects.filter(
            payroll_item__payroll_run=run,
            pay_component_id__in=component_ids
        ).select_related(
            'payroll_item__employee',
            'payroll_item__employee__department',
            'pay_component'
        )

        # Group by component
        components_summary = {}
        for detail in details:
            comp_code = detail.pay_component.code
            comp_name = detail.pay_component.name

            if comp_code not in components_summary:
                components_summary[comp_code] = {
                    'component_code': comp_code,
                    'component_name': comp_name,
                    'total_amount': Decimal('0'),
                    'employee_count': 0,
                    'employees': []
                }

            summary = components_summary[comp_code]
            summary['total_amount'] += detail.amount or Decimal('0')
            summary['employee_count'] += 1

            emp = detail.payroll_item.employee
            summary['employees'].append({
                'employee_number': emp.employee_number,
                'employee_name': emp.full_name,
                'department': emp.department.name if emp.department else '',
                'amount': float(detail.amount or 0),
            })

        # Convert Decimals
        for comp_code, summary in components_summary.items():
            summary['total_amount'] = float(summary['total_amount'])

        return Response({
            'payroll_period': run.payroll_period.name if run.payroll_period else run.run_date.strftime('%B %Y'),
            'run_id': str(run.id),
            'components': list(components_summary.values()),
            'generated_at': timezone.now()
        })


class RentDeductionsReportView(APIView):
    """
    Rent deductions report.
    GET /api/v1/reports/payroll/rent-deductions/
    """

    def get(self, request):
        from payroll.models import PayComponent, PayrollItemDetail
        from decimal import Decimal

        run_id = request.query_params.get('run_id')
        period_id = request.query_params.get('period_id')

        # Get rent-related components
        rent_components = PayComponent.objects.filter(
            Q(code__icontains='RENT') |
            Q(name__icontains='rent') |
            Q(name__icontains='housing'),
            component_type='DEDUCTION',
            is_active=True
        )

        component_ids = list(rent_components.values_list('id', flat=True))

        # Get payroll run
        run = None
        if run_id:
            run = PayrollRun.objects.filter(id=run_id).first()
        elif period_id:
            from payroll.models import PayrollPeriod
            period = PayrollPeriod.objects.filter(id=period_id).first()
            if period:
                run = PayrollRun.objects.filter(
                    payroll_period=period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()
        else:
            run = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).order_by('-run_date').first()

        if not run:
            return Response({
                'message': 'No payroll run found',
                'generated_at': timezone.now()
            })

        # Get rent deduction details
        details = PayrollItemDetail.objects.filter(
            payroll_item__payroll_run=run,
            pay_component_id__in=component_ids
        ).select_related(
            'payroll_item__employee',
            'payroll_item__employee__department',
            'payroll_item__employee__work_location',
            'pay_component'
        )

        total_deductions = Decimal('0')
        employees = []

        for detail in details:
            emp = detail.payroll_item.employee
            amount = detail.amount or Decimal('0')
            total_deductions += amount

            employees.append({
                'employee_number': emp.employee_number,
                'employee_name': emp.full_name,
                'department': emp.department.name if emp.department else '',
                'location': emp.work_location.name if emp.work_location else '',
                'component': detail.pay_component.name,
                'amount': float(amount),
            })

        # Sort by department
        employees.sort(key=lambda x: x['department'])

        return Response({
            'payroll_period': run.payroll_period.name if run.payroll_period else run.run_date.strftime('%B %Y'),
            'run_id': str(run.id),
            'total_rent_deductions': float(total_deductions),
            'employee_count': len(employees),
            'employees': employees,
            'generated_at': timezone.now()
        })


class PayrollJournalView(APIView):
    """
    Payroll Journal/Posting report for accounting.
    GET /api/v1/reports/payroll/journal/
    """

    def get(self, request):
        from payroll.models import PayComponent, PayrollItemDetail
        from decimal import Decimal

        run_id = request.query_params.get('run_id')
        period_id = request.query_params.get('period_id')
        group_by = request.query_params.get('group_by', 'component')  # component, department, cost_center

        # Get payroll run
        run = None
        if run_id:
            run = PayrollRun.objects.filter(id=run_id).first()
        elif period_id:
            from payroll.models import PayrollPeriod
            period = PayrollPeriod.objects.filter(id=period_id).first()
            if period:
                run = PayrollRun.objects.filter(
                    payroll_period=period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()
        else:
            run = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).order_by('-run_date').first()

        if not run:
            return Response({
                'message': 'No payroll run found',
                'generated_at': timezone.now()
            })

        # Get all payroll details
        details = PayrollItemDetail.objects.filter(
            payroll_item__payroll_run=run
        ).select_related(
            'payroll_item__employee',
            'payroll_item__employee__department',
            'payroll_item__employee__cost_center',
            'pay_component'
        )

        # Build journal entries
        journal_entries = {}
        total_debits = Decimal('0')
        total_credits = Decimal('0')

        for detail in details:
            comp = detail.pay_component
            emp = detail.payroll_item.employee
            amount = detail.amount or Decimal('0')

            if amount == 0:
                continue

            # Determine debit/credit based on component type
            is_earning = comp.component_type == 'EARNING'
            is_employer_contrib = comp.component_type == 'EMPLOYER'

            if group_by == 'component':
                key = comp.code
                name = f"{comp.code} - {comp.name}"
            elif group_by == 'department':
                dept = emp.department
                key = str(dept.id) if dept else 'UNKNOWN'
                name = dept.name if dept else 'Unknown Department'
            else:  # cost_center
                cc = emp.cost_center
                key = str(cc.id) if cc else 'UNKNOWN'
                name = cc.name if cc else 'Unknown Cost Center'

            if key not in journal_entries:
                journal_entries[key] = {
                    'code': key,
                    'name': name,
                    'component_type': comp.component_type if group_by == 'component' else 'MIXED',
                    'debit': Decimal('0'),
                    'credit': Decimal('0'),
                }

            entry = journal_entries[key]

            if is_earning or is_employer_contrib:
                # Earnings are expenses (debits)
                entry['debit'] += amount
                total_debits += amount
            else:
                # Deductions are liabilities (credits)
                entry['credit'] += amount
                total_credits += amount

        # Net pay entry (credit to bank/cash)
        net_pay = Decimal(run.total_net or 0)
        journal_entries['NET_PAY'] = {
            'code': 'NET_PAY',
            'name': 'Net Pay - Bank/Cash',
            'component_type': 'NET',
            'debit': Decimal('0'),
            'credit': net_pay,
        }
        total_credits += net_pay

        # Convert to list and format
        entries_list = []
        for key, entry in journal_entries.items():
            entries_list.append({
                'code': entry['code'],
                'name': entry['name'],
                'component_type': entry['component_type'],
                'debit': float(entry['debit']) if entry['debit'] > 0 else None,
                'credit': float(entry['credit']) if entry['credit'] > 0 else None,
            })

        # Sort by component type (EARNING first, then DEDUCTION, then NET)
        type_order = {'EARNING': 0, 'EMPLOYER': 1, 'DEDUCTION': 2, 'MIXED': 3, 'NET': 4}
        entries_list.sort(key=lambda x: (type_order.get(x['component_type'], 99), x['code']))

        return Response({
            'payroll_period': run.payroll_period.name if run.payroll_period else run.run_date.strftime('%B %Y'),
            'run_id': str(run.id),
            'run_date': run.run_date,
            'group_by': group_by,
            'journal_entries': entries_list,
            'total_debits': float(total_debits),
            'total_credits': float(total_credits),
            'is_balanced': abs(total_debits - total_credits) < Decimal('0.01'),
            'generated_at': timezone.now()
        })


class CarLoanInterestReportView(APIView):
    """
    Car Loan Interest Report (monthly and yearly).
    GET /api/v1/reports/payroll/car-loan-interest/
    """

    def get(self, request):
        from benefits.models import LoanAccount, LoanType, LoanSchedule, LoanTransaction
        from decimal import Decimal

        year = int(request.query_params.get('year', timezone.now().year))
        month = request.query_params.get('month')

        # Get car loan types
        car_loan_types = LoanType.objects.filter(
            Q(code__icontains='CAR') |
            Q(name__icontains='car') |
            Q(name__icontains='vehicle') |
            Q(name__icontains='auto'),
            is_active=True
        )

        if not car_loan_types.exists():
            return Response({
                'message': 'No car loan types configured',
                'generated_at': timezone.now()
            })

        # Get active car loans
        loans_qs = LoanAccount.objects.filter(
            loan_type__in=car_loan_types,
            status__in=['ACTIVE', 'DISBURSED', 'COMPLETED']
        ).select_related('employee', 'employee__department', 'loan_type')

        # Calculate interest for each loan
        loan_details = []
        total_principal = Decimal('0')
        total_interest_paid = Decimal('0')
        total_interest_outstanding = Decimal('0')

        for loan in loans_qs:
            # Get interest from transactions
            interest_transactions = LoanTransaction.objects.filter(
                loan_account=loan,
                transaction_type='INTEREST'
            )

            if month:
                interest_transactions = interest_transactions.filter(
                    transaction_date__year=year,
                    transaction_date__month=int(month)
                )
            else:
                interest_transactions = interest_transactions.filter(
                    transaction_date__year=year
                )

            interest_paid = interest_transactions.aggregate(
                total=Sum('amount')
            )['total'] or Decimal('0')

            # Calculate outstanding interest from schedule
            schedule_interest = LoanSchedule.objects.filter(
                loan_account=loan,
                status__in=['PENDING', 'PARTIAL']
            ).aggregate(
                total=Sum('interest_amount')
            )['total'] or Decimal('0')

            total_principal += loan.principal_amount or Decimal('0')
            total_interest_paid += interest_paid
            total_interest_outstanding += schedule_interest

            loan_details.append({
                'employee_number': loan.employee.employee_number,
                'employee_name': loan.employee.full_name,
                'department': loan.employee.department.name if loan.employee.department else '',
                'loan_number': loan.loan_number,
                'loan_type': loan.loan_type.name,
                'principal_amount': float(loan.principal_amount or 0),
                'interest_rate': float(loan.loan_type.interest_rate),
                'interest_paid': float(interest_paid),
                'interest_outstanding': float(schedule_interest),
                'outstanding_balance': float(loan.outstanding_balance or 0),
                'start_date': loan.start_date,
            })

        return Response({
            'year': year,
            'month': int(month) if month else None,
            'loan_types': [lt.name for lt in car_loan_types],
            'total_loans': len(loan_details),
            'total_principal': float(total_principal),
            'total_interest_paid': float(total_interest_paid),
            'total_interest_outstanding': float(total_interest_outstanding),
            'loans': loan_details,
            'generated_at': timezone.now()
        })


class StudentLoanReportView(APIView):
    """
    Student Loan Deductions Report.
    GET /api/v1/reports/payroll/student-loans/
    """

    def get(self, request):
        from benefits.models import LoanAccount, LoanType
        from payroll.models import PayComponent, PayrollItemDetail
        from decimal import Decimal

        run_id = request.query_params.get('run_id')
        period_id = request.query_params.get('period_id')

        # Get student loan types
        student_loan_types = LoanType.objects.filter(
            Q(code__icontains='STUDENT') |
            Q(name__icontains='student') |
            Q(name__icontains='education') |
            Q(name__icontains='sltf'),  # Student Loan Trust Fund
            is_active=True
        )

        # Also check for student loan pay components
        student_loan_components = PayComponent.objects.filter(
            Q(code__icontains='STUDENT') |
            Q(name__icontains='student') |
            Q(name__icontains='sltf'),
            component_type='DEDUCTION',
            is_active=True
        )

        # Get payroll run
        run = None
        if run_id:
            run = PayrollRun.objects.filter(id=run_id).first()
        elif period_id:
            from payroll.models import PayrollPeriod
            period = PayrollPeriod.objects.filter(id=period_id).first()
            if period:
                run = PayrollRun.objects.filter(
                    payroll_period=period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()
        else:
            run = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).order_by('-run_date').first()

        # Get student loans from loan accounts
        student_loans = LoanAccount.objects.filter(
            loan_type__in=student_loan_types,
            status__in=['ACTIVE', 'DISBURSED']
        ).select_related('employee', 'employee__department', 'loan_type')

        employees = []
        total_deduction = Decimal('0')

        for loan in student_loans:
            monthly_deduction = loan.monthly_deduction or Decimal('0')
            total_deduction += monthly_deduction

            employees.append({
                'employee_number': loan.employee.employee_number,
                'employee_name': loan.employee.full_name,
                'department': loan.employee.department.name if loan.employee.department else '',
                'loan_number': loan.loan_number,
                'source': 'INTERNAL',
                'principal_amount': float(loan.principal_amount or 0),
                'outstanding_balance': float(loan.outstanding_balance or 0),
                'monthly_deduction': float(monthly_deduction),
            })

        # Also get from payroll deductions (external SLTF)
        if run and student_loan_components.exists():
            component_ids = list(student_loan_components.values_list('id', flat=True))

            details = PayrollItemDetail.objects.filter(
                payroll_item__payroll_run=run,
                pay_component_id__in=component_ids
            ).select_related(
                'payroll_item__employee',
                'payroll_item__employee__department',
                'pay_component'
            )

            for detail in details:
                emp = detail.payroll_item.employee
                amount = detail.amount or Decimal('0')

                # Check if already in list
                existing = next(
                    (e for e in employees if e['employee_number'] == emp.employee_number),
                    None
                )
                if not existing:
                    total_deduction += amount
                    employees.append({
                        'employee_number': emp.employee_number,
                        'employee_name': emp.full_name,
                        'department': emp.department.name if emp.department else '',
                        'loan_number': 'N/A',
                        'source': 'EXTERNAL/SLTF',
                        'principal_amount': None,
                        'outstanding_balance': None,
                        'monthly_deduction': float(amount),
                    })

        return Response({
            'payroll_period': run.payroll_period.name if run and run.payroll_period else None,
            'total_deductions': float(total_deduction),
            'employee_count': len(employees),
            'employees': employees,
            'generated_at': timezone.now()
        })


class ExportDuesReportView(APIView):
    """Export dues report to CSV/Excel/PDF."""

    def get(self, request):
        from .exports import ReportExporter
        from payroll.models import PayComponent, PayrollItemDetail
        from django.db.models import Q

        component_code = request.query_params.get('component_code')
        # Use file_format instead of format to avoid DRF content negotiation conflict
        format_type = request.query_params.get('file_format', request.query_params.get('format', 'csv'))
        run_id = request.query_params.get('run_id')

        # Get deduction components of FUND category or matching code
        components_qs = PayComponent.objects.filter(
            component_type='DEDUCTION',
            is_active=True
        )

        if component_code:
            components_qs = components_qs.filter(code__icontains=component_code)
        else:
            components_qs = components_qs.filter(
                Q(category='FUND') |
                Q(code__icontains='PAWU') |
                Q(code__icontains='UNICOF') |
                Q(code__icontains='CREDIT') |
                Q(code__icontains='UNION') |
                Q(name__icontains='dues') |
                Q(name__icontains='fund')
            )

        component_ids = list(components_qs.values_list('id', flat=True))

        # Get payroll run
        if run_id:
            run = PayrollRun.objects.filter(id=run_id).first()
        else:
            run = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).order_by('-run_date').first()

        if not run:
            return Response({'message': 'No payroll run found'}, status=404)

        # Get deduction details for these components
        details = PayrollItemDetail.objects.filter(
            payroll_item__payroll_run=run,
            pay_component_id__in=component_ids,
            amount__gt=0
        ).select_related(
            'payroll_item__employee',
            'payroll_item__employee__department',
            'pay_component'
        ).order_by('pay_component__code', 'payroll_item__employee__employee_number')

        if not details.exists():
            return Response({'message': 'No dues data found'}, status=404)

        # Flatten for export
        rows = []
        for detail in details:
            emp = detail.payroll_item.employee
            rows.append({
                'Component Code': detail.pay_component.code,
                'Component Name': detail.pay_component.name,
                'Employee Number': emp.employee_number,
                'Employee Name': emp.full_name,
                'Department': emp.department.name if emp.department else '',
                'Amount': float(detail.amount),
            })

        headers = ['Component Code', 'Component Name', 'Employee Number', 'Employee Name', 'Department', 'Amount']
        period_name = run.payroll_period.name if run.payroll_period else run.run_number
        filename = f"dues_report_{period_name.replace(' ', '_')}"

        return ReportExporter.export_data(rows, headers, filename, format_type)


class PayrollJournalReportView(APIView):
    """
    Payroll Journal Report - accounting entries for payroll.

    Format matches standard payroll journal:
    - Credits: Deductions, liabilities (Tax, SSF, Loans, Net Pay)
    - Debits: Earnings, expenses (Salaries, Allowances, Employer Contributions)
    """

    def get(self, request):
        from payroll.models import PayComponent, PayrollItemDetail, PayrollItem
        from django.db.models import Sum
        from decimal import Decimal

        run_id = request.query_params.get('run_id')

        # Get payroll run
        if run_id:
            run = PayrollRun.objects.filter(id=run_id).first()
        else:
            run = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).order_by('-run_date').first()

        if not run:
            return Response({'message': 'No payroll run found'}, status=404)

        # Get aggregated amounts by component
        details = PayrollItemDetail.objects.filter(
            payroll_item__payroll_run=run,
            amount__gt=0
        ).values(
            'pay_component__code',
            'pay_component__name',
            'pay_component__component_type',
        ).annotate(
            total_amount=Sum('amount')
        ).order_by('pay_component__name')

        if not details.exists():
            return Response({'message': 'No journal data found'}, status=404)

        # Get aggregates from PayrollItem (includes net pay, employee SSF, and employer contributions)
        item_totals = PayrollItem.objects.filter(
            payroll_run=run
        ).aggregate(
            net_pay=Sum('net_salary'),
            ssnit_employee=Sum('ssnit_employee'),
            ssnit_employer=Sum('ssnit_employer'),
            tier2_employer=Sum('tier2_employer'),
        )
        net_pay = item_totals['net_pay'] or Decimal('0')
        ssnit_employee = item_totals['ssnit_employee'] or Decimal('0')
        ssnit_employer = item_totals['ssnit_employer'] or Decimal('0')
        tier2_employer = item_totals['tier2_employer'] or Decimal('0')

        # Build journal entries
        # Accounting treatment (double-entry):
        # - Earnings: Debit (Salary Expense)
        # - Employer Contributions: Debit (Expense) AND Credit (Liability)
        # - Deductions: Credit (Liability)
        # - Net Pay: Credit (Bank/Cash)
        credit_entries = []
        debit_entries = []
        total_credits = Decimal('0')
        total_debits = Decimal('0')

        for detail in details:
            amount = detail['total_amount'] or Decimal('0')
            component_type = detail['pay_component__component_type']
            account_code = detail['pay_component__code']
            account_name = detail['pay_component__name']

            if component_type == 'EARNING':
                # Earnings go to debit only (salary expense)
                debit_entries.append({
                    'account_code': account_code,
                    'account_name': account_name,
                    'component_type': component_type,
                    'credit_amount': None,
                    'debit_amount': float(amount),
                })
                total_debits += amount
            else:
                # Deductions go to credit (liability)
                credit_entries.append({
                    'account_code': account_code,
                    'account_name': account_name,
                    'component_type': component_type,
                    'credit_amount': float(amount),
                    'debit_amount': None,
                })
                total_credits += amount

        # Add SSNIT employee contribution (stored on PayrollItem, not in details)
        if ssnit_employee > 0:
            credit_entries.append({
                'account_code': 'SSF_EMP',
                'account_name': 'Employee SSF Contribution (5.5%)',
                'component_type': 'DEDUCTION',
                'credit_amount': float(ssnit_employee),
                'debit_amount': None,
            })
            total_credits += ssnit_employee

        # Add employer contributions (from PayrollItem) - both Debit AND Credit
        if ssnit_employer > 0:
            # SSNIT Employer - Debit (expense)
            debit_entries.append({
                'account_code': 'SSF_EMPR',
                'account_name': 'Employer SSF Contribution (13%)',
                'component_type': 'EMPLOYER',
                'credit_amount': None,
                'debit_amount': float(ssnit_employer),
            })
            total_debits += ssnit_employer
            # SSNIT Employer - Credit (liability)
            credit_entries.append({
                'account_code': 'SSF_EMPR',
                'account_name': 'Employer SSF Contribution (13%)',
                'component_type': 'EMPLOYER',
                'credit_amount': float(ssnit_employer),
                'debit_amount': None,
            })
            total_credits += ssnit_employer

        if tier2_employer > 0:
            # Tier 2 Employer - Debit (expense)
            debit_entries.append({
                'account_code': 'TIER2_EMPR',
                'account_name': 'Tier 2 Pension (Employer)',
                'component_type': 'EMPLOYER',
                'credit_amount': None,
                'debit_amount': float(tier2_employer),
            })
            total_debits += tier2_employer
            # Tier 2 Employer - Credit (liability)
            credit_entries.append({
                'account_code': 'TIER2_EMPR',
                'account_name': 'Tier 2 Pension (Employer)',
                'component_type': 'EMPLOYER',
                'credit_amount': float(tier2_employer),
                'debit_amount': None,
            })
            total_credits += tier2_employer

        # Add Bank/Cash Payment as credit entry (balancing entry)
        bank_payment_entry = {
            'account_code': 'BANK_CASH',
            'account_name': 'Bank/Cash Payment',
            'component_type': 'PAYMENT',
            'credit_amount': float(net_pay),
            'debit_amount': None,
        }
        credit_entries.insert(0, bank_payment_entry)
        total_credits += net_pay

        # Combine: Credits first, then Debits
        all_entries = credit_entries + debit_entries

        # Period info
        period_name = run.payroll_period.name if run.payroll_period else run.run_number
        period_start = run.payroll_period.start_date if run.payroll_period else None
        period_end = run.payroll_period.end_date if run.payroll_period else None

        return Response({
            'success': True,
            'data': {
                'period': {
                    'name': period_name,
                    'start_date': period_start,
                    'end_date': period_end,
                    'run_id': str(run.id),
                    'run_number': run.run_number,
                    'run_date': run.run_date,
                    'status': run.status,
                },
                'entries': all_entries,
                'summary': {
                    'total_credits': float(total_credits),
                    'total_debits': float(total_debits),
                    'is_balanced': abs(total_credits - total_debits) < Decimal('0.01'),
                    'variance': float(abs(total_credits - total_debits)),
                },
                'meta': {
                    'credit_count': len(credit_entries),
                    'debit_count': len(debit_entries),
                    'total_entries': len(all_entries),
                }
            }
        })


class ExportPayrollJournalView(APIView):
    """Export payroll journal to CSV/Excel/PDF matching GTP format."""

    def get(self, request):
        from .exports import ReportExporter
        from payroll.models import PayComponent, PayrollItemDetail, PayrollItem
        from django.db.models import Sum
        from decimal import Decimal

        # Use file_format instead of format to avoid DRF content negotiation conflict
        format_type = request.query_params.get('file_format', request.query_params.get('format', 'csv'))
        run_id = request.query_params.get('run_id')

        # Get payroll run
        if run_id:
            run = PayrollRun.objects.filter(id=run_id).first()
        else:
            run = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).order_by('-run_date').first()

        if not run:
            return Response({'message': 'No payroll run found'}, status=404)

        # Get aggregated amounts by component
        details = PayrollItemDetail.objects.filter(
            payroll_item__payroll_run=run,
            amount__gt=0
        ).values(
            'pay_component__code',
            'pay_component__name',
            'pay_component__component_type',
        ).annotate(
            total_amount=Sum('amount')
        ).order_by('pay_component__name')

        if not details.exists():
            return Response({'message': 'No journal data found'}, status=404)

        # Get aggregates from PayrollItem (includes net pay, employee SSF, and employer contributions)
        item_totals = PayrollItem.objects.filter(
            payroll_run=run
        ).aggregate(
            net_pay=Sum('net_salary'),
            ssnit_employee=Sum('ssnit_employee'),
            ssnit_employer=Sum('ssnit_employer'),
            tier2_employer=Sum('tier2_employer'),
        )
        net_pay = item_totals['net_pay'] or Decimal('0')
        ssnit_employee = item_totals['ssnit_employee'] or Decimal('0')
        ssnit_employer = item_totals['ssnit_employer'] or Decimal('0')
        tier2_employer = item_totals['tier2_employer'] or Decimal('0')

        # Build journal entries - Credits first, then Debits
        # Accounting treatment (double-entry):
        # - Earnings: Debit (Salary Expense)
        # - Employer Contributions: Debit (Expense) AND Credit (Liability)
        # - Deductions: Credit (Liability)
        # - Net Pay: Credit (Bank/Cash)
        credit_rows = []
        debit_rows = []
        total_credits = Decimal('0')
        total_debits = Decimal('0')

        for detail in details:
            amount = detail['total_amount'] or Decimal('0')
            component_type = detail['pay_component__component_type']
            account_name = detail['pay_component__name']

            if component_type == 'EARNING':
                # Earnings go to debit only (salary expense)
                debit_rows.append({
                    'Account Name': account_name,
                    'Credit Amount': '',
                    'Debit Amount': float(amount),
                })
                total_debits += amount
            else:
                # Deductions go to credit (liability)
                credit_rows.append({
                    'Account Name': account_name,
                    'Credit Amount': float(amount),
                    'Debit Amount': '',
                })
                total_credits += amount

        # Add SSNIT employee contribution (stored on PayrollItem, not in details)
        if ssnit_employee > 0:
            credit_rows.append({
                'Account Name': 'Employee SSF Contribution (5.5%)',
                'Credit Amount': float(ssnit_employee),
                'Debit Amount': '',
            })
            total_credits += ssnit_employee

        # Add employer contributions (from PayrollItem) - both Debit AND Credit
        if ssnit_employer > 0:
            debit_rows.append({
                'Account Name': 'Employer SSF Contribution (13%)',
                'Credit Amount': '',
                'Debit Amount': float(ssnit_employer),
            })
            total_debits += ssnit_employer
            credit_rows.append({
                'Account Name': 'Employer SSF Contribution (13%)',
                'Credit Amount': float(ssnit_employer),
                'Debit Amount': '',
            })
            total_credits += ssnit_employer

        if tier2_employer > 0:
            debit_rows.append({
                'Account Name': 'Tier 2 Pension (Employer)',
                'Credit Amount': '',
                'Debit Amount': float(tier2_employer),
            })
            total_debits += tier2_employer
            credit_rows.append({
                'Account Name': 'Tier 2 Pension (Employer)',
                'Credit Amount': float(tier2_employer),
                'Debit Amount': '',
            })
            total_credits += tier2_employer

        # Add Bank/Cash Payment as first credit entry
        credit_rows.insert(0, {
            'Account Name': 'Bank/Cash Payment',
            'Credit Amount': float(net_pay),
            'Debit Amount': '',
        })
        total_credits += net_pay

        # Combine rows: Credits first, then Debits
        rows = credit_rows + debit_rows

        # Add TOTAL row
        rows.append({
            'Account Name': 'TOTAL',
            'Credit Amount': float(total_credits),
            'Debit Amount': float(total_debits),
        })

        headers = ['Account Name', 'Credit Amount', 'Debit Amount']
        period_name = run.payroll_period.name if run.payroll_period else run.run_number
        filename = f"payroll_journal_{period_name.replace(' ', '_')}"
        title = f"Payroll Journal - {period_name}"

        return ReportExporter.export_data(rows, headers, filename, format_type, title=title)


class SalaryReconciliationView(APIView):
    """
    Salary Reconciliation Report matching GTP format.

    Shows period-to-period changes:
    - Non-recurring earnings (add/subtract)
    - Recurring earnings changes
    - New employees (additions)
    - Removed employees (deletions)
    - Final gross salary
    """

    def get(self, request):
        from decimal import Decimal
        from collections import defaultdict
        from payroll.models import PayrollPeriod, PayComponent, PayrollItemDetail

        current_period_id = request.query_params.get('current_period')
        previous_period_id = request.query_params.get('previous_period')

        # Get payroll runs
        if current_period_id and previous_period_id:
            try:
                current_period = PayrollPeriod.objects.get(id=current_period_id)
                previous_period = PayrollPeriod.objects.get(id=previous_period_id)

                current_run = PayrollRun.objects.filter(
                    payroll_period=current_period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()

                previous_run = PayrollRun.objects.filter(
                    payroll_period=previous_period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()

            except PayrollPeriod.DoesNotExist:
                return Response({'message': 'Invalid period IDs'}, status=404)
        else:
            # Default to last two periods
            runs = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).select_related('payroll_period').order_by('-payroll_period__year', '-payroll_period__month')[:2]

            if len(runs) < 2:
                return Response({
                    'message': 'Need at least two completed payroll periods for reconciliation'
                }, status=404)

            current_run = runs[0]
            previous_run = runs[1]

        if not current_run or not previous_run:
            return Response({'message': 'No completed payroll runs found'}, status=404)

        def safe_decimal(val):
            return Decimal(str(val)) if val else Decimal('0')

        # Get recurring vs non-recurring components
        recurring_codes = set(PayComponent.objects.filter(
            is_active=True, is_recurring=True
        ).values_list('code', flat=True))

        non_recurring_codes = set(PayComponent.objects.filter(
            is_active=True, is_recurring=False, component_type='EARNING'
        ).values_list('code', flat=True))

        # Get current period items
        current_items = {}
        current_details = defaultdict(dict)
        for item in PayrollItem.objects.filter(payroll_run=current_run).select_related(
            'employee'
        ).prefetch_related('details__pay_component'):
            current_items[item.employee_id] = item
            for detail in item.details.all():
                current_details[item.employee_id][detail.pay_component.code] = {
                    'amount': safe_decimal(detail.amount),
                    'name': detail.pay_component.name,
                    'is_recurring': detail.pay_component.is_recurring,
                }

        # Get previous period items
        previous_items = {}
        previous_details = defaultdict(dict)
        for item in PayrollItem.objects.filter(payroll_run=previous_run).select_related(
            'employee'
        ).prefetch_related('details__pay_component'):
            previous_items[item.employee_id] = item
            for detail in item.details.all():
                previous_details[item.employee_id][detail.pay_component.code] = {
                    'amount': safe_decimal(detail.amount),
                    'name': detail.pay_component.name,
                    'is_recurring': detail.pay_component.is_recurring,
                }

        all_emp_ids = set(current_items.keys()) | set(previous_items.keys())

        # Calculate totals
        prev_gross = safe_decimal(previous_run.total_gross)
        curr_gross = safe_decimal(current_run.total_gross)

        # Track changes
        additions = []  # New employees
        deletions = []  # Removed employees
        non_recurring_add = []  # Non-recurring earnings to add
        non_recurring_less = []  # Non-recurring earnings to subtract
        recurring_changes = []  # Changes in recurring earnings

        total_additions = Decimal('0')
        total_deletions = Decimal('0')
        total_non_recurring_add = Decimal('0')
        total_non_recurring_less = Decimal('0')
        total_recurring_changes = Decimal('0')

        for emp_id in all_emp_ids:
            curr_item = current_items.get(emp_id)
            prev_item = previous_items.get(emp_id)
            curr_comps = current_details.get(emp_id, {})
            prev_comps = previous_details.get(emp_id, {})

            if curr_item and not prev_item:
                # New employee - Addition
                emp = curr_item.employee
                basic = safe_decimal(curr_item.basic_salary)
                additions.append({
                    'employee_name': emp.full_name,
                    'amount': float(basic),
                })
                total_additions += basic

            elif prev_item and not curr_item:
                # Removed employee - Deletion
                emp = prev_item.employee
                basic = safe_decimal(prev_item.basic_salary)
                deletions.append({
                    'employee_name': emp.full_name,
                    'amount': float(basic),
                })
                total_deletions += basic

            elif curr_item and prev_item:
                # Existing employee - check for changes
                emp = curr_item.employee

                # Check non-recurring earnings in current period
                for code, detail in curr_comps.items():
                    if not detail['is_recurring'] and detail['amount'] > 0:
                        prev_amt = prev_comps.get(code, {}).get('amount', Decimal('0'))
                        if detail['amount'] != prev_amt:
                            non_recurring_add.append({
                                'description': detail['name'],
                                'amount': float(detail['amount']),
                            })
                            total_non_recurring_add += detail['amount']

                # Check non-recurring that were in previous but not current
                for code, detail in prev_comps.items():
                    if not detail['is_recurring'] and detail['amount'] > 0:
                        if code not in curr_comps or curr_comps[code]['amount'] == 0:
                            non_recurring_less.append({
                                'description': detail['name'],
                                'amount': float(detail['amount']),
                            })
                            total_non_recurring_less += detail['amount']

                # Check recurring earnings changes (basic salary changes)
                curr_basic = safe_decimal(curr_item.basic_salary)
                prev_basic = safe_decimal(prev_item.basic_salary)
                if curr_basic != prev_basic:
                    diff = curr_basic - prev_basic
                    recurring_changes.append({
                        'employee_name': emp.full_name,
                        'previous_amount': float(prev_basic),
                        'current_amount': float(curr_basic),
                        'change': float(diff),
                    })
                    total_recurring_changes += diff

        # Build response
        return Response({
            'success': True,
            'data': {
                'periods': {
                    'current': {
                        'name': current_run.payroll_period.name if current_run.payroll_period else current_run.run_number,
                        'run_id': str(current_run.id),
                        'gross': float(curr_gross),
                    },
                    'previous': {
                        'name': previous_run.payroll_period.name if previous_run.payroll_period else previous_run.run_number,
                        'run_id': str(previous_run.id),
                        'gross': float(prev_gross),
                    },
                },
                'reconciliation': {
                    'previous_gross': float(prev_gross),
                    'less_non_recurring': {
                        'items': non_recurring_less if non_recurring_less else [{'description': 'NO TRANSACTION', 'amount': 0}],
                        'total': float(total_non_recurring_less),
                    },
                    'basic_plus_recurring': float(prev_gross - total_non_recurring_less),
                    'add_non_recurring': {
                        'items': non_recurring_add if non_recurring_add else [{'description': 'NO TRANSACTION', 'amount': 0}],
                        'total': float(total_non_recurring_add),
                    },
                    'change_in_recurring': {
                        'items': recurring_changes if recurring_changes else [{'description': 'NO TRANSACTION', 'change': 0}],
                        'total': float(total_recurring_changes),
                    },
                    'additions': {
                        'items': additions if additions else [{'employee_name': 'NO ADDITIONS', 'amount': 0}],
                        'total': float(total_additions),
                    },
                    'deletions': {
                        'items': deletions if deletions else [{'employee_name': 'NO DELETIONS', 'amount': 0}],
                        'total': float(total_deletions),
                    },
                    'current_gross': float(curr_gross),
                },
                'summary': {
                    'previous_gross': float(prev_gross),
                    'less_non_recurring': float(total_non_recurring_less),
                    'add_non_recurring': float(total_non_recurring_add),
                    'recurring_changes': float(total_recurring_changes),
                    'additions': float(total_additions),
                    'deletions': float(total_deletions),
                    'calculated_gross': float(
                        prev_gross - total_non_recurring_less + total_non_recurring_add +
                        total_recurring_changes + total_additions - total_deletions
                    ),
                    'actual_gross': float(curr_gross),
                    'variance': float(
                        curr_gross - (prev_gross - total_non_recurring_less + total_non_recurring_add +
                        total_recurring_changes + total_additions - total_deletions)
                    ),
                },
            }
        })


class ExportSalaryReconciliationView(APIView):
    """Export salary reconciliation to CSV/Excel/PDF matching GTP format."""

    def get(self, request):
        from .exports import ReportExporter
        from decimal import Decimal
        from collections import defaultdict
        from payroll.models import PayrollPeriod, PayComponent

        format_type = request.query_params.get('file_format', request.query_params.get('format', 'csv'))
        current_period_id = request.query_params.get('current_period')
        previous_period_id = request.query_params.get('previous_period')

        # Get payroll runs (same logic as above)
        if current_period_id and previous_period_id:
            try:
                current_period = PayrollPeriod.objects.get(id=current_period_id)
                previous_period = PayrollPeriod.objects.get(id=previous_period_id)

                current_run = PayrollRun.objects.filter(
                    payroll_period=current_period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()

                previous_run = PayrollRun.objects.filter(
                    payroll_period=previous_period,
                    status__in=['COMPUTED', 'APPROVED', 'PAID']
                ).order_by('-run_date').first()

            except PayrollPeriod.DoesNotExist:
                return Response({'message': 'Invalid period IDs'}, status=404)
        else:
            runs = PayrollRun.objects.filter(
                status__in=['COMPUTED', 'APPROVED', 'PAID']
            ).select_related('payroll_period').order_by('-payroll_period__year', '-payroll_period__month')[:2]

            if len(runs) < 2:
                return Response({'message': 'Need at least two completed payroll periods'}, status=404)

            current_run = runs[0]
            previous_run = runs[1]

        if not current_run or not previous_run:
            return Response({'message': 'No completed payroll runs found'}, status=404)

        def safe_decimal(val):
            return Decimal(str(val)) if val else Decimal('0')

        # Get current and previous items
        current_items = {}
        current_details = defaultdict(dict)
        for item in PayrollItem.objects.filter(payroll_run=current_run).select_related(
            'employee'
        ).prefetch_related('details__pay_component'):
            current_items[item.employee_id] = item
            for detail in item.details.all():
                current_details[item.employee_id][detail.pay_component.code] = {
                    'amount': safe_decimal(detail.amount),
                    'name': detail.pay_component.name,
                    'is_recurring': detail.pay_component.is_recurring,
                }

        previous_items = {}
        previous_details = defaultdict(dict)
        for item in PayrollItem.objects.filter(payroll_run=previous_run).select_related(
            'employee'
        ).prefetch_related('details__pay_component'):
            previous_items[item.employee_id] = item
            for detail in item.details.all():
                previous_details[item.employee_id][detail.pay_component.code] = {
                    'amount': safe_decimal(detail.amount),
                    'name': detail.pay_component.name,
                    'is_recurring': detail.pay_component.is_recurring,
                }

        all_emp_ids = set(current_items.keys()) | set(previous_items.keys())

        prev_gross = safe_decimal(previous_run.total_gross)
        curr_gross = safe_decimal(current_run.total_gross)

        # Track changes
        additions = []
        deletions = []
        non_recurring_add = []
        non_recurring_less = []

        total_additions = Decimal('0')
        total_deletions = Decimal('0')
        total_non_recurring_add = Decimal('0')
        total_non_recurring_less = Decimal('0')

        for emp_id in all_emp_ids:
            curr_item = current_items.get(emp_id)
            prev_item = previous_items.get(emp_id)
            curr_comps = current_details.get(emp_id, {})
            prev_comps = previous_details.get(emp_id, {})

            if curr_item and not prev_item:
                emp = curr_item.employee
                basic = safe_decimal(curr_item.basic_salary)
                additions.append({
                    'Description': emp.full_name,
                    'Amount': float(basic),
                })
                total_additions += basic

            elif prev_item and not curr_item:
                emp = prev_item.employee
                basic = safe_decimal(prev_item.basic_salary)
                deletions.append({
                    'Description': emp.full_name,
                    'Amount': float(basic),
                })
                total_deletions += basic

            elif curr_item and prev_item:
                for code, detail in curr_comps.items():
                    if not detail['is_recurring'] and detail['amount'] > 0:
                        prev_amt = prev_comps.get(code, {}).get('amount', Decimal('0'))
                        if detail['amount'] != prev_amt:
                            non_recurring_add.append({
                                'Description': detail['name'],
                                'Amount': float(detail['amount']),
                            })
                            total_non_recurring_add += detail['amount']

                for code, detail in prev_comps.items():
                    if not detail['is_recurring'] and detail['amount'] > 0:
                        if code not in curr_comps or curr_comps[code]['amount'] == 0:
                            non_recurring_less.append({
                                'Description': detail['name'],
                                'Amount': float(detail['amount']),
                            })
                            total_non_recurring_less += detail['amount']

        # Build export rows
        rows = []

        # Get previous period name
        prev_period_name = previous_run.payroll_period.name if previous_run.payroll_period else previous_run.run_number

        # Section: Previous Month Gross Salary (Starting Point)
        rows.append({'Description': f'Previous Month Gross Salary ({prev_period_name})', 'Amount': '', 'Total': float(prev_gross)})
        rows.append({'Description': '', 'Amount': '', 'Total': ''})

        # Section: Less Non-Recurring Earnings
        rows.append({'Description': 'Less: Non-Recurring Earnings', 'Amount': '', 'Total': ''})
        if non_recurring_less:
            for item in non_recurring_less:
                rows.append({'Description': f"  {item['Description']}", 'Amount': item['Amount'], 'Total': ''})
        else:
            rows.append({'Description': '  NO TRANSACTION', 'Amount': 0, 'Total': ''})
        rows.append({'Description': '', 'Amount': '', 'Total': float(total_non_recurring_less)})
        rows.append({'Description': '', 'Amount': '', 'Total': ''})

        # Section: Basic Salary Plus Recurring Earnings
        basic_plus_recurring = prev_gross - total_non_recurring_less
        rows.append({'Description': 'Basic Salary Plus Recurring Earnings', 'Amount': '', 'Total': float(basic_plus_recurring)})
        rows.append({'Description': '', 'Amount': '', 'Total': ''})

        # Section: Add Non-Recurring Earnings
        rows.append({'Description': 'Add: Non-Recurring Earnings', 'Amount': '', 'Total': ''})
        if non_recurring_add:
            for item in non_recurring_add:
                rows.append({'Description': f"  {item['Description']}", 'Amount': item['Amount'], 'Total': ''})
        else:
            rows.append({'Description': '  NO TRANSACTION', 'Amount': 0, 'Total': ''})
        rows.append({'Description': '', 'Amount': '', 'Total': float(total_non_recurring_add)})
        rows.append({'Description': '', 'Amount': '', 'Total': ''})

        # Section: Additions
        rows.append({'Description': 'Additions (New Employees)', 'Amount': '', 'Total': ''})
        if additions:
            for item in sorted(additions, key=lambda x: x['Description']):
                rows.append({'Description': f"  {item['Description']}", 'Amount': item['Amount'], 'Total': ''})
        else:
            rows.append({'Description': '  NO ADDITIONS', 'Amount': 0, 'Total': ''})
        rows.append({'Description': '', 'Amount': '', 'Total': float(total_additions)})
        rows.append({'Description': '', 'Amount': '', 'Total': ''})

        # Section: Deletions
        rows.append({'Description': 'Less: Deletions (Separated Employees)', 'Amount': '', 'Total': ''})
        if deletions:
            for item in sorted(deletions, key=lambda x: x['Description']):
                rows.append({'Description': f"  {item['Description']}", 'Amount': item['Amount'], 'Total': ''})
        else:
            rows.append({'Description': '  NO DELETIONS', 'Amount': 0, 'Total': ''})
        rows.append({'Description': '', 'Amount': '', 'Total': float(total_deletions)})
        rows.append({'Description': '', 'Amount': '', 'Total': ''})

        # Get current period name
        current_period_name = current_run.payroll_period.name if current_run.payroll_period else current_run.run_number

        # Final Gross Salary - Current Month
        rows.append({'Description': f'Current Month Gross Salary ({current_period_name})', 'Amount': '', 'Total': float(curr_gross)})

        headers = ['Description', 'Amount', 'Total']
        filename = f"salary_reconciliation_{current_period_name.replace(' ', '_')}"
        title = f"Salary Reconciliation - {current_period_name}"

        return ReportExporter.export_data(rows, headers, filename, format_type, title=title)
