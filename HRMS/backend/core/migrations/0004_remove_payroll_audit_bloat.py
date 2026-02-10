"""
Data migration to remove existing audit log bloat from bulk payroll models.

These models are now excluded from signal-based audit logging and audited
via summary entries instead (see core/audit.py EXCLUDED_MODELS).
"""

from django.db import migrations


def remove_payroll_audit_rows(apps, schema_editor):
    AuditLog = apps.get_model('core', 'AuditLog')
    deleted, _ = AuditLog.objects.filter(
        model_name__in=['PayrollItem', 'PayrollItemDetail', 'Payslip', 'BackpayDetail']
    ).delete()
    if deleted:
        print(f'\n  Deleted {deleted} payroll audit bloat rows.')


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_announcements'),
    ]

    operations = [
        migrations.RunPython(remove_payroll_audit_rows, noop),
    ]
