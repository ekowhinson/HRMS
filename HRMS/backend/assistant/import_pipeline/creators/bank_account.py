"""
BankAccount entity creator, validator, and matcher.
"""

import logging

from ..interfaces import EntityCreator, EntityValidator, EntityMatcher, ValidationResult, MatchResult
from .base import to_str, to_bool, get_tenant_from_user

logger = logging.getLogger(__name__)


class BankAccountCreator(EntityCreator):
    model = None

    def _get_model(self):
        if self.model is None:
            from employees.models import BankAccount
            BankAccountCreator.model = BankAccount
        return self.model

    def get_entity_type(self):
        return 'BANK_ACCOUNT'

    def get_target_schema(self):
        return {
            'employee_number': 'Employee number (e.g. EMP001)',
            'bank_code': 'Bank code (e.g. GCB)',
            'bank_name': 'Bank name (fallback if code not found)',
            'account_name': 'Account holder name',
            'account_number': 'Bank account number',
            'account_type': 'Account type: SAVINGS, CURRENT, OTHER',
            'branch_name': 'Bank branch name (optional)',
            'is_primary': 'Is primary account? true/false',
        }

    def create(self, row, user):
        Model = self._get_model()
        tenant = get_tenant_from_user(user)
        employee = self._resolve_employee(row)
        bank = self._resolve_bank(row)

        acct_type = to_str(row.get('account_type'), 'SAVINGS').upper()
        if acct_type not in ('SAVINGS', 'CURRENT', 'OTHER'):
            acct_type = 'SAVINGS'

        account = Model(
            tenant=tenant,
            employee=employee,
            bank=bank,
            account_name=to_str(row.get('account_name')) or employee.get_full_name(),
            account_number=to_str(row.get('account_number')),
            account_type=acct_type,
            branch_name=to_str(row.get('branch_name')) or None,
            is_primary=to_bool(row.get('is_primary'), default=True),
            is_active=True,
            created_by=user,
            updated_by=user,
        )
        account.save()
        return account

    def update(self, existing, row, user):
        changed = False
        for field in ('account_name', 'account_number', 'branch_name'):
            new_val = to_str(row.get(field))
            if new_val and getattr(existing, field) != new_val:
                setattr(existing, field, new_val)
                changed = True

        acct_type = to_str(row.get('account_type'))
        if acct_type and acct_type.upper() in ('SAVINGS', 'CURRENT', 'OTHER'):
            if existing.account_type != acct_type.upper():
                existing.account_type = acct_type.upper()
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

    def _resolve_bank(self, row):
        from payroll.models import Bank
        code = to_str(row.get('bank_code'))
        name = to_str(row.get('bank_name'))

        if code:
            try:
                return Bank.objects.get(code=code, is_deleted=False)
            except Bank.DoesNotExist:
                pass

        if name:
            bank = Bank.objects.filter(name__iexact=name, is_deleted=False).first()
            if bank:
                return bank

        return None  # bank is nullable on BankAccount


class BankAccountValidator(EntityValidator):
    def validate_row(self, parsed_row, row_number):
        errors = []
        warnings = []

        if not to_str(parsed_row.get('employee_number')):
            errors.append(f"Row {row_number}: employee_number is required")
        if not to_str(parsed_row.get('account_number')):
            errors.append(f"Row {row_number}: account_number is required")

        if not to_str(parsed_row.get('bank_code')) and not to_str(parsed_row.get('bank_name')):
            warnings.append(f"Row {row_number}: bank_code/bank_name not provided, bank will be null")

        return ValidationResult(errors=errors, warnings=warnings)


class BankAccountMatcher(EntityMatcher):
    def find_existing(self, parsed_row):
        from employees.models import Employee, BankAccount

        emp_num = to_str(parsed_row.get('employee_number'))
        acct_num = to_str(parsed_row.get('account_number'))

        if not emp_num or not acct_num:
            return MatchResult()

        try:
            employee = Employee.objects.get(employee_number=emp_num, is_deleted=False)
        except Employee.DoesNotExist:
            return MatchResult()

        existing = BankAccount.objects.filter(
            employee=employee,
            account_number=acct_num,
            is_deleted=False,
        ).first()

        if not existing:
            return MatchResult()

        changes = {}
        for field in ('account_name', 'branch_name'):
            new_val = to_str(parsed_row.get(field))
            old_val = getattr(existing, field, '') or ''
            if new_val and new_val != old_val:
                changes[field] = {'old': old_val, 'new': new_val}

        return MatchResult(existing_record=existing, changes=changes or None)
