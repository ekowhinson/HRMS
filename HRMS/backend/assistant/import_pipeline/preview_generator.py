"""
Import preview generator — dry-run that validates rows and detects upserts.

Creates ImportPreviewRow records without modifying any business data.
"""

import io
import logging

import pandas as pd

from ..models import ImportPreviewRow

logger = logging.getLogger(__name__)


class ImportPreviewGenerator:
    """Generate a preview of what the import would do."""

    def generate(self, session, registry):
        """
        Read file from session.attachment, apply mapping, validate, detect upserts.

        Returns: {total, to_create, to_update, to_skip, errors, warnings}
        """
        attachment = session.attachment
        if not attachment:
            raise ValueError("No attachment linked to import session")

        df = self._read_file(attachment)
        mapping = session.confirmed_mapping or session.column_mapping
        if not mapping:
            raise ValueError("No column mapping available")

        entity_type = session.entity_type
        creator = registry.get_creator(entity_type)
        validator = registry.get_validator(entity_type)
        matcher = registry.get_matcher(entity_type)

        # Clear any previous preview rows
        session.preview_rows.all().delete()

        preview_rows = []
        summary = {'total': len(df), 'to_create': 0, 'to_update': 0, 'to_skip': 0, 'errors': 0, 'warnings': 0}

        for idx, raw_row in df.iterrows():
            row_number = idx + 1
            raw_dict = {k: (None if pd.isna(v) else v) for k, v in raw_row.to_dict().items()}

            # Apply column mapping
            parsed = {}
            for src_col, tgt_field in mapping.items():
                if tgt_field and src_col in raw_dict:
                    parsed[tgt_field] = raw_dict[src_col]

            # Merge import_params defaults
            if session.import_params:
                for key, value in session.import_params.items():
                    if key not in parsed or parsed[key] is None:
                        parsed[key] = value

            # Validate
            errors = []
            warnings = []
            if validator:
                result = validator.validate_row(parsed, row_number)
                errors = result.errors
                warnings = result.warnings

            if errors:
                action = ImportPreviewRow.Action.ERROR
                summary['errors'] += 1
            elif matcher:
                match = matcher.find_existing(parsed)
                if match.existing_record:
                    action = ImportPreviewRow.Action.UPDATE
                    summary['to_update'] += 1
                else:
                    action = ImportPreviewRow.Action.CREATE
                    summary['to_create'] += 1
            else:
                action = ImportPreviewRow.Action.CREATE
                summary['to_create'] += 1

            if warnings:
                summary['warnings'] += len(warnings)

            preview_rows.append(ImportPreviewRow(
                session=session,
                row_number=row_number,
                action=action,
                parsed_data=parsed,
                raw_data=raw_dict,
                existing_record_id=getattr(
                    matcher.find_existing(parsed).existing_record, 'pk', None
                ) if matcher and action == ImportPreviewRow.Action.UPDATE else None,
                changes=matcher.find_existing(parsed).changes
                if matcher and action == ImportPreviewRow.Action.UPDATE else None,
                errors=errors or None,
                warnings=warnings or None,
            ))

        ImportPreviewRow.objects.bulk_create(preview_rows, batch_size=500)

        session.total_rows = summary['total']
        session.status = 'PREVIEWED'
        session.save(update_fields=['total_rows', 'status', 'updated_at'])

        return summary

    def _read_file(self, attachment):
        """Read attachment binary data into a pandas DataFrame."""
        buffer = io.BytesIO(bytes(attachment.file_data))
        name = attachment.file_name.lower()
        if name.endswith('.csv'):
            return pd.read_csv(buffer)
        else:
            return pd.read_excel(buffer)
