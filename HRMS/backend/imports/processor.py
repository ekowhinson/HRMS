"""
Import processor for batch processing data imports.
Supports up to 10,000 records with batch processing.
"""

import logging
from typing import Dict, List, Any, Iterator, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from django.db import transaction
from django.utils import timezone
from django.core.cache import cache

logger = logging.getLogger(__name__)


@dataclass
class ImportResult:
    """Result of import processing."""
    success_count: int = 0
    error_count: int = 0
    skip_count: int = 0
    errors: List[Dict] = None

    def __post_init__(self):
        if self.errors is None:
            self.errors = []


class ImportProcessor:
    """
    Process validated data and import to database.
    Supports batch processing for large files up to 10,000 records.
    """

    BATCH_SIZE = 500  # Process records in batches
    MAX_RECORDS = 10000  # Maximum supported records per import

    def __init__(self):
        self._fk_cache = {}  # Cache for foreign key lookups

    def process(self, job) -> ImportResult:
        """
        Process an import job.
        Called synchronously for small imports, async for large ones.
        """
        from .models import ImportJob

        result = ImportResult()

        try:
            job.status = ImportJob.Status.IMPORTING
            job.started_at = timezone.now()
            job.save(update_fields=['status', 'started_at'])

            # Get processor for target model
            processors = {
                'employees': self._process_employees,
                'leave_balances': self._process_leave_balances,
                'transactions': self._process_transactions,
                'departments': self._process_departments,
                'positions': self._process_positions,
                'grades': self._process_grades,
                'job_categories': self._process_job_categories,
                'divisions': self._process_divisions,
                'directorates': self._process_directorates,
                'work_locations': self._process_work_locations,
                'banks': self._process_banks,
                'bank_branches': self._process_bank_branches,
                'staff_categories': self._process_staff_categories,
                'salary_bands': self._process_salary_bands,
                'salary_levels': self._process_salary_levels,
                'salary_notches': self._process_salary_notches,
                'pay_components': self._process_pay_components,
                'leave_types': self._process_leave_types,
                'holidays': self._process_holidays,
                'bank_accounts': self._process_bank_accounts,
            }

            processor = processors.get(job.target_model)
            if not processor:
                raise ValueError(f"Unknown target model: {job.target_model}")

            # Pre-load foreign key caches
            self._cache_foreign_keys(job.target_model)

            # Process in batches
            result = processor(job)

            # Update job status
            job.success_count = result.success_count
            job.error_count = result.error_count
            job.skip_count = result.skip_count
            job.errors = result.errors
            job.status = ImportJob.Status.COMPLETED
            job.completed_at = timezone.now()
            job.save()

        except Exception as e:
            logger.exception(f"Import job {job.id} failed: {str(e)}")
            job.fail(str(e))
            result.errors.append({
                'type': 'system',
                'message': str(e)
            })

        return result

    def _cache_foreign_keys(self, target_model: str):
        """Pre-load and cache FK lookups for efficiency."""
        from organization.models import Department, JobPosition, JobGrade, Division, Directorate, WorkLocation
        from leave.models import LeaveType
        from payroll.models import PayComponent, Bank, BankBranch, StaffCategory, SalaryBand, SalaryLevel, SalaryNotch
        from employees.models import Employee
        from core.models import Region, District

        self._fk_cache = {
            'departments': {},
            'positions': {},
            'grades': {},
            'leave_types': {},
            'pay_components': {},
            'employees': {},
            'divisions': {},
            'directorates': {},
            'work_locations': {},
            'banks': {},
            'bank_branches': {},
            'staff_categories': {},
            'salary_bands': {},
            'salary_levels': {},
            'salary_notches': {},
            'regions': {},
            'districts': {},
        }

        # Cache departments by code and name (only non-deleted for FK resolution)
        for d in Department.objects.all():
            self._fk_cache['departments'][d.code.lower()] = d
            self._fk_cache['departments'][d.name.lower()] = d

        # Cache positions by code and title (only non-deleted for FK resolution)
        for p in JobPosition.objects.all():
            self._fk_cache['positions'][p.code.lower()] = p
            self._fk_cache['positions'][p.title.lower()] = p

        # Cache grades by code and name
        for g in JobGrade.objects.all():
            self._fk_cache['grades'][g.code.lower()] = g
            self._fk_cache['grades'][g.name.lower()] = g

        # Cache leave types by code and name
        for lt in LeaveType.objects.all():
            self._fk_cache['leave_types'][lt.code.lower()] = lt
            self._fk_cache['leave_types'][lt.name.lower()] = lt

        # Cache pay components by code and name
        for pc in PayComponent.objects.all():
            self._fk_cache['pay_components'][pc.code.lower()] = pc
            self._fk_cache['pay_components'][pc.name.lower()] = pc

        # Cache employees by employee_number
        for e in Employee.objects.all():
            self._fk_cache['employees'][e.employee_number.lower()] = e

        # Cache divisions by code and name
        for div in Division.objects.all():
            self._fk_cache['divisions'][div.code.lower()] = div
            self._fk_cache['divisions'][div.name.lower()] = div

        # Cache directorates by code and name
        for d in Directorate.objects.all():
            self._fk_cache['directorates'][d.code.lower()] = d
            self._fk_cache['directorates'][d.name.lower()] = d

        # Cache work locations by code and name
        for wl in WorkLocation.objects.all():
            self._fk_cache['work_locations'][wl.code.lower()] = wl
            self._fk_cache['work_locations'][wl.name.lower()] = wl

        # Cache banks by code and name
        for b in Bank.objects.all():
            self._fk_cache['banks'][b.code.lower()] = b
            self._fk_cache['banks'][b.name.lower()] = b

        # Cache bank branches by code and full name
        for bb in BankBranch.objects.select_related('bank').all():
            self._fk_cache['bank_branches'][bb.code.lower()] = bb
            self._fk_cache['bank_branches'][bb.name.lower()] = bb
            # Also cache by "BANK - BRANCH" format
            full_name = f"{bb.bank.name} - {bb.name}".lower()
            self._fk_cache['bank_branches'][full_name] = bb

        # Cache staff categories by code and name
        for sc in StaffCategory.objects.all():
            self._fk_cache['staff_categories'][sc.code.lower()] = sc
            self._fk_cache['staff_categories'][sc.name.lower()] = sc
            if sc.payroll_group:
                self._fk_cache['staff_categories'][sc.payroll_group.lower()] = sc

        # Cache salary bands by code and name
        for sb in SalaryBand.objects.all():
            self._fk_cache['salary_bands'][sb.code.lower()] = sb
            self._fk_cache['salary_bands'][sb.name.lower()] = sb

        # Cache salary levels by code and compound key
        for sl in SalaryLevel.objects.select_related('band').all():
            self._fk_cache['salary_levels'][sl.code.lower()] = sl
            self._fk_cache['salary_levels'][sl.name.lower()] = sl
            # Also cache by "Band/Level" format
            compound = f"{sl.band.code}/{sl.code}".lower()
            self._fk_cache['salary_levels'][compound] = sl

        # Cache salary notches by code and compound key
        for sn in SalaryNotch.objects.select_related('level__band').all():
            self._fk_cache['salary_notches'][sn.code.lower()] = sn
            self._fk_cache['salary_notches'][sn.name.lower()] = sn
            # Also cache by "Band/Level/Notch" format
            compound = f"{sn.level.band.code}/{sn.level.code}/{sn.code}".lower()
            self._fk_cache['salary_notches'][compound] = sn
            # Also cache by full name format
            full_name = sn.full_name.lower() if hasattr(sn, 'full_name') else ''
            if full_name:
                self._fk_cache['salary_notches'][full_name] = sn

        # Cache regions by code and name
        for r in Region.objects.all():
            self._fk_cache['regions'][r.code.lower()] = r
            self._fk_cache['regions'][r.name.lower()] = r

        # Cache districts by code and name
        for d in District.objects.all():
            self._fk_cache['districts'][d.code.lower()] = d
            self._fk_cache['districts'][d.name.lower()] = d

    def _resolve_fk(self, cache_key: str, value: str) -> Any:
        """Resolve a foreign key value from cache."""
        if not value:
            return None
        cache_dict = self._fk_cache.get(cache_key, {})
        return cache_dict.get(str(value).lower().strip())

    def _batch_iterator(self, rows: List, batch_size: int = None) -> Iterator[Tuple[int, List]]:
        """Yield rows in batches for memory-efficient processing."""
        batch_size = batch_size or self.BATCH_SIZE
        total = len(rows)

        for i in range(0, total, batch_size):
            yield i // batch_size, rows[i:i + batch_size]

    def _process_employees(self, job) -> ImportResult:
        """Process employee imports."""
        from employees.models import Employee

        result = ImportResult()
        rows = job.sample_data if job.total_rows <= 10 else self._get_all_rows(job)

        # Build header index
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        employees_to_create = []
        employees_to_update = []

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2  # +2 for 1-based + header

                try:
                    # Extract mapped data
                    data = self._extract_row_data(row, header_index, mapping)

                    # Skip empty employee numbers
                    if not data.get('employee_number'):
                        result.skip_count += 1
                        continue

                    # Resolve foreign keys
                    if 'department' in data and data['department']:
                        data['department'] = self._resolve_fk('departments', data['department'])
                    if 'position' in data and data['position']:
                        data['position'] = self._resolve_fk('positions', data['position'])
                    if 'grade' in data and data['grade']:
                        data['grade'] = self._resolve_fk('grades', data['grade'])
                    if 'supervisor' in data and data['supervisor']:
                        data['supervisor'] = self._resolve_fk('employees', data['supervisor'])
                    # New FK fields
                    if 'division' in data and data['division']:
                        data['division'] = self._resolve_fk('divisions', data['division'])
                    if 'directorate' in data and data['directorate']:
                        data['directorate'] = self._resolve_fk('directorates', data['directorate'])
                    if 'staff_category' in data and data['staff_category']:
                        data['staff_category'] = self._resolve_fk('staff_categories', data['staff_category'])
                    if 'salary_notch' in data and data['salary_notch']:
                        data['salary_notch'] = self._resolve_fk('salary_notches', data['salary_notch'])
                    if 'work_location' in data and data['work_location']:
                        data['work_location'] = self._resolve_fk('work_locations', data['work_location'])
                    if 'residential_region' in data and data['residential_region']:
                        data['residential_region'] = self._resolve_fk('regions', data['residential_region'])
                    if 'residential_district' in data and data['residential_district']:
                        data['residential_district'] = self._resolve_fk('districts', data['residential_district'])

                    # Transform date fields
                    for date_field in ['date_of_birth', 'date_of_joining']:
                        if date_field in data and data[date_field]:
                            data[date_field] = self._parse_date(data[date_field])

                    # Transform gender
                    if 'gender' in data and data['gender']:
                        gender = str(data['gender']).upper().strip()
                        if gender in ['M', 'MALE']:
                            data['gender'] = 'M'
                        elif gender in ['F', 'FEMALE']:
                            data['gender'] = 'F'
                        else:
                            data['gender'] = None

                    # Transform assignment_status
                    if 'assignment_status' in data and data['assignment_status']:
                        status = str(data['assignment_status']).upper().strip()
                        if 'ACTIVE' in status:
                            data['assignment_status'] = 'ACTIVE'
                        elif 'SUSPEND' in status:
                            data['assignment_status'] = 'SUSPENDED'
                        elif 'END' in status:
                            data['assignment_status'] = 'ENDED'
                        elif 'PENDING' in status:
                            data['assignment_status'] = 'PENDING'
                        else:
                            data['assignment_status'] = 'ACTIVE'

                    # Check if employee exists
                    existing = Employee.objects.filter(
                        employee_number__iexact=data['employee_number']
                    ).first()

                    if existing:
                        # Update existing
                        for key, value in data.items():
                            if value is not None:
                                setattr(existing, key, value)
                        employees_to_update.append(existing)
                    else:
                        # Create new
                        employees_to_create.append(Employee(**data))

                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({
                        'row': row_num,
                        'message': str(e),
                        'data': str(row[:5])  # First 5 columns for context
                    })

            # Update progress
            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

            # Update cache for progress tracking
            self._update_progress_cache(job.id, job.processed_rows, job.total_rows)

        # Bulk operations
        with transaction.atomic():
            if employees_to_create:
                Employee.objects.bulk_create(employees_to_create, batch_size=self.BATCH_SIZE)

            if employees_to_update:
                update_fields = [
                    'first_name', 'last_name', 'middle_name', 'work_email',
                    'mobile_phone', 'department', 'position', 'grade',
                    'date_of_joining', 'gender', 'status', 'employment_type',
                    # New fields
                    'old_staff_number', 'division', 'directorate', 'staff_category',
                    'salary_notch', 'assignment_status', 'work_location',
                    'residential_region', 'residential_district', 'ssnit_number'
                ]
                Employee.objects.bulk_update(
                    employees_to_update,
                    update_fields,
                    batch_size=self.BATCH_SIZE
                )

        return result

    def _process_leave_balances(self, job) -> ImportResult:
        """Process leave balance imports."""
        from leave.models import LeaveBalance
        from employees.models import Employee

        result = ImportResult()
        rows = self._get_all_rows(job)

        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        balances_to_create = []
        balances_to_update = []

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2

                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    # Find employee
                    employee = self._resolve_fk('employees', data.get('employee_number'))
                    if not employee:
                        result.skip_count += 1
                        result.errors.append({
                            'row': row_num,
                            'message': f"Employee not found: {data.get('employee_number')}"
                        })
                        continue

                    # Find leave type
                    leave_type = self._resolve_fk('leave_types', data.get('leave_type'))
                    if not leave_type:
                        result.skip_count += 1
                        result.errors.append({
                            'row': row_num,
                            'message': f"Leave type not found: {data.get('leave_type')}"
                        })
                        continue

                    year = int(data.get('year', timezone.now().year))

                    # Check existing balance
                    existing = LeaveBalance.objects.filter(
                        employee=employee,
                        leave_type=leave_type,
                        year=year
                    ).first()

                    balance_data = {
                        'employee': employee,
                        'leave_type': leave_type,
                        'year': year,
                    }

                    if 'earned' in data and data['earned']:
                        balance_data['earned'] = Decimal(str(data['earned']))
                    if 'taken' in data and data['taken']:
                        balance_data['taken'] = Decimal(str(data['taken']))
                    if 'opening_balance' in data and data['opening_balance']:
                        balance_data['opening_balance'] = Decimal(str(data['opening_balance']))

                    if existing:
                        for key, value in balance_data.items():
                            setattr(existing, key, value)
                        balances_to_update.append(existing)
                    else:
                        balances_to_create.append(LeaveBalance(**balance_data))

                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({
                        'row': row_num,
                        'message': str(e)
                    })

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])
            self._update_progress_cache(job.id, job.processed_rows, job.total_rows)

        with transaction.atomic():
            if balances_to_create:
                LeaveBalance.objects.bulk_create(balances_to_create, batch_size=self.BATCH_SIZE)
            if balances_to_update:
                LeaveBalance.objects.bulk_update(
                    balances_to_update,
                    ['earned', 'taken', 'opening_balance'],
                    batch_size=self.BATCH_SIZE
                )

        return result

    def _process_transactions(self, job) -> ImportResult:
        """Process payroll transaction imports."""
        from payroll.models import EmployeeTransaction

        result = ImportResult()
        rows = self._get_all_rows(job)

        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        transactions_to_create = []

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2

                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    employee = self._resolve_fk('employees', data.get('employee_number'))
                    if not employee:
                        result.skip_count += 1
                        continue

                    pay_component = self._resolve_fk('pay_components', data.get('pay_component'))
                    if not pay_component:
                        result.skip_count += 1
                        continue

                    trans_data = {
                        'employee': employee,
                        'pay_component': pay_component,
                        'override_type': 'FIXED',
                        'override_amount': Decimal(str(data.get('override_amount', 0))),
                        'effective_from': self._parse_date(data.get('effective_from')) or timezone.now().date(),
                        'is_recurring': data.get('is_recurring', False),
                        'status': 'ACTIVE',
                    }

                    if data.get('effective_to'):
                        trans_data['effective_to'] = self._parse_date(data['effective_to'])

                    transactions_to_create.append(EmployeeTransaction(**trans_data))
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({
                        'row': row_num,
                        'message': str(e)
                    })

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])
            self._update_progress_cache(job.id, job.processed_rows, job.total_rows)

        with transaction.atomic():
            if transactions_to_create:
                EmployeeTransaction.objects.bulk_create(
                    transactions_to_create,
                    batch_size=self.BATCH_SIZE
                )

        return result

    def _process_departments(self, job) -> ImportResult:
        """Process department imports."""
        from organization.models import Department

        result = ImportResult()
        rows = self._get_all_rows(job)

        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        departments_to_create = []
        seen_names = set()  # Track names to avoid duplicates in file
        seen_codes = set()  # Track codes generated in this import

        # Get existing names and codes from database (including soft-deleted records!)
        # Use all_objects to bypass soft delete filter - DB constraint applies to ALL records
        existing_names = set(n.lower() for n in Department.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in Department.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2

                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    # Skip if duplicate in file or exists in database
                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    # Determine the code to use
                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        # Check if provided code already exists in DB or this batch
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    # Auto-generate if no valid code provided
                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        # Track the user-provided code
                        seen_codes.add(code.lower())

                    # Double-check code uniqueness before proceeding
                    code_check = code.lower()
                    retry_count = 0
                    while code_check in existing_codes and retry_count < 10:
                        logger.warning(f"Row {row_num}: Code '{code}' exists in DB, regenerating")
                        code = self._generate_code_with_tracking(
                            f"{data['name']}{retry_count}", existing_codes, seen_codes
                        )
                        code_check = code.lower()
                        retry_count += 1

                    parent = None
                    if data.get('parent'):
                        parent = self._resolve_fk('departments', data['parent'])

                    directorate = None
                    if data.get('directorate'):
                        directorate = self._resolve_fk('directorates', data['directorate'])
                        if not directorate:
                            result.error_count += 1
                            result.errors.append({'row': row_num, 'message': f"Directorate not found: {data.get('directorate')}"})
                            continue

                    dept = Department(
                        code=code,
                        name=data['name'],
                        directorate=directorate,
                        parent=parent
                    )
                    departments_to_create.append(dept)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({
                        'row': row_num,
                        'message': str(e)
                    })

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        # Check for duplicate codes before bulk_create
        codes_in_batch = {}
        db_codes = set(Department.all_objects.values_list('code', flat=True))  # Fresh check (includes soft-deleted)
        logger.info(f"Existing DB codes: {db_codes}")

        for dept in departments_to_create:
            logger.info(f"Processing dept: name='{dept.name}', code='{dept.code}'")

            # Check against fresh DB codes (exact match)
            if dept.code in db_codes:
                logger.error(f"CODE EXISTS IN DB: '{dept.code}' for '{dept.name}'")
                import uuid
                dept.code = f"{dept.code[:14]}{uuid.uuid4().hex[:6].upper()}"
                logger.info(f"Changed to: '{dept.code}'")

            # Check within batch
            if dept.code in codes_in_batch:
                logger.error(f"DUPLICATE IN BATCH: '{dept.code}' for '{dept.name}' - already used by '{codes_in_batch[dept.code]}'")
                import uuid
                dept.code = f"{dept.code[:14]}{uuid.uuid4().hex[:6].upper()}"
                logger.info(f"Changed to: '{dept.code}'")

            codes_in_batch[dept.code] = dept.name

        # Create one by one to identify the exact failing record
        for dept in departments_to_create:
            try:
                dept.save()
                logger.info(f"SAVED: code='{dept.code}', name='{dept.name}'")
            except Exception as e:
                logger.error(f"FAILED TO SAVE: code='{dept.code}', name='{dept.name}', error={str(e)}")
                # Check what's in DB with this code
                existing = Department.objects.filter(code=dept.code).first()
                if existing:
                    logger.error(f"EXISTING IN DB: id={existing.id}, code='{existing.code}', name='{existing.name}'")
                result.error_count += 1
                result.success_count -= 1
                result.errors.append({'row': 0, 'message': f"Code '{dept.code}' failed: {str(e)}"})

        return result

    def _process_positions(self, job) -> ImportResult:
        """Process job position imports."""
        from organization.models import JobPosition

        result = ImportResult()
        rows = self._get_all_rows(job)

        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        positions_to_create = []
        seen_titles = set()  # Track titles to avoid duplicates in file
        seen_codes = set()  # Track codes generated in this import

        # Get existing titles and codes from database
        existing_titles = set(t.lower() for t in JobPosition.all_objects.values_list('title', flat=True))
        existing_codes = set(c.lower() for c in JobPosition.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2

                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('title'):
                        result.skip_count += 1
                        continue

                    title_lower = data['title'].lower().strip()

                    # Skip if duplicate in file or exists in database
                    if title_lower in seen_titles or title_lower in existing_titles:
                        result.skip_count += 1
                        continue

                    seen_titles.add(title_lower)

                    # Determine the code to use
                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    # Auto-generate if no valid code provided
                    if not code:
                        code = self._generate_code_with_tracking(
                            data['title'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    department = None
                    if data.get('department'):
                        department = self._resolve_fk('departments', data['department'])

                    # Grade is required - resolve or error
                    grade = None
                    if data.get('grade'):
                        grade = self._resolve_fk('grades', data['grade'])

                    if not grade:
                        result.error_count += 1
                        result.errors.append({
                            'row': row_num,
                            'message': f"Grade is required but not found: '{data.get('grade', 'not provided')}'"
                        })
                        continue

                    position = JobPosition(
                        code=code,
                        title=data['title'],
                        department=department,
                        grade=grade
                    )
                    positions_to_create.append(position)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({
                        'row': row_num,
                        'message': str(e)
                    })

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if positions_to_create:
                JobPosition.objects.bulk_create(positions_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _get_all_rows(self, job) -> List:
        """Get all rows from job, parsing if needed."""
        if job.sample_data and len(job.sample_data) == job.total_rows:
            return job.sample_data

        # Re-parse file if needed
        from .parsers import parse_file
        parsed = parse_file(job.file_data, job.original_filename)
        return parsed.rows

    def _extract_row_data(
        self,
        row: List,
        header_index: Dict[str, int],
        mapping: Dict[str, str]
    ) -> Dict[str, Any]:
        """Extract mapped data from a row."""
        data = {}
        for source_col, target_field in mapping.items():
            if source_col in header_index:
                idx = header_index[source_col]
                if idx < len(row):
                    value = row[idx]
                    if value is not None:
                        value = str(value).strip()
                        if value:
                            data[target_field] = value
        return data

    def _parse_date(self, value: str) -> Optional[datetime]:
        """Parse date string to date object."""
        if not value:
            return None

        from datetime import datetime as dt

        formats = [
            '%Y-%m-%d',
            '%d/%m/%Y',
            '%m/%d/%Y',
            '%d-%m-%Y',
            '%m-%d-%Y',
        ]

        for fmt in formats:
            try:
                return dt.strptime(str(value), fmt).date()
            except ValueError:
                continue

        return None

    def _update_progress_cache(self, job_id: str, processed: int, total: int):
        """Update progress in cache for real-time tracking."""
        cache.set(
            f'import_progress_{job_id}',
            {
                'processed': processed,
                'total': total,
                'percentage': round((processed / total) * 100, 1) if total > 0 else 0,
                'timestamp': timezone.now().isoformat()
            },
            timeout=3600
        )

    def _process_grades(self, job) -> ImportResult:
        """Process job grade imports."""
        from organization.models import JobGrade
        from decimal import Decimal

        result = ImportResult()
        rows = self._get_all_rows(job)

        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        grades_to_create = []
        seen_names = set()  # Track names to avoid duplicates in file
        seen_codes = set()  # Track codes generated in this import

        # Get existing names and codes from database (including soft-deleted)
        existing_names = set(n.lower() for n in JobGrade.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in JobGrade.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2

                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    # Skip if duplicate in file or exists in database
                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    # Determine the code to use
                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    # Auto-generate if no valid code provided
                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    # Parse level (required)
                    level = int(data.get('level', 0))

                    grade = JobGrade(
                        code=code,
                        name=data['name'],
                        level=level,
                    )

                    # Optional fields
                    if data.get('min_salary'):
                        grade.min_salary = Decimal(str(data['min_salary']))
                    if data.get('max_salary'):
                        grade.max_salary = Decimal(str(data['max_salary']))
                    if data.get('annual_leave_days'):
                        grade.annual_leave_days = int(data['annual_leave_days'])
                    if data.get('is_management'):
                        grade.is_management = str(data['is_management']).lower() in ('true', 'yes', '1', 'y')

                    grades_to_create.append(grade)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({
                        'row': row_num,
                        'message': str(e)
                    })

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if grades_to_create:
                JobGrade.objects.bulk_create(grades_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_divisions(self, job) -> ImportResult:
        """Process division imports."""
        from organization.models import Division

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()  # Track names to avoid duplicates in file
        seen_codes = set()  # Track codes generated in this import

        # Get existing names and codes from database
        existing_names = set(n.lower() for n in Division.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in Division.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    # Skip if duplicate in file or exists in database
                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    # Determine the code to use
                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    # Auto-generate if no valid code provided
                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    item = Division(
                        code=code,
                        name=data['name'],
                        short_name=data.get('short_name'),
                        description=data.get('description'),
                    )
                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                Division.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_directorates(self, job) -> ImportResult:
        """Process directorate imports."""
        from organization.models import Directorate

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()  # Track names to avoid duplicates in file
        seen_codes = set()  # Track codes generated in this import

        # Get existing names and codes from database
        existing_names = set(n.lower() for n in Directorate.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in Directorate.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    # Skip if duplicate in file or exists in database
                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    division = self._resolve_fk('divisions', data.get('division'))
                    if not division:
                        result.error_count += 1
                        result.errors.append({'row': row_num, 'message': f"Division not found: {data.get('division')}"})
                        continue

                    # Determine the code to use
                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    # Auto-generate if no valid code provided
                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    item = Directorate(
                        code=code,
                        name=data['name'],
                        short_name=data.get('short_name'),
                        division=division,
                        description=data.get('description'),
                    )
                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                Directorate.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_banks(self, job) -> ImportResult:
        """Process bank imports."""
        from payroll.models import Bank

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()  # Track names to avoid duplicates in file
        seen_codes = set()  # Track codes generated in this import

        # Get existing names and codes from database
        existing_names = set(n.lower() for n in Bank.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in Bank.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    # Skip if duplicate in file or exists in database
                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    # Determine the code to use
                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    # Auto-generate if no valid code provided
                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    item = Bank(
                        code=code,
                        name=data['name'],
                        short_name=data.get('short_name'),
                        swift_code=data.get('swift_code'),
                        sort_code=data.get('sort_code'),
                    )
                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                Bank.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_bank_branches(self, job) -> ImportResult:
        """Process bank branch imports."""
        from payroll.models import Bank, BankBranch

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()  # Track bank+name combos to avoid duplicates in file
        seen_codes = {}  # Track bank_id -> set of codes used in this import

        # Refresh banks cache to include any recently imported banks
        # Cache by code (primary), name, and short_name
        banks_cache = {}
        for b in Bank.objects.all():
            banks_cache[b.code.lower()] = b
            banks_cache[b.name.lower()] = b
            if b.short_name:
                banks_cache[b.short_name.lower()] = b

        # Get existing names and codes from database
        existing_names = set()
        existing_codes = {}  # bank_id -> set of codes
        for bb in BankBranch.objects.select_related('bank').all():
            existing_names.add((bb.bank_id, bb.name.lower()))
            if bb.bank_id not in existing_codes:
                existing_codes[bb.bank_id] = set()
            existing_codes[bb.bank_id].add(bb.code.lower())

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name'):
                        result.skip_count += 1
                        continue

                    # Look up bank by code first, then by name
                    bank_ref = data.get('bank', '').lower().strip()
                    bank = banks_cache.get(bank_ref)

                    if not bank:
                        result.error_count += 1
                        result.errors.append({
                            'row': row_num,
                            'message': f"Bank not found: '{data.get('bank')}'. Use bank code from Banks setup."
                        })
                        continue

                    name_lower = data['name'].lower().strip()
                    combo_key = (bank.id, name_lower)

                    # Skip if duplicate in file or exists in database
                    if combo_key in seen_names or combo_key in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(combo_key)

                    # Initialize tracking sets for this bank
                    if bank.id not in seen_codes:
                        seen_codes[bank.id] = set()
                    if bank.id not in existing_codes:
                        existing_codes[bank.id] = set()

                    # Generate unique code - check both DB and in-memory
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower in existing_codes[bank.id] or code_lower in seen_codes[bank.id]:
                            # Provided code already exists, generate a new one
                            base_code = self._generate_code(data['name'])
                            code = base_code
                            counter = 1
                            while (code.lower() in existing_codes[bank.id] or
                                   code.lower() in seen_codes[bank.id]):
                                counter += 1
                                code = f"{base_code[:17]}{counter}"
                        else:
                            code = data['code']
                    else:
                        base_code = self._generate_code(data['name'])
                        code = base_code
                        counter = 1
                        # Check against both existing DB codes and codes created in this import
                        while (code.lower() in existing_codes[bank.id] or
                               code.lower() in seen_codes[bank.id]):
                            counter += 1
                            code = f"{base_code[:17]}{counter}"

                    # Track this code
                    seen_codes[bank.id].add(code.lower())

                    item = BankBranch(
                        bank=bank,
                        code=code,
                        name=data['name'],
                        sort_code=data.get('sort_code'),
                        city=data.get('city'),
                    )
                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                BankBranch.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_staff_categories(self, job) -> ImportResult:
        """Process staff category imports."""
        from payroll.models import StaffCategory

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()  # Track names to avoid duplicates in file
        seen_codes = set()  # Track codes generated in this import

        # Get existing names and codes from database
        existing_names = set(n.lower() for n in StaffCategory.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in StaffCategory.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    # Skip if duplicate in file or exists in database
                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    # Determine the code to use
                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    # Auto-generate if no valid code provided
                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    item = StaffCategory(
                        code=code,
                        name=data['name'],
                        payroll_group=data.get('payroll_group'),
                        description=data.get('description'),
                    )
                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                StaffCategory.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_salary_bands(self, job) -> ImportResult:
        """Process salary band imports."""
        from payroll.models import SalaryBand

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()  # Track names to avoid duplicates in file
        seen_codes = set()  # Track codes generated in this import

        # Get existing names and codes from database
        existing_names = set(n.lower() for n in SalaryBand.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in SalaryBand.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    # Skip if duplicate in file or exists in database
                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    # Determine the code to use
                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    # Auto-generate if no valid code provided
                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    item = SalaryBand(
                        code=code,
                        name=data['name'],
                        description=data.get('description'),
                    )
                    if data.get('min_salary'):
                        item.min_salary = Decimal(str(data['min_salary']))
                    if data.get('max_salary'):
                        item.max_salary = Decimal(str(data['max_salary']))

                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                SalaryBand.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_salary_levels(self, job) -> ImportResult:
        """Process salary level imports."""
        from payroll.models import SalaryLevel

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()  # Track band+name combos to avoid duplicates in file
        seen_codes = {}  # Track band_id -> set of codes used in this import

        # Get existing names and codes from database
        existing_names = set()
        existing_codes = {}  # band_id -> set of codes
        for sl in SalaryLevel.objects.select_related('band').all():
            existing_names.add((sl.band_id, sl.name.lower()))
            if sl.band_id not in existing_codes:
                existing_codes[sl.band_id] = set()
            existing_codes[sl.band_id].add(sl.code.lower())

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name'):
                        result.skip_count += 1
                        continue

                    band = self._resolve_fk('salary_bands', data.get('band'))
                    if not band:
                        result.error_count += 1
                        result.errors.append({'row': row_num, 'message': f"Salary band not found: {data.get('band')}"})
                        continue

                    name_lower = data['name'].lower().strip()
                    combo_key = (band.id, name_lower)

                    # Skip if duplicate in file or exists in database
                    if combo_key in seen_names or combo_key in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(combo_key)

                    # Initialize tracking sets for this band
                    if band.id not in seen_codes:
                        seen_codes[band.id] = set()
                    if band.id not in existing_codes:
                        existing_codes[band.id] = set()

                    # Determine the code to use
                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes[band.id] and code_lower not in seen_codes[band.id]:
                            code = data['code'].strip()

                    # Auto-generate if no valid code provided
                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes[band.id], seen_codes[band.id]
                        )
                    else:
                        seen_codes[band.id].add(code.lower())

                    item = SalaryLevel(
                        band=band,
                        code=code,
                        name=data['name'],
                        description=data.get('description'),
                    )
                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                SalaryLevel.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_salary_notches(self, job) -> ImportResult:
        """Process salary notch imports."""
        from payroll.models import SalaryNotch

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()  # Track level+name combos to avoid duplicates in file
        seen_codes = {}  # Track level_id -> set of codes used in this import

        # Get existing names and codes from database
        existing_names = set()
        existing_codes = {}  # level_id -> set of codes
        for sn in SalaryNotch.objects.select_related('level').all():
            existing_names.add((sn.level_id, sn.name.lower()))
            if sn.level_id not in existing_codes:
                existing_codes[sn.level_id] = set()
            existing_codes[sn.level_id].add(sn.code.lower())

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name') or not data.get('amount'):
                        result.skip_count += 1
                        continue

                    level = self._resolve_fk('salary_levels', data.get('level'))
                    if not level:
                        result.error_count += 1
                        result.errors.append({'row': row_num, 'message': f"Salary level not found: {data.get('level')}"})
                        continue

                    name_lower = data['name'].lower().strip()
                    combo_key = (level.id, name_lower)

                    # Skip if duplicate in file or exists in database
                    if combo_key in seen_names or combo_key in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(combo_key)

                    # Initialize tracking sets for this level
                    if level.id not in seen_codes:
                        seen_codes[level.id] = set()
                    if level.id not in existing_codes:
                        existing_codes[level.id] = set()

                    # Determine the code to use
                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes[level.id] and code_lower not in seen_codes[level.id]:
                            code = data['code'].strip()

                    # Auto-generate if no valid code provided
                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes[level.id], seen_codes[level.id]
                        )
                    else:
                        seen_codes[level.id].add(code.lower())

                    item = SalaryNotch(
                        level=level,
                        code=code,
                        name=data['name'],
                        amount=Decimal(str(data['amount'])),
                        description=data.get('description'),
                    )
                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                SalaryNotch.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_bank_accounts(self, job) -> ImportResult:
        """Process employee bank account imports."""
        from employees.models import BankAccount

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        items_to_update = []

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('employee_number') or not data.get('account_number'):
                        result.skip_count += 1
                        continue

                    employee = self._resolve_fk('employees', data['employee_number'])
                    if not employee:
                        result.error_count += 1
                        result.errors.append({'row': row_num, 'message': f"Employee not found: {data.get('employee_number')}"})
                        continue

                    # Resolve bank and branch FKs
                    bank = self._resolve_fk('banks', data.get('bank')) if data.get('bank') else None
                    branch = self._resolve_fk('bank_branches', data.get('branch')) if data.get('branch') else None

                    # Check if account exists
                    existing = BankAccount.objects.filter(
                        employee=employee,
                        account_number=data['account_number']
                    ).first()

                    account_data = {
                        'employee': employee,
                        'account_number': data['account_number'],
                        'account_name': data.get('account_name') or employee.full_name,
                        'bank': bank,
                        'branch': branch,
                        'bank_name': data.get('bank') if not bank else None,
                        'branch_name': data.get('branch') if not branch else None,
                    }

                    if data.get('account_type'):
                        atype = str(data['account_type']).upper()
                        if 'SAVING' in atype:
                            account_data['account_type'] = 'SAVINGS'
                        elif 'CURRENT' in atype or 'CHECKING' in atype:
                            account_data['account_type'] = 'CURRENT'
                        else:
                            account_data['account_type'] = 'OTHER'

                    if existing:
                        for key, value in account_data.items():
                            if value is not None:
                                setattr(existing, key, value)
                        items_to_update.append(existing)
                    else:
                        items_to_create.append(BankAccount(**account_data))

                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])
            self._update_progress_cache(job.id, job.processed_rows, job.total_rows)

        with transaction.atomic():
            if items_to_create:
                BankAccount.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)
            if items_to_update:
                BankAccount.objects.bulk_update(
                    items_to_update,
                    ['bank', 'branch', 'bank_name', 'branch_name', 'account_name', 'account_type'],
                    batch_size=self.BATCH_SIZE
                )

        return result

    def _process_job_categories(self, job) -> ImportResult:
        """Process job category imports."""
        from organization.models import JobCategory

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()
        seen_codes = set()

        existing_names = set(n.lower() for n in JobCategory.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in JobCategory.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    item = JobCategory(
                        code=code,
                        name=data['name'],
                        description=data.get('description'),
                    )
                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                JobCategory.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_work_locations(self, job) -> ImportResult:
        """Process work location imports."""
        from organization.models import WorkLocation

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()
        seen_codes = set()

        existing_names = set(n.lower() for n in WorkLocation.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in WorkLocation.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name') or not data.get('city'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    region = self._resolve_fk('regions', data.get('region')) if data.get('region') else None

                    is_hq = False
                    if data.get('is_headquarters'):
                        is_hq = str(data['is_headquarters']).lower() in ('true', 'yes', '1', 'y')

                    item = WorkLocation(
                        code=code,
                        name=data['name'],
                        address=data.get('address', ''),
                        city=data['city'],
                        region=region,
                        phone=data.get('phone'),
                        is_headquarters=is_hq,
                    )
                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                WorkLocation.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_leave_types(self, job) -> ImportResult:
        """Process leave type imports."""
        from leave.models import LeaveType

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()
        seen_codes = set()

        existing_names = set(n.lower() for n in LeaveType.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in LeaveType.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name') or not data.get('default_days'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    item = LeaveType(
                        code=code,
                        name=data['name'],
                        description=data.get('description'),
                        default_days=Decimal(str(data['default_days'])),
                    )

                    if data.get('max_days'):
                        item.max_days = Decimal(str(data['max_days']))
                    if data.get('is_paid') is not None:
                        item.is_paid = str(data['is_paid']).lower() in ('true', 'yes', '1', 'y')
                    if data.get('requires_approval') is not None:
                        item.requires_approval = str(data['requires_approval']).lower() in ('true', 'yes', '1', 'y')
                    if data.get('requires_document') is not None:
                        item.requires_document = str(data['requires_document']).lower() in ('true', 'yes', '1', 'y')
                    if data.get('allow_carry_forward') is not None:
                        item.allow_carry_forward = str(data['allow_carry_forward']).lower() in ('true', 'yes', '1', 'y')
                    if data.get('color_code'):
                        item.color_code = data['color_code']

                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                LeaveType.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_pay_components(self, job) -> ImportResult:
        """Process pay component imports."""
        from payroll.models import PayComponent

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_names = set()
        seen_codes = set()

        existing_names = set(n.lower() for n in PayComponent.all_objects.values_list('name', flat=True))
        existing_codes = set(c.lower() for c in PayComponent.all_objects.values_list('code', flat=True))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name') or not data.get('component_type'):
                        result.skip_count += 1
                        continue

                    name_lower = data['name'].lower().strip()

                    if name_lower in seen_names or name_lower in existing_names:
                        result.skip_count += 1
                        continue

                    seen_names.add(name_lower)

                    code = None
                    if data.get('code'):
                        code_lower = data['code'].lower().strip()
                        if code_lower not in existing_codes and code_lower not in seen_codes:
                            code = data['code'].strip()

                    if not code:
                        code = self._generate_code_with_tracking(
                            data['name'], existing_codes, seen_codes
                        )
                    else:
                        seen_codes.add(code.lower())

                    # Parse component_type
                    comp_type = str(data['component_type']).upper().strip()
                    if 'EARN' in comp_type:
                        comp_type = 'EARNING'
                    elif 'DEDUCT' in comp_type:
                        comp_type = 'DEDUCTION'
                    elif 'EMPLOYER' in comp_type:
                        comp_type = 'EMPLOYER'
                    else:
                        comp_type = 'EARNING'  # Default

                    item = PayComponent(
                        code=code,
                        name=data['name'],
                        short_name=data.get('short_name'),
                        description=data.get('description'),
                        component_type=comp_type,
                    )

                    # Parse calculation_type
                    if data.get('calculation_type'):
                        calc = str(data['calculation_type']).upper().strip()
                        if 'FIXED' in calc:
                            item.calculation_type = 'FIXED'
                        elif 'PCT' in calc or 'PERCENT' in calc:
                            if 'GROSS' in calc:
                                item.calculation_type = 'PCT_GROSS'
                            else:
                                item.calculation_type = 'PCT_BASIC'
                        elif 'FORMULA' in calc:
                            item.calculation_type = 'FORMULA'

                    # Parse category
                    if data.get('category'):
                        cat = str(data['category']).upper().strip()
                        valid_cats = ['BASIC', 'ALLOWANCE', 'BONUS', 'STATUTORY', 'OVERTIME', 'SHIFT', 'LOAN', 'FUND', 'OTHER']
                        if cat in valid_cats:
                            item.category = cat
                        else:
                            item.category = 'OTHER'

                    if data.get('default_amount'):
                        item.default_amount = Decimal(str(data['default_amount']))
                    if data.get('percentage_value'):
                        item.percentage_value = Decimal(str(data['percentage_value']))
                    if data.get('is_taxable') is not None:
                        item.is_taxable = str(data['is_taxable']).lower() in ('true', 'yes', '1', 'y')
                    if data.get('is_statutory') is not None:
                        item.is_statutory = str(data['is_statutory']).lower() in ('true', 'yes', '1', 'y')
                    if data.get('affects_ssnit') is not None:
                        item.affects_ssnit = str(data['affects_ssnit']).lower() in ('true', 'yes', '1', 'y')
                    if data.get('show_on_payslip') is not None:
                        item.show_on_payslip = str(data['show_on_payslip']).lower() in ('true', 'yes', '1', 'y')

                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                PayComponent.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _process_holidays(self, job) -> ImportResult:
        """Process holiday imports."""
        from organization.models import Holiday

        result = ImportResult()
        rows = self._get_all_rows(job)
        header_index = {h: i for i, h in enumerate(job.headers)}
        mapping = job.column_mapping

        items_to_create = []
        seen_combos = set()  # Track name+date combos

        # Get existing name+date combos
        existing_combos = set()
        for h in Holiday.all_objects.all():
            existing_combos.add((h.name.lower(), str(h.date)))

        for batch_num, batch in self._batch_iterator(rows):
            for row_idx, row in enumerate(batch):
                row_num = batch_num * self.BATCH_SIZE + row_idx + 2
                try:
                    data = self._extract_row_data(row, header_index, mapping)

                    if not data.get('name') or not data.get('date'):
                        result.skip_count += 1
                        continue

                    date_val = self._parse_date(data['date'])
                    if not date_val:
                        result.error_count += 1
                        result.errors.append({'row': row_num, 'message': f"Invalid date: {data['date']}"})
                        continue

                    name_lower = data['name'].lower().strip()
                    combo_key = (name_lower, str(date_val))

                    if combo_key in seen_combos or combo_key in existing_combos:
                        result.skip_count += 1
                        continue

                    seen_combos.add(combo_key)

                    region = self._resolve_fk('regions', data.get('region')) if data.get('region') else None

                    # Parse holiday_type
                    holiday_type = 'PUBLIC'
                    if data.get('holiday_type'):
                        htype = str(data['holiday_type']).upper().strip()
                        if 'ORG' in htype:
                            holiday_type = 'ORG'
                        elif 'REGIONAL' in htype:
                            holiday_type = 'REGIONAL'

                    is_paid = True
                    if data.get('is_paid') is not None:
                        is_paid = str(data['is_paid']).lower() in ('true', 'yes', '1', 'y')

                    item = Holiday(
                        name=data['name'],
                        date=date_val,
                        holiday_type=holiday_type,
                        region=region,
                        description=data.get('description'),
                        is_paid=is_paid,
                        year=date_val.year,
                    )
                    items_to_create.append(item)
                    result.success_count += 1

                except Exception as e:
                    result.error_count += 1
                    result.errors.append({'row': row_num, 'message': str(e)})

            job.processed_rows = (batch_num + 1) * self.BATCH_SIZE
            job.save(update_fields=['processed_rows'])

        with transaction.atomic():
            if items_to_create:
                Holiday.objects.bulk_create(items_to_create, batch_size=self.BATCH_SIZE)

        return result

    def _generate_code_with_tracking(
        self,
        name: str,
        existing_codes: set,
        seen_codes: set,
        max_length: int = 20
    ) -> str:
        """
        Generate a unique code, checking against both database and in-memory sets.
        Updates seen_codes set with the generated code.
        """
        base_code = self._generate_code(name, max_length - 3)  # Leave room for suffix
        code = base_code
        counter = 1

        while code.lower() in existing_codes or code.lower() in seen_codes:
            counter += 1
            code = f"{base_code[:max_length-3]}{counter}"
            if counter > 999:
                import uuid
                code = f"{base_code[:10]}{uuid.uuid4().hex[:6].upper()}"
                break

        seen_codes.add(code.lower())
        return code

    def _generate_code(self, name: str, max_length: int = 20) -> str:
        """
        Generate a code from a name.
        - For short names (<=max_length chars): use cleaned name
        - For longer names: create acronym from first letters of words
        - Ensures uniqueness by adding numeric suffix if needed
        """
        import re

        if not name:
            return 'CODE'

        # Clean the name
        cleaned = name.strip().upper()

        # Remove special characters except spaces and hyphens
        cleaned = re.sub(r'[^A-Z0-9\s\-]', '', cleaned)

        # Split into words
        words = cleaned.split()

        if not words:
            return 'CODE'

        # If single short word, use it directly
        if len(words) == 1 and len(words[0]) <= max_length:
            return words[0][:max_length]

        # For multiple words, create acronym
        if len(words) > 1:
            # Try first letter of each word
            acronym = ''.join(w[0] for w in words if w)

            # If acronym is too short (< 3 chars), add more letters
            if len(acronym) < 3:
                # Use first 3 chars of first word + first letters of rest
                acronym = words[0][:3] + ''.join(w[0] for w in words[1:] if w)

            return acronym[:max_length]

        # Single long word - abbreviate
        return cleaned.replace(' ', '')[:max_length]

    def _generate_unique_code(self, name: str, model_class, field_name: str = 'code',
                              parent_field: str = None, parent_value = None, max_length: int = 20) -> str:
        """
        Generate a unique code for a model.
        Appends numeric suffix if base code already exists.
        """
        base_code = self._generate_code(name, max_length - 2)  # Reserve space for suffix
        code = base_code
        counter = 1

        while True:
            # Build filter
            filter_kwargs = {f'{field_name}__iexact': code}
            if parent_field and parent_value:
                filter_kwargs[parent_field] = parent_value

            if not model_class.objects.filter(**filter_kwargs).exists():
                return code

            # Append counter
            counter += 1
            code = f"{base_code}{counter}"

            # Safety limit
            if counter > 99:
                import uuid
                return f"{base_code[:10]}{uuid.uuid4().hex[:6].upper()}"
