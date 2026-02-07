"""
Two-Factor Authentication policy helper.
Reads org-wide 2FA policy from SystemConfiguration.
"""

import json
from datetime import timedelta
from django.utils import timezone


class TFAPolicy:
    """Reads and evaluates 2FA policy stored in SystemConfiguration."""

    KEYS = {
        'tfa_enforcement': ('string', 'optional'),
        'tfa_allowed_methods': ('json', '["EMAIL","SMS","TOTP"]'),
        'tfa_grace_period_days': ('integer', '7'),
    }

    @classmethod
    def get(cls, key):
        """Read a policy value from SystemConfiguration, falling back to defaults."""
        from core.models import SystemConfiguration

        value_type, default = cls.KEYS[key]
        try:
            config = SystemConfiguration.objects.get(key=key)
            return config.get_value()
        except SystemConfiguration.DoesNotExist:
            if value_type == 'integer':
                return int(default)
            elif value_type == 'json':
                return json.loads(default)
            return default

    @classmethod
    def is_required_for(cls, user):
        """Check if 2FA is required for the given user."""
        enforcement = cls.get('tfa_enforcement')
        if enforcement == 'optional':
            return False
        if enforcement == 'required':
            return True
        if enforcement == 'required_admins':
            return user.is_staff or user.is_superuser
        return False

    @classmethod
    def allowed_methods(cls):
        """Return list of allowed 2FA methods."""
        return cls.get('tfa_allowed_methods')

    @classmethod
    def grace_period_days(cls):
        """Return grace period in days."""
        return cls.get('tfa_grace_period_days')

    @classmethod
    def grace_deadline_for(cls, user):
        """Return the grace period deadline for a user, or None."""
        if not cls.is_required_for(user):
            return None
        days = cls.grace_period_days()
        return user.created_at + timedelta(days=days)

    @classmethod
    def is_within_grace(cls, user):
        """Check if user is still within the grace period."""
        deadline = cls.grace_deadline_for(user)
        if deadline is None:
            return False
        return timezone.now() < deadline
