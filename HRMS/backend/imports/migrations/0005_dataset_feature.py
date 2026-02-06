# Generated migration for Dataset, DatasetFile, and JoinConfiguration models

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('imports', '0004_multi_file_import'),
    ]

    operations = [
        migrations.CreateModel(
            name='Dataset',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('name', models.CharField(help_text='Name for this dataset', max_length=200)),
                ('description', models.TextField(blank=True, help_text='Optional description of the dataset', null=True)),
                ('status', models.CharField(choices=[('DRAFT', 'Draft'), ('ANALYZING', 'Analyzing'), ('READY', 'Ready for Configuration'), ('MERGED', 'Merged'), ('SAVED', 'Saved'), ('FAILED', 'Failed')], db_index=True, default='DRAFT', max_length=20)),
                ('merged_data', models.BinaryField(blank=True, help_text='Merged CSV/JSON data', null=True)),
                ('merged_headers', models.JSONField(default=list, help_text='Column headers of the merged data')),
                ('merged_row_count', models.PositiveIntegerField(default=0, help_text='Total rows in merged data')),
                ('merged_sample_data', models.JSONField(default=list, help_text='First 10 rows of merged data for preview')),
                ('ai_analysis', models.JSONField(default=dict, help_text='AI-generated join suggestions and analysis')),
                ('file_count', models.PositiveIntegerField(default=0)),
                ('total_source_rows', models.PositiveIntegerField(default=0)),
                ('error_message', models.TextField(blank=True, help_text='Error message if merge failed', null=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
                ('deleted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_deleted', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'datasets',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='DatasetFile',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                # BinaryFileMixin fields
                ('file_data', models.BinaryField(blank=True, null=True)),
                ('file_name', models.CharField(blank=True, max_length=255, null=True)),
                ('file_size', models.PositiveIntegerField(blank=True, null=True)),
                ('mime_type', models.CharField(blank=True, max_length=100, null=True)),
                ('file_checksum', models.CharField(blank=True, max_length=64, null=True)),
                # DatasetFile specific fields
                ('file_type', models.CharField(max_length=20)),
                ('headers', models.JSONField(default=list, help_text='Column headers from source file')),
                ('sample_data', models.JSONField(default=list, help_text='Sample rows for preview (first 10 rows)')),
                ('row_count', models.PositiveIntegerField(default=0)),
                ('detected_data_types', models.JSONField(default=dict, help_text='Detected data type for each column')),
                ('detected_patterns', models.JSONField(default=dict, help_text='Detected patterns (id_columns, date_columns, etc.)')),
                ('alias', models.CharField(blank=True, help_text="Alias for use in joins (e.g., 'employees')", max_length=50)),
                ('order', models.PositiveIntegerField(default=0, help_text='Order of file in the dataset')),
                ('dataset', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='files', to='imports.dataset')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
                ('deleted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_deleted', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'dataset_files',
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.CreateModel(
            name='JoinConfiguration',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('is_deleted', models.BooleanField(db_index=True, default=False)),
                ('deleted_at', models.DateTimeField(blank=True, null=True)),
                ('left_column', models.CharField(max_length=255)),
                ('right_column', models.CharField(max_length=255)),
                ('join_type', models.CharField(choices=[('inner', 'Inner Join'), ('left', 'Left Join'), ('right', 'Right Join'), ('outer', 'Outer Join')], default='left', max_length=10)),
                ('is_ai_suggested', models.BooleanField(default=False)),
                ('ai_confidence', models.FloatField(default=0.0, help_text='AI confidence score (0-1)')),
                ('ai_reasoning', models.TextField(blank=True, help_text='AI explanation for this join suggestion')),
                ('relationship_type', models.CharField(blank=True, choices=[('1:1', 'One to One'), ('1:N', 'One to Many'), ('N:1', 'Many to One'), ('N:N', 'Many to Many')], help_text='Detected relationship cardinality', max_length=5)),
                ('sample_matches', models.JSONField(default=list, help_text='Sample matching rows to validate the join')),
                ('order', models.PositiveIntegerField(default=0, help_text='Order of join execution')),
                ('dataset', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='joins', to='imports.dataset')),
                ('left_file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='joins_as_left', to='imports.datasetfile')),
                ('right_file', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='joins_as_right', to='imports.datasetfile')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_created', to=settings.AUTH_USER_MODEL)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_updated', to=settings.AUTH_USER_MODEL)),
                ('deleted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='%(class)s_deleted', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'join_configurations',
                'ordering': ['order', 'created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='datasetfile',
            index=models.Index(fields=['dataset', 'order'], name='dataset_fil_dataset_e1f3f4_idx'),
        ),
        migrations.AddIndex(
            model_name='joinconfiguration',
            index=models.Index(fields=['dataset', 'order'], name='join_config_dataset_a2b3c4_idx'),
        ),
    ]
