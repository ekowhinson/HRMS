"""
Staging settings for HRMS.

Loaded when DJANGO_ENV="staging".
Mirrors production security with shorter HSTS and more verbose logging.
"""

import os
import sys

from config.settings.base import *  # noqa: F401,F403
from config.settings.base import INSTALLED_APPS, MIDDLEWARE, SIMPLE_JWT

DJANGO_ENV = 'staging'

# ── Fail-hard checks ────────────────────────────────────────────────────────
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    sys.exit("FATAL: SECRET_KEY environment variable is required in staging.")

DEBUG = False

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')
ALLOWED_HOSTS = [h.strip() for h in ALLOWED_HOSTS if h.strip()]
if not ALLOWED_HOSTS:
    sys.exit("FATAL: ALLOWED_HOSTS environment variable is required in staging.")

# JWT signing key
SIMPLE_JWT['SIGNING_KEY'] = SECRET_KEY

# ── Database — PostgreSQL required ───────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'hrms'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        'CONN_MAX_AGE': 600,
        'CONN_HEALTH_CHECKS': True,
        'OPTIONS': {
            'connect_timeout': 10,
        },
    }
}

# ── CORS — strict whitelist ──────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    'GET',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
]
CORS_ALLOW_HEADERS = [
    'accept',
    'authorization',
    'content-type',
    'origin',
    'x-csrftoken',
    'x-request-id',
]

# ── CSRF ─────────────────────────────────────────────────────────────────────
CSRF_TRUSTED_ORIGINS = [
    o.strip()
    for o in os.environ.get('CSRF_TRUSTED_ORIGINS', '').split(',')
    if o.strip()
]

# ── Security ─────────────────────────────────────────────────────────────────
SECURE_SSL_REDIRECT = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 3600  # 1 hour — shorter than production
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = False
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# ── Cache — Redis required ───────────────────────────────────────────────────
REDIS_CACHE_URL = os.environ.get('REDIS_CACHE_URL', 'redis://localhost:6379/1')

CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_CACHE_URL,
        'KEY_PREFIX': 'hrms',
        'TIMEOUT': 300,
    },
    'persistent': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_CACHE_URL,
        'KEY_PREFIX': 'hrms_persist',
        'TIMEOUT': 86400,
    },
    'volatile': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_CACHE_URL,
        'KEY_PREFIX': 'hrms_volatile',
        'TIMEOUT': 60,
    },
    'long': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_CACHE_URL,
        'KEY_PREFIX': 'hrms_long',
        'TIMEOUT': 3600,
    },
    'sessions': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': REDIS_CACHE_URL,
        'KEY_PREFIX': 'hrms_sessions',
        'TIMEOUT': 86400,
    },
}

SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
SESSION_CACHE_ALIAS = 'sessions'

# ── Sentry — error tracking ──────────────────────────────────────────────────
SENTRY_DSN = os.environ.get('SENTRY_DSN', '')
if SENTRY_DSN:
    import sentry_sdk
    from sentry_sdk.integrations.django import DjangoIntegration
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.redis import RedisIntegration
    from sentry_sdk.integrations.logging import LoggingIntegration

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        integrations=[
            DjangoIntegration(transaction_style='url'),
            CeleryIntegration(monitor_beat_tasks=True),
            RedisIntegration(),
            LoggingIntegration(
                level=None,
                event_level='ERROR',
            ),
        ],
        environment='staging',
        release=os.environ.get('APP_VERSION', 'unknown'),
        traces_sample_rate=float(os.environ.get('SENTRY_TRACES_RATE', '0.2')),
        profiles_sample_rate=float(os.environ.get('SENTRY_PROFILES_RATE', '0.2')),
        send_default_pii=False,
    )

# ── Logging — structured JSON to stdout ──────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'json': {
            '()': 'core.logging.HRMSJsonFormatter',
            'fmt': '%(asctime)s %(levelname)s %(name)s %(message)s',
        },
    },
    'filters': {
        'celery_context': {
            '()': 'core.logging.CeleryTaskFilter',
        },
    },
    'handlers': {
        'stdout': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
            'filters': ['celery_context'],
        },
        'sql_slow': {
            '()': 'core.logging.SQLQueryLogger',
            'warning_ms': 100,   # Staging: warn at 100ms
            'error_ms': 1000,    # Staging: error at 1s
        },
    },
    'root': {
        'handlers': ['stdout'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['stdout'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['stdout'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['sql_slow'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'hrms': {
            'handlers': ['stdout'],
            'level': 'INFO',
            'propagate': False,
        },
        'hrms.sql.slow': {
            'handlers': ['stdout'],
            'level': 'WARNING',
            'propagate': False,
        },
        'celery': {
            'handlers': ['stdout'],
            'level': 'INFO',
            'propagate': False,
        },
    },
}

# ── WhiteNoise for static files ──────────────────────────────────────────────
# Insert after SecurityMiddleware (index 0)
if 'whitenoise.middleware.WhiteNoiseMiddleware' not in MIDDLEWARE:
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')

STORAGES = {
    'staticfiles': {
        'BACKEND': 'whitenoise.storage.CompressedManifestStaticFilesStorage',
    },
}
