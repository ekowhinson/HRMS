"""
Service for applying global salary increments across notches.
"""

from decimal import Decimal
from django.db import transaction
from django.db.models import Min, Max, Count, Q
from django.utils import timezone

from .models import (
    SalaryNotch, SalaryLevel, SalaryBand,
    SalaryIncrementHistory, SalaryIncrementDetail,
    EmployeeSalary,
)


class SalaryIncrementService:
    """Handles global salary increment preview and application."""

    @staticmethod
    def _get_notches_queryset(band_id=None, level_id=None):
        """Return active notches filtered by optional band/level."""
        qs = SalaryNotch.objects.filter(is_active=True).select_related(
            'level', 'level__band'
        )
        if level_id:
            qs = qs.filter(level_id=level_id)
        elif band_id:
            qs = qs.filter(level__band_id=band_id)
        return qs

    @staticmethod
    def _compute_new_amount(old_amount, increment_type, value):
        """Compute new amount, floored at 0.01."""
        if increment_type == 'PERCENTAGE':
            new_amount = old_amount * (Decimal('1') + value / Decimal('100'))
        else:
            new_amount = old_amount + value
        return max(new_amount, Decimal('0.01')).quantize(Decimal('0.01'))

    @staticmethod
    def _recalculate_level_band_ranges(affected_level_ids, affected_band_ids):
        """Cascade: recalculate level min/max and band min/max."""
        for level_id_val in affected_level_ids:
            agg = SalaryNotch.objects.filter(
                level_id=level_id_val, is_active=True
            ).aggregate(min_sal=Min('amount'), max_sal=Max('amount'))
            SalaryLevel.objects.filter(id=level_id_val).update(
                min_salary=agg['min_sal'],
                max_salary=agg['max_sal'],
            )

        for band_id_val in affected_band_ids:
            agg = SalaryLevel.objects.filter(
                band_id=band_id_val, is_active=True
            ).aggregate(min_sal=Min('min_salary'), max_sal=Max('max_salary'))
            SalaryBand.objects.filter(id=band_id_val).update(
                min_salary=agg['min_sal'],
                max_salary=agg['max_sal'],
            )

    @staticmethod
    def preview(increment_type, value, effective_date, band_id=None, level_id=None):
        """
        Preview the effect of a global increment without modifying data.
        Returns per-notch details and a summary.
        """
        value = Decimal(str(value))
        notches = SalaryIncrementService._get_notches_queryset(band_id, level_id)
        notches = notches.annotate(
            emp_count=Count(
                'employees',
                filter=Q(employees__status='ACTIVE')
            )
        )

        items = []
        total_old = Decimal('0')
        total_new = Decimal('0')
        total_employees = 0

        for notch in notches:
            old_amount = notch.amount
            new_amount = SalaryIncrementService._compute_new_amount(
                old_amount, increment_type, value
            )
            diff = new_amount - old_amount
            items.append({
                'notch_id': str(notch.id),
                'full_code': notch.full_code,
                'notch_name': notch.name,
                'old_amount': float(old_amount),
                'new_amount': float(new_amount),
                'difference': float(diff),
                'employee_count': notch.emp_count,
            })
            total_old += old_amount
            total_new += new_amount
            total_employees += notch.emp_count

        return {
            'items': items,
            'summary': {
                'notches_affected': len(items),
                'employees_affected': total_employees,
                'total_old_amount': float(total_old),
                'total_new_amount': float(total_new),
                'total_difference': float(total_new - total_old),
            }
        }

    @staticmethod
    def validate_can_forecast():
        """Raise ValueError if an active forecast already exists."""
        existing = SalaryIncrementHistory.objects.filter(
            status=SalaryIncrementHistory.Status.FORECAST
        ).first()
        if existing:
            raise ValueError(
                f'An active forecast already exists: {existing.reference_number}. '
                'Reverse or promote it before creating a new one.'
            )

    @staticmethod
    @transaction.atomic
    def apply(increment_type, value, effective_date, user,
              band_id=None, level_id=None, description='', is_forecast=False):
        """
        Apply a global salary increment:
        1. Update notch amounts
        2. Cascade min/max to levels and bands
        3. Create new EmployeeSalary records for affected employees

        When is_forecast=True, the increment is tagged as a forecast
        that can be reversed or promoted later.
        """
        value = Decimal(str(value))

        # Validate
        if value == 0:
            raise ValueError('Increment value cannot be zero.')
        if increment_type == 'PERCENTAGE' and value <= Decimal('-100'):
            raise ValueError('Percentage decrease cannot be 100% or more.')

        # Determine status based on forecast flag
        status = (
            SalaryIncrementHistory.Status.FORECAST if is_forecast
            else SalaryIncrementHistory.Status.APPLIED
        )

        # Create history record
        history = SalaryIncrementHistory.objects.create(
            increment_type=increment_type,
            value=value,
            effective_date=effective_date,
            band_id=band_id,
            level_id=level_id,
            status=status,
            is_forecast=is_forecast,
            applied_by=user,
            description=description,
        )

        # Get notches with employee counts
        notches = SalaryIncrementService._get_notches_queryset(band_id, level_id)
        notches = notches.annotate(
            emp_count=Count(
                'employees',
                filter=Q(employees__status='ACTIVE')
            )
        )

        details = []
        total_old = Decimal('0')
        total_new = Decimal('0')
        total_employees = 0
        affected_level_ids = set()
        affected_band_ids = set()
        notches_to_update = []

        for notch in notches:
            old_amount = notch.amount
            new_amount = SalaryIncrementService._compute_new_amount(
                old_amount, increment_type, value
            )
            diff = new_amount - old_amount

            notch.amount = new_amount
            notches_to_update.append(notch)

            details.append(SalaryIncrementDetail(
                increment=history,
                notch=notch,
                old_amount=old_amount,
                new_amount=new_amount,
                difference=diff,
            ))

            total_old += old_amount
            total_new += new_amount
            total_employees += notch.emp_count
            affected_level_ids.add(notch.level_id)
            affected_band_ids.add(notch.level.band_id)

        # Bulk update notch amounts
        if notches_to_update:
            SalaryNotch.objects.bulk_update(notches_to_update, ['amount'])

        # Bulk create detail records
        if details:
            SalaryIncrementDetail.objects.bulk_create(details)

        # Cascade: recalculate level and band ranges
        SalaryIncrementService._recalculate_level_band_ranges(
            affected_level_ids, affected_band_ids
        )

        # Create new EmployeeSalary records for affected employees
        from employees.models import Employee
        affected_notch_ids = [n.id for n in notches_to_update]
        affected_employees = Employee.objects.filter(
            status='ACTIVE',
            salary_notch_id__in=affected_notch_ids,
        ).select_related('salary_notch')

        employees_updated = 0

        for emp in affected_employees:
            # Close current salary record
            EmployeeSalary.objects.filter(
                employee=emp, is_current=True
            ).update(is_current=False, effective_to=effective_date)

            # Create new salary record with updated notch amount
            EmployeeSalary.objects.create(
                employee=emp,
                basic_salary=emp.salary_notch.amount,
                effective_from=effective_date,
                is_current=True,
                reason=f'Global salary increment {history.reference_number}',
                reference_number=history.reference_number,
            )
            employees_updated += 1

        # Update history counts
        history.notches_affected = len(notches_to_update)
        history.employees_affected = employees_updated
        history.total_old_amount = total_old
        history.total_new_amount = total_new
        history.save(update_fields=[
            'notches_affected', 'employees_affected',
            'total_old_amount', 'total_new_amount',
        ])

        return history

    @staticmethod
    @transaction.atomic
    def reverse(history_id, user):
        """
        Reverse a salary increment (forecast or applied):
        1. Restore notch amounts from stored old_amount values
        2. Remove EmployeeSalary records created by this increment
        3. Re-activate previous EmployeeSalary records
        4. Recalculate level/band ranges
        """
        history = SalaryIncrementHistory.objects.select_for_update().get(id=history_id)

        if history.status == SalaryIncrementHistory.Status.REVERSED:
            raise ValueError('This increment has already been reversed.')

        if history.status not in (
            SalaryIncrementHistory.Status.FORECAST,
            SalaryIncrementHistory.Status.APPLIED,
        ):
            raise ValueError(f'Cannot reverse an increment with status: {history.status}')

        # Restore notch amounts from detail records
        detail_records = history.details.select_related('notch', 'notch__level', 'notch__level__band')
        affected_level_ids = set()
        affected_band_ids = set()
        notches_to_update = []

        for detail in detail_records:
            detail.notch.amount = detail.old_amount
            notches_to_update.append(detail.notch)
            affected_level_ids.add(detail.notch.level_id)
            affected_band_ids.add(detail.notch.level.band_id)

        if notches_to_update:
            SalaryNotch.objects.bulk_update(notches_to_update, ['amount'])

        # Capture employee IDs from salary records created by this increment
        # BEFORE deleting them, so we can re-activate their previous records
        affected_employee_ids = list(
            EmployeeSalary.objects.filter(
                reference_number=history.reference_number
            ).values_list('employee_id', flat=True)
        )

        # Remove EmployeeSalary records created by this increment
        EmployeeSalary.objects.filter(
            reference_number=history.reference_number
        ).delete()

        # Re-activate previous EmployeeSalary records that were closed by this increment
        # Match by: same employees, closed on the same effective_date
        if affected_employee_ids:
            EmployeeSalary.objects.filter(
                employee_id__in=affected_employee_ids,
                effective_to=history.effective_date,
                is_current=False,
            ).update(is_current=True, effective_to=None)

        # Cascade: recalculate level and band ranges
        SalaryIncrementService._recalculate_level_band_ranges(
            affected_level_ids, affected_band_ids
        )

        # Mark as reversed
        history.status = SalaryIncrementHistory.Status.REVERSED
        history.reversed_by = user
        history.reversed_at = timezone.now()
        history.save(update_fields=['status', 'reversed_by', 'reversed_at'])

        return history

    @staticmethod
    @transaction.atomic
    def promote_forecast(history_id, user):
        """Convert a forecast increment into a permanent applied increment."""
        history = SalaryIncrementHistory.objects.select_for_update().get(id=history_id)

        if history.status != SalaryIncrementHistory.Status.FORECAST:
            raise ValueError(
                f'Only forecasts can be promoted. Current status: {history.status}'
            )

        history.status = SalaryIncrementHistory.Status.APPLIED
        history.is_forecast = False
        history.save(update_fields=['status', 'is_forecast'])

        return history
