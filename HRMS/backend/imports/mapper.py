"""
AI-powered column mapping for data imports.
Uses fuzzy matching and instruction parsing to map source columns to target fields.
"""

import re
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from difflib import SequenceMatcher
import logging

logger = logging.getLogger(__name__)


@dataclass
class FieldDefinition:
    """Definition of a target model field."""
    name: str
    type: str  # string, integer, decimal, date, email, foreign_key
    required: bool = False
    aliases: List[str] = None
    lookup_model: Optional[str] = None  # For foreign keys


@dataclass
class MappingResult:
    """Result of column mapping."""
    source_column: str
    target_field: str
    confidence: float
    reason: str


@dataclass
class ValidationResult:
    """Result of validating a mapping."""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    sample_transformations: List[Dict]


# Target model field definitions
MODEL_FIELDS: Dict[str, Dict[str, FieldDefinition]] = {
    'employees': {
        'employee_number': FieldDefinition(
            name='employee_number',
            type='string',
            required=True,
            aliases=['emp_no', 'staff_id', 'id', 'employee_id', 'emp_id', 'staff_no', 'emp no', 'staff number']
        ),
        'first_name': FieldDefinition(
            name='first_name',
            type='string',
            required=True,
            aliases=['fname', 'given_name', 'first', 'firstname', 'forename', 'given name']
        ),
        'middle_name': FieldDefinition(
            name='middle_name',
            type='string',
            aliases=['mname', 'middle', 'middlename', 'other_names', 'other names']
        ),
        'last_name': FieldDefinition(
            name='last_name',
            type='string',
            required=True,
            aliases=['lname', 'surname', 'family_name', 'last', 'lastname', 'family name']
        ),
        'work_email': FieldDefinition(
            name='work_email',
            type='email',
            aliases=['email', 'work email', 'email_address', 'office_email', 'corporate_email']
        ),
        'personal_email': FieldDefinition(
            name='personal_email',
            type='email',
            aliases=['personal email', 'private_email', 'home_email']
        ),
        'mobile_phone': FieldDefinition(
            name='mobile_phone',
            type='string',
            aliases=['phone', 'mobile', 'cell', 'cellphone', 'phone_number', 'telephone', 'contact']
        ),
        'department': FieldDefinition(
            name='department',
            type='foreign_key',
            aliases=['dept', 'department_name', 'dept_name', 'department name', 'unit'],
            lookup_model='organization.Department'
        ),
        'position': FieldDefinition(
            name='position',
            type='foreign_key',
            aliases=['job_position', 'job_title', 'title', 'role', 'designation', 'job title'],
            lookup_model='organization.JobPosition'
        ),
        'grade': FieldDefinition(
            name='grade',
            type='foreign_key',
            aliases=['job_grade', 'salary_grade', 'level', 'grade_level', 'pay_grade'],
            lookup_model='organization.JobGrade'
        ),
        'date_of_birth': FieldDefinition(
            name='date_of_birth',
            type='date',
            aliases=['dob', 'birth_date', 'birthdate', 'date of birth', 'birth date']
        ),
        'date_of_joining': FieldDefinition(
            name='date_of_joining',
            type='date',
            aliases=['hire_date', 'join_date', 'start_date', 'employment_date', 'date of hire', 'hired on']
        ),
        'gender': FieldDefinition(
            name='gender',
            type='string',
            aliases=['sex']
        ),
        'ghana_card_number': FieldDefinition(
            name='ghana_card_number',
            type='string',
            aliases=['ghana_card', 'national_id', 'gha_card', 'ghana card']
        ),
        'ssnit_number': FieldDefinition(
            name='ssnit_number',
            type='string',
            aliases=['ssnit', 'social_security', 'ssnit_no']
        ),
        'tin_number': FieldDefinition(
            name='tin_number',
            type='string',
            aliases=['tin', 'tax_id', 'tax_number']
        ),
        'status': FieldDefinition(
            name='status',
            type='string',
            aliases=['employment_status', 'emp_status', 'active_status']
        ),
        'employment_type': FieldDefinition(
            name='employment_type',
            type='string',
            aliases=['emp_type', 'contract_type', 'type']
        ),
        'supervisor': FieldDefinition(
            name='supervisor',
            type='foreign_key',
            aliases=['manager', 'reports_to', 'line_manager', 'supervisor_id', 'manager_id'],
            lookup_model='employees.Employee'
        ),
        'residential_address': FieldDefinition(
            name='residential_address',
            type='string',
            aliases=['address', 'home_address', 'street_address', 'location']
        ),
        'residential_city': FieldDefinition(
            name='residential_city',
            type='string',
            aliases=['city', 'town']
        ),
        # New fields from district data
        'old_staff_number': FieldDefinition(
            name='old_staff_number',
            type='string',
            aliases=['old_staff_no', 'old_emp_no', 'previous_staff_no', 'legacy_staff_no', 'old_id']
        ),
        'division': FieldDefinition(
            name='division',
            type='foreign_key',
            aliases=['div', 'division_name', 'org_division'],
            lookup_model='organization.Division'
        ),
        'directorate': FieldDefinition(
            name='directorate',
            type='foreign_key',
            aliases=['dir', 'directorate_name', 'directorate/office', 'office'],
            lookup_model='organization.Directorate'
        ),
        'staff_category': FieldDefinition(
            name='staff_category',
            type='foreign_key',
            aliases=['category', 'payroll_name', 'staff_type', 'payroll_group'],
            lookup_model='payroll.StaffCategory'
        ),
        'salary_notch': FieldDefinition(
            name='salary_notch',
            type='foreign_key',
            aliases=['notch', 'notch_new', 'salary_step', 'pay_notch', 'band_level_notch'],
            lookup_model='payroll.SalaryNotch'
        ),
        'assignment_status': FieldDefinition(
            name='assignment_status',
            type='string',
            aliases=['user_status', 'assignment', 'active_assignment']
        ),
        'work_location': FieldDefinition(
            name='work_location',
            type='foreign_key',
            aliases=['location', 'office_location', 'work_site', 'station'],
            lookup_model='organization.WorkLocation'
        ),
        'region': FieldDefinition(
            name='residential_region',
            type='foreign_key',
            aliases=['region', 'state', 'province'],
            lookup_model='core.Region'
        ),
        'district': FieldDefinition(
            name='residential_district',
            type='foreign_key',
            aliases=['district', 'lga'],
            lookup_model='core.District'
        ),
    },
    'leave_balances': {
        'employee_number': FieldDefinition(
            name='employee_number',
            type='string',
            required=True,
            aliases=['emp_no', 'staff_id', 'employee_id']
        ),
        'leave_type': FieldDefinition(
            name='leave_type',
            type='foreign_key',
            required=True,
            aliases=['type', 'leave_type_code', 'leave_code'],
            lookup_model='leave.LeaveType'
        ),
        'year': FieldDefinition(
            name='year',
            type='integer',
            required=True,
            aliases=['fiscal_year', 'leave_year']
        ),
        'earned': FieldDefinition(
            name='earned',
            type='decimal',
            aliases=['entitlement', 'total_days', 'entitled_days', 'allocation']
        ),
        'taken': FieldDefinition(
            name='taken',
            type='decimal',
            aliases=['used', 'days_taken', 'consumed']
        ),
        'opening_balance': FieldDefinition(
            name='opening_balance',
            type='decimal',
            aliases=['brought_forward', 'bf', 'carried_over', 'opening']
        ),
    },
    'transactions': {
        'employee_number': FieldDefinition(
            name='employee_number',
            type='string',
            required=True,
            aliases=['emp_no', 'staff_id', 'employee_id']
        ),
        'pay_component': FieldDefinition(
            name='pay_component',
            type='foreign_key',
            required=True,
            aliases=['component', 'component_code', 'earning_type', 'deduction_type'],
            lookup_model='payroll.PayComponent'
        ),
        'override_amount': FieldDefinition(
            name='override_amount',
            type='decimal',
            aliases=['amount', 'value', 'fixed_amount']
        ),
        'effective_from': FieldDefinition(
            name='effective_from',
            type='date',
            required=True,
            aliases=['start_date', 'from_date', 'effective_date']
        ),
        'effective_to': FieldDefinition(
            name='effective_to',
            type='date',
            aliases=['end_date', 'to_date', 'expiry_date']
        ),
        'is_recurring': FieldDefinition(
            name='is_recurring',
            type='boolean',
            aliases=['recurring', 'continuous', 'permanent']
        ),
    },
    'departments': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['dept_code', 'department_code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['dept_name', 'department_name', 'description']
        ),
        'directorate': FieldDefinition(
            name='directorate',
            type='foreign_key',
            required=False,  # Validated during processing
            aliases=['directorate_code', 'directorate_name', 'dir', 'parent_directorate'],
            lookup_model='organization.Directorate'
        ),
        'parent': FieldDefinition(
            name='parent',
            type='foreign_key',
            aliases=['parent_dept', 'parent_department', 'parent_code'],
            lookup_model='organization.Department'
        ),
    },
    'positions': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['position_code', 'job_code']
        ),
        'title': FieldDefinition(
            name='title',
            type='string',
            required=True,
            aliases=['name', 'job_title', 'position_name']
        ),
        'department': FieldDefinition(
            name='department',
            type='foreign_key',
            aliases=['dept', 'department_code'],
            lookup_model='organization.Department'
        ),
        'grade': FieldDefinition(
            name='grade',
            type='foreign_key',
            required=True,  # Grade is required in the database
            aliases=['job_grade', 'grade_code', 'level'],
            lookup_model='organization.JobGrade'
        ),
    },
    'grades': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['grade_code', 'job_grade_code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['grade_name', 'job_grade', 'title']
        ),
        'level': FieldDefinition(
            name='level',
            type='integer',
            required=True,
            aliases=['grade_level', 'rank', 'order']
        ),
        'min_salary': FieldDefinition(
            name='min_salary',
            type='decimal',
            aliases=['minimum_salary', 'salary_min', 'min_pay']
        ),
        'max_salary': FieldDefinition(
            name='max_salary',
            type='decimal',
            aliases=['maximum_salary', 'salary_max', 'max_pay']
        ),
        'annual_leave_days': FieldDefinition(
            name='annual_leave_days',
            type='integer',
            aliases=['leave_days', 'annual_leave', 'vacation_days']
        ),
        'is_management': FieldDefinition(
            name='is_management',
            type='boolean',
            aliases=['management', 'is_manager', 'manager_grade']
        ),
    },
    'divisions': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['div_code', 'division_code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['div_name', 'division_name', 'description']
        ),
    },
    'directorates': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['dir_code', 'directorate_code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['dir_name', 'directorate_name', 'description']
        ),
        'division': FieldDefinition(
            name='division',
            type='foreign_key',
            required=False,  # Validated during processing - allows per-row errors
            aliases=['division_code', 'div', 'division_name', 'parent_division'],
            lookup_model='organization.Division'
        ),
    },
    'banks': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['bank_code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['bank_name', 'bank']
        ),
        'swift_code': FieldDefinition(
            name='swift_code',
            type='string',
            aliases=['swift', 'bic']
        ),
    },
    'bank_branches': {
        'bank': FieldDefinition(
            name='bank',
            type='foreign_key',
            required=True,
            aliases=['bank_code', 'bank_name', 'bank code', 'bankcode', 'parent_bank', 'bank_id'],
            lookup_model='payroll.Bank'
        ),
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['branch_code', 'branch code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['branch_name', 'branch', 'bank_branch', 'branch name']
        ),
        'sort_code': FieldDefinition(
            name='sort_code',
            type='string',
            aliases=['sort', 'routing_number', 'routing']
        ),
        'city': FieldDefinition(
            name='city',
            type='string',
            aliases=['town', 'location', 'branch_city']
        ),
    },
    'staff_categories': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['category_code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['category_name', 'staff_type']
        ),
        'payroll_group': FieldDefinition(
            name='payroll_group',
            type='string',
            aliases=['payroll_name', 'group']
        ),
    },
    'salary_bands': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['band_code', 'band']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['band_name']
        ),
        'min_salary': FieldDefinition(
            name='min_salary',
            type='decimal',
            aliases=['minimum', 'min']
        ),
        'max_salary': FieldDefinition(
            name='max_salary',
            type='decimal',
            aliases=['maximum', 'max']
        ),
    },
    'salary_levels': {
        'band': FieldDefinition(
            name='band',
            type='foreign_key',
            required=True,
            aliases=['salary_band', 'band_code'],
            lookup_model='payroll.SalaryBand'
        ),
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['level_code', 'level']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['level_name']
        ),
    },
    'salary_notches': {
        'level': FieldDefinition(
            name='level',
            type='foreign_key',
            required=True,
            aliases=['salary_level', 'level_code'],
            lookup_model='payroll.SalaryLevel'
        ),
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,  # Auto-generated if not provided
            aliases=['notch_code', 'notch', 'step']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['notch_name']
        ),
        'amount': FieldDefinition(
            name='amount',
            type='decimal',
            required=True,
            aliases=['salary', 'base_salary', 'value']
        ),
    },
    'bank_accounts': {
        'employee_number': FieldDefinition(
            name='employee_number',
            type='string',
            required=True,
            aliases=['emp_no', 'staff_id', 'employee_id']
        ),
        'bank': FieldDefinition(
            name='bank',
            type='foreign_key',
            aliases=['bank_code', 'bank_name'],
            lookup_model='payroll.Bank'
        ),
        'branch': FieldDefinition(
            name='branch',
            type='foreign_key',
            aliases=['branch_code', 'branch_name', 'bank_branch'],
            lookup_model='payroll.BankBranch'
        ),
        'account_number': FieldDefinition(
            name='account_number',
            type='string',
            required=True,
            aliases=['account_no', 'acct_no', 'account']
        ),
        'account_name': FieldDefinition(
            name='account_name',
            type='string',
            aliases=['acct_name', 'name']
        ),
        'account_type': FieldDefinition(
            name='account_type',
            type='string',
            aliases=['acct_type', 'type']
        ),
    },
    'job_categories': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,
            aliases=['category_code', 'cat_code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['category_name', 'category', 'job_category']
        ),
        'description': FieldDefinition(
            name='description',
            type='string',
            aliases=['desc', 'details']
        ),
    },
    'work_locations': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,
            aliases=['location_code', 'loc_code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['location_name', 'location', 'office_name']
        ),
        'address': FieldDefinition(
            name='address',
            type='string',
            required=True,
            aliases=['street_address', 'office_address']
        ),
        'city': FieldDefinition(
            name='city',
            type='string',
            required=True,
            aliases=['town', 'location_city']
        ),
        'region': FieldDefinition(
            name='region',
            type='foreign_key',
            aliases=['region_name', 'region_code', 'state'],
            lookup_model='core.Region'
        ),
        'phone': FieldDefinition(
            name='phone',
            type='string',
            aliases=['telephone', 'contact', 'phone_number']
        ),
        'is_headquarters': FieldDefinition(
            name='is_headquarters',
            type='boolean',
            aliases=['headquarters', 'is_hq', 'hq']
        ),
    },
    'leave_types': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,
            aliases=['leave_code', 'type_code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['leave_name', 'leave_type', 'type_name']
        ),
        'description': FieldDefinition(
            name='description',
            type='string',
            aliases=['desc', 'details']
        ),
        'default_days': FieldDefinition(
            name='default_days',
            type='decimal',
            required=True,
            aliases=['days', 'entitlement', 'annual_days', 'allowed_days']
        ),
        'max_days': FieldDefinition(
            name='max_days',
            type='decimal',
            aliases=['maximum_days', 'max_entitlement']
        ),
        'is_paid': FieldDefinition(
            name='is_paid',
            type='boolean',
            aliases=['paid', 'paid_leave']
        ),
        'requires_approval': FieldDefinition(
            name='requires_approval',
            type='boolean',
            aliases=['needs_approval', 'approval_required']
        ),
        'requires_document': FieldDefinition(
            name='requires_document',
            type='boolean',
            aliases=['needs_document', 'document_required']
        ),
        'allow_carry_forward': FieldDefinition(
            name='allow_carry_forward',
            type='boolean',
            aliases=['carry_forward', 'can_carry_forward']
        ),
        'color_code': FieldDefinition(
            name='color_code',
            type='string',
            aliases=['color', 'hex_color']
        ),
    },
    'pay_components': {
        'code': FieldDefinition(
            name='code',
            type='string',
            required=False,
            aliases=['component_code', 'comp_code']
        ),
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['component_name', 'component', 'pay_name']
        ),
        'short_name': FieldDefinition(
            name='short_name',
            type='string',
            aliases=['abbreviation', 'abbrev']
        ),
        'description': FieldDefinition(
            name='description',
            type='string',
            aliases=['desc', 'details']
        ),
        'component_type': FieldDefinition(
            name='component_type',
            type='string',
            required=True,
            aliases=['type', 'pay_type', 'earning_deduction']
        ),
        'calculation_type': FieldDefinition(
            name='calculation_type',
            type='string',
            aliases=['calc_type', 'calculation']
        ),
        'category': FieldDefinition(
            name='category',
            type='string',
            aliases=['component_category', 'pay_category']
        ),
        'default_amount': FieldDefinition(
            name='default_amount',
            type='decimal',
            aliases=['amount', 'value', 'default_value']
        ),
        'percentage_value': FieldDefinition(
            name='percentage_value',
            type='decimal',
            aliases=['percentage', 'rate', 'pct']
        ),
        'is_taxable': FieldDefinition(
            name='is_taxable',
            type='boolean',
            aliases=['taxable', 'subject_to_tax']
        ),
        'is_statutory': FieldDefinition(
            name='is_statutory',
            type='boolean',
            aliases=['statutory', 'mandatory']
        ),
        'affects_ssnit': FieldDefinition(
            name='affects_ssnit',
            type='boolean',
            aliases=['ssnit', 'pension_contribution']
        ),
        'show_on_payslip': FieldDefinition(
            name='show_on_payslip',
            type='boolean',
            aliases=['on_payslip', 'visible']
        ),
    },
    'holidays': {
        'name': FieldDefinition(
            name='name',
            type='string',
            required=True,
            aliases=['holiday_name', 'holiday', 'event']
        ),
        'date': FieldDefinition(
            name='date',
            type='date',
            required=True,
            aliases=['holiday_date', 'event_date']
        ),
        'holiday_type': FieldDefinition(
            name='holiday_type',
            type='string',
            aliases=['type', 'category']
        ),
        'region': FieldDefinition(
            name='region',
            type='foreign_key',
            aliases=['region_name', 'region_code', 'state'],
            lookup_model='core.Region'
        ),
        'description': FieldDefinition(
            name='description',
            type='string',
            aliases=['desc', 'details', 'notes']
        ),
        'is_paid': FieldDefinition(
            name='is_paid',
            type='boolean',
            aliases=['paid', 'paid_holiday']
        ),
    },
}


class ColumnMapper:
    """AI-powered column to field mapping."""

    def __init__(self):
        self.model_fields = MODEL_FIELDS

    def map_columns(
        self,
        headers: List[str],
        target_model: str,
        instructions: str = None
    ) -> Dict[str, MappingResult]:
        """
        Map source columns to target fields.

        1. Parse any explicit instructions
        2. Fuzzy match headers to known aliases
        3. Return mapping with confidence scores
        """
        if target_model not in self.model_fields:
            raise ValueError(f"Unknown target model: {target_model}")

        fields = self.model_fields[target_model]
        mappings = {}

        # Parse explicit instructions
        explicit_mappings = self._parse_instructions(instructions, headers, fields)

        # Normalize headers for matching
        normalized_headers = {
            self._normalize(h): h for h in headers
        }

        for header in headers:
            # Check if explicitly mapped
            if header in explicit_mappings:
                target_field = explicit_mappings[header]
                mappings[header] = MappingResult(
                    source_column=header,
                    target_field=target_field,
                    confidence=1.0,
                    reason="Explicitly specified in instructions"
                )
                continue

            # Try fuzzy matching
            best_match = self._find_best_match(header, fields)
            if best_match:
                mappings[header] = best_match

        return mappings

    def _normalize(self, text: str) -> str:
        """Normalize text for comparison."""
        # Convert to lowercase, replace separators with spaces, strip
        text = text.lower()
        text = re.sub(r'[_\-./]', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _similarity(self, a: str, b: str) -> float:
        """Calculate string similarity (0-1)."""
        return SequenceMatcher(None, a.lower(), b.lower()).ratio()

    def _find_best_match(
        self,
        header: str,
        fields: Dict[str, FieldDefinition]
    ) -> Optional[MappingResult]:
        """Find best matching field for a header."""
        normalized_header = self._normalize(header)
        best_score = 0.0
        best_field = None
        best_reason = ""

        for field_name, field_def in fields.items():
            # Check exact match with field name
            if normalized_header == self._normalize(field_name):
                return MappingResult(
                    source_column=header,
                    target_field=field_name,
                    confidence=1.0,
                    reason="Exact field name match"
                )

            # Check aliases
            if field_def.aliases:
                for alias in field_def.aliases:
                    normalized_alias = self._normalize(alias)

                    # Exact alias match
                    if normalized_header == normalized_alias:
                        return MappingResult(
                            source_column=header,
                            target_field=field_name,
                            confidence=0.95,
                            reason=f"Exact alias match: {alias}"
                        )

                    # Check if header contains alias or vice versa
                    if normalized_alias in normalized_header:
                        score = len(normalized_alias) / len(normalized_header)
                        if score > best_score:
                            best_score = score
                            best_field = field_name
                            best_reason = f"Header contains alias: {alias}"

                    if normalized_header in normalized_alias:
                        score = len(normalized_header) / len(normalized_alias) * 0.9
                        if score > best_score:
                            best_score = score
                            best_field = field_name
                            best_reason = f"Alias contains header: {alias}"

                    # Fuzzy similarity
                    sim = self._similarity(normalized_header, normalized_alias)
                    if sim > best_score and sim > 0.6:
                        best_score = sim
                        best_field = field_name
                        best_reason = f"Similar to alias: {alias}"

            # Fuzzy match with field name
            sim = self._similarity(normalized_header, self._normalize(field_name))
            if sim > best_score and sim > 0.6:
                best_score = sim
                best_field = field_name
                best_reason = f"Similar to field: {field_name}"

        if best_field and best_score > 0.5:
            return MappingResult(
                source_column=header,
                target_field=best_field,
                confidence=min(best_score, 0.9),  # Cap at 0.9 for non-exact matches
                reason=best_reason
            )

        return None

    def _parse_instructions(
        self,
        instructions: str,
        headers: List[str],
        fields: Dict[str, FieldDefinition]
    ) -> Dict[str, str]:
        """
        Parse natural language instructions for explicit mappings.
        E.g., "Column 'Staff ID' is the employee number"
        """
        if not instructions:
            return {}

        explicit_mappings = {}
        instructions_lower = instructions.lower()

        # Pattern: "column X is/maps to/should be Y"
        patterns = [
            r"(?:column\s+)?['\"]?(\w[\w\s]*)['\"]?\s+(?:is|maps?\s+to|should\s+be|=)\s+(?:the\s+)?['\"]?(\w[\w\s]*)['\"]?",
            r"(?:map|use)\s+['\"]?(\w[\w\s]*)['\"]?\s+(?:for|as)\s+(?:the\s+)?['\"]?(\w[\w\s]*)['\"]?",
        ]

        for pattern in patterns:
            matches = re.finditer(pattern, instructions_lower, re.IGNORECASE)
            for match in matches:
                source = match.group(1).strip()
                target = match.group(2).strip()

                # Find matching header
                header_match = None
                for h in headers:
                    if self._normalize(h) == self._normalize(source):
                        header_match = h
                        break

                # Find matching field
                field_match = None
                for field_name, field_def in fields.items():
                    if self._normalize(field_name) == self._normalize(target):
                        field_match = field_name
                        break
                    if field_def.aliases:
                        for alias in field_def.aliases:
                            if self._normalize(alias) == self._normalize(target):
                                field_match = field_name
                                break

                if header_match and field_match:
                    explicit_mappings[header_match] = field_match

        return explicit_mappings

    def validate_mapping(
        self,
        mapping: Dict[str, str],
        sample_data: List[List[Any]],
        headers: List[str],
        target_model: str
    ) -> ValidationResult:
        """
        Validate mapping against sample data.
        Check data types and required fields.
        """
        errors = []
        warnings = []
        sample_transformations = []

        fields = self.model_fields.get(target_model, {})

        # Check required fields
        required_fields = [
            name for name, field in fields.items()
            if field.required
        ]
        mapped_fields = set(mapping.values())

        for req in required_fields:
            if req not in mapped_fields:
                errors.append(f"Required field '{req}' is not mapped")

        # Create header index
        header_index = {h: i for i, h in enumerate(headers)}

        # Validate sample data
        for row_idx, row in enumerate(sample_data[:5]):
            row_transformations = {}

            for source_col, target_field in mapping.items():
                if source_col not in header_index:
                    continue

                col_idx = header_index[source_col]
                if col_idx >= len(row):
                    continue

                value = row[col_idx]
                field_def = fields.get(target_field)

                if field_def:
                    transformed, error = self._validate_value(value, field_def)
                    row_transformations[target_field] = {
                        'original': value,
                        'transformed': transformed,
                        'error': error
                    }
                    if error and row_idx == 0:
                        warnings.append(f"Row {row_idx + 1}: {target_field} - {error}")

            sample_transformations.append(row_transformations)

        return ValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            sample_transformations=sample_transformations
        )

    def _validate_value(
        self,
        value: Any,
        field_def: FieldDefinition
    ) -> Tuple[Any, Optional[str]]:
        """Validate and transform a value based on field definition."""
        if value is None or str(value).strip() == '':
            if field_def.required:
                return None, "Value is required"
            return None, None

        value_str = str(value).strip()

        if field_def.type == 'integer':
            try:
                return int(float(value_str)), None
            except ValueError:
                return value_str, f"Cannot convert '{value_str}' to integer"

        elif field_def.type == 'decimal':
            try:
                # Remove common formatting
                cleaned = re.sub(r'[,$\s]', '', value_str)
                return float(cleaned), None
            except ValueError:
                return value_str, f"Cannot convert '{value_str}' to decimal"

        elif field_def.type == 'date':
            parsed = self._parse_date(value_str)
            if parsed:
                return parsed, None
            return value_str, f"Cannot parse date '{value_str}'"

        elif field_def.type == 'email':
            if '@' in value_str and '.' in value_str:
                return value_str.lower(), None
            return value_str, f"Invalid email format: '{value_str}'"

        elif field_def.type == 'boolean':
            lower = value_str.lower()
            if lower in ('true', '1', 'yes', 'y'):
                return True, None
            elif lower in ('false', '0', 'no', 'n'):
                return False, None
            return value_str, f"Cannot convert '{value_str}' to boolean"

        # String or foreign key (will be resolved later)
        return value_str, None

    def _parse_date(self, value: str) -> Optional[str]:
        """Try to parse various date formats to YYYY-MM-DD."""
        from datetime import datetime

        formats = [
            '%Y-%m-%d',
            '%d/%m/%Y',
            '%m/%d/%Y',
            '%d-%m-%Y',
            '%m-%d-%Y',
            '%Y/%m/%d',
            '%d %b %Y',
            '%d %B %Y',
            '%B %d, %Y',
            '%b %d, %Y',
        ]

        for fmt in formats:
            try:
                dt = datetime.strptime(value, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue

        return None

    def get_field_definitions(self, target_model: str) -> Dict[str, Dict]:
        """Get field definitions for a target model."""
        fields = self.model_fields.get(target_model, {})
        return {
            name: {
                'name': f.name,
                'type': f.type,
                'required': f.required,
                'aliases': f.aliases or [],
                'lookup_model': f.lookup_model
            }
            for name, f in fields.items()
        }
