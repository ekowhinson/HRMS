"""
Management command to flush caches by alias.

Usage:
    python manage.py flush_caches                  # Flush all cache aliases
    python manage.py flush_caches --alias default   # Flush specific alias
    python manage.py flush_caches --alias long      # Flush long cache only
"""

import logging
from django.core.management.base import BaseCommand, CommandError

logger = logging.getLogger(__name__)

ALL_ALIASES = ['default', 'persistent', 'volatile', 'long', 'sessions']


class Command(BaseCommand):
    help = 'Flush HRMS caches by alias'

    def add_arguments(self, parser):
        parser.add_argument(
            '--alias',
            type=str,
            default='all',
            choices=['all'] + ALL_ALIASES,
            help='Cache alias to flush (default: all)',
        )

    def handle(self, *args, **options):
        from django.core.cache import caches

        alias = options['alias']

        if alias == 'all':
            aliases_to_flush = ALL_ALIASES
        else:
            aliases_to_flush = [alias]

        flushed = []
        for cache_alias in aliases_to_flush:
            try:
                caches[cache_alias].clear()
                flushed.append(cache_alias)
                self.stdout.write(f'  Flushed: {cache_alias}')
            except Exception as e:
                self.stdout.write(self.style.WARNING(
                    f'  Failed to flush {cache_alias}: {e}'
                ))

        if flushed:
            self.stdout.write(self.style.SUCCESS(
                f'Successfully flushed {len(flushed)} cache(s): {", ".join(flushed)}'
            ))
        else:
            self.stdout.write(self.style.ERROR('No caches were flushed'))
