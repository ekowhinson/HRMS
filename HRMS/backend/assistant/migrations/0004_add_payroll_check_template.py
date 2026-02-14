import uuid
from django.db import migrations, models


def seed_payroll_check_template(apps, schema_editor):
    PromptTemplate = apps.get_model('assistant', 'PromptTemplate')
    PromptTemplate.objects.create(
        id=uuid.uuid4(),
        name='Check Payroll',
        description='Run consistency checks on a payroll run — verify math, statutory rates, and flag anomalies',
        prompt_text=(
            'Analyze this payroll run for consistency. Check the automated audit findings, '
            'review the employee details, and identify any anomalies or issues that need attention. '
            'Provide a clear summary of what looks correct and what needs review.'
        ),
        category='PAYROLL_CHECK',
        icon='BanknotesIcon',
        requires_file=False,
        sort_order=7,
        is_active=True,
    )


def remove_payroll_check_template(apps, schema_editor):
    PromptTemplate = apps.get_model('assistant', 'PromptTemplate')
    PromptTemplate.objects.filter(name='Check Payroll').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('assistant', '0003_seed_prompt_templates'),
    ]

    operations = [
        migrations.AlterField(
            model_name='prompttemplate',
            name='category',
            field=models.CharField(
                choices=[
                    ('DATA_ANALYSIS', 'Data Analysis'),
                    ('DATA_LOADING', 'Data Loading'),
                    ('VARIATION_CHECK', 'Variation Check'),
                    ('IMAGE_RECOGNITION', 'Image Recognition'),
                    ('DATA_EXTRACTION', 'Data Extraction'),
                    ('PAYROLL_CHECK', 'Payroll Check'),
                    ('GENERAL', 'General'),
                ],
                max_length=20,
            ),
        ),
        migrations.RunPython(seed_payroll_check_template, remove_payroll_check_template),
    ]
