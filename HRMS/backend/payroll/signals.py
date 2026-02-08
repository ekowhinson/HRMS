"""
Signals for payroll model changes.
Auto-populates processing_period on EmployeeSalary and EmployeeTransaction records.
"""

from django.db.models.signals import pre_save
from django.dispatch import receiver

from .models import EmployeeSalary, EmployeeTransaction, PayrollSettings


def _get_active_period():
    """Get the current active payroll period."""
    try:
        return PayrollSettings.get_active_period()
    except Exception:
        return None


@receiver(pre_save, sender=EmployeeSalary)
def set_salary_processing_period(sender, instance, **kwargs):
    """Auto-set processing_period to the current active period on new salary records."""
    if not instance.pk and not instance.processing_period_id:
        period = _get_active_period()
        if period:
            instance.processing_period = period


@receiver(pre_save, sender=EmployeeTransaction)
def set_transaction_processing_period(sender, instance, **kwargs):
    """Auto-set processing_period to the current active period on new transaction records."""
    if not instance.pk and not instance.processing_period_id:
        period = _get_active_period()
        if period:
            instance.processing_period = period
