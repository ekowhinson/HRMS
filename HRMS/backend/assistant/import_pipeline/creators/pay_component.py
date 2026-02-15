"""
PayComponent entity creator, validator, and matcher.
"""

import logging

from ..interfaces import EntityCreator, EntityValidator, EntityMatcher, ValidationResult, MatchResult
from .base import to_decimal, to_str, to_bool, get_tenant_from_user

logger = logging.getLogger(__name__)


class PayComponentCreator(EntityCreator):
    model = None

    def _get_model(self):
        if self.model is None:
            from payroll.models import PayComponent
            PayComponentCreator.model = PayComponent
        return self.model

    def get_entity_type(self):
        return 'PAY_COMPONENT'

    def get_target_schema(self):
        return {
            'code': 'Unique component code (e.g. HOUSING)',
            'name': 'Component name (e.g. Housing Allowance)',
            'short_name': 'Short display name (optional)',
            'component_type': 'Type: EARNING, DEDUCTION, EMPLOYER',
            'category': 'Category: BASIC, ALLOWANCE, BONUS, STATUTORY, OVERTIME, SHIFT, LOAN, FUND, OTHER',
            'calculation_type': 'Calculation: FIXED, PCT_BASIC, PCT_GROSS, FORMULA, LOOKUP',
            'default_amount': 'Default amount (decimal)',
            'percentage_value': 'Percentage value (decimal)',
            'is_taxable': 'Is taxable? true/false',
            'is_statutory': 'Is statutory? true/false',
            'is_recurring': 'Is recurring? true/false',
            'description': 'Description (optional)',
        }

    def create(self, row, user):
        Model = self._get_model()
        tenant = get_tenant_from_user(user)

        comp_type = to_str(row.get('component_type'), 'EARNING').upper()
        if comp_type not in ('EARNING', 'DEDUCTION', 'EMPLOYER'):
            comp_type = 'EARNING'

        category = to_str(row.get('category'), 'OTHER').upper()
        valid_categories = (
            'BASIC', 'ALLOWANCE', 'BONUS', 'STATUTORY',
            'OVERTIME', 'SHIFT', 'LOAN', 'FUND', 'OTHER',
        )
        if category not in valid_categories:
            category = 'OTHER'

        calc_type = to_str(row.get('calculation_type'), 'FIXED').upper()
        if calc_type not in ('FIXED', 'PCT_BASIC', 'PCT_GROSS', 'FORMULA', 'LOOKUP'):
            calc_type = 'FIXED'

        comp = Model(
            tenant=tenant,
            code=to_str(row.get('code')),
            name=to_str(row.get('name')),
            short_name=to_str(row.get('short_name')) or None,
            description=to_str(row.get('description')) or None,
            component_type=comp_type,
            category=category,
            calculation_type=calc_type,
            default_amount=to_decimal(row.get('default_amount')),
            percentage_value=to_decimal(row.get('percentage_value')),
            is_taxable=to_bool(row.get('is_taxable'), default=True),
            is_statutory=to_bool(row.get('is_statutory'), default=False),
            is_recurring=to_bool(row.get('is_recurring'), default=True),
            created_by=user,
            updated_by=user,
        )
        comp.save()
        return comp

    def update(self, existing, row, user):
        changed = False
        for field in ('name', 'short_name', 'description'):
            new_val = to_str(row.get(field))
            if new_val and getattr(existing, field) != new_val:
                setattr(existing, field, new_val)
                changed = True

        for field in ('default_amount', 'percentage_value'):
            new_val = to_decimal(row.get(field))
            if new_val is not None and getattr(existing, field) != new_val:
                setattr(existing, field, new_val)
                changed = True

        for field in ('is_taxable', 'is_statutory', 'is_recurring'):
            raw = row.get(field)
            if raw is not None and raw != '':
                new_val = to_bool(raw)
                if getattr(existing, field) != new_val:
                    setattr(existing, field, new_val)
                    changed = True

        if changed:
            existing.updated_by = user
            existing.save()
        return existing


class PayComponentValidator(EntityValidator):
    def validate_row(self, parsed_row, row_number):
        errors = []
        warnings = []

        if not to_str(parsed_row.get('code')):
            errors.append(f"Row {row_number}: code is required")
        if not to_str(parsed_row.get('name')):
            errors.append(f"Row {row_number}: name is required")

        return ValidationResult(errors=errors, warnings=warnings)


class PayComponentMatcher(EntityMatcher):
    def find_existing(self, parsed_row):
        from payroll.models import PayComponent
        code = to_str(parsed_row.get('code'))
        if not code:
            return MatchResult()

        existing = PayComponent.objects.filter(code=code, is_deleted=False).first()
        if not existing:
            return MatchResult()

        changes = {}
        for field in ('name', 'short_name', 'description'):
            new_val = to_str(parsed_row.get(field))
            old_val = getattr(existing, field, '') or ''
            if new_val and new_val != old_val:
                changes[field] = {'old': old_val, 'new': new_val}

        return MatchResult(existing_record=existing, changes=changes or None)
