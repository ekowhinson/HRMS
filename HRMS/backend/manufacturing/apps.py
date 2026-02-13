"""App configuration for manufacturing module."""

from django.apps import AppConfig


class ManufacturingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'manufacturing'
    verbose_name = 'Manufacturing'

    def ready(self):
        import manufacturing.signals  # noqa: F401
