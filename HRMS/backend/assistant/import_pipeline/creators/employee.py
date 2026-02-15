"""
Employee entity creator, validator, and matcher.

Auto-creates Department, JobPosition, JobGrade if not found.
"""

import logging
import uuid

from ..interfaces import EntityCreator, EntityValidator, EntityMatcher, ValidationResult, MatchResult
from .base import to_decimal, to_date, to_str, to_bool, get_tenant_from_user

logger = logging.getLogger(__name__)


class EmployeeCreator(EntityCreator):
    model = None

    def _get_model(self):
        if self.model is None:
            from employees.models import Employee
            EmployeeCreator.model = Employee
        return self.model

    def get_entity_type(self):
        return 'EMPLOYEE'

    def get_target_schema(self):
        return {
            'employee_number': 'Employee number (e.g. EMP001)',
            'first_name': 'First name',
            'middle_name': 'Middle name (optional)',
            'last_name': 'Last name / surname',
            'date_of_birth': 'Date of birth (YYYY-MM-DD)',
            'date_of_joining': 'Date of joining (YYYY-MM-DD)',
            'department_code': 'Department code',
            'department_name': 'Department name (used if code not found, auto-creates)',
            'position_code': 'Job position code',
            'position_name': 'Job position title (used if code not found, auto-creates)',
            'grade_code': 'Job grade code (optional)',
            'mobile_phone': 'Mobile phone number',
            'work_email': 'Work email address',
            'personal_email': 'Personal email address',
            'ssnit_number': 'SSNIT number',
            'tin_number': 'TIN number',
            'ghana_card_number': 'Ghana Card number',
            'status': 'Employment status (ACTIVE, PROBATION, etc.)',
        }

    def create(self, row, user):
        EmpModel = self._get_model()
        tenant = get_tenant_from_user(user)

        department = self._resolve_or_create_department(row, tenant, user)
        position = self._resolve_or_create_position(row, tenant, user, department)
        grade = self._resolve_grade(row)

        status = to_str(row.get('status'), 'ACTIVE').upper()

        emp = EmpModel(
            tenant=tenant,
            employee_number=to_str(row.get('employee_number')),
            first_name=to_str(row.get('first_name')),
            middle_name=to_str(row.get('middle_name')) or None,
            last_name=to_str(row.get('last_name')),
            date_of_birth=to_date(row.get('date_of_birth')),
            date_of_joining=to_date(row.get('date_of_joining')),
            department=department,
            position=position,
            grade=grade,
            mobile_phone=to_str(row.get('mobile_phone')),
            work_email=to_str(row.get('work_email')) or None,
            personal_email=to_str(row.get('personal_email')) or None,
            ssnit_number=to_str(row.get('ssnit_number')) or None,
            tin_number=to_str(row.get('tin_number')) or None,
            ghana_card_number=to_str(row.get('ghana_card_number')) or None,
            status=status,
            created_by=user,
            updated_by=user,
        )
        emp.save()
        return emp

    def update(self, existing, row, user):
        changed = False
        simple_fields = [
            'first_name', 'middle_name', 'last_name',
            'mobile_phone', 'work_email', 'personal_email',
            'ssnit_number', 'tin_number', 'ghana_card_number',
        ]
        for field in simple_fields:
            new_val = to_str(row.get(field))
            if new_val and getattr(existing, field) != new_val:
                setattr(existing, field, new_val)
                changed = True

        date_fields = ['date_of_birth', 'date_of_joining']
        for field in date_fields:
            new_val = to_date(row.get(field))
            if new_val and getattr(existing, field) != new_val:
                setattr(existing, field, new_val)
                changed = True

        if changed:
            existing.updated_by = user
            existing.save()
        return existing

    def _resolve_or_create_department(self, row, tenant, user):
        from organization.models import Department
        code = to_str(row.get('department_code'))
        name = to_str(row.get('department_name'))

        if code:
            try:
                return Department.objects.get(code=code, is_deleted=False)
            except Department.DoesNotExist:
                if name:
                    return Department.objects.create(
                        tenant=tenant, code=code, name=name,
                        created_by=user, updated_by=user,
                    )

        if name:
            dept = Department.objects.filter(name__iexact=name, is_deleted=False).first()
            if dept:
                return dept
            gen_code = f"DEPT-{uuid.uuid4().hex[:6].upper()}"
            return Department.objects.create(
                tenant=tenant, code=gen_code, name=name,
                created_by=user, updated_by=user,
            )

        raise ValueError("department_code or department_name is required")

    def _resolve_or_create_position(self, row, tenant, user, department=None):
        from organization.models import JobPosition
        code = to_str(row.get('position_code'))
        name = to_str(row.get('position_name'))

        if code:
            try:
                return JobPosition.objects.get(code=code, is_deleted=False)
            except JobPosition.DoesNotExist:
                if name:
                    return JobPosition.objects.create(
                        tenant=tenant, code=code, title=name,
                        department=department,
                        created_by=user, updated_by=user,
                    )

        if name:
            pos = JobPosition.objects.filter(title__iexact=name, is_deleted=False).first()
            if pos:
                return pos
            gen_code = f"POS-{uuid.uuid4().hex[:6].upper()}"
            return JobPosition.objects.create(
                tenant=tenant, code=gen_code, title=name,
                department=department,
                created_by=user, updated_by=user,
            )

        raise ValueError("position_code or position_name is required")

    def _resolve_grade(self, row):
        from organization.models import JobGrade
        code = to_str(row.get('grade_code'))
        if not code:
            return None
        try:
            return JobGrade.objects.get(code=code, is_deleted=False)
        except JobGrade.DoesNotExist:
            return None


class EmployeeValidator(EntityValidator):
    def validate_row(self, parsed_row, row_number):
        errors = []
        warnings = []

        if not to_str(parsed_row.get('employee_number')):
            errors.append(f"Row {row_number}: employee_number is required")
        if not to_str(parsed_row.get('first_name')):
            errors.append(f"Row {row_number}: first_name is required")
        if not to_str(parsed_row.get('last_name')):
            errors.append(f"Row {row_number}: last_name is required")

        if not to_str(parsed_row.get('department_code')) and not to_str(parsed_row.get('department_name')):
            errors.append(f"Row {row_number}: department_code or department_name is required")
        if not to_str(parsed_row.get('position_code')) and not to_str(parsed_row.get('position_name')):
            errors.append(f"Row {row_number}: position_code or position_name is required")

        if not to_date(parsed_row.get('date_of_joining')):
            warnings.append(f"Row {row_number}: date_of_joining not provided")

        return ValidationResult(errors=errors, warnings=warnings)


class EmployeeMatcher(EntityMatcher):
    def find_existing(self, parsed_row):
        from employees.models import Employee

        emp_num = to_str(parsed_row.get('employee_number'))
        ssnit = to_str(parsed_row.get('ssnit_number'))

        existing = None
        if emp_num:
            existing = Employee.objects.filter(
                employee_number=emp_num, is_deleted=False
            ).first()

        if not existing and ssnit:
            existing = Employee.objects.filter(
                ssnit_number=ssnit, is_deleted=False
            ).first()

        if not existing:
            return MatchResult()

        changes = {}
        for field in ('first_name', 'last_name', 'mobile_phone', 'work_email'):
            new_val = to_str(parsed_row.get(field))
            old_val = getattr(existing, field, '') or ''
            if new_val and new_val != old_val:
                changes[field] = {'old': old_val, 'new': new_val}

        return MatchResult(existing_record=existing, changes=changes or None)
