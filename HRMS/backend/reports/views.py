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
    export_leave_balance, export_loan_outstanding, export_payroll_master
)


class ExportEmployeeMasterView(APIView):
    """Export employee master report to CSV/Excel/PDF."""

    def get(self, request):
        filters = {
            'department': request.query_params.get('department'),
            'grade': request.query_params.get('grade'),
            'status': request.query_params.get('status'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_employee_master(filters, format=file_format)


class ExportHeadcountView(APIView):
    """Export headcount report to CSV/Excel/PDF."""

    def get(self, request):
        file_format = request.query_params.get('file_format', 'csv')
        return export_headcount(format=file_format)


class ExportPayrollSummaryView(APIView):
    """Export payroll summary to CSV/Excel/PDF."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        file_format = request.query_params.get('file_format', 'csv')
        return export_payroll_summary(payroll_run_id, format=file_format)


class ExportPAYEReportView(APIView):
    """Export PAYE tax report to CSV/Excel/PDF."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        file_format = request.query_params.get('file_format', 'csv')
        return export_paye_report(payroll_run_id, format=file_format)


class ExportSSNITReportView(APIView):
    """Export SSNIT contribution report to CSV/Excel/PDF."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        file_format = request.query_params.get('file_format', 'csv')
        return export_ssnit_report(payroll_run_id, format=file_format)


class ExportBankAdviceView(APIView):
    """Export bank advice report to CSV/Excel/PDF."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        file_format = request.query_params.get('file_format', 'csv')
        return export_bank_advice(payroll_run_id, format=file_format)


class ExportLeaveBalanceView(APIView):
    """Export leave balance report to CSV/Excel/PDF."""

    def get(self, request):
        filters = {
            'year': request.query_params.get('year'),
            'department': request.query_params.get('department'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_leave_balance(filters, format=file_format)


class ExportLoanOutstandingView(APIView):
    """Export outstanding loans report to CSV/Excel/PDF."""

    def get(self, request):
        filters = {
            'department': request.query_params.get('department'),
        }
        file_format = request.query_params.get('file_format', 'csv')
        return export_loan_outstanding(filters, format=file_format)


class ExportPayrollMasterView(APIView):
    """Export Payroll Master Report to CSV/Excel/PDF."""

    def get(self, request):
        payroll_run_id = request.query_params.get('payroll_run')
        department_id = request.query_params.get('department')
        file_format = request.query_params.get('file_format', 'csv')
        return export_payroll_master(payroll_run_id, department_id, format=file_format)
