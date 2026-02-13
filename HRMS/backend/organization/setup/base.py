"""
Base seeder class for organization setup.
"""


class BaseSeeder:
    """Base class for all organization data seeders."""

    module_name = ''

    def __init__(self, org, year=None, stdout=None, style=None):
        self.org = org
        self.year = year
        self.stdout = stdout
        self.style = style
        self.stats = {'created': 0, 'updated': 0, 'skipped': 0}

    def seed(self):
        """Run the seeder. Must be implemented by subclasses."""
        raise NotImplementedError

    def _update_or_create(self, model_class, lookup, defaults):
        """
        Tenant-scoped update_or_create.
        Uses all_objects to bypass TenantAwareManager filtering.
        """
        lookup['tenant'] = self.org
        defaults['tenant'] = self.org
        obj, created = model_class.all_objects.update_or_create(
            **lookup, defaults=defaults
        )
        if created:
            self.stats['created'] += 1
        else:
            self.stats['updated'] += 1
        return obj, created

    def _get_or_create(self, model_class, lookup, defaults):
        """
        Tenant-scoped get_or_create.
        Uses all_objects to bypass TenantAwareManager filtering.
        """
        lookup['tenant'] = self.org
        defaults['tenant'] = self.org
        obj, created = model_class.all_objects.get_or_create(
            **lookup, defaults=defaults
        )
        if created:
            self.stats['created'] += 1
        else:
            self.stats['skipped'] += 1
        return obj, created

    def _get_or_create_global(self, model_class, lookup, defaults):
        """For global models without tenant FK (Role, Permission, etc.)."""
        obj, created = model_class.objects.get_or_create(
            **lookup, defaults=defaults
        )
        if created:
            self.stats['created'] += 1
        else:
            self.stats['skipped'] += 1
        return obj, created

    def _log(self, message):
        """Print output if stdout is available."""
        if self.stdout:
            self.stdout.write(f'  {message}')
