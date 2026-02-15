"""
Import executor — runs the confirmed import with per-row savepoints.

Iterates over non-ERROR preview rows and calls the appropriate
EntityCreator.create() or .update() for each row.
"""

import logging

from django.db import transaction

from ..models import ImportPreviewRow, ImportResult, ImportSession

logger = logging.getLogger(__name__)


class ImportExecutor:
    """Execute a confirmed import session."""

    def execute(self, session, registry, progress_callback=None):
        """
        Process all non-ERROR preview rows.

        Args:
            session: ImportSession with status=CONFIRMED
            registry: EntityCreatorRegistry
            progress_callback: Optional callable(processed, total) for live progress
        """
        entity_type = session.entity_type
        creator = registry.get_creator(entity_type)

        preview_rows = (
            session.preview_rows
            .exclude(action=ImportPreviewRow.Action.ERROR)
            .exclude(action=ImportPreviewRow.Action.SKIP)
            .order_by('row_number')
        )

        total = preview_rows.count()
        rollback_on_error = (session.import_params or {}).get('rollback_on_error', False)

        created = 0
        updated = 0
        skipped = 0
        errored = 0
        error_details = []

        session.status = ImportSession.Status.EXECUTING
        session.save(update_fields=['status', 'updated_at'])

        if rollback_on_error:
            # Atomic: all or nothing
            try:
                with transaction.atomic():
                    for i, row in enumerate(preview_rows.iterator()):
                        result = self._process_row(row, creator, session.user)
                        if result['action'] == 'CREATE':
                            created += 1
                        elif result['action'] == 'UPDATE':
                            updated += 1
                        elif result['action'] == 'ERROR':
                            raise _RollbackError(result['error'], row.row_number)

                        if progress_callback:
                            progress_callback(i + 1, total)
            except _RollbackError as e:
                errored = total
                error_details = [{'row': e.row_number, 'error': str(e)}]
                session.status = ImportSession.Status.FAILED
                session.rows_errored = errored
                session.error_details = error_details
                session.save(update_fields=['status', 'rows_errored', 'error_details', 'updated_at'])
                return
        else:
            # Per-row savepoints
            for i, row in enumerate(preview_rows.iterator()):
                try:
                    with transaction.atomic():
                        result = self._process_row(row, creator, session.user)
                except Exception as e:
                    result = {
                        'action': 'ERROR',
                        'record_id': None,
                        'record_type': None,
                        'error': str(e),
                    }

                ImportResult.objects.create(
                    session=session,
                    row_number=row.row_number,
                    action_taken=result['action'],
                    record_id=result.get('record_id'),
                    record_type=result.get('record_type'),
                    error_message=result.get('error'),
                )

                if result['action'] == 'CREATE':
                    created += 1
                elif result['action'] == 'UPDATE':
                    updated += 1
                elif result['action'] == 'ERROR':
                    errored += 1
                    error_details.append({
                        'row': row.row_number,
                        'error': result.get('error'),
                    })

                if progress_callback:
                    progress_callback(i + 1, total)

        session.status = ImportSession.Status.COMPLETED
        session.rows_created = created
        session.rows_updated = updated
        session.rows_skipped = skipped
        session.rows_errored = errored
        session.error_details = error_details or None
        session.save(update_fields=[
            'status', 'rows_created', 'rows_updated', 'rows_skipped',
            'rows_errored', 'error_details', 'updated_at',
        ])

    def _process_row(self, preview_row, creator, user):
        """Process a single preview row."""
        parsed = preview_row.parsed_data

        if preview_row.action == ImportPreviewRow.Action.CREATE:
            record = creator.create(parsed, user)
            return {
                'action': 'CREATE',
                'record_id': getattr(record, 'pk', None),
                'record_type': type(record).__name__,
            }
        elif preview_row.action == ImportPreviewRow.Action.UPDATE:
            # Load the existing record
            model_class = type(creator).model if hasattr(type(creator), 'model') else None
            if model_class and preview_row.existing_record_id:
                existing = model_class.objects.get(pk=preview_row.existing_record_id)
            else:
                existing = None

            if existing:
                record = creator.update(existing, parsed, user)
                return {
                    'action': 'UPDATE',
                    'record_id': getattr(record, 'pk', None),
                    'record_type': type(record).__name__,
                }

        return {'action': 'SKIP', 'record_id': None, 'record_type': None}


class _RollbackError(Exception):
    """Raised to trigger atomic rollback."""
    def __init__(self, message, row_number):
        super().__init__(message)
        self.row_number = row_number
