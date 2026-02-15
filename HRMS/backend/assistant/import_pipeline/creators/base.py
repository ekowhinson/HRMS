"""
Shared utilities for entity creators.
"""

from decimal import Decimal, InvalidOperation
from datetime import date, datetime


def to_decimal(value, default=None):
    """Safely convert a value to Decimal."""
    if value is None or value == '':
        return default
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return default


def to_date(value, default=None):
    """Safely convert a value to a date object."""
    if value is None or value == '':
        return default
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%Y/%m/%d'):
        try:
            return datetime.strptime(str(value).strip(), fmt).date()
        except ValueError:
            continue
    return default


def to_bool(value, default=False):
    """Safely convert a value to boolean."""
    if value is None or value == '':
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ('true', '1', 'yes', 'y')


def to_str(value, default=''):
    """Safely convert to trimmed string."""
    if value is None:
        return default
    return str(value).strip()


def get_tenant_from_user(user):
    """Get the tenant from the current user context."""
    from core.middleware import get_current_tenant
    tenant = get_current_tenant()
    if tenant:
        return tenant
    if hasattr(user, 'tenant'):
        return user.tenant
    return None
