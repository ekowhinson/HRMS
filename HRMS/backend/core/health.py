"""
Health check views for NHIA HRMS.

Three tiers of health endpoints:
  /healthz/     Liveness  — always 200 if the process is alive (no DB/Redis)
  /readyz/      Readiness — checks DB, Redis, and reports degraded components
  /api/status/  Detailed  — admin-only, includes versions, uptime, request stats
"""

import logging
import time

import django
from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response

logger = logging.getLogger('nhia_hrms')

# Process start time for uptime calculation
_process_start = time.monotonic()


def healthz(request):
    """
    Liveness probe — Kubernetes / Cloud Run uses this to know the process
    is alive. No dependency checks; returns 200 instantly.
    """
    return JsonResponse({'status': 'alive'}, status=200)


def readyz(request):
    """
    Readiness probe — returns 200 only when all critical dependencies
    are reachable. Cloud Run uses this to decide whether to route traffic.

    Checks: PostgreSQL, Redis (if configured).
    Returns 503 if any critical dependency is down.
    """
    checks = {}
    healthy = True

    # ── Database check ─────────────────────────────────────────────────────
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        checks['database'] = 'ok'
    except Exception as e:
        checks['database'] = f'error: {e}'
        healthy = False
        logger.error("Readiness check: database unreachable", extra={
            'event': 'readiness_failure',
            'component': 'database',
            'error': str(e),
        })

    # ── Redis check ────────────────────────────────────────────────────────
    try:
        from django.core.cache import caches
        cache = caches['default']
        cache.set('_readyz_probe', 1, timeout=10)
        val = cache.get('_readyz_probe')
        if val == 1:
            checks['cache'] = 'ok'
        else:
            checks['cache'] = 'error: cache read returned unexpected value'
            healthy = False
    except Exception as e:
        # In development with LocMemCache, this will always pass
        checks['cache'] = f'error: {e}'
        healthy = False
        logger.error("Readiness check: cache unreachable", extra={
            'event': 'readiness_failure',
            'component': 'cache',
            'error': str(e),
        })

    status_code = 200 if healthy else 503
    return JsonResponse(
        {
            'status': 'ready' if healthy else 'not_ready',
            'checks': checks,
        },
        status=status_code,
    )


@api_view(['GET'])
@permission_classes([IsAdminUser])
def system_status(request):
    """
    Detailed system status — admin-only.

    Returns versions, uptime, dependency health, request timing percentiles,
    Celery worker status, and cache hit statistics.
    """
    from core.logging import request_stats

    status = {
        'service': 'NHIA HRMS API',
        'version': getattr(settings, 'VERSION', '1.0.0'),
        'environment': getattr(settings, 'DJANGO_ENV', 'unknown'),
        'django_version': django.get_version(),
        'debug': settings.DEBUG,
    }

    # ── Uptime ─────────────────────────────────────────────────────────────
    uptime_secs = round(time.monotonic() - _process_start)
    hours, remainder = divmod(uptime_secs, 3600)
    minutes, seconds = divmod(remainder, 60)
    status['uptime'] = f'{hours}h {minutes}m {seconds}s'
    status['uptime_seconds'] = uptime_secs

    # ── Request timing percentiles ─────────────────────────────────────────
    status['request_stats'] = request_stats.get_stats()

    # ── Database ───────────────────────────────────────────────────────────
    db_status = {}
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        db_status['status'] = 'ok'
        db_status['engine'] = settings.DATABASES['default']['ENGINE']
        db_status['name'] = settings.DATABASES['default']['NAME']
        db_status['host'] = settings.DATABASES['default'].get('HOST', 'localhost')

        # Connection count (PostgreSQL only)
        if 'postgresql' in settings.DATABASES['default']['ENGINE']:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT count(*) FROM pg_stat_activity "
                    "WHERE datname = current_database()"
                )
                db_status['active_connections'] = cursor.fetchone()[0]
    except Exception as e:
        db_status['status'] = f'error: {e}'
    status['database'] = db_status

    # ── Cache ──────────────────────────────────────────────────────────────
    cache_status = {}
    try:
        from django.core.cache import caches
        for alias in ('default', 'persistent', 'volatile'):
            try:
                cache = caches[alias]
                cache.set(f'_status_probe_{alias}', 1, timeout=10)
                cache.get(f'_status_probe_{alias}')
                cache_status[alias] = 'ok'
            except Exception as e:
                cache_status[alias] = f'error: {e}'
    except Exception as e:
        cache_status['error'] = str(e)
    status['cache'] = cache_status

    # ── Celery ─────────────────────────────────────────────────────────────
    celery_status = {}
    try:
        from config.celery import app as celery_app
        inspector = celery_app.control.inspect(timeout=2)
        active = inspector.active()
        if active:
            celery_status['status'] = 'ok'
            celery_status['workers'] = len(active)
            celery_status['active_tasks'] = sum(len(tasks) for tasks in active.values())
        else:
            celery_status['status'] = 'no_workers'
    except Exception as e:
        celery_status['status'] = f'error: {e}'
    status['celery'] = celery_status

    # ── Cached health metrics (from periodic task) ─────────────────────────
    try:
        from django.core.cache import caches
        metrics = caches['volatile'].get('health_metrics')
        if metrics:
            status['last_health_metrics'] = metrics
    except Exception:
        pass

    return Response(status)
