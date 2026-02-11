"""
Celery tasks for async report generation and file exports.

Heavy report queries and PDF/Excel generation run here to avoid
blocking API request threads. Results are stored in cache and
served by the task-status polling endpoint.
"""

import base64
import io
import logging
from datetime import datetime

from celery import shared_task
from django.core.cache import cache

logger = logging.getLogger(__name__)

EXPORT_CACHE_TIMEOUT = 3600  # 1 hour


def _progress_key(task_id):
    return f'report_task_{task_id}'


def _set_progress(task_id, status, percentage=0, **extra):
    cache.set(_progress_key(task_id), {
        'status': status,
        'percentage': percentage,
        **extra,
    }, timeout=EXPORT_CACHE_TIMEOUT)


# ─── Generic export task ────────────────────────────────────────────────────

@shared_task(bind=True, queue='reports', max_retries=2, default_retry_delay=30,
             time_limit=600, soft_time_limit=300)
def generate_export_task(self, export_type, params=None, file_format='excel',
                         user_id=None):
    """
    Generate a report export asynchronously.

    Args:
        export_type: One of 'employee_master', 'headcount', 'payroll_summary',
                     'paye', 'paye_gra', 'ssnit', 'bank_advice',
                     'leave_balance', 'loan_outstanding', 'payroll_master',
                     'payroll_reconciliation', 'salary_reconciliation',
                     'dues', 'journal'.
        params:      Dict of filter parameters from the request.
        file_format: 'csv', 'excel', or 'pdf'.
        user_id:     Requesting user id (for audit).

    Returns:
        Dict with 'file_b64' (base64-encoded bytes) and 'filename'.
    """
    task_id = self.request.id
    _set_progress(task_id, 'processing', 10, export_type=export_type)
    params = params or {}

    try:
        response = _dispatch_export(export_type, params, file_format)
        _set_progress(task_id, 'processing', 80)

        # Extract bytes and filename from the HttpResponse
        file_bytes = response.content
        content_disposition = response.get('Content-Disposition', '')
        filename = 'report'
        if 'filename="' in content_disposition:
            filename = content_disposition.split('filename="')[1].rstrip('"')

        # Store result in cache as base64 so it's JSON-serializable
        result = {
            'file_b64': base64.b64encode(file_bytes).decode('ascii'),
            'filename': filename,
            'content_type': response.get('Content-Type', 'application/octet-stream'),
            'size_bytes': len(file_bytes),
        }

        _set_progress(task_id, 'completed', 100, filename=filename,
                      size_bytes=len(file_bytes))

        # Also cache the file itself for direct download
        cache.set(f'report_file_{task_id}', result, timeout=EXPORT_CACHE_TIMEOUT)

        logger.info(
            "Export task completed: type=%s format=%s size=%d user=%s",
            export_type, file_format, len(file_bytes), user_id,
        )
        return {'status': 'completed', 'filename': filename,
                'size_bytes': len(file_bytes)}

    except Exception as exc:
        _set_progress(task_id, 'failed', 0, error=str(exc))
        logger.exception("Export task failed: type=%s", export_type)
        raise self.retry(exc=exc)


def _dispatch_export(export_type, params, file_format):
    """Route to the correct export function and return an HttpResponse."""
    from .exports import (
        export_employee_master, export_headcount, export_payroll_summary,
        export_paye_report, export_paye_gra_report, export_ssnit_report,
        export_bank_advice, export_leave_balance, export_loan_outstanding,
        export_payroll_master,
        get_payroll_reconciliation_data,
        generate_excel_response, generate_csv_response, generate_pdf_response,
    )

    filters = params.get('filters', {})
    payroll_run_id = params.get('payroll_run_id')

    dispatch = {
        'employee_master': lambda: export_employee_master(filters, format=file_format),
        'headcount': lambda: export_headcount(filters=filters, format=file_format),
        'payroll_summary': lambda: export_payroll_summary(payroll_run_id, filters, format=file_format),
        'paye': lambda: export_paye_report(payroll_run_id, filters, format=file_format),
        'paye_gra': lambda: export_paye_gra_report(payroll_run_id, filters, format=file_format),
        'ssnit': lambda: export_ssnit_report(payroll_run_id, filters, format=file_format),
        'bank_advice': lambda: export_bank_advice(payroll_run_id, filters, format=file_format),
        'leave_balance': lambda: export_leave_balance(filters=filters, format=file_format),
        'loan_outstanding': lambda: export_loan_outstanding(filters=filters, format=file_format),
        'payroll_master': lambda: export_payroll_master(payroll_run_id, filters, format=file_format),
    }

    # Reconciliation is special — needs two run IDs
    if export_type == 'payroll_reconciliation':
        current_run_id = params.get('current_run_id')
        previous_run_id = params.get('previous_run_id')
        data, headers, title = get_payroll_reconciliation_data(current_run_id, previous_run_id)
        if not data:
            return generate_csv_response([], ['No Data'], 'empty.csv')
        fn_base = f"payroll_reconciliation_{datetime.now().strftime('%Y%m%d')}"
        if file_format == 'csv':
            return generate_csv_response(data, headers, f"{fn_base}.csv")
        elif file_format == 'pdf':
            return generate_pdf_response(data, headers, f"{fn_base}.pdf", title=title, landscape_mode=True)
        else:
            return generate_excel_response(data, headers, f"{fn_base}.xlsx", title=title)

    handler = dispatch.get(export_type)
    if not handler:
        raise ValueError(f"Unknown export type: {export_type}")

    return handler()


# ─── Payroll computation (async wrapper) ────────────────────────────────────

@shared_task(bind=True, queue='payroll', max_retries=0,
             time_limit=3600, soft_time_limit=3000)
def compute_payroll_task(self, payroll_run_id, user_id):
    """
    Compute payroll for an entire run asynchronously.

    Progress is tracked in cache under 'payroll_progress_{payroll_run_id}'
    by the PayrollService itself.
    """
    from payroll.models import PayrollRun
    from payroll.services import PayrollService
    from django.contrib.auth import get_user_model

    User = get_user_model()
    task_id = self.request.id

    try:
        payroll_run = PayrollRun.objects.get(pk=payroll_run_id)
        user = User.objects.get(pk=user_id)

        # Store task_id on the run for status polling
        cache.set(f'payroll_task_{payroll_run_id}', task_id, timeout=7200)

        service = PayrollService(payroll_run)
        result = service.compute_payroll(user)

        logger.info("Payroll computation completed: run=%s employees=%s",
                     payroll_run_id, result.get('total_employees', 0))
        return result

    except Exception as exc:
        logger.exception("Payroll computation failed: run=%s", payroll_run_id)
        # Mark run as failed so the UI can show the error
        try:
            run = PayrollRun.objects.get(pk=payroll_run_id)
            run.status = 'DRAFT'
            run.save(update_fields=['status'])
            cache.set(f'payroll_progress_{payroll_run_id}', {
                'status': 'failed',
                'error': str(exc),
            }, timeout=3600)
        except Exception:
            pass
        raise
