"""
Core email service for HRMS.

Provides centralized email sending via SendGrid Web API v3,
with async Celery dispatch, HTML templates, and delivery logging.
"""

from .events import EmailEvent
from .service import send_email

__all__ = ['send_email', 'EmailEvent']
