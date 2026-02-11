"""
Structured logging utilities for NHIA HRMS.

Provides:
- HRMSJsonFormatter: Custom JSON formatter that injects request_id and trace_id
- SQLQueryLogger: Database backend logger for slow query detection
- CeleryTaskFilter: Adds task context to Celery worker log records
"""

import logging
import threading
import time

from pythonjsonlogger.json import JsonFormatter


# Thread-local for storing request context used by the formatter
_log_context = threading.local()


def set_log_context(**kwargs):
    """Set key-value pairs on the thread-local log context."""
    for key, value in kwargs.items():
        setattr(_log_context, key, value)


def clear_log_context():
    """Clear all thread-local log context."""
    _log_context.__dict__.clear()


def get_log_context():
    """Return the current thread-local context as a dict."""
    return dict(_log_context.__dict__)


class HRMSJsonFormatter(JsonFormatter):
    """
    JSON formatter that automatically injects request_id and trace_id
    from thread-local context into every log record.

    Usage in LOGGING config:
        'formatters': {
            'json': {
                '()': 'core.logging.HRMSJsonFormatter',
                'fmt': '%(asctime)s %(levelname)s %(name)s %(message)s',
            },
        }
    """

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)

        # Inject thread-local context (request_id, trace_id, user_id)
        ctx = get_log_context()
        for key in ('request_id', 'trace_id', 'user_id'):
            if key not in log_record and key in ctx:
                log_record[key] = ctx[key]

        # Ensure logger name and level are always present
        log_record.setdefault('logger', record.name)
        log_record.setdefault('level', record.levelname)

        # Add source location for ERROR and above
        if record.levelno >= logging.ERROR:
            log_record.setdefault('source', f'{record.pathname}:{record.lineno}')
            log_record.setdefault('func', record.funcName)


class SQLQueryLogger(logging.Handler):
    """
    Logging handler that captures Django's django.db.backends queries
    and re-emits slow queries at WARNING/ERROR level.

    Thresholds are configurable:
      - warning_ms: queries slower than this are logged at WARNING (default 100ms)
      - error_ms: queries slower than this are logged at ERROR (default 1000ms)

    Usage in LOGGING config:
        'handlers': {
            'sql_slow': {
                '()': 'core.logging.SQLQueryLogger',
                'warning_ms': 100,
                'error_ms': 1000,
            },
        }
    """

    def __init__(self, warning_ms=100, error_ms=1000, **kwargs):
        super().__init__(**kwargs)
        self.warning_ms = warning_ms
        self.error_ms = error_ms
        self._slow_logger = logging.getLogger('nhia_hrms.sql.slow')

    def emit(self, record):
        # django.db.backends logs contain 'duration' and 'sql' in the params
        try:
            duration = getattr(record, 'duration', None)
            if duration is None:
                return

            duration_ms = duration * 1000  # Convert seconds to ms

            if duration_ms < self.warning_ms:
                return

            sql = getattr(record, 'sql', record.getMessage())
            params = getattr(record, 'params', None)
            ctx = get_log_context()

            extra = {
                'duration_ms': round(duration_ms, 2),
                'sql': str(sql)[:2000],  # Truncate very long queries
                'event': 'slow_query',
                'request_id': ctx.get('request_id', ''),
            }

            if params:
                extra['params'] = str(params)[:500]

            if duration_ms >= self.error_ms:
                self._slow_logger.error(
                    "Slow SQL query: %.0fms",
                    duration_ms,
                    extra=extra,
                )
            else:
                self._slow_logger.warning(
                    "Slow SQL query: %.0fms",
                    duration_ms,
                    extra=extra,
                )
        except Exception:
            self.handleError(record)


class CeleryTaskFilter(logging.Filter):
    """
    Logging filter that injects Celery task context into log records.

    Adds task_id and task_name from the current Celery worker context
    when running inside a task.

    Usage in LOGGING config:
        'filters': {
            'celery_context': {
                '()': 'core.logging.CeleryTaskFilter',
            },
        }
    """

    def filter(self, record):
        try:
            from celery._state import get_current_task
            task = get_current_task()
            if task and task.request:
                record.task_id = task.request.id
                record.task_name = task.name
            else:
                record.task_id = ''
                record.task_name = ''
        except Exception:
            record.task_id = ''
            record.task_name = ''
        return True


class RequestTimingCollector:
    """
    Collects request timing percentiles in memory for the /api/status/ endpoint.

    Thread-safe ring buffer that stores the last N request durations.
    """

    def __init__(self, max_samples=1000):
        self._lock = threading.Lock()
        self._samples = []
        self._max = max_samples
        self._total_requests = 0
        self._start_time = time.monotonic()

    def record(self, duration_ms):
        with self._lock:
            self._total_requests += 1
            if len(self._samples) >= self._max:
                self._samples.pop(0)
            self._samples.append(duration_ms)

    def get_stats(self):
        with self._lock:
            if not self._samples:
                return {
                    'total_requests': self._total_requests,
                    'uptime_seconds': round(time.monotonic() - self._start_time),
                    'p50_ms': 0,
                    'p95_ms': 0,
                    'p99_ms': 0,
                    'avg_ms': 0,
                }
            sorted_samples = sorted(self._samples)
            n = len(sorted_samples)
            return {
                'total_requests': self._total_requests,
                'sample_size': n,
                'uptime_seconds': round(time.monotonic() - self._start_time),
                'p50_ms': round(sorted_samples[int(n * 0.50)], 2),
                'p95_ms': round(sorted_samples[int(n * 0.95)], 2),
                'p99_ms': round(sorted_samples[min(int(n * 0.99), n - 1)], 2),
                'avg_ms': round(sum(sorted_samples) / n, 2),
                'max_ms': round(sorted_samples[-1], 2),
            }


# Global instance — imported by AuditLogMiddleware and health views
request_stats = RequestTimingCollector()
