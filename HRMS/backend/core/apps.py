from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = 'core'
    default_auto_field = 'django.db.models.BigAutoField'

    def ready(self):
        """Setup signals and cache when app is ready."""
        # Import and setup cache invalidation signals
        try:
            from .caching import setup_cache_invalidation_signals
            setup_cache_invalidation_signals()
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to setup cache invalidation: {e}")
