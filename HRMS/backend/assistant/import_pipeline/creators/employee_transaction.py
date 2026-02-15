"""
EmployeeTransaction entity creator, validator, and matcher.
"""

import logging
from datetime import date

from django.db import models

from ..interfaces import EntityCreator, EntityValidator, EntityMatcher, ValidationResult, MatchResult
from .base import to_decimal, to_date, to_bool, to_str, get_tenant_from_user

logger = logging.getLogger(__name__)


class EmployeeTransactionCreator(EntityCreator):
    model = None  # Set lazily

    def _get_model(self):
        if self.model is None:
            from payroll.models import EmployeeTransaction
            EmployeeTransactionCreator.model = EmployeeTransaction
        return self.model

    def get_entity_type(self):
        return 'EMPLOYEE_TRANSACTION'

    def get_target_schema(self):
        return {
            'employee_number': 'Employee number (e.g. EMP001)',
            'component_code': 'Pay component code (e.g. HOUSING)',
            'component_name': 'Pay component name (fallback if code not found)',
            'override_type': 'Override type: NONE, FIXED, PCT, FORMULA',
            'override_amount': 'Fixed override amount (decimal)',
            'override_percentage': 'Percentage override (decimal, e.g. 10.5)',
            'quantity': 'Multiplier for amount (default 1)',
            'is_recurring': 'Is recurring? true/false',
            'effective_from': 'Start date (YYYY-MM-DD)',
            'effective_to': 'End date (YYYY-MM-DD, optional)',
            'status': 'Status: PENDING, APPROVED, ACTIVE',
            'description': 'Description / notes',
        }

    def create(self, row, user):
        ETModel = self._get_model()
        employee = self._resolve_employee(row)
        component = self._resolve_component(row)
        tenant = get_tenant_from_user(user)

        override_type = to_str(row.get('override_type'), 'NONE').upper()
        if override_type not in ('NONE', 'FIXED', 'PCT', 'FORMULA'):
            override_type = 'NONE'

        status = to_str(row.get('status'), 'ACTIVE').upper()
        if status not in ('PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED'):
            status = 'ACTIVE'

        txn = ETModel(
            tenant=tenant,
            employee=employee,
            pay_component=component,
            target_type='INDIVIDUAL',
            override_type=override_type,
            override_amount=to_decimal(row.get('override_amount')),
            override_percentage=to_decimal(row.get('override_percentage')),
            quantity=to_decimal(row.get('quantity'), default=1),
            is_recurring=to_bool(row.get('is_recurring'), default=True),
            effective_from=to_date(row.get('effective_from')) or date.today(),
            effective_to=to_date(row.get('effective_to')),
            status=status,
            description=to_str(row.get('description')),
            created_by=user,
            updated_by=user,
        )
        txn.save()
        return txn

    def update(self, existing, row, user):
        changed = False
        for field, value in [
            ('override_type', to_str(row.get('override_type'))),
            ('override_amount', to_decimal(row.get('override_amount'))),
            ('override_percentage', to_decimal(row.get('override_percentage'))),
            ('quantity', to_decimal(row.get('quantity'))),
            ('effective_to', to_date(row.get('effective_to'))),
            ('description', to_str(row.get('description'))),
        ]:
            if value is not None and value != '' and getattr(existing, field) != value:
                setattr(existing, field, value)
                changed = True

        status = to_str(row.get('status'))
        if status and status.upper() in ('PENDING', 'APPROVED', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED'):
            if existing.status != status.upper():
                existing.status = status.upper()
                changed = True

        if changed:
            existing.updated_by = user
            existing.save()
        return existing

    def _resolve_employee(self, row):
        from employees.models import Employee
        emp_num = to_str(row.get('employee_number'))
        if not emp_num:
            raise ValueError("employee_number is required")
        try:
            return Employee.objects.get(employee_number=emp_num, is_deleted=False)
        except Employee.DoesNotExist:
            raise ValueError(f"Employee not found: {emp_num}")

    def _resolve_component(self, row):
        from payroll.models import PayComponent
        code = to_str(row.get('component_code'))
        name = to_str(row.get('component_name'))

        if code:
            try:
                return PayComponent.objects.get(code=code, is_deleted=False)
            except PayComponent.DoesNotExist:
                pass

        if name:
            try:
                return PayComponent.objects.get(name__iexact=name, is_deleted=False)
            except (PayComponent.DoesNotExist, PayComponent.MultipleObjectsReturned):
                pass

        raise ValueError(f"Pay component not found: code={code}, name={name}")


class EmployeeTransactionValidator(EntityValidator):
    def validate_row(self, parsed_row, row_number):
        errors = []
        warnings = []

        if not to_str(parsed_row.get('employee_number')):
            errors.append(f"Row {row_number}: employee_number is required")

        if not to_str(parsed_row.get('component_code')) and not to_str(parsed_row.get('component_name')):
            errors.append(f"Row {row_number}: component_code or component_name is required")

        override_type = to_str(parsed_row.get('override_type'), 'NONE').upper()
        if override_type == 'FIXED' and to_decimal(parsed_row.get('override_amount')) is None:
            errors.append(f"Row {row_number}: override_amount required when override_type=FIXED")
        if override_type == 'PCT' and to_decimal(parsed_row.get('override_percentage')) is None:
            errors.append(f"Row {row_number}: override_percentage required when override_type=PCT")

        if not to_date(parsed_row.get('effective_from')):
            warnings.append(f"Row {row_number}: effective_from not provided, will default to today")

        return ValidationResult(errors=errors, warnings=warnings)


class EmployeeTransactionMatcher(EntityMatcher):
    def find_existing(self, parsed_row):
        from payroll.models import EmployeeTransaction
        from employees.models import Employee

        emp_num = to_str(parsed_row.get('employee_number'))
        comp_code = to_str(parsed_row.get('component_code'))

        if not emp_num or not comp_code:
            return MatchResult()

        try:
            employee = Employee.objects.get(employee_number=emp_num, is_deleted=False)
        except Employee.DoesNotExist:
            return MatchResult()

        existing = (
            EmployeeTransaction.objects
            .filter(
                employee=employee,
                pay_component__code=comp_code,
                is_current_version=True,
                is_deleted=False,
            )
            .exclude(status__in=['COMPLETED', 'CANCELLED'])
            .first()
        )

        if not existing:
            return MatchResult()

        changes = {}
        new_amount = to_decimal(parsed_row.get('override_amount'))
        if new_amount is not None and existing.override_amount != new_amount:
            changes['override_amount'] = {
                'old': str(existing.override_amount),
                'new': str(new_amount),
            }

        new_pct = to_decimal(parsed_row.get('override_percentage'))
        if new_pct is not None and existing.override_percentage != new_pct:
            changes['override_percentage'] = {
                'old': str(existing.override_percentage),
                'new': str(new_pct),
            }

        return MatchResult(existing_record=existing, changes=changes or None)
