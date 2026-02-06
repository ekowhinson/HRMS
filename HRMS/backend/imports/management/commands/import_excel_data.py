"""
Management command to import employee data from Excel files.
Imports from:
- district_staff_data.xlsx (employee personal data)
- district_payroll_data.xlsx (payroll data)
- Salary Structure-2025 & 2026.xlsx (salary bands/levels/notches)
"""

import os
import re
from decimal import Decimal
from datetime import datetime

import pandas as pd
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from core.models import Region, District, Country
from organization.models import (
    Division, Directorate, Department, JobGrade, JobPosition, WorkLocation
)
from payroll.models import Bank, BankBranch, StaffCategory, SalaryBand, SalaryLevel, SalaryNotch
from employees.models import Employee


class Command(BaseCommand):
    help = 'Import employee data from Excel files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--data-dir',
            type=str,
            default='/home/ekowhinson/projects/expene-tracker-ai',
            help='Directory containing Excel files'
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without making changes'
        )

    def handle(self, *args, **options):
        self.data_dir = options['data_dir']
        self.dry_run = options['dry_run']
        self.stdout.write(f"Data directory: {self.data_dir}")
        self.stdout.write(f"Dry run: {self.dry_run}")

        try:
            # Load Excel files
            self.stdout.write("\n=== Loading Excel Files ===")
            self.staff_df = pd.read_excel(os.path.join(self.data_dir, 'district_staff_data.xlsx'))
            self.payroll_df = pd.read_excel(os.path.join(self.data_dir, 'district_payroll_data.xlsx'))
            self.salary_df = pd.read_excel(
                os.path.join(self.data_dir, 'Salary Structure-2025 & 2026.xlsx'),
                sheet_name='Salary Structure',
                header=1
            )

            self.stdout.write(f"Staff data: {len(self.staff_df)} rows")
            self.stdout.write(f"Payroll data: {len(self.payroll_df)} rows")
            self.stdout.write(f"Salary structure: {len(self.salary_df)} rows")

            # Clean column names
            self.staff_df.columns = self.staff_df.columns.str.strip()
            self.payroll_df.columns = self.payroll_df.columns.str.strip()

            with transaction.atomic():
                # Create all setups
                self.create_country()
                self.create_regions()
                self.create_districts()
                self.create_divisions_and_directorates()
                self.create_departments()
                self.create_grades()
                self.create_positions()
                self.create_work_locations()
                self.create_banks_and_branches()
                self.create_staff_categories()
                self.create_salary_structure()
                self.create_employees()

                if self.dry_run:
                    self.stdout.write(self.style.WARNING("\n=== DRY RUN - Rolling back changes ==="))
                    raise Exception("Dry run complete")

        except Exception as e:
            if "Dry run complete" in str(e):
                self.stdout.write(self.style.SUCCESS("Dry run completed successfully"))
            else:
                self.stdout.write(self.style.ERROR(f"Error: {e}"))
                raise

    def create_country(self):
        """Ensure Ghana exists in the database."""
        self.stdout.write("\n=== Creating Country ===")
        country, created = Country.objects.get_or_create(
            code='GHA',
            defaults={
                'name': 'Ghana',
                'phone_code': '+233',
                'currency_code': 'GHS'
            }
        )
        self.stdout.write(f"Country: Ghana ({'created' if created else 'exists'})")
        self.country = country

    def create_regions(self):
        """Create regions from the data."""
        self.stdout.write("\n=== Creating Regions ===")
        regions = self.staff_df['REGION'].dropna().unique()

        self.regions = {}
        for region_name in regions:
            region_name = str(region_name).strip()
            code = self._generate_code(region_name, 'REG')

            region, created = Region.objects.get_or_create(
                code=code,
                defaults={
                    'name': region_name,
                    'country_id': 'GHA'
                }
            )
            self.regions[region_name] = region
            self.regions[region_name.upper()] = region
            self.stdout.write(f"  Region: {region_name} ({'created' if created else 'exists'})")

        self.stdout.write(f"Total regions: {len(self.regions) // 2}")

    def create_districts(self):
        """Create districts from the data."""
        self.stdout.write("\n=== Creating Districts ===")

        # Get unique district-region pairs
        districts = self.staff_df[['DISTRICT', 'REGION']].dropna().drop_duplicates()

        self.districts = {}
        for _, row in districts.iterrows():
            district_name = str(row['DISTRICT']).strip()
            region_name = str(row['REGION']).strip()

            region = self.regions.get(region_name)
            if not region:
                self.stdout.write(self.style.WARNING(f"  Warning: Region not found for district {district_name}"))
                continue

            code = self._generate_code(district_name, 'DST')

            district, created = District.objects.get_or_create(
                code=code,
                defaults={
                    'name': district_name,
                    'region': region
                }
            )
            self.districts[district_name] = district
            self.districts[district_name.upper()] = district

        self.stdout.write(f"Total districts: {len(self.districts) // 2}")

    def create_divisions_and_directorates(self):
        """Create divisions and directorates from the data."""
        self.stdout.write("\n=== Creating Divisions and Directorates ===")

        # Extract unique divisions and directorates
        divisions_data = self.staff_df[['DIVISION', 'DIRECTORATE']].dropna().drop_duplicates()

        self.divisions = {}
        self.directorates = {}

        # Create divisions first
        unique_divisions = divisions_data['DIVISION'].unique()
        for idx, division_name in enumerate(unique_divisions):
            division_name = str(division_name).strip()
            code = self._generate_code(division_name, 'DIV')

            division, created = Division.objects.get_or_create(
                code=code,
                defaults={
                    'name': division_name,
                    'sort_order': idx
                }
            )
            self.divisions[division_name] = division
            self.divisions[division_name.upper()] = division
            self.stdout.write(f"  Division: {division_name} ({'created' if created else 'exists'})")

        # Create directorates
        for _, row in divisions_data.iterrows():
            division_name = str(row['DIVISION']).strip()
            directorate_name = str(row['DIRECTORATE']).strip()

            division = self.divisions.get(division_name)
            if not division:
                continue

            code = self._generate_code(directorate_name, 'DIR')

            directorate, created = Directorate.objects.get_or_create(
                code=code,
                defaults={
                    'name': directorate_name,
                    'division': division
                }
            )
            self.directorates[directorate_name] = directorate
            self.directorates[directorate_name.upper()] = directorate
            if created:
                self.stdout.write(f"  Directorate: {directorate_name}")

        self.stdout.write(f"Total divisions: {len(self.divisions) // 2}")
        self.stdout.write(f"Total directorates: {len(self.directorates) // 2}")

    def create_departments(self):
        """Create departments from the data."""
        self.stdout.write("\n=== Creating Departments ===")

        departments_data = self.staff_df[['DEPARTMENT', 'DIRECTORATE']].dropna().drop_duplicates()

        self.departments = {}
        for _, row in departments_data.iterrows():
            dept_name = str(row['DEPARTMENT']).strip()
            directorate_name = str(row['DIRECTORATE']).strip()

            directorate = self.directorates.get(directorate_name)
            code = self._generate_code(dept_name, 'DEPT')

            department, created = Department.objects.get_or_create(
                code=code,
                defaults={
                    'name': dept_name,
                    'directorate': directorate
                }
            )
            self.departments[dept_name] = department
            self.departments[dept_name.upper()] = department
            if created:
                self.stdout.write(f"  Department: {dept_name}")

        self.stdout.write(f"Total departments: {len(self.departments) // 2}")

    def create_grades(self):
        """Create job grades from the data."""
        self.stdout.write("\n=== Creating Job Grades ===")

        grades = self.staff_df['GRADE'].dropna().unique()

        # Grade level mapping (lower number = higher rank)
        grade_levels = {
            'Chief Executive': 1,
            'Deputy Chief Executive': 2,
            'Director': 3,
            'Associate Director': 4,
            'Assistant Director': 5,
            'Principal Manager': 6,
            'Senior Manager': 7,
            'Manager': 8,
            'Assistant Manager': 9,
            'Chief Admin. Officers': 10,
            'Chief Administrative Officers': 10,
            'Principal Admin. Officers': 11,
            'Principal Administrative Officers': 11,
            'Senior Admin. Officer': 12,
            'Senior Administrative Officer': 12,
            'Administrative Officer': 13,
            'Chief Admin. Assistant': 14,
            'Chief Administrative Assistant': 14,
            'Principal Admin. Assistant': 15,
            'Principal Administrative Assistant': 15,
            'Senior Admin. Assistant': 16,
            'Senior Administrative Assistant': 16,
            'Administrative Assistant': 17,
            'Chief Ancillary staff': 18,
            'Principal Ancillary staff': 19,
            'Senior Ancillary staff': 20,
            'Ancillary Staff': 21,
        }

        self.grades = {}
        for grade_name in grades:
            grade_name = str(grade_name).strip()
            code = self._generate_code(grade_name, 'GRD')
            level = grade_levels.get(grade_name, 99)

            grade, created = JobGrade.objects.get_or_create(
                code=code,
                defaults={
                    'name': grade_name,
                    'level': level,
                    'is_management': level <= 9
                }
            )
            self.grades[grade_name] = grade
            self.grades[grade_name.lower()] = grade
            if created:
                self.stdout.write(f"  Grade: {grade_name} (Level {level})")

        self.stdout.write(f"Total grades: {len(self.grades) // 2}")

    def create_positions(self):
        """Create job positions from the data."""
        self.stdout.write("\n=== Creating Job Positions ===")

        positions = self.staff_df['JOB_NAME'].dropna().unique()

        self.positions = {}
        # Get a default grade for positions without grade mapping
        default_grade = list(self.grades.values())[0] if self.grades else None

        for position_name in positions:
            position_name = str(position_name).strip()
            if not position_name:
                continue

            code = self._generate_code(position_name, 'POS')

            # Try to find matching grade
            grade = default_grade
            for grade_name, g in self.grades.items():
                if grade_name.lower() in position_name.lower():
                    grade = g
                    break

            position, created = JobPosition.objects.get_or_create(
                code=code,
                defaults={
                    'title': position_name,
                    'grade': grade
                }
            )
            self.positions[position_name] = position
            self.positions[position_name.upper()] = position
            self.positions[position_name.lower()] = position

        self.stdout.write(f"Total positions: {len(self.positions) // 3}")

    def create_work_locations(self):
        """Create work locations from the data."""
        self.stdout.write("\n=== Creating Work Locations ===")

        locations = self.staff_df[['LOCATION', 'REGION']].dropna().drop_duplicates()

        self.work_locations = {}
        for _, row in locations.iterrows():
            location_name = str(row['LOCATION']).strip()
            region_name = str(row['REGION']).strip()

            region = self.regions.get(region_name)
            code = self._generate_code(location_name, 'LOC')

            work_location, created = WorkLocation.objects.get_or_create(
                code=code,
                defaults={
                    'name': location_name,
                    'city': location_name,
                    'address': location_name,
                    'region': region
                }
            )
            self.work_locations[location_name] = work_location
            self.work_locations[location_name.upper()] = work_location

        self.stdout.write(f"Total work locations: {len(self.work_locations) // 2}")

    def create_banks_and_branches(self):
        """Create banks and bank branches from payroll data."""
        self.stdout.write("\n=== Creating Banks and Branches ===")

        # Create banks
        banks = self.payroll_df['BANK'].dropna().unique()

        self.banks = {}
        for bank_name in banks:
            bank_name = str(bank_name).strip()
            code = self._generate_code(bank_name, 'BNK')

            bank, created = Bank.objects.get_or_create(
                code=code,
                defaults={
                    'name': bank_name,
                    'short_name': bank_name[:50] if len(bank_name) > 50 else bank_name
                }
            )
            self.banks[bank_name] = bank
            self.banks[bank_name.upper()] = bank
            if created:
                self.stdout.write(f"  Bank: {bank_name}")

        # Create bank branches
        branches_data = self.payroll_df[['BANK', 'BANK BRANCH']].dropna().drop_duplicates()

        self.bank_branches = {}
        for _, row in branches_data.iterrows():
            bank_name = str(row['BANK']).strip()
            branch_name = str(row['BANK BRANCH']).strip()

            bank = self.banks.get(bank_name)
            if not bank:
                continue

            # Extract branch code from name (e.g., "ABSA BANK (GH) LTD-TAMALE" -> "TAMALE")
            branch_code = self._generate_code(branch_name, 'BR')

            branch, created = BankBranch.objects.get_or_create(
                bank=bank,
                code=branch_code,
                defaults={
                    'name': branch_name
                }
            )
            self.bank_branches[branch_name] = branch
            self.bank_branches[branch_name.upper()] = branch

        self.stdout.write(f"Total banks: {len(self.banks) // 2}")
        self.stdout.write(f"Total bank branches: {len(self.bank_branches) // 2}")

    def create_staff_categories(self):
        """Create staff categories from payroll data."""
        self.stdout.write("\n=== Creating Staff Categories ===")

        categories = self.payroll_df['STAFF_CATEGORY'].dropna().unique()

        self.staff_categories = {}
        for cat_name in categories:
            cat_name = str(cat_name).strip()
            code = self._generate_code(cat_name, 'CAT')

            category, created = StaffCategory.objects.get_or_create(
                code=code,
                defaults={
                    'name': cat_name,
                    'payroll_group': f'{cat_name} Payroll'
                }
            )
            self.staff_categories[cat_name] = category
            self.staff_categories[cat_name.upper()] = category
            if created:
                self.stdout.write(f"  Category: {cat_name}")

        self.stdout.write(f"Total staff categories: {len(self.staff_categories) // 2}")

    def create_salary_structure(self):
        """Create salary bands, levels, and notches from salary structure file."""
        self.stdout.write("\n=== Creating Salary Structure ===")

        self.salary_bands = {}
        self.salary_levels = {}
        self.salary_notches = {}

        # Parse salary structure
        current_band = None
        current_level = None
        band_sort = 0
        level_sort = 0

        for _, row in self.salary_df.iterrows():
            grade_category = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else None
            band_code = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else None
            grade_title = str(row.iloc[2]).strip() if pd.notna(row.iloc[2]) else None
            level_code = str(row.iloc[3]).strip() if pd.notna(row.iloc[3]) else None

            # Skip header row
            if grade_category == 'Grade category' or band_code == 'Band':
                continue

            # Create band if we have a new one
            if band_code and band_code.startswith('Band'):
                band_sort += 1
                band, created = SalaryBand.objects.get_or_create(
                    code=band_code.replace(' ', ''),
                    defaults={
                        'name': f'{band_code} - {grade_category}' if grade_category else band_code,
                        'sort_order': band_sort
                    }
                )
                current_band = band
                self.salary_bands[band_code] = band
                self.salary_bands[band_code.replace(' ', '')] = band
                if created:
                    self.stdout.write(f"  Band: {band_code}")
                level_sort = 0

            # Create level if we have one
            if level_code and level_code.startswith('Level') and current_band:
                level_sort += 1
                level_key = f"{current_band.code}/{level_code.replace(' ', '')}"

                level, created = SalaryLevel.objects.get_or_create(
                    band=current_band,
                    code=level_code.replace(' ', ''),
                    defaults={
                        'name': grade_title or level_code,
                        'sort_order': level_sort
                    }
                )
                current_level = level
                self.salary_levels[level_key] = level
                if created:
                    self.stdout.write(f"    Level: {level_code} - {grade_title}")

                # Create notches (columns 4-13 are Notch 1-10)
                for notch_num in range(1, 11):
                    col_idx = 3 + notch_num
                    if col_idx < len(row) and pd.notna(row.iloc[col_idx]):
                        try:
                            amount = Decimal(str(row.iloc[col_idx]))
                            notch_code = f"Notch{notch_num}"
                            notch_key = f"{current_band.code}/{current_level.code}/{notch_code}"

                            notch, created = SalaryNotch.objects.get_or_create(
                                level=current_level,
                                code=notch_code,
                                defaults={
                                    'name': f"Notch {notch_num}",
                                    'amount': amount,
                                    'sort_order': notch_num
                                }
                            )
                            self.salary_notches[notch_key] = notch
                        except (ValueError, TypeError):
                            pass

        self.stdout.write(f"Total salary bands: {len(self.salary_bands) // 2}")
        self.stdout.write(f"Total salary levels: {len(self.salary_levels)}")
        self.stdout.write(f"Total salary notches: {len(self.salary_notches)}")

    def create_employees(self):
        """Create employees from staff and payroll data."""
        self.stdout.write("\n=== Creating Employees ===")

        # Create a merged dataframe
        merged_df = self.staff_df.merge(
            self.payroll_df,
            on='EMPLOYEE_NUMBER',
            how='left',
            suffixes=('', '_payroll')
        )

        created_count = 0
        updated_count = 0
        error_count = 0

        for idx, row in merged_df.iterrows():
            try:
                emp_number = str(row['EMPLOYEE_NUMBER']).strip()
                if not emp_number or emp_number == 'nan':
                    continue

                # Get required fields
                first_name = str(row.get('FIRST_NAME', '')).strip()
                last_name = str(row.get('LAST_NAME', '')).strip()
                middle_name = str(row.get('MIDDLE_NAMES', '')).strip() if pd.notna(row.get('MIDDLE_NAMES')) else ''

                if not first_name or first_name == 'nan':
                    first_name = 'Unknown'
                if not last_name or last_name == 'nan':
                    last_name = 'Unknown'

                # Parse date of birth
                dob = row.get('DATE_OF_BIRTH')
                if pd.isna(dob):
                    dob = datetime(1980, 1, 1).date()
                elif isinstance(dob, str):
                    try:
                        dob = datetime.strptime(dob, '%Y-%m-%d').date()
                    except:
                        dob = datetime(1980, 1, 1).date()
                else:
                    dob = dob.date() if hasattr(dob, 'date') else dob

                # Parse date of joining
                doj = row.get('ORIGINAL_DATE_OF_HIRE')
                if pd.isna(doj):
                    doj = datetime(2017, 1, 1).date()
                elif isinstance(doj, str):
                    try:
                        doj = datetime.strptime(doj, '%Y-%m-%d').date()
                    except:
                        doj = datetime(2017, 1, 1).date()
                else:
                    doj = doj.date() if hasattr(doj, 'date') else doj

                # Get foreign key references
                gender = 'M' if str(row.get('SEX', 'M')).upper() == 'M' else 'F'

                # Department
                dept_name = str(row.get('DEPARTMENT', '')).strip()
                department = self.departments.get(dept_name)
                if not department:
                    department = list(self.departments.values())[0] if self.departments else None

                # Position
                position_name = str(row.get('JOB_NAME', '')).strip()
                position = self.positions.get(position_name) or self.positions.get(position_name.upper())
                if not position:
                    position = list(self.positions.values())[0] if self.positions else None

                # Grade
                grade_name = str(row.get('GRADE', '')).strip()
                grade = self.grades.get(grade_name) or self.grades.get(grade_name.lower())
                if not grade:
                    grade = list(self.grades.values())[0] if self.grades else None

                # Work location
                location_name = str(row.get('LOCATION', '')).strip()
                work_location = self.work_locations.get(location_name) or self.work_locations.get(location_name.upper())

                # Division and Directorate
                division_name = str(row.get('DIVISION', '')).strip()
                division = self.divisions.get(division_name)

                directorate_name = str(row.get('DIRECTORATE', '')).strip()
                directorate = self.directorates.get(directorate_name)

                # Bank and branch
                bank_branch = None
                branch_name = str(row.get('BANK BRANCH', '')).strip() if pd.notna(row.get('BANK BRANCH')) else ''
                if branch_name:
                    bank_branch = self.bank_branches.get(branch_name) or self.bank_branches.get(branch_name.upper())

                # Staff category
                cat_name = str(row.get('STAFF_CATEGORY', '')).strip() if pd.notna(row.get('STAFF_CATEGORY')) else ''
                staff_category = self.staff_categories.get(cat_name) or self.staff_categories.get(cat_name.upper())

                # Salary notch
                salary_notch = None
                notch_str = str(row.get('NOTCH_NEW', '')).strip() if pd.notna(row.get('NOTCH_NEW')) else ''
                if notch_str:
                    # Parse "Band 4/Level 4B/Notch 2" format
                    match = re.match(r'Band\s*(\d+)/Level\s*(\w+)/Notch\s*(\d+)', notch_str)
                    if match:
                        band_code = f"Band{match.group(1)}"
                        level_code = f"Level{match.group(2)}"
                        notch_code = f"Notch{match.group(3)}"
                        notch_key = f"{band_code}/{level_code}/{notch_code}"
                        salary_notch = self.salary_notches.get(notch_key)

                # SSNIT number
                ssnit = str(row.get('SSNIT', '')).strip() if pd.notna(row.get('SSNIT')) else None
                if ssnit == 'nan' or ssnit == '':
                    ssnit = None

                # Old staff number
                old_staff_num = str(row.get('OLD_STAFF_NUMBER', '')).strip() if pd.notna(row.get('OLD_STAFF_NUMBER')) else None
                if old_staff_num == 'nan' or old_staff_num == '':
                    old_staff_num = None

                # Account number
                account_number = str(row.get('ACCOUNT NO', '')).strip() if pd.notna(row.get('ACCOUNT NO')) else None
                if account_number == 'nan' or account_number == '':
                    account_number = None

                # Create or update employee
                employee, created = Employee.objects.update_or_create(
                    employee_number=emp_number,
                    defaults={
                        'first_name': first_name,
                        'middle_name': middle_name if middle_name != 'nan' else '',
                        'last_name': last_name,
                        'date_of_birth': dob,
                        'gender': gender,
                        'date_of_joining': doj,
                        'department': department,
                        'position': position,
                        'grade': grade,
                        'work_location': work_location,
                        'division': division,
                        'directorate': directorate,
                        'staff_category': staff_category,
                        'salary_notch': salary_notch,
                        'ssnit_number': ssnit,
                        'old_staff_number': old_staff_num,
                        'mobile_phone': '0000000000',  # Placeholder
                        'residential_address': location_name or 'Ghana',
                        'residential_city': location_name or 'Accra',
                        'status': 'ACTIVE',
                        'employment_type': 'PERMANENT',
                    }
                )

                if created:
                    created_count += 1
                else:
                    updated_count += 1

                if (created_count + updated_count) % 100 == 0:
                    self.stdout.write(f"  Processed {created_count + updated_count} employees...")

            except Exception as e:
                error_count += 1
                if error_count <= 10:
                    self.stdout.write(self.style.WARNING(f"  Error on row {idx}: {e}"))

        self.stdout.write(f"\nEmployees created: {created_count}")
        self.stdout.write(f"Employees updated: {updated_count}")
        self.stdout.write(f"Errors: {error_count}")

    def _generate_code(self, name, prefix):
        """Generate a unique code from a name."""
        if not name:
            return f"{prefix}_UNKNOWN"

        # Clean and abbreviate
        name = str(name).strip().upper()

        # Remove common words
        for word in ['THE', 'AND', '&', 'OF', 'FOR', '-', '.', ',', '(', ')', 'LTD', 'LIMITED']:
            name = name.replace(word, '')

        # Take first letters of words
        words = name.split()
        if len(words) >= 2:
            code = ''.join(w[0] for w in words if w)[:8]
        else:
            code = name[:8]

        code = re.sub(r'[^A-Z0-9]', '', code)

        return f"{prefix}_{code}" if code else f"{prefix}_UNK"
