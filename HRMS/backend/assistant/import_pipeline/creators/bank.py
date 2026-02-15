"""
Bank entity creator, validator, and matcher.
"""

import logging

from ..interfaces import EntityCreator, EntityValidator, EntityMatcher, ValidationResult, MatchResult
from .base import to_str, get_tenant_from_user

logger = logging.getLogger(__name__)


class BankCreator(EntityCreator):
    model = None

    def _get_model(self):
        if self.model is None:
            from payroll.models import Bank
            BankCreator.model = Bank
        return self.model

    def get_entity_type(self):
        return 'BANK'

    def get_target_schema(self):
        return {
            'code': 'Unique bank code (e.g. GCB)',
            'name': 'Bank full name (e.g. GCB Bank Limited)',
            'short_name': 'Short name (e.g. GCB)',
            'swift_code': 'SWIFT/BIC code (optional)',
            'sort_code': 'Sort code (optional)',
            'phone': 'Phone number (optional)',
            'email': 'Email address (optional)',
        }

    def create(self, row, user):
        Model = self._get_model()
        tenant = get_tenant_from_user(user)

        bank = Model(
            tenant=tenant,
            code=to_str(row.get('code')),
            name=to_str(row.get('name')),
            short_name=to_str(row.get('short_name')) or None,
            swift_code=to_str(row.get('swift_code')) or None,
            sort_code=to_str(row.get('sort_code')) or None,
            phone=to_str(row.get('phone')) or None,
            email=to_str(row.get('email')) or None,
            is_active=True,
            created_by=user,
            updated_by=user,
        )
        bank.save()
        return bank

    def update(self, existing, row, user):
        changed = False
        for field in ('name', 'short_name', 'swift_code', 'sort_code', 'phone', 'email'):
            new_val = to_str(row.get(field))
            if new_val and getattr(existing, field) != new_val:
                setattr(existing, field, new_val)
                changed = True

        if changed:
            existing.updated_by = user
            existing.save()
        return existing


class BankValidator(EntityValidator):
    def validate_row(self, parsed_row, row_number):
        errors = []
        warnings = []

        if not to_str(parsed_row.get('code')):
            errors.append(f"Row {row_number}: code is required")
        if not to_str(parsed_row.get('name')):
            errors.append(f"Row {row_number}: name is required")

        return ValidationResult(errors=errors, warnings=warnings)


class BankMatcher(EntityMatcher):
    def find_existing(self, parsed_row):
        from payroll.models import Bank
        code = to_str(parsed_row.get('code'))
        name = to_str(parsed_row.get('name'))

        existing = None
        if code:
            existing = Bank.objects.filter(code=code, is_deleted=False).first()

        if not existing and name:
            existing = Bank.objects.filter(name__iexact=name, is_deleted=False).first()

        if not existing:
            return MatchResult()

        changes = {}
        for field in ('name', 'short_name', 'swift_code', 'sort_code'):
            new_val = to_str(parsed_row.get(field))
            old_val = getattr(existing, field, '') or ''
            if new_val and new_val != old_val:
                changes[field] = {'old': old_val, 'new': new_val}

        return MatchResult(existing_record=existing, changes=changes or None)
