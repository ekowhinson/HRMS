"""
Salary upgrade service with approval workflow.

Creating an upgrade produces a PENDING request. Only after explicit approval
are the actual changes (Employee update, EmployeeSalary, EmploymentHistory,
auto-backpay) applied.
"""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from employees.models import Employee, EmploymentHistory
from organization.models import JobGrade, JobPosition
from .models import (
    EmployeeSalary, SalaryNotch, PayrollSettings,
    BackpayRequest, PayrollPeriod, SalaryUpgradeRequest,
)


class SalaryUpgradeService:
    """Orchestrates salary upgrades with an approval workflow."""

    # ──────────────────────────────────────────────
    # Notch resolution from increment
    # ──────────────────────────────────────────────

    @staticmethod
    def resolve_notch_from_increment(employee, increment_type, increment_value):
        """
        Given an employee and increment params, calculate the target salary
        and find the closest notch at or above that amount.

        For PERCENTAGE: target = current + (current * value / 100)
        For AMOUNT: target = current + value

        Returns the resolved SalaryNotch.
        Raises ValueError if no suitable notch is found.
        """
        current_notch = employee.salary_notch
        if not current_notch:
            raise ValueError('Employee has no current salary notch assigned.')

        current_amount = current_notch.amount
        increment_value = Decimal(str(increment_value))

        if increment_type == 'PERCENTAGE':
            target_amount = current_amount + (current_amount * increment_value / Decimal('100'))
        else:  # AMOUNT
            target_amount = current_amount + increment_value

        # First try: find notch in same level with amount >= target, closest match
        same_level_notches = SalaryNotch.objects.filter(
            level=current_notch.level,
            is_active=True,
            amount__gte=target_amount,
        ).order_by('amount')

        if same_level_notches.exists():
            return same_level_notches.first()

        # Second try: find next higher notch in same level (any above current)
        higher_in_level = SalaryNotch.objects.filter(
            level=current_notch.level,
            is_active=True,
            amount__gt=current_amount,
        ).order_by('amount')

        if higher_in_level.exists():
            return higher_in_level.last()  # highest in same level

        # Third try: look in higher levels within the same band
        if current_notch.level and current_notch.level.band:
            higher_levels = SalaryNotch.objects.filter(
                level__band=current_notch.level.band,
                is_active=True,
                amount__gte=target_amount,
            ).order_by('amount')

            if higher_levels.exists():
                return higher_levels.first()

        raise ValueError(
            f'No suitable notch found for target amount {target_amount:.2f}. '
            f'Please select a specific notch manually.'
        )

    # ──────────────────────────────────────────────
    # Public: create / approve / reject
    # ──────────────────────────────────────────────

    @staticmethod
    @transaction.atomic
    def create_request(
        employee_id,
        new_notch_id=None,
        reason='SALARY_REVISION',
        effective_from=None,
        description='',
        new_grade_id=None,
        new_position_id=None,
        increment_type=None,
        increment_value=None,
    ):
        """
        Create a PENDING salary upgrade request. No side-effects on Employee
        or salary records.

        Either new_notch_id or (increment_type + increment_value) must be provided.
        When increment params are given, the target notch is auto-resolved.
        """
        employee = Employee.objects.select_related(
            'salary_notch', 'salary_notch__level', 'salary_notch__level__band',
            'grade', 'position',
        ).get(pk=employee_id)

        # Resolve notch from increment if needed
        if increment_type and increment_value and not new_notch_id:
            new_notch = SalaryUpgradeService.resolve_notch_from_increment(
                employee, increment_type, increment_value,
            )
        else:
            new_notch = SalaryNotch.objects.select_related('level', 'level__band').get(pk=new_notch_id)

        if employee.salary_notch_id and str(employee.salary_notch_id) == str(new_notch.id):
            raise ValueError('New notch is the same as the current notch.')

        new_grade = None
        new_position = None
        if new_grade_id:
            new_grade = JobGrade.objects.get(pk=new_grade_id)
        if new_position_id:
            new_position = JobPosition.objects.get(pk=new_position_id)

        active_period = PayrollSettings.get_active_period()

        request = SalaryUpgradeRequest.objects.create(
            employee=employee,
            new_notch=new_notch,
            new_grade=new_grade,
            new_position=new_position,
            reason=reason,
            effective_from=effective_from,
            description=description,
            status=SalaryUpgradeRequest.Status.PENDING,
            processing_period=active_period,
            increment_type=increment_type,
            increment_value=Decimal(str(increment_value)) if increment_value else None,
        )
        return request

    @staticmethod
    @transaction.atomic
    def approve_request(request_id, user):
        """
        Approve a PENDING request: apply the actual upgrade (Employee update,
        EmployeeSalary, EmploymentHistory, auto-backpay), then mark APPROVED.
        """
        # Only select_related non-nullable FKs with select_for_update();
        # nullable FKs produce LEFT OUTER JOINs which PostgreSQL rejects
        # with "FOR UPDATE cannot be applied to the nullable side of an outer join".
        # Nullable relations (salary_notch, grade, position, new_grade, new_position)
        # are lazy-loaded within the same transaction.
        req = SalaryUpgradeRequest.objects.select_related(
            'employee',
            'new_notch', 'new_notch__level', 'new_notch__level__band',
        ).select_for_update().get(pk=request_id)

        if req.status != SalaryUpgradeRequest.Status.PENDING:
            raise ValueError(f'Request is already {req.get_status_display()}.')

        SalaryUpgradeService._apply_upgrade(req, user)

        req.status = SalaryUpgradeRequest.Status.APPROVED
        req.approved_by = user
        req.approved_at = timezone.now()
        req.save(update_fields=['status', 'approved_by', 'approved_at', 'updated_at'])
        return req

    @staticmethod
    @transaction.atomic
    def reject_request(request_id, user, rejection_reason):
        """Reject a PENDING request. No side-effects."""
        req = SalaryUpgradeRequest.objects.select_for_update().get(pk=request_id)

        if req.status != SalaryUpgradeRequest.Status.PENDING:
            raise ValueError(f'Request is already {req.get_status_display()}.')

        req.status = SalaryUpgradeRequest.Status.REJECTED
        req.approved_by = user
        req.approved_at = timezone.now()
        req.rejection_reason = rejection_reason
        req.save(update_fields=['status', 'approved_by', 'approved_at', 'rejection_reason', 'updated_at'])
        return req

    # ──────────────────────────────────────────────
    # Bulk
    # ──────────────────────────────────────────────

    @staticmethod
    def bulk_create(
        filters,
        new_notch_id=None,
        reason='SALARY_REVISION',
        effective_from=None,
        description='',
        new_grade_id=None,
        new_position_id=None,
        increment_type=None,
        increment_value=None,
    ):
        """
        Create multiple PENDING requests sharing a bulk_reference.
        Returns summary with created count, skipped, and errors.

        When increment_type/increment_value are provided, each employee's
        target notch is individually resolved based on their current salary.
        """
        qs = Employee.objects.filter(status='ACTIVE', is_deleted=False).select_related(
            'salary_notch', 'salary_notch__level', 'salary_notch__level__band',
        )

        if filters.get('all_active'):
            pass
        elif filters.get('employee_ids'):
            qs = qs.filter(id__in=filters['employee_ids'])
        else:
            filter_map = {
                'division': 'department__directorate__division_id',
                'directorate': 'department__directorate_id',
                'department': 'department_id',
                'grade': 'grade_id',
                'region': 'work_location__region_id',
                'district': 'work_location__district_id',
                'work_location': 'work_location_id',
                'staff_category': 'staff_category_id',
            }
            for key, lookup in filter_map.items():
                val = filters.get(key)
                if val:
                    qs = qs.filter(**{lookup: val})

        bulk_ref = f"BU-{datetime.now().strftime('%Y%m')}-{uuid.uuid4().hex[:8].upper()}"
        use_increment = bool(increment_type and increment_value)

        created = []
        skipped = []
        errors = []

        for emp in qs.iterator():
            try:
                if not use_increment and emp.salary_notch_id and str(emp.salary_notch_id) == str(new_notch_id):
                    skipped.append({
                        'id': str(emp.id),
                        'employee_number': emp.employee_number,
                        'name': emp.full_name,
                        'reason': 'Already on target notch',
                    })
                    continue

                req = SalaryUpgradeService.create_request(
                    employee_id=emp.id,
                    new_notch_id=new_notch_id if not use_increment else None,
                    reason=reason,
                    effective_from=effective_from,
                    description=description,
                    new_grade_id=new_grade_id,
                    new_position_id=new_position_id,
                    increment_type=increment_type if use_increment else None,
                    increment_value=increment_value if use_increment else None,
                )
                req.is_bulk = True
                req.bulk_reference = bulk_ref
                req.save(update_fields=['is_bulk', 'bulk_reference', 'updated_at'])
                created.append(str(req.id))
            except Exception as e:
                errors.append({
                    'id': str(emp.id),
                    'employee_number': emp.employee_number,
                    'name': emp.full_name,
                    'error': str(e),
                })

        return {
            'bulk_reference': bulk_ref,
            'count': len(created),
            'skipped': len(skipped),
            'skipped_employees': skipped,
            'errors': errors,
        }

    # ──────────────────────────────────────────────
    # Preview (read-only, unchanged)
    # ──────────────────────────────────────────────

    @staticmethod
    def preview_upgrade(
        employee_id,
        new_notch_id=None,
        new_grade_id=None,
        new_position_id=None,
        increment_type=None,
        increment_value=None,
    ):
        """Return current vs new salary/grade/position comparison without saving."""
        employee = Employee.objects.select_related(
            'salary_notch', 'salary_notch__level', 'salary_notch__level__band',
            'grade', 'position',
        ).get(pk=employee_id)

        # Resolve notch from increment if needed
        if increment_type and increment_value and not new_notch_id:
            new_notch = SalaryUpgradeService.resolve_notch_from_increment(
                employee, increment_type, increment_value,
            )
        else:
            new_notch = SalaryNotch.objects.select_related('level', 'level__band').get(pk=new_notch_id)

        active_period = PayrollSettings.get_active_period()

        current_notch = employee.salary_notch
        current_amount = current_notch.amount if current_notch else Decimal('0')

        current_band = current_notch.level.band.name if current_notch and current_notch.level else ''
        current_level = current_notch.level.name if current_notch and current_notch.level else ''
        current_notch_name = current_notch.name if current_notch else ''

        new_band = new_notch.level.band.name if new_notch.level else ''
        new_level = new_notch.level.name if new_notch.level else ''

        current_grade_name = employee.grade.name if employee.grade else ''
        new_grade_name = current_grade_name
        if new_grade_id:
            try:
                ng = JobGrade.objects.get(pk=new_grade_id)
                new_grade_name = ng.name
            except JobGrade.DoesNotExist:
                pass

        current_position_name = employee.position.title if employee.position else ''
        new_position_name = current_position_name
        if new_position_id:
            try:
                np = JobPosition.objects.get(pk=new_position_id)
                new_position_name = np.title
            except JobPosition.DoesNotExist:
                pass

        result = {
            'employee_id': str(employee.id),
            'employee_number': employee.employee_number,
            'employee_name': employee.full_name,
            'current_band': current_band,
            'current_level': current_level,
            'current_notch': current_notch_name,
            'current_amount': float(current_amount),
            'current_grade': current_grade_name,
            'current_position': current_position_name,
            'new_band': new_band,
            'new_level': new_level,
            'new_notch': new_notch.name,
            'new_notch_id': str(new_notch.id),
            'new_amount': float(new_notch.amount),
            'new_grade': new_grade_name,
            'new_position': new_position_name,
            'salary_diff': float(new_notch.amount - current_amount),
            'processing_period': active_period.name if active_period else None,
        }

        if increment_type:
            result['increment_type'] = increment_type
            result['increment_value'] = float(increment_value)

        return result

    # ──────────────────────────────────────────────
    # Private: apply the actual upgrade
    # ──────────────────────────────────────────────

    @staticmethod
    def _apply_upgrade(req, user):
        """
        Apply the upgrade: update Employee, create EmployeeSalary,
        create EmploymentHistory, and auto-create BackpayRequest if needed.
        """
        employee = req.employee
        new_notch = req.new_notch
        new_grade = req.new_grade
        new_position = req.new_position
        effective_from = req.effective_from
        description = req.description or req.reason

        active_period = PayrollSettings.get_active_period()

        # Save previous values
        prev_notch = employee.salary_notch
        prev_grade = employee.grade
        prev_position = employee.position
        prev_salary_amount = prev_notch.amount if prev_notch else Decimal('0')

        # Close current EmployeeSalary
        current_salary = EmployeeSalary.objects.filter(
            employee=employee, is_current=True
        ).first()

        old_salary_record = current_salary
        if current_salary:
            current_salary.is_current = False
            current_salary.effective_to = effective_from - timedelta(days=1)
            current_salary.save(update_fields=['is_current', 'effective_to', 'updated_at'])

        # Create new EmployeeSalary
        new_salary_record = EmployeeSalary.objects.create(
            employee=employee,
            basic_salary=new_notch.amount,
            effective_from=effective_from,
            is_current=True,
            reason=description,
            approved_by=user,
            processing_period=active_period,
        )

        # Update employee fields
        employee.salary_notch = new_notch
        update_fields = ['salary_notch', 'updated_at']

        if new_grade:
            employee.grade = new_grade
            update_fields.append('grade')
        if new_position:
            employee.position = new_position
            update_fields.append('position')

        employee.save(update_fields=update_fields)

        # Determine change type
        if new_grade and new_position:
            change_type = EmploymentHistory.ChangeType.PROMOTION
        elif new_grade:
            change_type = EmploymentHistory.ChangeType.GRADE_CHANGE
        else:
            change_type = EmploymentHistory.ChangeType.SALARY_REVISION

        # Create EmploymentHistory record
        EmploymentHistory.objects.create(
            employee=employee,
            change_type=change_type,
            effective_date=effective_from,
            previous_grade=prev_grade,
            new_grade=new_grade or prev_grade,
            previous_position=prev_position,
            new_position=new_position or prev_position,
            previous_salary=prev_salary_amount,
            new_salary=new_notch.amount,
            reason=description,
            approved_by=user,
            processing_period=active_period,
        )

        # Auto-backpay: if effective_from < active period start_date
        if active_period and effective_from < active_period.start_date:
            BackpayRequest.objects.create(
                employee=employee,
                old_salary=old_salary_record,
                new_salary=new_salary_record,
                reason=BackpayRequest.Reason.UPGRADE if new_grade else BackpayRequest.Reason.SALARY_REVISION,
                description=f'Auto-created from salary upgrade: {description}',
                effective_from=effective_from,
                effective_to=active_period.start_date - timedelta(days=1),
                status=BackpayRequest.Status.DRAFT,
                payroll_period=active_period,
                created_by=user,
            )
