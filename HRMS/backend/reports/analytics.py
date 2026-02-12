"""
Comprehensive Analytics and KPI calculations for HRMS Dashboard.
"""

from django.db.models import Count, Sum, Avg, F, Q, Value, Case, When
from django.db.models.functions import (
    TruncMonth, TruncYear, ExtractYear, ExtractMonth,
    Coalesce, Now
)
from django.utils import timezone
from datetime import timedelta, date
from decimal import Decimal
from dateutil.relativedelta import relativedelta


class RecruitmentAnalytics:
    """Recruitment KPIs and metrics."""

    @staticmethod
    def get_fte_count():
        """Get Full-Time Equivalent (FTE) count."""
        from employees.models import Employee

        # Count full-time as 1.0, part-time as 0.5
        active = Employee.objects.filter(status='ACTIVE')
        full_time = active.filter(employment_type='PERMANENT').count()
        contract = active.filter(employment_type='CONTRACT').count()
        part_time = active.filter(employment_type='PART_TIME').count()

        fte = full_time + contract + (part_time * 0.5)
        return {
            'fte': round(fte, 1),
            'full_time': full_time,
            'contract': contract,
            'part_time': part_time,
            'headcount': active.count()
        }

    @staticmethod
    def get_hiring_rate(year=None):
        """Calculate hiring rate for the year."""
        from employees.models import Employee

        if year is None:
            year = timezone.now().year

        # New hires in the year
        new_hires = Employee.objects.filter(
            date_of_joining__year=year
        ).count()

        # Average headcount (start + end / 2)
        start_count = Employee.objects.filter(
            date_of_joining__lt=date(year, 1, 1),
            status__in=['ACTIVE', 'ON_LEAVE', 'SUSPENDED']
        ).count()

        end_count = Employee.objects.filter(
            status__in=['ACTIVE', 'ON_LEAVE', 'SUSPENDED']
        ).count()

        avg_headcount = (start_count + end_count) / 2 if (start_count + end_count) > 0 else 1

        hiring_rate = (new_hires / avg_headcount) * 100

        return {
            'new_hires': new_hires,
            'average_headcount': round(avg_headcount, 1),
            'hiring_rate': round(hiring_rate, 2),
            'year': year
        }

    @staticmethod
    def get_attrition_rate(year=None, months=12):
        """Calculate attrition/turnover rate."""
        from employees.models import Employee
        from exits.models import ExitRequest

        if year is None:
            year = timezone.now().year

        # Exits in the period
        exits = ExitRequest.objects.filter(
            actual_last_day__year=year,
            status='COMPLETED'
        ).count()

        # Also count directly terminated employees
        direct_exits = Employee.objects.filter(
            Q(status='TERMINATED') | Q(status='RESIGNED') | Q(status='RETIRED'),
            updated_at__year=year
        ).count()

        total_exits = exits + direct_exits

        # Average headcount
        avg_headcount = Employee.objects.filter(
            status__in=['ACTIVE', 'ON_LEAVE', 'SUSPENDED']
        ).count()

        attrition_rate = (total_exits / avg_headcount * 100) if avg_headcount > 0 else 0

        return {
            'total_exits': total_exits,
            'average_headcount': avg_headcount,
            'attrition_rate': round(attrition_rate, 2),
            'year': year
        }

    @staticmethod
    def get_time_to_fill():
        """Calculate average time to fill positions."""
        from recruitment.models import Vacancy

        # Get closed vacancies with both opening and closing dates
        closed_vacancies = Vacancy.objects.filter(
            status='CLOSED',
            publish_date__isnull=False,
            closing_date__isnull=False
        )

        if not closed_vacancies.exists():
            return {'average_days': 0, 'vacancies_analyzed': 0}

        total_days = sum(
            (v.closing_date - v.publish_date).days
            for v in closed_vacancies
            if v.closing_date and v.publish_date
        )

        count = closed_vacancies.count()
        avg_days = total_days / count if count > 0 else 0

        return {
            'average_days': round(avg_days, 1),
            'vacancies_analyzed': count
        }

    @staticmethod
    def get_vacancy_summary():
        """Get current vacancy summary."""
        from recruitment.models import Vacancy, Applicant

        vacancies = Vacancy.objects.values('status').annotate(count=Count('id'))
        applicants = Applicant.objects.values('status').annotate(count=Count('id'))

        return {
            'vacancies_by_status': list(vacancies),
            'applicants_by_status': list(applicants),
            'open_vacancies': Vacancy.objects.filter(status='PUBLISHED').count(),
            'total_applicants': Applicant.objects.count()
        }


class DemographicsAnalytics:
    """Workforce demographics analysis."""

    @staticmethod
    def get_age_distribution():
        """Get age distribution of employees."""
        from employees.models import Employee
        from django.db.models.functions import ExtractYear

        today = timezone.now().date()
        current_year = today.year

        employees = Employee.objects.filter(
            status='ACTIVE',
            date_of_birth__isnull=False
        ).annotate(
            birth_year=ExtractYear('date_of_birth')
        ).values('birth_year')

        # Calculate age brackets
        brackets = {
            '18-25': 0, '26-35': 0, '36-45': 0,
            '46-55': 0, '56-60': 0, '60+': 0
        }

        for emp in employees:
            if emp['birth_year']:
                age = current_year - emp['birth_year']
                if age <= 25:
                    brackets['18-25'] += 1
                elif age <= 35:
                    brackets['26-35'] += 1
                elif age <= 45:
                    brackets['36-45'] += 1
                elif age <= 55:
                    brackets['46-55'] += 1
                elif age <= 60:
                    brackets['56-60'] += 1
                else:
                    brackets['60+'] += 1

        # Calculate average age
        total = sum(brackets.values())
        avg_ages = []
        for emp in employees:
            if emp['birth_year']:
                avg_ages.append(current_year - emp['birth_year'])

        average_age = sum(avg_ages) / len(avg_ages) if avg_ages else 0

        return {
            'distribution': brackets,
            'average_age': round(average_age, 1),
            'total_employees': total
        }

    @staticmethod
    def get_gender_distribution():
        """Get gender distribution."""
        from employees.models import Employee

        distribution = Employee.objects.filter(
            status='ACTIVE'
        ).values('gender').annotate(count=Count('id'))

        total = sum(d['count'] for d in distribution)

        result = {}
        for d in distribution:
            gender = 'Male' if d['gender'] == 'M' else 'Female' if d['gender'] == 'F' else 'Other'
            result[gender] = {
                'count': d['count'],
                'percentage': round(d['count'] / total * 100, 1) if total > 0 else 0
            }

        return result

    @staticmethod
    def get_location_distribution():
        """Get distribution by work location."""
        from employees.models import Employee

        distribution = Employee.objects.filter(
            status='ACTIVE'
        ).values(
            location_name=F('work_location__name')
        ).annotate(count=Count('id')).order_by('-count')

        return list(distribution)

    @staticmethod
    def get_education_distribution():
        """Get distribution by highest education level."""
        from employees.models import Education

        # Get highest qualification for each employee
        distribution = Education.objects.filter(
            employee__status='ACTIVE'
        ).values('qualification_level').annotate(
            count=Count('employee', distinct=True)
        ).order_by('-count')

        return list(distribution)

    @staticmethod
    def get_tenure_distribution():
        """Get tenure/years of service distribution."""
        from employees.models import Employee

        today = timezone.now().date()

        employees = Employee.objects.filter(
            status='ACTIVE',
            date_of_joining__isnull=False
        )

        brackets = {
            '< 1 year': 0,
            '1-3 years': 0,
            '3-5 years': 0,
            '5-10 years': 0,
            '10-15 years': 0,
            '15-20 years': 0,
            '20+ years': 0
        }

        tenures = []
        for emp in employees:
            years = (today - emp.date_of_joining).days / 365.25
            tenures.append(years)

            if years < 1:
                brackets['< 1 year'] += 1
            elif years < 3:
                brackets['1-3 years'] += 1
            elif years < 5:
                brackets['3-5 years'] += 1
            elif years < 10:
                brackets['5-10 years'] += 1
            elif years < 15:
                brackets['10-15 years'] += 1
            elif years < 20:
                brackets['15-20 years'] += 1
            else:
                brackets['20+ years'] += 1

        avg_tenure = sum(tenures) / len(tenures) if tenures else 0

        return {
            'distribution': brackets,
            'average_tenure_years': round(avg_tenure, 1)
        }

    @staticmethod
    def get_grade_distribution():
        """Get distribution by job grade."""
        from employees.models import Employee

        distribution = Employee.objects.filter(
            status='ACTIVE'
        ).values(
            grade_name=F('grade__name'),
            grade_level=F('grade__level')
        ).annotate(count=Count('id')).order_by('grade_level')

        return list(distribution)

    @staticmethod
    def get_department_distribution():
        """Get distribution by department."""
        from employees.models import Employee

        distribution = Employee.objects.filter(
            status='ACTIVE'
        ).values(
            department_name=F('department__name')
        ).annotate(count=Count('id')).order_by('-count')

        return list(distribution)


class TrainingAnalytics:
    """Training and development metrics."""

    @staticmethod
    def get_training_completion_rate(year=None):
        """Calculate training completion rate."""
        from performance.models import DevelopmentActivity

        if year is None:
            year = timezone.now().year

        activities = DevelopmentActivity.objects.filter(
            created_at__year=year
        )

        total = activities.count()
        completed = activities.filter(status='COMPLETED').count()

        completion_rate = (completed / total * 100) if total > 0 else 0

        return {
            'total_activities': total,
            'completed': completed,
            'in_progress': activities.filter(status='IN_PROGRESS').count(),
            'planned': activities.filter(status='PLANNED').count(),
            'completion_rate': round(completion_rate, 1),
            'year': year
        }

    @staticmethod
    def get_training_cost_per_employee(year=None):
        """Calculate average training cost per employee."""
        from performance.models import DevelopmentActivity
        from employees.models import Employee

        if year is None:
            year = timezone.now().year

        # Sum actual costs from development activities
        total_cost = DevelopmentActivity.objects.filter(
            created_at__year=year,
            actual_cost__isnull=False
        ).aggregate(total=Sum('actual_cost'))['total'] or Decimal('0')

        active_employees = Employee.objects.filter(status='ACTIVE').count()

        cost_per_employee = float(total_cost) / active_employees if active_employees > 0 else 0

        return {
            'total_training_cost': float(total_cost),
            'active_employees': active_employees,
            'cost_per_employee': round(cost_per_employee, 2),
            'year': year
        }

    @staticmethod
    def get_training_needs_summary():
        """Get summary of training needs from performance module."""
        from performance.models import TrainingNeed

        needs = TrainingNeed.objects.values('status', 'priority').annotate(
            count=Count('id')
        )

        by_status = {}
        by_priority = {}

        for n in needs:
            status = n['status']
            priority = n['priority']
            count = n['count']

            by_status[status] = by_status.get(status, 0) + count
            by_priority[priority] = by_priority.get(priority, 0) + count

        return {
            'by_status': by_status,
            'by_priority': by_priority,
            'total': sum(by_status.values())
        }


class PerformanceAnalytics:
    """Performance management analytics."""

    @staticmethod
    def get_appraisal_completion(cycle_year=None):
        """Get appraisal completion statistics."""
        from performance.models import Appraisal, AppraisalCycle
        from employees.models import Employee

        if cycle_year is None:
            cycle_year = timezone.now().year

        # Get the cycle
        cycle = AppraisalCycle.objects.filter(year=cycle_year).first()
        if not cycle:
            return {'error': 'No appraisal cycle found for this year'}

        appraisals = Appraisal.objects.filter(appraisal_cycle=cycle)
        total_employees = Employee.objects.filter(status='ACTIVE').count()

        completed = appraisals.filter(status='COMPLETED').count()
        in_progress = appraisals.filter(status__in=['SELF_ASSESSMENT', 'MANAGER_REVIEW', 'CALIBRATION']).count()
        not_started = total_employees - appraisals.count()

        completion_rate = (completed / total_employees * 100) if total_employees > 0 else 0

        return {
            'cycle_year': cycle_year,
            'total_employees': total_employees,
            'completed': completed,
            'in_progress': in_progress,
            'not_started': not_started,
            'completion_rate': round(completion_rate, 1)
        }

    @staticmethod
    def get_performance_distribution(cycle_year=None):
        """Get distribution of performance ratings."""
        from performance.models import Appraisal, AppraisalCycle

        if cycle_year is None:
            cycle_year = timezone.now().year

        cycle = AppraisalCycle.objects.filter(year=cycle_year).first()
        if not cycle:
            return {'error': 'No appraisal cycle found'}

        appraisals = Appraisal.objects.filter(
            appraisal_cycle=cycle,
            status='COMPLETED',
            final_rating__isnull=False
        )

        # Group by rating bands
        distribution = {
            'Outstanding (90-100)': 0,
            'Exceeds (75-89)': 0,
            'Meets (60-74)': 0,
            'Below (40-59)': 0,
            'Poor (<40)': 0
        }

        for appraisal in appraisals:
            rating = float(appraisal.final_rating) if appraisal.final_rating else 0
            if rating >= 90:
                distribution['Outstanding (90-100)'] += 1
            elif rating >= 75:
                distribution['Exceeds (75-89)'] += 1
            elif rating >= 60:
                distribution['Meets (60-74)'] += 1
            elif rating >= 40:
                distribution['Below (40-59)'] += 1
            else:
                distribution['Poor (<40)'] += 1

        # Average rating
        ratings = [float(a.final_rating) for a in appraisals if a.final_rating]
        avg_rating = sum(ratings) / len(ratings) if ratings else 0

        return {
            'distribution': distribution,
            'average_rating': round(avg_rating, 1),
            'total_rated': len(ratings),
            'cycle_year': cycle_year
        }

    @staticmethod
    def get_high_low_performers(cycle_year=None, top_n=10):
        """Get top and bottom performers."""
        from performance.models import Appraisal, AppraisalCycle

        if cycle_year is None:
            cycle_year = timezone.now().year

        cycle = AppraisalCycle.objects.filter(year=cycle_year).first()
        if not cycle:
            return {'error': 'No appraisal cycle found'}

        appraisals = Appraisal.objects.filter(
            appraisal_cycle=cycle,
            status='COMPLETED',
            final_rating__isnull=False
        ).select_related('employee', 'employee__department', 'employee__position')

        # Top performers
        top = appraisals.order_by('-final_rating')[:top_n]
        top_performers = [
            {
                'employee_name': a.employee.full_name,
                'employee_number': a.employee.employee_number,
                'department': a.employee.department.name if a.employee.department else None,
                'position': a.employee.position.title if a.employee.position else None,
                'rating': float(a.final_rating)
            }
            for a in top
        ]

        # Bottom performers
        bottom = appraisals.order_by('final_rating')[:top_n]
        low_performers = [
            {
                'employee_name': a.employee.full_name,
                'employee_number': a.employee.employee_number,
                'department': a.employee.department.name if a.employee.department else None,
                'position': a.employee.position.title if a.employee.position else None,
                'rating': float(a.final_rating)
            }
            for a in bottom
        ]

        return {
            'high_performers': top_performers,
            'low_performers': low_performers,
            'cycle_year': cycle_year
        }


class CompensationAnalytics:
    """Compensation and payroll analytics."""

    @staticmethod
    def get_payroll_cost_summary(year=None, month=None):
        """Get payroll cost summary."""
        from payroll.models import PayrollRun, PayrollItem

        if year is None:
            year = timezone.now().year

        filters = Q(run_date__year=year, status='APPROVED')
        if month:
            filters &= Q(run_date__month=month)

        runs = PayrollRun.objects.filter(filters)

        totals = runs.aggregate(
            total_gross=Sum('total_gross'),
            total_net=Sum('total_net'),
            total_paye=Sum('total_paye'),
            total_ssnit_employee=Sum('total_ssnit_employee'),
            total_ssnit_employer=Sum('total_ssnit_employer'),
            total_deductions=Sum('total_deductions'),
            employee_count=Sum('total_employees')
        )

        return {
            'total_gross': float(totals['total_gross'] or 0),
            'total_net': float(totals['total_net'] or 0),
            'total_paye': float(totals['total_paye'] or 0),
            'total_ssnit_employee': float(totals['total_ssnit_employee'] or 0),
            'total_ssnit_employer': float(totals['total_ssnit_employer'] or 0),
            'total_deductions': float(totals['total_deductions'] or 0),
            'payroll_runs': runs.count(),
            'year': year,
            'month': month
        }

    @staticmethod
    def get_payroll_variance(current_period_id=None, previous_period_id=None):
        """Calculate payroll variance between periods."""
        from payroll.models import PayrollRun

        if not current_period_id or not previous_period_id:
            # Get last two approved payroll runs
            runs = PayrollRun.objects.filter(
                status='APPROVED'
            ).order_by('-run_date')[:2]

            if len(runs) < 2:
                return {'error': 'Not enough payroll data for variance calculation'}

            current = runs[0]
            previous = runs[1]
        else:
            current = PayrollRun.objects.filter(id=current_period_id).first()
            previous = PayrollRun.objects.filter(id=previous_period_id).first()

        if not current or not previous:
            return {'error': 'Payroll runs not found'}

        def calc_variance(current_val, previous_val):
            if previous_val == 0:
                return 0
            return round(((current_val - previous_val) / previous_val) * 100, 2)

        current_gross = float(current.total_gross or 0)
        previous_gross = float(previous.total_gross or 0)

        return {
            'current_period': {
                'id': str(current.id),
                'date': current.run_date,
                'total_gross': current_gross,
                'total_net': float(current.total_net or 0),
                'employees': current.total_employees
            },
            'previous_period': {
                'id': str(previous.id),
                'date': previous.run_date,
                'total_gross': previous_gross,
                'total_net': float(previous.total_net or 0),
                'employees': previous.total_employees
            },
            'variance': {
                'gross_change': round(current_gross - previous_gross, 2),
                'gross_variance_pct': calc_variance(current_gross, previous_gross),
                'employee_change': current.total_employees - previous.total_employees
            }
        }

    @staticmethod
    def get_average_salary_by_grade():
        """Get average salary by job grade."""
        from employees.models import Employee

        result = Employee.objects.filter(
            status='ACTIVE',
            basic_salary__isnull=False
        ).values(
            grade_name=F('grade__name'),
            grade_level=F('grade__level')
        ).annotate(
            avg_salary=Avg('basic_salary'),
            min_salary=Sum(Case(When(basic_salary__isnull=False, then='basic_salary'))),
            employee_count=Count('id')
        ).order_by('grade_level')

        return [
            {
                'grade': r['grade_name'],
                'level': r['grade_level'],
                'average_salary': round(float(r['avg_salary'] or 0), 2),
                'employee_count': r['employee_count']
            }
            for r in result if r['grade_name']
        ]

    @staticmethod
    def get_salary_band_distribution():
        """Get distribution of employees by salary bands."""
        from employees.models import Employee

        employees = Employee.objects.filter(
            status='ACTIVE',
            basic_salary__isnull=False
        )

        bands = {
            '< 2,000': 0,
            '2,000 - 5,000': 0,
            '5,000 - 10,000': 0,
            '10,000 - 20,000': 0,
            '20,000 - 50,000': 0,
            '50,000+': 0
        }

        for emp in employees:
            salary = float(emp.basic_salary)
            if salary < 2000:
                bands['< 2,000'] += 1
            elif salary < 5000:
                bands['2,000 - 5,000'] += 1
            elif salary < 10000:
                bands['5,000 - 10,000'] += 1
            elif salary < 20000:
                bands['10,000 - 20,000'] += 1
            elif salary < 50000:
                bands['20,000 - 50,000'] += 1
            else:
                bands['50,000+'] += 1

        return bands


class ExitAnalytics:
    """Exit and turnover analytics."""

    @staticmethod
    def get_turnover_rate(year=None):
        """Calculate monthly and annual turnover rates."""
        from employees.models import Employee
        from exits.models import ExitRequest

        if year is None:
            year = timezone.now().year

        # Get exits by month
        monthly_exits = ExitRequest.objects.filter(
            actual_last_day__year=year,
            status='COMPLETED'
        ).annotate(
            month=ExtractMonth('actual_last_day')
        ).values('month').annotate(count=Count('id'))

        # Average headcount for the year
        avg_headcount = Employee.objects.filter(
            status__in=['ACTIVE', 'ON_LEAVE', 'SUSPENDED']
        ).count()

        monthly_data = {}
        total_exits = 0
        for m in monthly_exits:
            month_num = m['month']
            count = m['count']
            total_exits += count
            turnover_rate = (count / avg_headcount * 100) if avg_headcount > 0 else 0
            monthly_data[month_num] = {
                'exits': count,
                'turnover_rate': round(turnover_rate, 2)
            }

        annual_rate = (total_exits / avg_headcount * 100) if avg_headcount > 0 else 0

        return {
            'monthly': monthly_data,
            'annual_exits': total_exits,
            'annual_turnover_rate': round(annual_rate, 2),
            'average_headcount': avg_headcount,
            'year': year
        }

    @staticmethod
    def get_exit_breakdown(year=None):
        """Get breakdown of exits by reason."""
        from exits.models import ExitRequest

        if year is None:
            year = timezone.now().year

        exits = ExitRequest.objects.filter(
            actual_last_day__year=year,
            status='COMPLETED'
        )

        by_reason = exits.values('exit_type').annotate(count=Count('id'))
        by_department = exits.values(
            department_name=F('employee__department__name')
        ).annotate(count=Count('id')).order_by('-count')

        voluntary = exits.filter(
            exit_type__in=['RESIGNATION', 'RETIREMENT']
        ).count()

        involuntary = exits.filter(
            exit_type__in=['TERMINATION', 'DISMISSAL', 'REDUNDANCY']
        ).count()

        total = exits.count()

        return {
            'by_reason': list(by_reason),
            'by_department': list(by_department),
            'voluntary': voluntary,
            'involuntary': involuntary,
            'voluntary_rate': round(voluntary / total * 100, 1) if total > 0 else 0,
            'total_exits': total,
            'year': year
        }

    @staticmethod
    def get_retention_rate(year=None):
        """Calculate retention rate."""
        from employees.models import Employee

        if year is None:
            year = timezone.now().year

        # Employees at start of year
        start_count = Employee.objects.filter(
            date_of_joining__lt=date(year, 1, 1)
        ).count()

        # Of those, how many are still active
        retained = Employee.objects.filter(
            date_of_joining__lt=date(year, 1, 1),
            status__in=['ACTIVE', 'ON_LEAVE', 'SUSPENDED']
        ).count()

        retention_rate = (retained / start_count * 100) if start_count > 0 else 100

        return {
            'start_of_year_employees': start_count,
            'currently_retained': retained,
            'retention_rate': round(retention_rate, 2),
            'year': year
        }


class MasterDashboard:
    """Consolidated master dashboard with all key metrics."""

    @staticmethod
    def get_all_kpis():
        """Get all KPIs for master dashboard."""
        from employees.models import Employee
        from leave.models import LeaveRequest
        from benefits.models import LoanAccount
        from payroll.models import PayrollRun

        today = timezone.now().date()
        current_year = today.year

        # Basic counts
        active_employees = Employee.objects.filter(status='ACTIVE').count()
        pending_leaves = LeaveRequest.objects.filter(status='PENDING').count()
        active_loans = LoanAccount.objects.filter(status__in=['ACTIVE', 'DISBURSED']).count()

        # Latest payroll
        latest_payroll = PayrollRun.objects.filter(status='APPROVED').order_by('-run_date').first()

        return {
            'summary': {
                'active_employees': active_employees,
                'pending_leave_requests': pending_leaves,
                'active_loans': active_loans,
                'latest_payroll_date': latest_payroll.run_date if latest_payroll else None,
            },
            'workforce': {
                'fte': RecruitmentAnalytics.get_fte_count(),
                'hiring_rate': RecruitmentAnalytics.get_hiring_rate(current_year),
                'attrition_rate': RecruitmentAnalytics.get_attrition_rate(current_year),
            },
            'demographics': {
                'age_distribution': DemographicsAnalytics.get_age_distribution(),
                'gender_distribution': DemographicsAnalytics.get_gender_distribution(),
                'tenure_distribution': DemographicsAnalytics.get_tenure_distribution(),
            },
            'compensation': {
                'payroll_summary': CompensationAnalytics.get_payroll_cost_summary(current_year),
                'salary_by_grade': CompensationAnalytics.get_average_salary_by_grade(),
            },
            'turnover': {
                'rate': ExitAnalytics.get_turnover_rate(current_year),
                'breakdown': ExitAnalytics.get_exit_breakdown(current_year),
            },
            'generated_at': timezone.now()
        }
