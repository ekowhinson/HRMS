"""
Celery tasks for core functionality.

Includes scheduled maintenance (session/token cleanup, health metrics)
and HR business-logic periodic tasks (probation, grievance, appraisals).
"""

import logging
from datetime import date, timedelta
from celery import shared_task

logger = logging.getLogger(__name__)


# ─── Maintenance / cleanup tasks ────────────────────────────────────────────

@shared_task
def cleanup_expired_sessions():
    """
    Remove expired Django sessions from the database/cache.
    Runs daily at 3:00 AM via Celery Beat.
    """
    try:
        from django.contrib.sessions.models import Session
        from django.utils import timezone

        count, _ = Session.objects.filter(
            expire_date__lt=timezone.now()
        ).delete()

        logger.info("Cleaned up %d expired sessions", count)
        return {'status': 'success', 'deleted_sessions': count}
    except Exception as e:
        # Session backend may be cache-only (no DB table) — that's fine
        logger.info("Session cleanup skipped (cache backend): %s", e)
        return {'status': 'skipped', 'reason': str(e)}


@shared_task
def cleanup_expired_tokens():
    """
    Flush expired / blacklisted JWT refresh tokens.
    Runs daily at 3:30 AM via Celery Beat.
    """
    try:
        from rest_framework_simplejwt.token_blacklist.models import (
            BlacklistedToken, OutstandingToken,
        )
        from django.utils import timezone

        # Delete blacklisted tokens whose outstanding token has expired
        expired = OutstandingToken.objects.filter(expires_at__lt=timezone.now())
        bl_count, _ = BlacklistedToken.objects.filter(
            token__in=expired
        ).delete()
        ot_count, _ = expired.delete()

        logger.info("Token cleanup: %d blacklisted, %d outstanding removed",
                     bl_count, ot_count)
        return {
            'status': 'success',
            'blacklisted_deleted': bl_count,
            'outstanding_deleted': ot_count,
        }
    except Exception as e:
        logger.exception("Token cleanup failed: %s", e)
        return {'status': 'error', 'message': str(e)}


@shared_task
def collect_health_metrics():
    """
    Collect lightweight health metrics and store in volatile cache.
    Runs every 5 minutes via Celery Beat.
    Useful for Cloud Monitoring dashboards and /health/ endpoint enrichment.
    """
    from django.core.cache import caches
    from django.utils import timezone
    from django.db import connection

    metrics = {
        'timestamp': timezone.now().isoformat(),
        'status': 'healthy',
    }

    # DB connectivity check
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        metrics['db'] = 'ok'
    except Exception as e:
        metrics['db'] = f'error: {e}'
        metrics['status'] = 'degraded'

    # Cache connectivity check
    try:
        cache = caches['default']
        cache.set('_health_probe', 1, timeout=60)
        cache.get('_health_probe')
        metrics['cache'] = 'ok'
    except Exception as e:
        metrics['cache'] = f'error: {e}'
        metrics['status'] = 'degraded'

    # Store in volatile cache for the health endpoint
    try:
        caches['volatile'].set('health_metrics', metrics, timeout=600)
    except Exception:
        pass

    return metrics


@shared_task
def warm_cache_task():
    """
    Warm the cache with commonly used data.
    Runs periodically via Celery Beat.
    """
    from .caching import CacheManager

    try:
        CacheManager.warm_cache()
        logger.info("Cache warming completed successfully")
        return {'status': 'success', 'message': 'Cache warmed'}
    except Exception as e:
        logger.exception(f"Cache warming failed: {str(e)}")
        return {'status': 'error', 'message': str(e)}


@shared_task
def invalidate_cache_task(cache_type: str = 'all'):
    """
    Invalidate cache entries.

    Args:
        cache_type: Type of cache to invalidate
            (all, employees, organization, lookups, leave, payroll, performance, discipline, reports)
    """
    from .caching import CacheManager
    from django.core.cache import caches

    try:
        if cache_type == 'all':
            for alias in ['default', 'persistent', 'volatile', 'long', 'sessions']:
                try:
                    caches[alias].clear()
                except Exception:
                    pass
            message = 'All caches cleared'

        elif cache_type == 'employees':
            CacheManager.invalidate_employee_caches()
            message = 'Employee caches cleared'

        elif cache_type == 'organization':
            CacheManager.invalidate_organization_caches()
            message = 'Organization caches cleared'

        elif cache_type == 'leave':
            CacheManager.invalidate_leave_caches()
            message = 'Leave caches cleared'

        elif cache_type == 'payroll':
            CacheManager.invalidate_payroll_caches()
            message = 'Payroll caches cleared'

        elif cache_type == 'performance':
            CacheManager.invalidate_performance_caches()
            message = 'Performance caches cleared'

        elif cache_type == 'discipline':
            CacheManager.invalidate_discipline_caches()
            message = 'Discipline caches cleared'

        elif cache_type == 'reports':
            CacheManager.invalidate_report_caches()
            message = 'Report caches cleared'

        else:
            message = f'Unknown cache type: {cache_type}'

        logger.info(message)
        return {'status': 'success', 'message': message}

    except Exception as e:
        logger.exception(f"Cache invalidation failed: {str(e)}")
        return {'status': 'error', 'message': str(e)}


@shared_task
def send_notification_task(user_id: str, notification_type: str, data: dict):
    """
    Send a notification to a user.

    Args:
        user_id: UUID of the user
        notification_type: Type of notification (INFO, WARNING, ERROR, SUCCESS, TASK, APPROVAL)
        data: dict with keys: title, message, link (optional), extra_data (optional), send_email (optional)
    """
    from django.contrib.auth import get_user_model
    from .models import Notification

    User = get_user_model()

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        logger.warning(f"Notification target user {user_id} not found")
        return {'status': 'error', 'message': 'User not found'}

    # Create notification record
    notification = Notification.objects.create(
        user=user,
        title=data.get('title', 'Notification'),
        message=data.get('message', ''),
        notification_type=notification_type,
        link=data.get('link'),
        extra_data=data.get('extra_data'),
    )

    # Send email if requested and user has email
    should_send_email = data.get('send_email', False)
    if should_send_email and user.email:
        try:
            from core.email import send_email as _send_email, EmailEvent

            _send_email(
                event=EmailEvent.GENERIC_NOTIFICATION,
                recipient_email=user.email,
                context={
                    'recipient_name': user.get_full_name() or user.email,
                    'title': data.get('title', 'HRMS Notification'),
                    'message': data.get('message', ''),
                    'cta_url': data.get('link', ''),
                    'cta_text': 'View Details',
                    'subject': data.get('title', 'HRMS Notification'),
                },
                recipient_user=user,
            )
        except Exception as e:
            logger.warning(f"Failed to send email notification to {user.email}: {e}")

    logger.info(f"Notification created for user {user_id}: {notification_type} - {data.get('title')}")
    return {'status': 'sent', 'user_id': user_id, 'type': notification_type, 'notification_id': str(notification.id)}


@shared_task
def cleanup_old_audit_logs():
    """
    Clean up old audit logs to manage database size.
    Keeps last 90 days of logs.
    """
    from core.models import AuditLog
    from django.utils import timezone
    from datetime import timedelta

    cutoff_date = timezone.now() - timedelta(days=90)

    try:
        deleted_count, _ = AuditLog.objects.filter(
            created_at__lt=cutoff_date
        ).delete()

        logger.info(f"Cleaned up {deleted_count} old audit logs")
        return {'status': 'success', 'deleted': deleted_count}

    except Exception as e:
        logger.exception(f"Audit log cleanup failed: {str(e)}")
        return {'status': 'error', 'message': str(e)}


@shared_task
def check_probation_due():
    """
    Check for probation assessments due within 30 days.
    Notifies line manager and HR users.
    Runs daily at 7:00 AM via Celery Beat.
    """
    from performance.services import ProbationService
    from .models import Notification
    from django.contrib.auth import get_user_model

    User = get_user_model()

    try:
        service = ProbationService()
        due_assessments = service.get_due_assessments(days_ahead=30)

        if not due_assessments:
            logger.info("No probation assessments due in the next 30 days")
            return {'status': 'success', 'notifications_sent': 0}

        # Get HR users
        hr_users = User.objects.filter(
            user_roles__role__code__in=['HR_MANAGER', 'HR_DIRECTOR'],
            user_roles__is_active=True,
            is_active=True
        ).distinct()

        notifications_sent = 0
        seven_days_ago = date.today() - timedelta(days=7)

        for item in due_assessments:
            employee = item['employee']
            period = item['period']
            due_date = item['due_date']
            extra_data = {
                'employee_id': str(employee.id),
                'period': period,
                'due_date': due_date.isoformat(),
            }

            # Notify supervisor
            if employee.supervisor and hasattr(employee.supervisor, 'user') and employee.supervisor.user:
                # Deduplication: skip if notification with same extra_data exists in last 7 days
                existing = Notification.objects.filter(
                    user=employee.supervisor.user,
                    extra_data=extra_data,
                    created_at__date__gte=seven_days_ago,
                ).exists()
                if not existing:
                    send_notification_task.delay(
                        str(employee.supervisor.user.id),
                        'TASK',
                        {
                            'title': f'Probation Assessment Due: {employee.full_name}',
                            'message': f'{employee.full_name} ({employee.employee_number}) has a {period} probation assessment due on {due_date.strftime("%d %b %Y")}. Please complete the assessment.',
                            'link': '/performance/probation-assessments',
                            'extra_data': extra_data,
                            'send_email': True,
                        }
                    )
                    notifications_sent += 1

            # Notify HR users
            for hr_user in hr_users:
                existing = Notification.objects.filter(
                    user=hr_user,
                    extra_data=extra_data,
                    created_at__date__gte=seven_days_ago,
                ).exists()
                if not existing:
                    send_notification_task.delay(
                        str(hr_user.id),
                        'TASK',
                        {
                            'title': f'Probation Assessment Due: {employee.full_name}',
                            'message': f'{employee.full_name} ({employee.employee_number}) has a {period} probation assessment due on {due_date.strftime("%d %b %Y")}.',
                            'link': '/performance/probation-assessments',
                            'extra_data': extra_data,
                        }
                    )
                    notifications_sent += 1

        logger.info(f"Probation due check complete: {notifications_sent} notifications sent")
        return {'status': 'success', 'notifications_sent': notifications_sent}

    except Exception as e:
        logger.exception(f"Probation due check failed: {str(e)}")
        return {'status': 'error', 'message': str(e)}


@shared_task
def check_grievance_escalation():
    """
    Check for grievances that have been submitted but unacknowledged for 5+ days.
    Auto-escalates and notifies HR.
    Runs daily at 8:00 AM via Celery Beat.
    """
    from discipline.models import Grievance
    from .models import Notification
    from django.contrib.auth import get_user_model

    User = get_user_model()

    try:
        threshold_date = date.today() - timedelta(days=5)

        # Find unacknowledged grievances submitted 5+ days ago
        stale_grievances = Grievance.objects.filter(
            status='SUBMITTED',
            submitted_date__lte=threshold_date,
            acknowledged_date__isnull=True,
        )

        if not stale_grievances.exists():
            logger.info("No stale grievances found")
            return {'status': 'success', 'escalated': 0}

        # Get HR users
        hr_users = User.objects.filter(
            user_roles__role__code__in=['HR_MANAGER', 'HR_DIRECTOR'],
            user_roles__is_active=True,
            is_active=True
        ).distinct()

        escalated_count = 0
        seven_days_ago = date.today() - timedelta(days=7)

        for grievance in stale_grievances:
            days_elapsed = (date.today() - grievance.submitted_date).days

            # Auto-escalate
            grievance.escalation_level = 1
            grievance.status = 'ESCALATED'
            grievance.escalation_reason = f'Auto-escalated: unacknowledged for {days_elapsed} days'
            grievance.escalated_date = date.today()
            grievance.save()
            escalated_count += 1

            extra_data = {
                'grievance_id': str(grievance.id),
                'grievance_number': grievance.grievance_number,
            }

            # Notify HR users
            for hr_user in hr_users:
                existing = Notification.objects.filter(
                    user=hr_user,
                    extra_data=extra_data,
                    created_at__date__gte=seven_days_ago,
                ).exists()
                if not existing:
                    send_notification_task.delay(
                        str(hr_user.id),
                        'WARNING',
                        {
                            'title': f'Grievance Requires Attention: {grievance.grievance_number}',
                            'message': f'Grievance {grievance.grievance_number} ("{grievance.subject}") has been unacknowledged for {days_elapsed} days and has been auto-escalated.',
                            'link': '/discipline/grievances',
                            'extra_data': extra_data,
                            'send_email': True,
                        }
                    )

        logger.info(f"Grievance escalation check complete: {escalated_count} grievances escalated")
        return {'status': 'success', 'escalated': escalated_count}

    except Exception as e:
        logger.exception(f"Grievance escalation check failed: {str(e)}")
        return {'status': 'error', 'message': str(e)}


@shared_task
def check_appraisal_deadlines():
    """
    Check for expired appraisal schedules and auto-lock them.
    Runs daily at 00:30 via Celery Beat.
    """
    try:
        from performance.models import AppraisalSchedule

        today = date.today()
        expired_schedules = AppraisalSchedule.objects.filter(
            end_date__lt=today,
            is_locked=False,
        )

        locked_count = 0
        for schedule in expired_schedules:
            schedule.check_and_lock()
            if schedule.is_locked:
                locked_count += 1

        logger.info(f"Appraisal deadline check complete: {locked_count} schedules locked")
        return {'status': 'success', 'locked': locked_count}

    except Exception as e:
        logger.exception(f"Appraisal deadline check failed: {str(e)}")
        return {'status': 'error', 'message': str(e)}
