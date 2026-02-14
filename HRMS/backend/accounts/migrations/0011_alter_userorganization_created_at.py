# Generated manually to align db_index with TimeStampedModel base class.

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0010_add_modules_to_role'),
    ]

    operations = [
        migrations.AlterField(
            model_name='userorganization',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, db_index=True),
        ),
    ]
