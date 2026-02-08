"""
Automatic audit logging via Django signals.

Connects pre_save, post_save, and post_delete signals to all models
inheriting from BaseModel or AuditModel. Creates AuditLog records for
every CREATE, UPDATE, and DELETE operation.
"""

import logging
import uuid
from datetime import date, datetime, time
from decimal import Decimal

from django.db.models.signals import pre_save, post_save, post_delete

logger = logging.getLogger('nhia_hrms')

# Models that should NOT be audit-logged
EXCLUDED_MODELS = {
    'AuditLog', 'Session', 'AuthenticationLog',
    'ContentType', 'Permission', 'LogEntry', 'Migration',
}

# Fields to skip when capturing values (binary/sensitive)
EXCLUDED_FIELDS = {'file_data', 'password', 'banner_data', '_old_instance'}


def serialize_value(value):
    """Convert a field value to a JSON-safe representation."""
    if value is None:
        return None
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, time):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, bytes):
        return f"<binary {len(value)} bytes>"
    if isinstance(value, memoryview):
        return f"<binary {len(value)} bytes>"
    return value


def get_model_fields(instance):
    """Return a dict of field_name -> serialized value for the instance."""
    data = {}
    for field in instance._meta.concrete_fields:
        name = field.attname  # Use attname for FK fields (e.g., user_id)
        if name in EXCLUDED_FIELDS:
            continue
        try:
            value = getattr(instance, name, None)
            data[name] = serialize_value(value)
        except Exception:
            pass
    return data


def audit_pre_save(sender, instance, **kwargs):
    """Stash the old instance from DB before saving (for UPDATE detection)."""
    if instance.pk:
        try:
            old = sender.objects.get(pk=instance.pk)
            instance._old_instance = old
        except sender.DoesNotExist:
            instance._old_instance = None
    else:
        instance._old_instance = None


def audit_post_save(sender, instance, created, **kwargs):
    """Create an AuditLog entry after a model is saved."""
    from .models import AuditLog
    from .middleware import get_current_user, get_current_request

    user = get_current_user()
    if user and not getattr(user, 'is_authenticated', False):
        user = None

    request = get_current_request()
    ip_address = None
    user_agent = ''
    if request:
        ip_address = _get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')

    new_values = get_model_fields(instance)

    if created:
        AuditLog.objects.create(
            user=user,
            action=AuditLog.ActionType.CREATE,
            model_name=sender.__name__,
            object_id=str(instance.pk),
            object_repr=str(instance)[:255],
            new_values=new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    else:
        old_instance = getattr(instance, '_old_instance', None)
        if old_instance is None:
            return

        old_values_full = get_model_fields(old_instance)
        changes = {}
        old_values = {}
        changed_new_values = {}

        for key, new_val in new_values.items():
            old_val = old_values_full.get(key)
            if old_val != new_val:
                changes[key] = {'old': old_val, 'new': new_val}
                old_values[key] = old_val
                changed_new_values[key] = new_val

        if not changes:
            return  # No-op save, skip

        AuditLog.objects.create(
            user=user,
            action=AuditLog.ActionType.UPDATE,
            model_name=sender.__name__,
            object_id=str(instance.pk),
            object_repr=str(instance)[:255],
            changes=changes,
            old_values=old_values,
            new_values=changed_new_values,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    # Clean up temp attribute
    if hasattr(instance, '_old_instance'):
        del instance._old_instance


def audit_post_delete(sender, instance, **kwargs):
    """Create an AuditLog entry when a model is deleted."""
    from .models import AuditLog
    from .middleware import get_current_user, get_current_request

    user = get_current_user()
    if user and not getattr(user, 'is_authenticated', False):
        user = None

    request = get_current_request()
    ip_address = None
    user_agent = ''
    if request:
        ip_address = _get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')

    AuditLog.objects.create(
        user=user,
        action=AuditLog.ActionType.DELETE,
        model_name=sender.__name__,
        object_id=str(instance.pk),
        object_repr=str(instance)[:255],
        old_values=get_model_fields(instance),
        ip_address=ip_address,
        user_agent=user_agent,
    )


def _get_client_ip(request):
    """Extract client IP from request headers."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def _walk_subclasses(cls):
    """Recursively yield all concrete (non-abstract) subclasses of cls."""
    for subclass in cls.__subclasses__():
        if not subclass._meta.abstract:
            yield subclass
        yield from _walk_subclasses(subclass)


def connect_audit_signals():
    """
    Discover all concrete subclasses of BaseModel and AuditModel
    and connect audit signals to them.
    """
    from .models import BaseModel, AuditModel

    connected = set()

    for base in (BaseModel, AuditModel):
        for model in _walk_subclasses(base):
            name = model.__name__
            if name in EXCLUDED_MODELS or name in connected:
                continue
            connected.add(name)

            pre_save.connect(
                audit_pre_save, sender=model,
                dispatch_uid=f'audit_pre_save_{name}',
            )
            post_save.connect(
                audit_post_save, sender=model,
                dispatch_uid=f'audit_post_save_{name}',
            )
            post_delete.connect(
                audit_post_delete, sender=model,
                dispatch_uid=f'audit_post_delete_{name}',
            )

    logger.info(f"Audit signals connected to {len(connected)} models")
