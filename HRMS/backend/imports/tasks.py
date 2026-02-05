"""
Celery tasks for import processing.
Handles large file imports asynchronously.
"""

import logging
from celery import shared_task, current_task
from django.utils import timezone
from django.core.cache import cache
from datetime import timedelta

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def process_import_task(self, job_id: str, use_chunked: bool = True):
    """
    Process an import job asynchronously.

    Args:
        job_id: UUID of the ImportJob
        use_chunked: Whether to use chunked processor for memory efficiency
    """
    from .models import ImportJob

    try:
        job = ImportJob.objects.get(id=job_id)
    except ImportJob.DoesNotExist:
        logger.error(f"Import job {job_id} not found")
        return {'status': 'error', 'message': 'Job not found'}

    # Update task ID on job
    job.celery_task_id = self.request.id
    job.status = ImportJob.Status.IMPORTING
    job.started_at = timezone.now()
    job.save(update_fields=['celery_task_id', 'status', 'started_at'])

    try:
        if use_chunked:
            from .chunked_processor import ChunkedImportProcessor
            processor = ChunkedImportProcessor(chunk_size=1000)
        else:
            from .processor import ImportProcessor
            processor = ImportProcessor()

        # Process the import
        result = processor.process(job)

        # Update job with results
        job.refresh_from_db()

        return {
            'status': 'completed',
            'job_id': str(job_id),
            'success_count': result.success_count,
            'error_count': result.error_count,
            'skip_count': result.skip_count,
            'processing_mode': 'chunked' if use_chunked else 'standard',
        }

    except Exception as e:
        logger.exception(f"Import task {job_id} failed: {str(e)}")

        # Update job status
        job.fail(str(e))

        # Retry if retries remaining
        if self.request.retries < self.max_retries:
            raise self.retry(exc=e)

        return {
            'status': 'failed',
            'job_id': str(job_id),
            'error': str(e)
        }


@shared_task(bind=True)
def process_import_batch_task(self, batch_id: str):
    """
    Process a multi-file import batch asynchronously.

    Args:
        batch_id: UUID of the MultiFileImportBatch
    """
    from .models import MultiFileImportBatch
    from .orchestrator import MultiFileOrchestrator

    try:
        batch = MultiFileImportBatch.objects.get(id=batch_id)
    except MultiFileImportBatch.DoesNotExist:
        logger.error(f"Import batch {batch_id} not found")
        return {'status': 'error', 'message': 'Batch not found'}

    # Update task ID
    batch.celery_task_id = self.request.id
    batch.save(update_fields=['celery_task_id'])

    try:
        orchestrator = MultiFileOrchestrator()
        result = orchestrator.execute_batch(batch)

        return {
            'status': 'completed',
            'batch_id': str(batch_id),
            'total_jobs': result.get('total_jobs', 0),
            'completed_jobs': result.get('completed_jobs', 0),
            'failed_jobs': result.get('failed_jobs', 0),
        }

    except Exception as e:
        logger.exception(f"Batch import {batch_id} failed: {str(e)}")
        batch.status = 'failed'
        batch.save(update_fields=['status'])

        return {
            'status': 'failed',
            'batch_id': str(batch_id),
            'error': str(e)
        }


@shared_task
def cleanup_expired_imports():
    """
    Cleanup old import jobs and their data.
    Runs periodically via Celery Beat.
    """
    from .models import ImportJob, Dataset

    # Delete completed jobs older than 30 days
    cutoff_date = timezone.now() - timedelta(days=30)

    # Clean up old import jobs
    old_jobs = ImportJob.objects.filter(
        created_at__lt=cutoff_date,
        status__in=[ImportJob.Status.COMPLETED, ImportJob.Status.FAILED]
    )
    deleted_jobs = old_jobs.count()
    old_jobs.delete()

    # Clean up old datasets
    old_datasets = Dataset.objects.filter(
        created_at__lt=cutoff_date,
        status__in=['completed', 'failed', 'saved']
    )
    deleted_datasets = old_datasets.count()
    old_datasets.delete()

    logger.info(f"Cleanup: Deleted {deleted_jobs} old import jobs and {deleted_datasets} old datasets")

    return {
        'deleted_jobs': deleted_jobs,
        'deleted_datasets': deleted_datasets
    }


@shared_task
def update_import_progress(job_id: str, processed: int, total: int, **extra):
    """
    Update import progress in cache.
    Called periodically during long imports.
    """
    cache_key = f'import_progress_{job_id}'
    progress_data = {
        'processed': processed,
        'total': total,
        'percentage': round((processed / total * 100) if total > 0 else 0, 1),
        **extra
    }
    cache.set(cache_key, progress_data, timeout=3600)
    return progress_data


@shared_task(bind=True)
def validate_import_data_task(self, job_id: str):
    """
    Validate import data asynchronously before processing.
    Useful for very large files where validation takes time.
    """
    from .models import ImportJob
    from .mapper import ColumnMapper

    try:
        job = ImportJob.objects.get(id=job_id)
    except ImportJob.DoesNotExist:
        return {'status': 'error', 'message': 'Job not found'}

    try:
        mapper = ColumnMapper()
        validation = mapper.validate_mapping(
            mapping=job.column_mapping,
            sample_data=job.sample_data,
            headers=job.headers,
            target_model=job.target_model
        )

        job.validation_errors = validation.errors + validation.warnings
        job.status = ImportJob.Status.PREVIEW
        job.save(update_fields=['validation_errors', 'status'])

        return {
            'status': 'validated',
            'is_valid': validation.is_valid,
            'errors': len(validation.errors),
            'warnings': len(validation.warnings)
        }

    except Exception as e:
        logger.exception(f"Validation task {job_id} failed: {str(e)}")
        return {'status': 'error', 'message': str(e)}


# Task status helpers
def get_task_status(task_id: str) -> dict:
    """Get the status of a Celery task."""
    from celery.result import AsyncResult

    result = AsyncResult(task_id)

    status_data = {
        'task_id': task_id,
        'status': result.status,
        'ready': result.ready(),
        'successful': result.successful() if result.ready() else None,
    }

    if result.ready():
        if result.successful():
            status_data['result'] = result.result
        else:
            status_data['error'] = str(result.result)

    return status_data


def revoke_task(task_id: str, terminate: bool = False):
    """Revoke/cancel a Celery task."""
    from celery.result import AsyncResult
    from config.celery import app

    result = AsyncResult(task_id)
    app.control.revoke(task_id, terminate=terminate)

    return {
        'task_id': task_id,
        'revoked': True,
        'terminated': terminate
    }
