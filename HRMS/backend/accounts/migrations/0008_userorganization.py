"""
Add UserOrganization M2M through model and backfill existing user-org relationships.
"""

import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def backfill_user_organizations(apps, schema_editor):
    """
    For every user that has an organization FK set,
    create a UserOrganization row with is_default=True.
    """
    User = apps.get_model('accounts', 'User')
    UserOrganization = apps.get_model('accounts', 'UserOrganization')

    users_with_org = User.objects.filter(organization__isnull=False)
    created = 0
    for user in users_with_org.iterator():
        _, was_created = UserOrganization.objects.get_or_create(
            user=user,
            organization=user.organization,
            defaults={
                'role': 'member',
                'is_default': True,
            },
        )
        if was_created:
            created += 1

    if created:
        print(f"\n  Backfilled {created} UserOrganization rows.")


def reverse_backfill(apps, schema_editor):
    """Reverse is a no-op — the table will be dropped."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0007_user_organization'),
        ('organization', '0005_organization_costcenter_tenant_department_tenant_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='UserOrganization',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('role', models.CharField(
                    choices=[('member', 'Member'), ('admin', 'Admin'), ('viewer', 'Viewer')],
                    default='member',
                    max_length=50,
                )),
                ('is_default', models.BooleanField(default=False, help_text='Default organization selected on login')),
                ('joined_at', models.DateTimeField(auto_now_add=True)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='organization_users',
                    to='organization.organization',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='user_organizations',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'db_table': 'user_organizations',
                'ordering': ['-is_default', 'organization__name'],
                'unique_together': {('user', 'organization')},
            },
        ),
        migrations.RunPython(backfill_user_organizations, reverse_backfill),
    ]
