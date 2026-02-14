"""
Base Django settings for HRMS.

Contains all environment-agnostic configuration. Environment-specific settings
(SECRET_KEY, DEBUG, DATABASES, CACHES, CORS, LOGGING, security flags) are
defined in development.py, staging.py, or production.py.
"""

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# One level deeper than before (config/settings/base.py instead of config/settings.py)
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'drf_spectacular',
    'django_extensions',
    'django_celery_beat',

    # Local apps
    'core.apps.CoreConfig',
    'accounts.apps.AccountsConfig',
    'employees.apps.EmployeesConfig',
    'organization.apps.OrganizationConfig',
    'recruitment.apps.RecruitmentConfig',
    'leave.apps.LeaveConfig',
    'benefits.apps.BenefitsConfig',
    'performance.apps.PerformanceConfig',
    'discipline.apps.DisciplineConfig',
    'payroll.apps.PayrollConfig',
    'reports.apps.ReportsConfig',
    'workflow.apps.WorkflowConfig',
    'policies.apps.PoliciesConfig',
    'exits.apps.ExitsConfig',
    'training.apps.TrainingConfig',
    'finance.apps.FinanceConfig',
    'procurement.apps.ProcurementConfig',
    'inventory.apps.InventoryConfig',
    'projects.apps.ProjectsConfig',
    'assistant.apps.AssistantConfig',
    'manufacturing.apps.ManufacturingConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'core.middleware.TenantMiddleware',
    'core.middleware.ModuleAccessMiddleware',
    'core.middleware.CurrentUserMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'core.middleware.AuditLogMiddleware',
    'core.middleware.SecurityHeadersMiddleware',
    'core.middleware.CacheControlMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Custom User Model
AUTH_USER_MODEL = 'accounts.User'

# Authentication Backends (Multi-provider support)
AUTHENTICATION_BACKENDS = [
    'accounts.backends.local.LocalAuthBackend',
    'accounts.backends.ldap.LDAPAuthBackend',
    'accounts.backends.azure_ad.AzureADBackend',
    'django.contrib.auth.backends.ModelBackend',  # Fallback for admin
]

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
        'OPTIONS': {
            'min_length': 8,
        }
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = os.getenv('TIME_ZONE', 'UTC')
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = os.getenv('STATIC_ROOT', BASE_DIR / 'staticfiles')
STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = os.getenv('MEDIA_ROOT', BASE_DIR / 'media')

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# REST Framework Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'core.authentication.AuditJWTAuthentication',
        'core.authentication.AuditSessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
        'rest_framework.filters.SearchFilter',
        'rest_framework.filters.OrderingFilter',
    ],
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardResultsSetPagination',
    'PAGE_SIZE': 25,
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '10000/hour',
        'login': '5/minute',
        'password_reset': '3/hour',
        'application_submit': '10/hour',
        'portal_login': '5/minute',
    },
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
}

# JWT Configuration — SIGNING_KEY is overridden per-environment
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.getenv('ACCESS_TOKEN_LIFETIME_MINUTES', 30))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.getenv('REFRESH_TOKEN_LIFETIME_DAYS', 1))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': 'override-in-environment-settings',
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'AUTH_TOKEN_CLASSES': ('rest_framework_simplejwt.tokens.AccessToken',),
    'TOKEN_TYPE_CLAIM': 'token_type',
}

# API Documentation
SPECTACULAR_SETTINGS = {
    'TITLE': 'HRMS API',
    'DESCRIPTION': 'Human Resource Management System API',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SCHEMA_PATH_PREFIX': '/api/v1',
    'COMPONENT_SPLIT_REQUEST': True,
    'TAGS': [
        {'name': 'Authentication', 'description': 'User authentication and authorization'},
        {'name': 'Employees', 'description': 'Employee management'},
        {'name': 'Organization', 'description': 'Organization structure management'},
        {'name': 'Leave', 'description': 'Leave management'},
        {'name': 'Payroll', 'description': 'Payroll processing'},
        {'name': 'Benefits', 'description': 'Benefits and loans management'},
        {'name': 'Performance', 'description': 'Performance and appraisals'},
        {'name': 'Recruitment', 'description': 'Recruitment and hiring'},
        {'name': 'Discipline', 'description': 'Discipline and grievances'},
        {'name': 'Reports', 'description': 'Reporting and analytics'},
        {'name': 'Finance', 'description': 'General ledger, AP/AR, budgets, and banking'},
        {'name': 'Procurement', 'description': 'Purchase requisitions, orders, and contracts'},
        {'name': 'Inventory', 'description': 'Stock management and fixed assets'},
        {'name': 'Projects', 'description': 'Project management and timesheets'},
    ],
}

# Celery Configuration
CELERY_BROKER_URL = os.getenv('CELERY_BROKER_URL', 'redis://localhost:6379/0')
CELERY_RESULT_BACKEND = os.getenv('CELERY_RESULT_BACKEND', 'redis://localhost:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 30 * 60  # 30 minutes

# Email Configuration
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', 587))
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_USE_SSL = os.getenv('EMAIL_USE_SSL', 'False').lower() == 'true'
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@example.com')

# File Upload Settings
FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 MB
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10 MB

# Frontend URL for email links
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:3000')

# Admin URL path (obscured for security)
ADMIN_URL_PATH = os.getenv('ADMIN_URL_PATH', 'sys-admin/')

# HRMS Specific Settings
HRMS_SETTINGS = {
    'ORGANIZATION_NAME': os.getenv('ORG_NAME', 'Your Organization'),
    'ORGANIZATION_CODE': os.getenv('ORG_CODE', 'ORG'),
    'COUNTRY': os.getenv('ORG_COUNTRY', ''),
    'CURRENCY': os.getenv('ORG_CURRENCY', 'USD'),
    'CURRENCY_SYMBOL': os.getenv('ORG_CURRENCY_SYMBOL', '$'),
    'FINANCIAL_YEAR_START_MONTH': 1,  # January
    'LEAVE_YEAR_START_MONTH': 1,  # January
    'PAYROLL_PROCESSING_DAY': 25,  # Day of month
    'MAX_FAILED_LOGIN_ATTEMPTS': 5,
    'ACCOUNT_LOCKOUT_DURATION_MINUTES': 30,
    'PASSWORD_EXPIRY_DAYS': 90,
    'SESSION_TIMEOUT_MINUTES': 30,
}

# Backup & Restore Settings
BACKUP_SETTINGS = {
    'STORAGE_BACKEND': os.getenv('BACKUP_STORAGE', 'local'),
    'LOCAL_PATH': os.getenv('BACKUP_PATH', '/var/backups/hrms/'),
    'S3_BUCKET': os.getenv('BACKUP_S3_BUCKET', ''),
    'S3_PREFIX': os.getenv('BACKUP_S3_PREFIX', 'backups/'),
    'MAX_INLINE_SIZE_MB': 50,
    'DEFAULT_RETENTION_DAYS': 90,
    'COMPRESSION': 'gzip',
}

# ── Ollama AI Assistant ──────────────────────────────────────────
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3.1')
OLLAMA_VISION_MODEL = os.getenv('OLLAMA_VISION_MODEL', 'llava')
