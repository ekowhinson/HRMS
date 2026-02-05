"""
Unified Multi-File Import Processor for HRMS.

This module handles:
1. Reading multiple files (CSV, XLSX, XLS)
2. Joining files on employee ID into a unified dataset
3. Creating setup models in dependency order
4. Creating employees with proper FK references
"""

import re
import logging
from io import BytesIO
from typing import Dict, List, Any, Optional, Tuple, Set
from dataclasses import dataclass, field
from datetime import datetime, date
from decimal import Decimal, InvalidOperation

import pandas as pd
from django.db import transaction, IntegrityError
from django.utils import timezone

from employees.models import Employee, BankAccount
from organization.models import (
    Division, Directorate, Department, JobGrade, JobCategory,
    JobPosition, WorkLocation, CostCenter
)
from payroll.models import (
    Bank, BankBranch, StaffCategory, SalaryBand, SalaryLevel, SalaryNotch
)

logger = logging.getLogger(__name__)


@dataclass
class ImportResult:
    """Result of an import operation."""
    success: bool
    total_rows: int = 0
    employees_created: int = 0
    employees_updated: int = 0
    employees_skipped: int = 0
    setups_created: Dict[str, int] = field(default_factory=dict)
    errors: List[Dict[str, Any]] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


@dataclass
class ColumnMapping:
    """Column mapping configuration."""
    # Employee identification
    employee_id: str = None
    employee_number: str = None
    legacy_id: str = None
    old_staff_number: str = None

    # Personal info
    title: str = None
    first_name: str = None
    middle_name: str = None
    last_name: str = None
    full_name: str = None  # Will be split if first/last not provided
    date_of_birth: str = None
    gender: str = None
    marital_status: str = None
    nationality: str = None

    # National IDs
    ghana_card: str = None
    ssnit: str = None
    tin: str = None
    voter_id: str = None
    passport: str = None

    # Contact
    email: str = None
    personal_email: str = None
    work_email: str = None
    phone: str = None
    mobile_phone: str = None

    # Address
    address: str = None
    city: str = None
    region: str = None
    district: str = None
    digital_address: str = None

    # Employment
    date_of_joining: str = None
    employment_status: str = None
    employment_type: str = None

    # Organization
    division: str = None
    directorate: str = None
    department: str = None
    position: str = None
    grade: str = None
    work_location: str = None
    staff_category: str = None

    # Salary
    salary_band: str = None
    salary_level: str = None
    salary_notch: str = None
    basic_salary: str = None

    # Bank
    bank_name: str = None
    bank_code: str = None
    branch_name: str = None
    branch_code: str = None
    account_name: str = None
    account_number: str = None
    account_type: str = None

    # Supervisor
    supervisor_id: str = None
    supervisor_name: str = None


class UnifiedImportProcessor:
    """
    Unified processor for multi-file employee imports.

    Handles:
    - Reading multiple files and joining on employee ID
    - Auto-detecting column mappings
    - Creating setup records in dependency order
    - Creating/updating employees with proper FK references
    """

    # Column name patterns for auto-detection
    COLUMN_PATTERNS = {
        'employee_id': [
            r'emp.*id', r'employee.*id', r'staff.*id', r'emp.*no', r'employee.*no',
            r'staff.*no', r'emp.*number', r'employee.*number', r'staff.*number',
            r'^id$', r'^no$', r'^number$'
        ],
        'first_name': [r'first.*name', r'fname', r'given.*name', r'forename'],
        'middle_name': [r'middle.*name', r'mname', r'other.*name'],
        'last_name': [r'last.*name', r'lname', r'surname', r'family.*name'],
        'full_name': [r'full.*name', r'^name$', r'employee.*name', r'staff.*name'],
        'date_of_birth': [r'dob', r'date.*birth', r'birth.*date', r'birthday'],
        'gender': [r'gender', r'sex'],
        'marital_status': [r'marital', r'married'],
        'nationality': [r'nationality', r'citizen'],
        'ghana_card': [r'ghana.*card', r'national.*id', r'gha.*id'],
        'ssnit': [r'ssnit', r'social.*security'],
        'tin': [r'tin', r'tax.*id'],
        'email': [r'email', r'e-mail', r'mail'],
        'personal_email': [r'personal.*email', r'private.*email'],
        'work_email': [r'work.*email', r'office.*email', r'corporate.*email'],
        'phone': [r'phone', r'tel', r'mobile', r'cell', r'contact'],
        'mobile_phone': [r'mobile', r'cell.*phone', r'gsm'],
        'address': [r'address', r'residence', r'home.*address'],
        'city': [r'city', r'town'],
        'region': [r'region', r'state', r'province'],
        'district': [r'district'],
        'digital_address': [r'digital.*address', r'gps'],
        'date_of_joining': [r'join.*date', r'date.*join', r'hire.*date', r'start.*date', r'employment.*date'],
        'employment_status': [r'emp.*status', r'status', r'employment.*status'],
        'employment_type': [r'emp.*type', r'employment.*type', r'contract.*type'],
        'division': [r'division'],
        'directorate': [r'directorate', r'director'],
        'department': [r'department', r'dept', r'unit'],
        'position': [r'position', r'job.*title', r'designation', r'role'],
        'grade': [r'grade', r'level', r'rank'],
        'work_location': [r'location', r'work.*location', r'office', r'station'],
        'staff_category': [r'staff.*cat', r'category', r'payroll.*group'],
        'salary_band': [r'band', r'salary.*band', r'pay.*band'],
        'salary_level': [r'salary.*level', r'pay.*level'],
        'salary_notch': [r'notch', r'step', r'increment'],
        'basic_salary': [r'basic', r'salary', r'gross', r'pay'],
        'bank_name': [r'bank.*name', r'^bank$'],
        'bank_code': [r'bank.*code', r'bank.*id'],
        'branch_name': [r'branch.*name', r'^branch$'],
        'branch_code': [r'branch.*code', r'sort.*code'],
        'account_name': [r'account.*name', r'acct.*name', r'a/c.*name'],
        'account_number': [r'account.*no', r'acct.*no', r'a/c.*no', r'account.*number'],
        'account_type': [r'account.*type', r'acct.*type'],
        'supervisor_id': [r'supervisor.*id', r'manager.*id', r'reports.*to.*id'],
        'supervisor_name': [r'supervisor', r'manager', r'reports.*to'],
    }

    # Gender mapping
    GENDER_MAP = {
        'male': 'M', 'm': 'M', 'man': 'M', 'boy': 'M',
        'female': 'F', 'f': 'F', 'woman': 'F', 'girl': 'F',
    }

    # Marital status mapping
    MARITAL_MAP = {
        'single': 'SINGLE', 's': 'SINGLE', 'unmarried': 'SINGLE',
        'married': 'MARRIED', 'm': 'MARRIED',
        'divorced': 'DIVORCED', 'd': 'DIVORCED',
        'widowed': 'WIDOWED', 'w': 'WIDOWED', 'widow': 'WIDOWED', 'widower': 'WIDOWED',
        'separated': 'SEPARATED',
    }

    # Employment status mapping
    STATUS_MAP = {
        'active': 'ACTIVE', 'a': 'ACTIVE', 'working': 'ACTIVE',
        'on leave': 'ON_LEAVE', 'leave': 'ON_LEAVE',
        'suspended': 'SUSPENDED',
        'probation': 'PROBATION', 'prob': 'PROBATION',
        'notice': 'NOTICE',
        'terminated': 'TERMINATED', 'fired': 'TERMINATED',
        'resigned': 'RESIGNED', 'quit': 'RESIGNED',
        'retired': 'RETIRED',
        'deceased': 'DECEASED', 'dead': 'DECEASED',
    }

    # Employment type mapping
    TYPE_MAP = {
        'permanent': 'PERMANENT', 'perm': 'PERMANENT', 'full time': 'PERMANENT',
        'contract': 'CONTRACT', 'cont': 'CONTRACT',
        'temporary': 'TEMPORARY', 'temp': 'TEMPORARY',
        'intern': 'INTERN', 'internship': 'INTERN',
        'consultant': 'CONSULTANT', 'consult': 'CONSULTANT',
        'part time': 'PART_TIME', 'part-time': 'PART_TIME',
        'secondment': 'SECONDMENT',
    }

    def __init__(self, user=None):
        """Initialize the processor."""
        self.user = user
        self.result = ImportResult(success=True)

        # Caches for created/existing records
        self._divisions: Dict[str, Division] = {}
        self._directorates: Dict[str, Directorate] = {}
        self._departments: Dict[str, Department] = {}
        self._grades: Dict[str, JobGrade] = {}
        self._categories: Dict[str, JobCategory] = {}
        self._positions: Dict[str, JobPosition] = {}
        self._locations: Dict[str, WorkLocation] = {}
        self._staff_categories: Dict[str, StaffCategory] = {}
        self._banks: Dict[str, Bank] = {}
        self._branches: Dict[str, BankBranch] = {}
        self._salary_bands: Dict[str, SalaryBand] = {}
        self._salary_levels: Dict[str, SalaryLevel] = {}
        self._salary_notches: Dict[str, SalaryNotch] = {}
        self._employees: Dict[str, Employee] = {}

    def read_file(self, file_content: bytes, filename: str) -> pd.DataFrame:
        """Read a file and return a DataFrame."""
        file_ext = filename.lower().split('.')[-1]
        file_buffer = BytesIO(file_content)

        try:
            if file_ext == 'csv':
                # Try different encodings
                for encoding in ['utf-8', 'latin-1', 'cp1252']:
                    try:
                        file_buffer.seek(0)
                        df = pd.read_csv(file_buffer, encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    raise ValueError(f"Could not decode CSV file: {filename}")
            elif file_ext in ['xlsx', 'xls']:
                df = pd.read_excel(file_buffer)
            else:
                raise ValueError(f"Unsupported file type: {file_ext}")

            # Clean column names
            df.columns = [str(col).strip().lower().replace('\n', ' ') for col in df.columns]

            # Remove completely empty rows
            df = df.dropna(how='all')

            logger.info(f"Read {len(df)} rows from {filename}")
            return df

        except Exception as e:
            logger.error(f"Error reading file {filename}: {e}")
            raise

    def auto_detect_mapping(self, columns: List[str]) -> ColumnMapping:
        """Auto-detect column mapping based on column names."""
        mapping = ColumnMapping()
        columns_lower = [str(col).lower() for col in columns]

        for field_name, patterns in self.COLUMN_PATTERNS.items():
            for col in columns_lower:
                for pattern in patterns:
                    if re.search(pattern, col, re.IGNORECASE):
                        setattr(mapping, field_name, col)
                        break
                if getattr(mapping, field_name):
                    break

        return mapping

    def join_dataframes(
        self,
        dataframes: List[Tuple[str, pd.DataFrame]],
        join_column: str = None
    ) -> pd.DataFrame:
        """
        Join multiple DataFrames on employee ID.

        Args:
            dataframes: List of (filename, DataFrame) tuples
            join_column: Column to join on (auto-detected if None)
        """
        if not dataframes:
            raise ValueError("No dataframes to join")

        if len(dataframes) == 1:
            return dataframes[0][1]

        # Start with the first dataframe
        result = dataframes[0][1].copy()
        first_file = dataframes[0][0]

        # Detect join column from first dataframe
        if join_column is None:
            mapping = self.auto_detect_mapping(result.columns.tolist())
            join_column = mapping.employee_id or mapping.employee_number
            if not join_column:
                # Try to find any ID-like column
                for col in result.columns:
                    if any(re.search(p, col, re.IGNORECASE) for p in self.COLUMN_PATTERNS['employee_id']):
                        join_column = col
                        break

        if not join_column:
            raise ValueError("Could not detect employee ID column for joining")

        logger.info(f"Using '{join_column}' as join column")

        # Join remaining dataframes
        for filename, df in dataframes[1:]:
            # Find matching join column in this dataframe
            df_join_col = None
            df_mapping = self.auto_detect_mapping(df.columns.tolist())
            df_join_col = df_mapping.employee_id or df_mapping.employee_number

            if not df_join_col:
                for col in df.columns:
                    if any(re.search(p, col, re.IGNORECASE) for p in self.COLUMN_PATTERNS['employee_id']):
                        df_join_col = col
                        break

            if not df_join_col:
                logger.warning(f"No join column found in {filename}, skipping")
                continue

            # Rename columns to avoid conflicts (except join column)
            suffix = f"_{filename.split('.')[0][:10]}"
            rename_map = {}
            for col in df.columns:
                if col != df_join_col and col in result.columns:
                    rename_map[col] = f"{col}{suffix}"

            df_renamed = df.rename(columns=rename_map)

            # Perform left join to keep all employees from first file
            result = result.merge(
                df_renamed,
                left_on=join_column,
                right_on=df_join_col,
                how='left',
                suffixes=('', suffix)
            )

            logger.info(f"Joined {filename} on {df_join_col}, result: {len(result)} rows")

        return result

    def _normalize_code(self, value: Any, max_length: int = 20) -> str:
        """Normalize a value to use as a code."""
        if pd.isna(value) or value is None:
            return None
        s = str(value).strip().upper()
        # Replace spaces and special chars with underscores
        s = re.sub(r'[^A-Z0-9]+', '_', s)
        # Remove leading/trailing underscores
        s = s.strip('_')
        return s[:max_length] if s else None

    def _generate_short_code(self, value: Any, max_length: int = 10) -> str:
        """Generate a short code from a value (for fields with limited length)."""
        if pd.isna(value) or value is None:
            return None
        s = str(value).strip().upper()
        # Take first letter of each word
        words = re.split(r'[^A-Z0-9]+', s)
        words = [w for w in words if w]  # Remove empty strings

        if len(words) == 1:
            # Single word - just truncate
            return words[0][:max_length]

        # Multiple words - create abbreviation
        abbrev = ''.join(w[0] for w in words)
        if len(abbrev) <= max_length:
            return abbrev
        return abbrev[:max_length]

    def _normalize_name(self, value: Any) -> str:
        """Normalize a value to use as a name."""
        if pd.isna(value) or value is None:
            return None
        return str(value).strip()[:200] if str(value).strip() else None

    def _parse_date(self, value: Any) -> Optional[date]:
        """Parse a date value."""
        if pd.isna(value) or value is None:
            return None

        if isinstance(value, (datetime, date)):
            return value.date() if isinstance(value, datetime) else value

        # Try pandas parsing
        try:
            parsed = pd.to_datetime(value, dayfirst=True)
            if pd.notna(parsed):
                return parsed.date()
        except:
            pass

        # Try common formats
        formats = [
            '%Y-%m-%d', '%d-%m-%Y', '%d/%m/%Y', '%m/%d/%Y',
            '%Y/%m/%d', '%d.%m.%Y', '%Y.%m.%d',
            '%d-%b-%Y', '%d %b %Y', '%B %d, %Y',
        ]

        value_str = str(value).strip()
        for fmt in formats:
            try:
                return datetime.strptime(value_str, fmt).date()
            except ValueError:
                continue

        return None

    def _parse_decimal(self, value: Any) -> Optional[Decimal]:
        """Parse a decimal value."""
        if pd.isna(value) or value is None:
            return None

        try:
            # Remove currency symbols and commas
            value_str = str(value).strip()
            value_str = re.sub(r'[^\d.-]', '', value_str)
            return Decimal(value_str) if value_str else None
        except (InvalidOperation, ValueError):
            return None

    def _get_value(self, row: pd.Series, column: str) -> Any:
        """Safely get a value from a row."""
        if column is None:
            return None
        if column not in row.index:
            return None
        value = row.get(column)
        if pd.isna(value):
            return None
        return value

    def _load_existing_records(self):
        """Load existing records into caches."""
        # Load divisions
        for d in Division.objects.filter(is_deleted=False):
            self._divisions[d.code] = d
            self._divisions[d.name.upper()] = d

        # Load directorates
        for d in Directorate.objects.filter(is_deleted=False):
            self._directorates[d.code] = d
            self._directorates[d.name.upper()] = d

        # Load departments
        for d in Department.objects.filter(is_deleted=False):
            self._departments[d.code] = d
            self._departments[d.name.upper()] = d

        # Load grades
        for g in JobGrade.objects.filter(is_deleted=False):
            self._grades[g.code] = g
            self._grades[g.name.upper()] = g

        # Load categories
        for c in JobCategory.objects.filter(is_deleted=False):
            self._categories[c.code] = c
            self._categories[c.name.upper()] = c

        # Load positions
        for p in JobPosition.objects.filter(is_deleted=False):
            self._positions[p.code] = p
            self._positions[p.title.upper()] = p

        # Load work locations
        for l in WorkLocation.objects.filter(is_deleted=False):
            self._locations[l.code] = l
            self._locations[l.name.upper()] = l

        # Load staff categories
        for s in StaffCategory.objects.filter(is_deleted=False):
            self._staff_categories[s.code] = s
            self._staff_categories[s.name.upper()] = s

        # Load banks
        for b in Bank.objects.filter(is_deleted=False):
            self._banks[b.code] = b
            self._banks[b.name.upper()] = b

        # Load branches
        for b in BankBranch.objects.filter(is_deleted=False):
            key = f"{b.bank.code}_{b.code}"
            self._branches[key] = b
            self._branches[f"{b.bank.name.upper()}_{b.name.upper()}"] = b

        # Load salary bands
        for s in SalaryBand.objects.filter(is_deleted=False):
            self._salary_bands[s.code] = s
            self._salary_bands[s.name.upper()] = s

        # Load salary levels
        for s in SalaryLevel.objects.filter(is_deleted=False):
            key = f"{s.band.code}_{s.code}"
            self._salary_levels[key] = s

        # Load salary notches
        for s in SalaryNotch.objects.filter(is_deleted=False):
            key = f"{s.level.band.code}_{s.level.code}_{s.code}"
            self._salary_notches[key] = s

        # Load employees
        for e in Employee.objects.filter(is_deleted=False):
            self._employees[e.employee_number] = e
            if e.legacy_employee_id:
                self._employees[e.legacy_employee_id] = e
            if e.old_staff_number:
                self._employees[e.old_staff_number] = e

    def _get_or_create_division(self, name: str) -> Optional[Division]:
        """Get or create a Division."""
        if not name:
            return None

        name = self._normalize_name(name)
        code = self._normalize_code(name)

        # Check cache
        if name.upper() in self._divisions:
            return self._divisions[name.upper()]
        if code in self._divisions:
            return self._divisions[code]

        # Create new
        division, created = Division.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._divisions[code] = division
        self._divisions[name.upper()] = division

        if created:
            self.result.setups_created['divisions'] = self.result.setups_created.get('divisions', 0) + 1
            logger.info(f"Created Division: {code} - {name}")

        return division

    def _get_or_create_directorate(self, name: str, division: Division = None) -> Optional[Directorate]:
        """Get or create a Directorate."""
        if not name:
            return None

        name = self._normalize_name(name)
        code = self._normalize_code(name)

        # Check cache
        if name.upper() in self._directorates:
            return self._directorates[name.upper()]
        if code in self._directorates:
            return self._directorates[code]

        # Need a division
        if not division:
            division = self._get_or_create_division("GENERAL")

        # Create new
        directorate, created = Directorate.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'division': division,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._directorates[code] = directorate
        self._directorates[name.upper()] = directorate

        if created:
            self.result.setups_created['directorates'] = self.result.setups_created.get('directorates', 0) + 1
            logger.info(f"Created Directorate: {code} - {name}")

        return directorate

    def _get_or_create_department(
        self,
        name: str,
        directorate: Directorate = None
    ) -> Optional[Department]:
        """Get or create a Department."""
        if not name:
            return None

        name = self._normalize_name(name)
        code = self._normalize_code(name)

        # Check cache
        if name.upper() in self._departments:
            return self._departments[name.upper()]
        if code in self._departments:
            return self._departments[code]

        # Create new
        department, created = Department.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'directorate': directorate,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._departments[code] = department
        self._departments[name.upper()] = department

        if created:
            self.result.setups_created['departments'] = self.result.setups_created.get('departments', 0) + 1
            logger.info(f"Created Department: {code} - {name}")

        return department

    def _get_or_create_grade(self, name: str, level: int = None) -> Optional[JobGrade]:
        """Get or create a JobGrade."""
        if not name:
            return None

        name = self._normalize_name(name)
        # JobGrade.code is max 10 chars, use short code
        code = self._generate_short_code(name, max_length=10)

        # Check cache by name first (more reliable)
        if name.upper() in self._grades:
            return self._grades[name.upper()]
        if code in self._grades:
            return self._grades[code]

        # Try to find existing by name
        existing = JobGrade.objects.filter(name__iexact=name, is_deleted=False).first()
        if existing:
            self._grades[existing.code] = existing
            self._grades[name.upper()] = existing
            return existing

        # Determine level from name if not provided
        if level is None:
            # Try to extract number from name
            match = re.search(r'(\d+)', name)
            level = int(match.group(1)) if match else 1

        # Ensure unique code
        base_code = code
        counter = 1
        while JobGrade.objects.filter(code=code, is_deleted=False).exists():
            code = f"{base_code[:8]}{counter}"
            counter += 1

        # Create new
        grade, created = JobGrade.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'level': level,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._grades[code] = grade
        self._grades[name.upper()] = grade

        if created:
            self.result.setups_created['grades'] = self.result.setups_created.get('grades', 0) + 1
            logger.info(f"Created JobGrade: {code} - {name}")

        return grade

    def _get_or_create_position(
        self,
        title: str,
        grade: JobGrade = None,
        department: Department = None
    ) -> Optional[JobPosition]:
        """Get or create a JobPosition."""
        if not title:
            return None

        title = self._normalize_name(title)
        code = self._normalize_code(title)

        # Check cache
        if title.upper() in self._positions:
            return self._positions[title.upper()]
        if code in self._positions:
            return self._positions[code]

        # Need a grade
        if not grade:
            grade = self._get_or_create_grade("GRADE_1", level=1)

        # Create new
        position, created = JobPosition.objects.get_or_create(
            code=code,
            defaults={
                'title': title,
                'grade': grade,
                'department': department,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._positions[code] = position
        self._positions[title.upper()] = position

        if created:
            self.result.setups_created['positions'] = self.result.setups_created.get('positions', 0) + 1
            logger.info(f"Created JobPosition: {code} - {title}")

        return position

    def _get_or_create_staff_category(self, name: str) -> Optional[StaffCategory]:
        """Get or create a StaffCategory."""
        if not name:
            return None

        name = self._normalize_name(name)
        code = self._normalize_code(name)

        # Check cache
        if name.upper() in self._staff_categories:
            return self._staff_categories[name.upper()]
        if code in self._staff_categories:
            return self._staff_categories[code]

        # Create new
        category, created = StaffCategory.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._staff_categories[code] = category
        self._staff_categories[name.upper()] = category

        if created:
            self.result.setups_created['staff_categories'] = self.result.setups_created.get('staff_categories', 0) + 1
            logger.info(f"Created StaffCategory: {code} - {name}")

        return category

    def _get_or_create_bank(self, name: str, code: str = None) -> Optional[Bank]:
        """Get or create a Bank."""
        if not name:
            return None

        name = self._normalize_name(name)
        if not code:
            code = self._normalize_code(name)
        else:
            code = self._normalize_code(code)

        # Check cache
        if name.upper() in self._banks:
            return self._banks[name.upper()]
        if code in self._banks:
            return self._banks[code]

        # Create new
        bank, created = Bank.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._banks[code] = bank
        self._banks[name.upper()] = bank

        if created:
            self.result.setups_created['banks'] = self.result.setups_created.get('banks', 0) + 1
            logger.info(f"Created Bank: {code} - {name}")

        return bank

    def _get_or_create_branch(
        self,
        name: str,
        bank: Bank,
        code: str = None
    ) -> Optional[BankBranch]:
        """Get or create a BankBranch."""
        if not name or not bank:
            return None

        name = self._normalize_name(name)
        if not code:
            code = self._normalize_code(name)
        else:
            code = self._normalize_code(code)

        # Check cache
        key = f"{bank.code}_{code}"
        if key in self._branches:
            return self._branches[key]

        name_key = f"{bank.name.upper()}_{name.upper()}"
        if name_key in self._branches:
            return self._branches[name_key]

        # Create new
        branch, created = BankBranch.objects.get_or_create(
            bank=bank,
            code=code,
            defaults={
                'name': name,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._branches[key] = branch
        self._branches[name_key] = branch

        if created:
            self.result.setups_created['bank_branches'] = self.result.setups_created.get('bank_branches', 0) + 1
            logger.info(f"Created BankBranch: {bank.name} - {name}")

        return branch

    def _get_or_create_salary_band(self, name: str) -> Optional[SalaryBand]:
        """Get or create a SalaryBand."""
        if not name:
            return None

        name = self._normalize_name(name)
        code = self._normalize_code(name)

        # Check cache
        if name.upper() in self._salary_bands:
            return self._salary_bands[name.upper()]
        if code in self._salary_bands:
            return self._salary_bands[code]

        # Determine sort order from name
        match = re.search(r'(\d+)', name)
        sort_order = int(match.group(1)) if match else 0

        # Create new
        band, created = SalaryBand.objects.get_or_create(
            code=code,
            defaults={
                'name': name,
                'sort_order': sort_order,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._salary_bands[code] = band
        self._salary_bands[name.upper()] = band

        if created:
            self.result.setups_created['salary_bands'] = self.result.setups_created.get('salary_bands', 0) + 1
            logger.info(f"Created SalaryBand: {code} - {name}")

        return band

    def _get_or_create_salary_level(
        self,
        name: str,
        band: SalaryBand
    ) -> Optional[SalaryLevel]:
        """Get or create a SalaryLevel."""
        if not name or not band:
            return None

        name = self._normalize_name(name)
        code = self._normalize_code(name)

        # Check cache
        key = f"{band.code}_{code}"
        if key in self._salary_levels:
            return self._salary_levels[key]

        # Determine sort order from name
        match = re.search(r'(\d+)', name)
        sort_order = int(match.group(1)) if match else 0

        # Create new
        level, created = SalaryLevel.objects.get_or_create(
            band=band,
            code=code,
            defaults={
                'name': name,
                'sort_order': sort_order,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._salary_levels[key] = level

        if created:
            self.result.setups_created['salary_levels'] = self.result.setups_created.get('salary_levels', 0) + 1
            logger.info(f"Created SalaryLevel: {band.code}/{code} - {name}")

        return level

    def _get_or_create_salary_notch(
        self,
        name: str,
        level: SalaryLevel,
        amount: Decimal = None
    ) -> Optional[SalaryNotch]:
        """Get or create a SalaryNotch."""
        if not name or not level:
            return None

        name = self._normalize_name(name)
        code = self._normalize_code(name)

        # Check cache
        key = f"{level.band.code}_{level.code}_{code}"
        if key in self._salary_notches:
            return self._salary_notches[key]

        # Determine sort order from name
        match = re.search(r'(\d+)', name)
        sort_order = int(match.group(1)) if match else 0

        # Create new
        notch, created = SalaryNotch.objects.get_or_create(
            level=level,
            code=code,
            defaults={
                'name': name,
                'amount': amount or Decimal('0'),
                'sort_order': sort_order,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._salary_notches[key] = notch

        if created:
            self.result.setups_created['salary_notches'] = self.result.setups_created.get('salary_notches', 0) + 1
            logger.info(f"Created SalaryNotch: {level.band.code}/{level.code}/{code}")

        return notch

    def _parse_full_name(self, full_name: str) -> Tuple[str, str, str]:
        """Parse a full name into first, middle, last names."""
        if not full_name:
            return None, None, None

        parts = full_name.strip().split()
        if len(parts) == 1:
            return parts[0], None, parts[0]
        elif len(parts) == 2:
            return parts[0], None, parts[1]
        else:
            return parts[0], ' '.join(parts[1:-1]), parts[-1]

    def _process_employee_row(
        self,
        row: pd.Series,
        mapping: ColumnMapping,
        row_num: int,
        update_existing: bool = True
    ) -> Optional[Employee]:
        """Process a single employee row."""
        try:
            # Get employee identifier
            emp_id = (
                self._get_value(row, mapping.employee_id) or
                self._get_value(row, mapping.employee_number)
            )

            if not emp_id:
                self.result.errors.append({
                    'row': row_num,
                    'error': 'No employee ID/number found',
                })
                return None

            emp_number = str(emp_id).strip()

            # Check if employee exists
            existing = self._employees.get(emp_number)
            if existing and not update_existing:
                self.result.employees_skipped += 1
                return existing

            # Get names
            first_name = self._get_value(row, mapping.first_name)
            middle_name = self._get_value(row, mapping.middle_name)
            last_name = self._get_value(row, mapping.last_name)

            # Parse full name if individual names not provided
            if not first_name and not last_name:
                full_name = self._get_value(row, mapping.full_name)
                if full_name:
                    first_name, middle_name, last_name = self._parse_full_name(full_name)

            if not first_name:
                first_name = "Unknown"
            if not last_name:
                last_name = "Unknown"

            # Parse dates
            dob = self._parse_date(self._get_value(row, mapping.date_of_birth))
            if not dob:
                dob = date(1990, 1, 1)  # Default DOB

            doj = self._parse_date(self._get_value(row, mapping.date_of_joining))
            if not doj:
                doj = timezone.now().date()

            # Parse gender
            gender_raw = self._get_value(row, mapping.gender)
            gender = self.GENDER_MAP.get(str(gender_raw).lower().strip(), 'M') if gender_raw else 'M'

            # Parse marital status
            marital_raw = self._get_value(row, mapping.marital_status)
            marital_status = self.MARITAL_MAP.get(str(marital_raw).lower().strip(), 'SINGLE') if marital_raw else 'SINGLE'

            # Parse employment status
            status_raw = self._get_value(row, mapping.employment_status)
            status = self.STATUS_MAP.get(str(status_raw).lower().strip(), 'ACTIVE') if status_raw else 'ACTIVE'

            # Parse employment type
            type_raw = self._get_value(row, mapping.employment_type)
            emp_type = self.TYPE_MAP.get(str(type_raw).lower().strip(), 'PERMANENT') if type_raw else 'PERMANENT'

            # Get/create organization hierarchy
            division_name = self._get_value(row, mapping.division)
            division = self._get_or_create_division(division_name) if division_name else None

            directorate_name = self._get_value(row, mapping.directorate)
            directorate = self._get_or_create_directorate(directorate_name, division) if directorate_name else None

            department_name = self._get_value(row, mapping.department)
            department = self._get_or_create_department(department_name, directorate)

            # Must have a department
            if not department:
                department = self._get_or_create_department("GENERAL")

            # Get/create grade and position
            grade_name = self._get_value(row, mapping.grade)
            grade = self._get_or_create_grade(grade_name) if grade_name else self._get_or_create_grade("GRADE_1", level=1)

            position_name = self._get_value(row, mapping.position)
            position = self._get_or_create_position(position_name, grade, department) if position_name else self._get_or_create_position("STAFF", grade, department)

            # Get/create staff category
            staff_cat_name = self._get_value(row, mapping.staff_category)
            staff_category = self._get_or_create_staff_category(staff_cat_name) if staff_cat_name else None

            # Get/create salary structure
            salary_notch = None
            band_name = self._get_value(row, mapping.salary_band)
            level_name = self._get_value(row, mapping.salary_level)
            notch_name = self._get_value(row, mapping.salary_notch)
            basic_salary = self._parse_decimal(self._get_value(row, mapping.basic_salary))

            if band_name:
                band = self._get_or_create_salary_band(band_name)
                if band and level_name:
                    level = self._get_or_create_salary_level(level_name, band)
                    if level and notch_name:
                        salary_notch = self._get_or_create_salary_notch(notch_name, level, basic_salary)

            # Build employee data
            employee_data = {
                'employee_number': emp_number,
                'first_name': first_name[:100],
                'middle_name': middle_name[:100] if middle_name else None,
                'last_name': last_name[:100],
                'date_of_birth': dob,
                'gender': gender,
                'marital_status': marital_status,
                'date_of_joining': doj,
                'status': status,
                'employment_type': emp_type,
                'department': department,
                'position': position,
                'grade': grade,
                'division': division,
                'directorate': directorate,
                'staff_category': staff_category,
                'salary_notch': salary_notch,
            }

            # Add optional fields
            optional_fields = [
                ('title', mapping.title, str, 20),
                ('nationality', mapping.nationality, str, 50),
                ('voter_id', mapping.voter_id, str, 20),
                ('passport_number', mapping.passport, str, 20),
                ('personal_email', mapping.personal_email or mapping.email, str, 254),
                ('work_email', mapping.work_email, str, 254),
                ('mobile_phone', mapping.mobile_phone or mapping.phone, str, 20),
                ('residential_address', mapping.address, str, 500),
                ('residential_city', mapping.city, str, 100),
                ('digital_address', mapping.digital_address, str, 20),
                ('legacy_employee_id', mapping.legacy_id, str, 50),
                ('old_staff_number', mapping.old_staff_number, str, 50),
            ]

            for field_name, column, converter, max_len in optional_fields:
                value = self._get_value(row, column)
                if value:
                    value = converter(value).strip()[:max_len]
                    employee_data[field_name] = value

            # Handle unique fields carefully - check for duplicates
            unique_fields = [
                ('ghana_card_number', mapping.ghana_card, 20),
                ('ssnit_number', mapping.ssnit, 20),
                ('tin_number', mapping.tin, 20),
            ]

            for field_name, column, max_len in unique_fields:
                value = self._get_value(row, column)
                if value:
                    value = str(value).strip()[:max_len]
                    # Check if this unique value already exists for another employee
                    existing_with_value = Employee.objects.filter(
                        **{field_name: value},
                        is_deleted=False
                    ).exclude(employee_number=emp_number).first()

                    if existing_with_value:
                        # Value already used by another employee, skip this field
                        self.result.warnings.append(
                            f"Row {row_num}: {field_name} '{value}' already used by employee {existing_with_value.employee_number}"
                        )
                    else:
                        employee_data[field_name] = value

            # Ensure mobile_phone has a value (required field)
            if not employee_data.get('mobile_phone'):
                employee_data['mobile_phone'] = '0000000000'

            # Ensure residential_address has a value (required field)
            if not employee_data.get('residential_address'):
                employee_data['residential_address'] = 'Not provided'

            # Ensure residential_city has a value (required field)
            if not employee_data.get('residential_city'):
                employee_data['residential_city'] = 'Not provided'

            # Create or update employee
            if existing:
                for key, value in employee_data.items():
                    setattr(existing, key, value)
                existing.updated_by = self.user
                existing.save()
                self._employees[emp_number] = existing
                self.result.employees_updated += 1
                return existing
            else:
                employee_data['created_by'] = self.user
                employee = Employee.objects.create(**employee_data)
                self._employees[emp_number] = employee
                self.result.employees_created += 1
                return employee

        except Exception as e:
            logger.error(f"Error processing row {row_num}: {e}")
            self.result.errors.append({
                'row': row_num,
                'error': str(e),
            })
            return None

    def _process_bank_account(
        self,
        row: pd.Series,
        mapping: ColumnMapping,
        employee: Employee,
        row_num: int
    ):
        """Process bank account data for an employee."""
        try:
            bank_name = self._get_value(row, mapping.bank_name)
            account_number = self._get_value(row, mapping.account_number)

            if not bank_name or not account_number:
                return

            account_number = str(account_number).strip()

            # Get or create bank
            bank_code = self._get_value(row, mapping.bank_code)
            bank = self._get_or_create_bank(bank_name, bank_code)

            # Get or create branch
            branch = None
            branch_name = self._get_value(row, mapping.branch_name)
            if branch_name:
                branch_code = self._get_value(row, mapping.branch_code)
                branch = self._get_or_create_branch(branch_name, bank, branch_code)

            # Account name defaults to employee name
            account_name = self._get_value(row, mapping.account_name)
            if not account_name:
                account_name = f"{employee.first_name} {employee.last_name}"

            # Account type
            account_type_raw = self._get_value(row, mapping.account_type)
            account_type = 'SAVINGS'
            if account_type_raw:
                at_lower = str(account_type_raw).lower()
                if 'current' in at_lower or 'checking' in at_lower:
                    account_type = 'CURRENT'

            # Check if account already exists
            existing_account = BankAccount.objects.filter(
                employee=employee,
                account_number=account_number,
                is_deleted=False
            ).first()

            if existing_account:
                # Update existing
                existing_account.bank = bank
                existing_account.branch = branch
                existing_account.bank_name = bank_name
                existing_account.branch_name = branch_name
                existing_account.account_name = account_name
                existing_account.account_type = account_type
                existing_account.updated_by = self.user
                existing_account.save()
            else:
                # Create new
                BankAccount.objects.create(
                    employee=employee,
                    bank=bank,
                    branch=branch,
                    bank_name=bank_name,
                    bank_code=bank_code,
                    branch_name=branch_name,
                    branch_code=self._get_value(row, mapping.branch_code),
                    account_name=account_name,
                    account_number=account_number,
                    account_type=account_type,
                    is_primary=True,
                    created_by=self.user,
                )
                self.result.setups_created['bank_accounts'] = self.result.setups_created.get('bank_accounts', 0) + 1

        except Exception as e:
            logger.error(f"Error processing bank account for row {row_num}: {e}")

    def process_import(
        self,
        files: List[Tuple[str, bytes]],
        mapping: ColumnMapping = None,
        update_existing: bool = True,
        join_column: str = None,
    ) -> ImportResult:
        """
        Process multi-file import.

        Args:
            files: List of (filename, file_content) tuples
            mapping: Column mapping (auto-detected if None)
            update_existing: Whether to update existing employees
            join_column: Column to join files on (auto-detected if None)

        Returns:
            ImportResult with statistics
        """
        logger.info(f"Starting import of {len(files)} files")

        try:
            # Read all files
            dataframes = []
            for filename, content in files:
                df = self.read_file(content, filename)
                dataframes.append((filename, df))
                logger.info(f"Loaded {filename}: {len(df)} rows, {len(df.columns)} columns")

            # Join dataframes
            merged_df = self.join_dataframes(dataframes, join_column)
            self.result.total_rows = len(merged_df)
            logger.info(f"Merged dataset: {self.result.total_rows} rows")

            # Auto-detect mapping if not provided
            if mapping is None:
                mapping = self.auto_detect_mapping(merged_df.columns.tolist())
                logger.info(f"Auto-detected mapping: emp_id={mapping.employee_id}, name={mapping.full_name or mapping.first_name}")

            # Load existing records into cache
            self._load_existing_records()

            # Process each row with individual savepoints
            for idx, row in merged_df.iterrows():
                row_num = idx + 2  # Excel-style row number (header = 1)

                try:
                    with transaction.atomic():
                        # Process employee
                        employee = self._process_employee_row(row, mapping, row_num, update_existing)

                        # Process bank account if employee was created/updated
                        if employee:
                            self._process_bank_account(row, mapping, employee, row_num)
                except IntegrityError as e:
                    # Handle duplicate key errors gracefully
                    error_msg = str(e)
                    if 'duplicate key' in error_msg.lower():
                        self.result.errors.append({
                            'row': row_num,
                            'error': f'Duplicate value: {error_msg.split("DETAIL:")[-1].strip() if "DETAIL:" in error_msg else error_msg}',
                        })
                    else:
                        self.result.errors.append({
                            'row': row_num,
                            'error': error_msg,
                        })
                    continue
                except Exception as e:
                    self.result.errors.append({
                        'row': row_num,
                        'error': str(e),
                    })
                    continue

            self.result.success = True
            logger.info(
                f"Import complete: {self.result.employees_created} created, "
                f"{self.result.employees_updated} updated, "
                f"{self.result.employees_skipped} skipped, "
                f"{len(self.result.errors)} errors"
            )

        except Exception as e:
            logger.error(f"Import failed: {e}")
            self.result.success = False
            self.result.errors.append({
                'row': 0,
                'error': f"Import failed: {str(e)}",
            })

        return self.result


def run_import(
    files: List[Tuple[str, bytes]],
    user=None,
    mapping: ColumnMapping = None,
    update_existing: bool = True,
) -> ImportResult:
    """
    Convenience function to run an import.

    Args:
        files: List of (filename, file_content) tuples
        user: User performing the import
        mapping: Column mapping (auto-detected if None)
        update_existing: Whether to update existing employees

    Returns:
        ImportResult with statistics
    """
    processor = UnifiedImportProcessor(user=user)
    return processor.process_import(files, mapping, update_existing)


@dataclass
class SalaryStructureResult:
    """Result of a salary structure import."""
    success: bool
    bands_created: int = 0
    bands_updated: int = 0
    levels_created: int = 0
    levels_updated: int = 0
    notches_created: int = 0
    notches_updated: int = 0
    errors: List[str] = field(default_factory=list)


class SalaryStructureImporter:
    """
    Import salary structure from Excel file.

    Expected format:
    - Grade category | Band | Grade Title | Level | Notch 1 | Notch 2 | ... | Notch 10

    The importer will:
    1. Create SalaryBand records (Band 1-8)
    2. Create SalaryLevel records for each band
    3. Create SalaryNotch records with salary amounts
    """

    def __init__(self, user=None):
        self.user = user
        self.result = SalaryStructureResult(success=True)
        self._bands: Dict[str, SalaryBand] = {}
        self._levels: Dict[str, SalaryLevel] = {}

    def _load_existing(self):
        """Load existing salary structure into cache."""
        for band in SalaryBand.objects.filter(is_deleted=False):
            self._bands[band.code] = band

        for level in SalaryLevel.objects.filter(is_deleted=False):
            key = f"{level.band.code}_{level.code}"
            self._levels[key] = level

    def _normalize_band_code(self, band_name: str) -> str:
        """Normalize band name to code (e.g., 'Band 8' -> 'BAND_8')."""
        if not band_name:
            return None
        band_name = str(band_name).strip()
        # Extract band number
        match = re.search(r'band\s*(\d+)', band_name, re.IGNORECASE)
        if match:
            return f"BAND_{match.group(1)}"
        return re.sub(r'[^A-Z0-9]+', '_', band_name.upper()).strip('_')[:20]

    def _normalize_level_code(self, level_name: str) -> str:
        """Normalize level name to code (e.g., 'Level 4B' -> '4B')."""
        if not level_name:
            return None
        level_name = str(level_name).strip()
        # Extract level code
        match = re.search(r'level\s*(\d+[A-Za-z]?)', level_name, re.IGNORECASE)
        if match:
            return match.group(1).upper()
        return re.sub(r'[^A-Z0-9]+', '_', level_name.upper()).strip('_')[:20]

    def _parse_amount(self, value: Any) -> Optional[Decimal]:
        """Parse a salary amount."""
        if pd.isna(value) or value is None:
            return None
        try:
            return Decimal(str(value).strip())
        except (InvalidOperation, ValueError):
            return None

    def _get_or_create_band(self, band_name: str) -> Optional[SalaryBand]:
        """Get or create a salary band."""
        if not band_name or pd.isna(band_name):
            return None

        code = self._normalize_band_code(band_name)
        if not code:
            return None

        # Check cache
        if code in self._bands:
            return self._bands[code]

        # Extract sort order from band number
        match = re.search(r'(\d+)', band_name)
        sort_order = int(match.group(1)) if match else 0

        # Create or update
        band, created = SalaryBand.objects.update_or_create(
            code=code,
            defaults={
                'name': str(band_name).strip(),
                'sort_order': sort_order,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._bands[code] = band

        if created:
            self.result.bands_created += 1
            logger.info(f"Created SalaryBand: {code} - {band_name}")
        else:
            self.result.bands_updated += 1

        return band

    def _get_or_create_level(
        self,
        level_name: str,
        band: SalaryBand,
        grade_title: str = None
    ) -> Optional[SalaryLevel]:
        """Get or create a salary level."""
        if not level_name or pd.isna(level_name) or not band:
            return None

        code = self._normalize_level_code(level_name)
        if not code:
            return None

        key = f"{band.code}_{code}"

        # Check cache
        if key in self._levels:
            return self._levels[key]

        # Extract sort order
        match = re.search(r'(\d+)', level_name)
        sort_order = int(match.group(1)) if match else 0

        # Use grade title as name if available
        name = grade_title if grade_title and not pd.isna(grade_title) else level_name

        # Create or update
        level, created = SalaryLevel.objects.update_or_create(
            band=band,
            code=code,
            defaults={
                'name': str(name).strip()[:100],
                'sort_order': sort_order,
                'is_active': True,
                'created_by': self.user,
            }
        )

        self._levels[key] = level

        if created:
            self.result.levels_created += 1
            logger.info(f"Created SalaryLevel: {band.code}/{code} - {name}")
        else:
            self.result.levels_updated += 1

        return level

    def _create_or_update_notch(
        self,
        level: SalaryLevel,
        notch_number: int,
        amount: Decimal
    ) -> Optional[SalaryNotch]:
        """Create or update a salary notch."""
        if not level or amount is None:
            return None

        code = f"NOTCH_{notch_number}"
        name = f"Notch {notch_number}"

        # Create or update
        notch, created = SalaryNotch.objects.update_or_create(
            level=level,
            code=code,
            defaults={
                'name': name,
                'amount': amount,
                'sort_order': notch_number,
                'is_active': True,
                'created_by': self.user,
            }
        )

        if created:
            self.result.notches_created += 1
        else:
            self.result.notches_updated += 1

        return notch

    def import_from_file(self, file_content: bytes, filename: str) -> SalaryStructureResult:
        """
        Import salary structure from an Excel file.

        Args:
            file_content: File content as bytes
            filename: Original filename

        Returns:
            SalaryStructureResult with statistics
        """
        logger.info(f"Starting salary structure import from {filename}")

        try:
            # Load existing data
            self._load_existing()

            # Read the Excel file without header first to find the actual header row
            file_buffer = BytesIO(file_content)
            df_raw = pd.read_excel(file_buffer, header=None)

            # Find the header row (look for 'Band' and 'Level' in the same row)
            header_row = None
            for idx, row in df_raw.iterrows():
                row_values = [str(v).lower() if not pd.isna(v) else '' for v in row.values]
                if any('band' in v for v in row_values) and any('level' in v for v in row_values):
                    header_row = idx
                    break

            if header_row is None:
                self.result.errors.append("Could not find header row with 'Band' and 'Level' columns")
                self.result.success = False
                return self.result

            logger.info(f"Found header row at index {header_row}")

            # Re-read with correct header
            file_buffer.seek(0)
            df = pd.read_excel(file_buffer, header=header_row)

            # Normalize column names
            df.columns = [str(col).strip().lower() for col in df.columns]
            logger.info(f"Columns found: {list(df.columns)}")

            # Find key columns
            band_col = None
            level_col = None
            grade_col = None
            notch_cols = []

            for col in df.columns:
                col_lower = col.lower()
                if 'band' in col_lower and band_col is None:
                    band_col = col
                elif 'level' in col_lower and level_col is None:
                    level_col = col
                elif 'grade' in col_lower and 'title' in col_lower:
                    grade_col = col
                elif 'notch' in col_lower:
                    # Extract notch number
                    match = re.search(r'notch\s*(\d+)', col_lower)
                    if match:
                        notch_cols.append((int(match.group(1)), col))

            # Sort notch columns by number
            notch_cols.sort(key=lambda x: x[0])

            if not band_col:
                self.result.errors.append("Could not find 'Band' column")
                self.result.success = False
                return self.result

            if not level_col:
                self.result.errors.append("Could not find 'Level' column")
                self.result.success = False
                return self.result

            logger.info(f"Found columns - Band: {band_col}, Level: {level_col}, Grade: {grade_col}")
            logger.info(f"Found {len(notch_cols)} notch columns")

            # Process each row
            current_band = None

            with transaction.atomic():
                for idx, row in df.iterrows():
                    try:
                        # Get band (may be empty if continuing previous band)
                        band_value = row.get(band_col)
                        if band_value and not pd.isna(band_value):
                            current_band = self._get_or_create_band(band_value)

                        if not current_band:
                            continue

                        # Get level
                        level_value = row.get(level_col)
                        if not level_value or pd.isna(level_value):
                            continue

                        # Get grade title
                        grade_title = row.get(grade_col) if grade_col else None

                        # Create level
                        level = self._get_or_create_level(level_value, current_band, grade_title)
                        if not level:
                            continue

                        # Create notches
                        for notch_num, notch_col in notch_cols:
                            amount = self._parse_amount(row.get(notch_col))
                            if amount is not None and amount > 0:
                                self._create_or_update_notch(level, notch_num, amount)

                    except Exception as e:
                        logger.error(f"Error processing row {idx}: {e}")
                        self.result.errors.append(f"Row {idx}: {str(e)}")

            logger.info(
                f"Salary structure import complete: "
                f"{self.result.bands_created} bands created, "
                f"{self.result.levels_created} levels created, "
                f"{self.result.notches_created} notches created"
            )

        except Exception as e:
            logger.error(f"Salary structure import failed: {e}")
            self.result.success = False
            self.result.errors.append(str(e))

        return self.result


def import_salary_structure(file_content: bytes, filename: str, user=None) -> SalaryStructureResult:
    """
    Convenience function to import salary structure.

    Args:
        file_content: File content as bytes
        filename: Original filename
        user: User performing the import

    Returns:
        SalaryStructureResult with statistics
    """
    importer = SalaryStructureImporter(user=user)
    return importer.import_from_file(file_content, filename)
