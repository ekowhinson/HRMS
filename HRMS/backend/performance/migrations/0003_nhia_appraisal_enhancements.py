# Generated migration for NHIA Appraisal Enhancements

import uuid
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('employees', '0001_initial'),
        ('performance', '0002_remove_developmentactivity_evidence_and_more'),
    ]

    operations = [
        # Add weight configuration fields to AppraisalCycle
        migrations.AddField(
            model_name='appraisalcycle',
            name='objectives_weight',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('60'),
                help_text='Weight percentage for objectives/goals component',
                max_digits=5
            ),
        ),
        migrations.AddField(
            model_name='appraisalcycle',
            name='competencies_weight',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('20'),
                help_text='Weight percentage for competencies component',
                max_digits=5
            ),
        ),
        migrations.AddField(
            model_name='appraisalcycle',
            name='values_weight',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('20'),
                help_text='Weight percentage for core values component',
                max_digits=5
            ),
        ),
        migrations.AddField(
            model_name='appraisalcycle',
            name='pass_mark',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('60'),
                help_text='Minimum score to pass appraisal',
                max_digits=5
            ),
        ),
        migrations.AddField(
            model_name='appraisalcycle',
            name='increment_threshold',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('70'),
                help_text='Minimum score for salary increment eligibility',
                max_digits=5
            ),
        ),
        migrations.AddField(
            model_name='appraisalcycle',
            name='promotion_threshold',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('85'),
                help_text='Minimum score for promotion consideration',
                max_digits=5
            ),
        ),
        migrations.AddField(
            model_name='appraisalcycle',
            name='pip_threshold',
            field=models.DecimalField(
                decimal_places=2, default=Decimal('40'),
                help_text='Score below which PIP is required',
                max_digits=5
            ),
        ),

        # Add core values rating fields to Appraisal
        migrations.AddField(
            model_name='appraisal',
            name='values_self_rating',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=5, null=True
            ),
        ),
        migrations.AddField(
            model_name='appraisal',
            name='values_manager_rating',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=5, null=True
            ),
        ),
        migrations.AddField(
            model_name='appraisal',
            name='values_final_rating',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=5, null=True
            ),
        ),
        migrations.AddField(
            model_name='appraisal',
            name='weighted_objectives_score',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=5, null=True
            ),
        ),
        migrations.AddField(
            model_name='appraisal',
            name='weighted_competencies_score',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=5, null=True
            ),
        ),
        migrations.AddField(
            model_name='appraisal',
            name='weighted_values_score',
            field=models.DecimalField(
                blank=True, decimal_places=2, max_digits=5, null=True
            ),
        ),

        # Create CoreValue model
        migrations.CreateModel(
            name='CoreValue',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('deleted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_deleted', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
                ('name', models.CharField(max_length=100)),
                ('code', models.CharField(max_length=20, unique=True)),
                ('description', models.TextField()),
                ('behavioral_indicators', models.TextField(blank=True, help_text='Behavioral indicators that demonstrate this value')),
                ('is_active', models.BooleanField(default=True)),
                ('sort_order', models.PositiveIntegerField(default=0)),
            ],
            options={
                'ordering': ['sort_order', 'name'],
            },
        ),

        # Create CoreValueAssessment model
        migrations.CreateModel(
            name='CoreValueAssessment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('deleted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_deleted', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
                ('self_rating', models.IntegerField(blank=True, null=True)),
                ('self_comments', models.TextField(blank=True)),
                ('manager_rating', models.IntegerField(blank=True, null=True)),
                ('manager_comments', models.TextField(blank=True)),
                ('final_rating', models.IntegerField(blank=True, null=True)),
                ('appraisal', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='value_assessments', to='performance.appraisal')),
                ('core_value', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='performance.corevalue')),
            ],
            options={
                'unique_together': {('appraisal', 'core_value')},
            },
        ),

        # Create ProbationAssessment model
        migrations.CreateModel(
            name='ProbationAssessment',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('deleted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_deleted', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
                ('assessment_period', models.CharField(choices=[('3M', '3 Months'), ('6M', '6 Months'), ('12M', '12 Months')], max_length=5)),
                ('assessment_date', models.DateField()),
                ('due_date', models.DateField()),
                ('overall_rating', models.DecimalField(blank=True, decimal_places=2, max_digits=5, null=True)),
                ('job_knowledge', models.IntegerField(blank=True, help_text='Understanding of job responsibilities and requirements', null=True)),
                ('work_quality', models.IntegerField(blank=True, help_text='Accuracy, thoroughness, and reliability of work', null=True)),
                ('attendance_punctuality', models.IntegerField(blank=True, help_text='Attendance record and punctuality', null=True)),
                ('teamwork', models.IntegerField(blank=True, help_text='Ability to work effectively with colleagues', null=True)),
                ('communication', models.IntegerField(blank=True, help_text='Verbal and written communication skills', null=True)),
                ('initiative', models.IntegerField(blank=True, help_text='Self-motivation and proactive approach', null=True)),
                ('supervisor_comments', models.TextField(blank=True)),
                ('employee_comments', models.TextField(blank=True)),
                ('hr_comments', models.TextField(blank=True)),
                ('status', models.CharField(choices=[('DRAFT', 'Draft'), ('SUBMITTED', 'Submitted'), ('REVIEWED', 'Under Review'), ('CONFIRMED', 'Confirmed'), ('EXTENDED', 'Probation Extended'), ('TERMINATED', 'Employment Terminated')], default='DRAFT', max_length=20)),
                ('recommendation', models.TextField(blank=True)),
                ('extension_duration', models.PositiveIntegerField(blank=True, help_text='Extension duration in months if probation extended', null=True)),
                ('reviewed_at', models.DateTimeField(blank=True, null=True)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('approved_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='approved_probations', to=settings.AUTH_USER_MODEL)),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='probation_assessments', to='employees.employee')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_probations', to='employees.employee')),
            ],
            options={
                'ordering': ['-due_date'],
            },
        ),

        # Create TrainingNeed model
        migrations.CreateModel(
            name='TrainingNeed',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('deleted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_deleted', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField()),
                ('training_type', models.CharField(choices=[('TRAINING', 'Training Course'), ('CERTIFICATION', 'Certification'), ('WORKSHOP', 'Workshop'), ('CONFERENCE', 'Conference'), ('MENTORING', 'Mentoring'), ('ONLINE', 'Online Course'), ('ON_THE_JOB', 'On-the-Job Training'), ('OTHER', 'Other')], default='TRAINING', max_length=20)),
                ('priority', models.CharField(choices=[('HIGH', 'High'), ('MEDIUM', 'Medium'), ('LOW', 'Low')], default='MEDIUM', max_length=10)),
                ('target_date', models.DateField(blank=True, null=True)),
                ('completion_date', models.DateField(blank=True, null=True)),
                ('status', models.CharField(choices=[('IDENTIFIED', 'Identified'), ('SCHEDULED', 'Scheduled'), ('IN_PROGRESS', 'In Progress'), ('COMPLETED', 'Completed'), ('CANCELLED', 'Cancelled')], default='IDENTIFIED', max_length=20)),
                ('estimated_cost', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('actual_cost', models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)),
                ('training_provider', models.CharField(blank=True, max_length=200)),
                ('outcome', models.TextField(blank=True)),
                ('appraisal', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='training_needs', to='performance.appraisal')),
                ('competency', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='training_needs', to='performance.competency')),
                ('employee', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='training_needs', to='employees.employee')),
            ],
            options={
                'ordering': ['-priority', 'target_date'],
            },
        ),

        # Create PerformanceAppeal model
        migrations.CreateModel(
            name='PerformanceAppeal',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('deleted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_deleted', to=settings.AUTH_USER_MODEL)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
                ('appeal_number', models.CharField(max_length=20, unique=True)),
                ('grounds', models.TextField(help_text='Reason for appeal')),
                ('disputed_ratings', models.JSONField(default=dict, help_text='Which ratings are disputed (e.g., {"goals": true, "competencies": false})')),
                ('requested_remedy', models.TextField()),
                ('supporting_evidence', models.TextField(blank=True)),
                ('submitted_at', models.DateTimeField(auto_now_add=True)),
                ('status', models.CharField(choices=[('SUBMITTED', 'Submitted'), ('UNDER_REVIEW', 'Under Review'), ('HEARING', 'Hearing Scheduled'), ('UPHELD', 'Appeal Upheld'), ('PARTIAL', 'Partially Upheld'), ('DISMISSED', 'Dismissed'), ('WITHDRAWN', 'Withdrawn')], default='SUBMITTED', max_length=20)),
                ('review_comments', models.TextField(blank=True)),
                ('hearing_date', models.DateTimeField(blank=True, null=True)),
                ('decision', models.TextField(blank=True)),
                ('revised_ratings', models.JSONField(blank=True, default=dict, help_text='Revised ratings if appeal upheld')),
                ('decision_date', models.DateTimeField(blank=True, null=True)),
                ('appraisal', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='appeals', to='performance.appraisal')),
                ('decided_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='decided_performance_appeals', to=settings.AUTH_USER_MODEL)),
                ('reviewer', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_performance_appeals', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-submitted_at'],
            },
        ),
    ]
