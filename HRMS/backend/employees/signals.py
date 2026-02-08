"""
Signals for employee model changes.
Auto-tracks grade changes in EmploymentHistory for backpay/retroactive pay support.
"""

from datetime import date

from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import Employee, EmploymentHistory


@receiver(pre_save, sender=Employee)
def track_grade_change(sender, instance, **kwargs):
    """Auto-create EmploymentHistory when employee grade changes."""
    if not instance.pk:
        return

    try:
        old = Employee.objects.get(pk=instance.pk)
    except Employee.DoesNotExist:
        return

    if old.grade_id != instance.grade_id:
        # Determine change type based on grade level ordering
        change_type = EmploymentHistory.ChangeType.GRADE_CHANGE
        if old.grade and instance.grade:
            if hasattr(old.grade, 'level') and hasattr(instance.grade, 'level'):
                if instance.grade.level > old.grade.level:
                    change_type = EmploymentHistory.ChangeType.PROMOTION
                elif instance.grade.level < old.grade.level:
                    change_type = EmploymentHistory.ChangeType.DEMOTION

        EmploymentHistory.objects.create(
            employee=instance,
            change_type=change_type,
            effective_date=date.today(),
            previous_grade=old.grade,
            new_grade_id=instance.grade_id,
            previous_department=old.department,
            new_department=old.department,
            previous_position=old.position,
            new_position=old.position,
        )
