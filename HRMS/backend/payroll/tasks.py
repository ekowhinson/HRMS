"""
Celery tasks for payroll processing.
"""

import logging
import uuid

from celery import shared_task
from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task(bind=True, queue='payroll', max_retries=0, time_limit=7200, soft_time_limit=7000)
def bulk_process_backpay(self, batch_id, request_ids, user_id):
    """
    Process backpay requests in bulk: calculate DRAFT ones, then approve PREVIEWED ones.

    Updates progress in Redis cache after each request so the frontend can poll.
    """
    from .models import BackpayRequest, BackpayDetail, EmployeeSalary
    from .backpay_service import BackpayService
    from django.contrib.auth import get_user_model

    User = get_user_model()
    cache_key = f'backpay_bulk_progress_{batch_id}'

    total = len(request_ids)
    progress = {
        'processed': 0,
        'total': total,
        'percentage': 0,
        'calculated': 0,
        'approved': 0,
        'zero_arrears': 0,
        'errors': [],
        'status': 'processing',
        'current_employee': '',
    }
    cache.set(cache_key, progress, timeout=3600)

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        progress['status'] = 'failed'
        progress['errors'].append('User not found')
        cache.set(cache_key, progress, timeout=3600)
        return progress

    for i, req_id in enumerate(request_ids):
        try:
            bp_request = BackpayRequest.objects.select_related(
                'employee', 'new_salary', 'old_salary'
            ).get(pk=req_id)

            progress['current_employee'] = (
                f"{bp_request.employee.full_name} ({bp_request.employee.employee_number})"
            )

            # Step 1: Calculate if DRAFT
            if bp_request.status == 'DRAFT':
                try:
                    service = BackpayService(
                        employee=bp_request.employee,
                        reason=bp_request.reason,
                        new_salary=bp_request.new_salary,
                        old_salary=bp_request.old_salary,
                    )

                    # Clear existing details if any
                    bp_request.details.all().delete()

                    result = service.calculate(bp_request.effective_from, bp_request.effective_to)
                    totals = result['totals']

                    # Save details
                    for period_data in result['periods']:
                        for detail in period_data['details']:
                            BackpayDetail.objects.create(
                                backpay_request=bp_request,
                                payroll_period=period_data['period'],
                                original_payroll_item=period_data['payroll_item'],
                                applicable_salary=period_data['applicable_salary'],
                                pay_component=detail['pay_component'],
                                old_amount=detail['old_amount'],
                                new_amount=detail['new_amount'],
                                difference=detail['difference'],
                            )

                    # Update totals and status
                    bp_request.total_arrears_earnings = totals['total_arrears_earnings']
                    bp_request.total_arrears_deductions = totals['total_arrears_deductions']
                    bp_request.net_arrears = totals['net_arrears']
                    bp_request.periods_covered = totals['periods_covered']
                    bp_request.status = BackpayRequest.Status.PREVIEWED
                    bp_request.save()

                    progress['calculated'] += 1

                except Exception as e:
                    logger.error(f"Error calculating backpay {req_id}: {e}")
                    progress['errors'].append({
                        'request_id': str(req_id),
                        'employee': progress['current_employee'],
                        'step': 'calculate',
                        'error': str(e),
                    })
                    # Update progress and continue to next request
                    progress['processed'] = i + 1
                    progress['percentage'] = int((i + 1) / total * 100)
                    cache.set(cache_key, progress, timeout=3600)
                    continue

            # Step 2: Approve if PREVIEWED with net_arrears > 0
            if bp_request.status == 'PREVIEWED':
                if bp_request.net_arrears > 0:
                    bp_request.status = BackpayRequest.Status.APPROVED
                    bp_request.approved_by = user
                    bp_request.approved_at = timezone.now()
                    bp_request.save(update_fields=[
                        'status', 'approved_by', 'approved_at', 'updated_at'
                    ])
                    progress['approved'] += 1
                else:
                    progress['zero_arrears'] += 1

        except BackpayRequest.DoesNotExist:
            progress['errors'].append({
                'request_id': str(req_id),
                'employee': '',
                'step': 'lookup',
                'error': 'Request not found',
            })
        except Exception as e:
            logger.error(f"Error processing backpay {req_id}: {e}")
            progress['errors'].append({
                'request_id': str(req_id),
                'employee': progress['current_employee'],
                'step': 'process',
                'error': str(e),
            })

        # Update progress after each request
        progress['processed'] = i + 1
        progress['percentage'] = int((i + 1) / total * 100)
        cache.set(cache_key, progress, timeout=3600)

    # Mark as completed
    progress['status'] = 'completed'
    progress['current_employee'] = ''
    cache.set(cache_key, progress, timeout=3600)

    logger.info(
        f"Bulk backpay processing completed: batch={batch_id}, "
        f"total={total}, calculated={progress['calculated']}, "
        f"approved={progress['approved']}, zero_arrears={progress['zero_arrears']}, "
        f"errors={len(progress['errors'])}"
    )

    return progress
