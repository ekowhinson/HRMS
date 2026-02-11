"""
Payroll setup processor for NHIA HRMS.

Implements 5 phases of payroll data import:
1. Update Employee Data (grades, NIA, bank accounts)
2. Seed Payroll Configuration (tax brackets, SSNIT rates)
3. Create Pay Components
4. Create Employee Salaries
5. Create Employee Transactions
"""

import logging
import uuid
from datetime import date
from decimal import Decimal

from django.core.cache import cache
from django.db import transaction

logger = logging.getLogger(__name__)

EFFECTIVE_DATE = date(2026, 1, 1)


class PayrollSetupProcessor:
    """Process payroll setup in 5 phases with progress reporting."""

    PHASE_NAMES = {
        1: 'Updating Employee Data',
        2: 'Seeding Payroll Configuration',
        3: 'Creating Pay Components',
        4: 'Creating Employee Salaries',
        5: 'Creating Employee Transactions',
    }

    PHASE_WEIGHTS = {1: 25, 2: 5, 3: 5, 4: 25, 5: 40}

    def __init__(self, task_id=None, user=None):
        self.task_id = task_id or uuid.uuid4().hex
        self.user = user
        self.log = []
        self.results = {
            'employees_graded': 0,
            'nia_updated': 0,
            'bank_accounts_updated': 0,
            'tax_brackets_created': 0,
            'ssnit_rates_created': 0,
            'overtime_config_created': 0,
            'pay_components_created': 0,
            'employee_salaries_created': 0,
            'transactions_created': 0,
            'errors': [],
        }

    def _update_progress(self, phase, phase_progress, details=None, status='processing'):
        """Update progress in Django cache."""
        completed_weight = sum(
            self.PHASE_WEIGHTS.get(p, 0) for p in range(1, phase)
        )
        current_weight = self.PHASE_WEIGHTS.get(phase, 0)
        overall = completed_weight + (current_weight * phase_progress / 100)

        data = {
            'phase': phase,
            'total_phases': 5,
            'phase_name': self.PHASE_NAMES.get(phase, ''),
            'phase_progress': round(phase_progress),
            'overall_progress': round(overall),
            'details': details or {},
            'status': status,
            'log': self.log[-20:],  # Last 20 log entries
            'results': self.results,
        }
        cache.set(f'payroll_setup_{self.task_id}', data, timeout=3600)

    def _log(self, message):
        """Add a log entry."""
        self.log.append(message)
        logger.info(f"[PayrollSetup {self.task_id}] {message}")

    def execute(self, allowances_data, staff_data):
        """
        Execute all 5 phases.

        Args:
            allowances_data: Band-level allowance policy dict from analyzer
            staff_data: Per-employee data list from analyzer
        """
        try:
            self._update_progress(1, 0, status='processing')

            self.phase1_update_employee_data(staff_data)
            self.phase2_seed_payroll_config()
            self.phase3_create_pay_components()
            self.phase4_create_employee_salaries()
            self.phase5_create_employee_transactions(allowances_data, staff_data)

            self._update_progress(5, 100, status='completed')
            self._log('All phases completed successfully')
            return self.results

        except Exception as e:
            logger.exception(f"Payroll setup failed: {e}")
            self.results['errors'].append(str(e))
            self._update_progress(0, 0, status='failed')
            raise

    def phase1_update_employee_data(self, staff_data):
        """Phase 1: Update employee grades, NIA, and bank accounts."""
        from organization.models import JobGrade
        from employees.models import Employee, BankAccount

        self._log('Phase 1: Updating Employee Data...')
        self._update_progress(1, 0)

        # 1a. Ensure JobGrade records exist for BAND1-BAND7
        grade_map = {}
        for band_num in range(1, 8):
            code = f'BAND{band_num}'
            grade, created = JobGrade.objects.get_or_create(
                code=code,
                defaults={
                    'name': f'Band {band_num}',
                    'level': band_num,
                    'is_management': band_num >= 5,
                    'is_active': True,
                }
            )
            grade_map[code] = grade
            if created:
                self._log(f'  Created JobGrade: {code}')

        self._update_progress(1, 10, {'grades_ensured': 7})

        # Build employee lookup by employee_number
        employees = {
            e.employee_number: e
            for e in Employee.objects.select_related('salary_notch__level__band', 'grade').all()
        }

        total = len(staff_data)
        graded = 0
        nia_updated = 0
        bank_updated = 0

        for idx, emp_data in enumerate(staff_data):
            staff_id = emp_data['staff_id']
            employee = employees.get(staff_id)

            if not employee:
                continue

            updated_fields = []

            # 1b. Set grade from salary_notch band
            if employee.salary_notch and employee.salary_notch.level and employee.salary_notch.level.band:
                band_code = employee.salary_notch.level.band.code.upper().replace(' ', '').replace('_', '')
                # Normalize: "BAND_1" -> "BAND1", "Band 1" -> "BAND1"
                if not band_code.startswith('BAND'):
                    band_code = f'BAND{band_code}'
                band_code = band_code.replace('BAND_', 'BAND')

                grade = grade_map.get(band_code)
                if grade and employee.grade_id != grade.id:
                    employee.grade = grade
                    updated_fields.append('grade')
                    graded += 1

            # 1c. Update ghana_card_number from NIA
            nia = emp_data.get('nia', '').strip()
            if nia and nia not in ('', 'None', 'N/A', '-') and employee.ghana_card_number != nia:
                employee.ghana_card_number = nia
                updated_fields.append('ghana_card_number')
                nia_updated += 1

            if updated_fields:
                try:
                    employee.save(update_fields=updated_fields + ['updated_at'])
                except Exception as e:
                    self.results['errors'].append(f"Employee {staff_id}: {str(e)}")

            # 1d. Update/create BankAccount
            account_number = emp_data.get('account_number', '').strip()
            if account_number and account_number not in ('', 'None', 'N/A'):
                try:
                    bank_account, created = BankAccount.objects.update_or_create(
                        employee=employee,
                        account_number=account_number,
                        defaults={
                            'bank_name': emp_data.get('bank_name', ''),
                            'branch_name': emp_data.get('branch_name', ''),
                            'bank_code': emp_data.get('bank_code', ''),
                            'branch_code': emp_data.get('branch_code', ''),
                            'account_name': f"{employee.first_name} {employee.last_name}",
                            'is_primary': True,
                            'is_active': True,
                        }
                    )
                    bank_updated += 1
                except Exception as e:
                    self.results['errors'].append(f"Bank account for {staff_id}: {str(e)}")

            # Progress update every 500 employees
            if (idx + 1) % 500 == 0 or idx == total - 1:
                pct = 10 + (90 * (idx + 1) / total)
                self._update_progress(1, pct, {
                    'processed': idx + 1,
                    'total': total,
                    'graded': graded,
                    'nia_updated': nia_updated,
                    'bank_updated': bank_updated,
                })

        self.results['employees_graded'] = graded
        self.results['nia_updated'] = nia_updated
        self.results['bank_accounts_updated'] = bank_updated
        self._log(f'  Phase 1 complete: {graded} graded, {nia_updated} NIA updated, {bank_updated} bank accounts')
        self._update_progress(1, 100)

    def phase2_seed_payroll_config(self):
        """Phase 2: Create tax brackets, SSNIT rates, overtime config."""
        from payroll.models import TaxBracket, SSNITRate, OvertimeBonusTaxConfig

        self._log('Phase 2: Seeding Payroll Configuration...')
        self._update_progress(2, 0)

        # Ghana PAYE 2025/2026 tax brackets
        tax_brackets = [
            {'name': 'First GHS 490', 'min_amount': 0, 'max_amount': 490, 'rate': 0, 'cumulative_tax': 0, 'order': 1},
            {'name': 'Next GHS 110', 'min_amount': 490, 'max_amount': 600, 'rate': 5, 'cumulative_tax': 0, 'order': 2},
            {'name': 'Next GHS 130', 'min_amount': 600, 'max_amount': 730, 'rate': 10, 'cumulative_tax': Decimal('5.50'), 'order': 3},
            {'name': 'Next GHS 3166.67', 'min_amount': 730, 'max_amount': 3896.67, 'rate': 17.5, 'cumulative_tax': Decimal('18.50'), 'order': 4},
            {'name': 'Next GHS 16395', 'min_amount': 3896.67, 'max_amount': 20291.67, 'rate': 25, 'cumulative_tax': Decimal('572.67'), 'order': 5},
            {'name': 'Next GHS 29796.67', 'min_amount': 20291.67, 'max_amount': 50088.34, 'rate': 30, 'cumulative_tax': Decimal('4671.42'), 'order': 6},
            {'name': 'Exceeding GHS 50088.34', 'min_amount': 50088.34, 'max_amount': None, 'rate': 35, 'cumulative_tax': Decimal('13610.42'), 'order': 7},
        ]

        created_count = 0
        for bracket_data in tax_brackets:
            _, created = TaxBracket.objects.get_or_create(
                order=bracket_data['order'],
                effective_from=EFFECTIVE_DATE,
                defaults={
                    'name': bracket_data['name'],
                    'min_amount': bracket_data['min_amount'],
                    'max_amount': bracket_data['max_amount'],
                    'rate': bracket_data['rate'],
                    'cumulative_tax': bracket_data['cumulative_tax'],
                    'is_active': True,
                }
            )
            if created:
                created_count += 1

        self.results['tax_brackets_created'] = created_count
        self._log(f'  Created {created_count} tax brackets')
        self._update_progress(2, 40)

        # SSNIT rates
        ssnit_configs = [
            {'tier': 'TIER_1', 'employee_rate': Decimal('5.50'), 'employer_rate': Decimal('13.00')},
            {'tier': 'TIER_2', 'employee_rate': Decimal('0.00'), 'employer_rate': Decimal('5.00')},
        ]

        ssnit_created = 0
        for config in ssnit_configs:
            _, created = SSNITRate.objects.get_or_create(
                tier=config['tier'],
                effective_from=EFFECTIVE_DATE,
                defaults={
                    'employee_rate': config['employee_rate'],
                    'employer_rate': config['employer_rate'],
                    'is_active': True,
                }
            )
            if created:
                ssnit_created += 1

        self.results['ssnit_rates_created'] = ssnit_created
        self._log(f'  Created {ssnit_created} SSNIT rates')
        self._update_progress(2, 70)

        # Overtime/Bonus tax config
        _, created = OvertimeBonusTaxConfig.objects.get_or_create(
            effective_from=EFFECTIVE_DATE,
            defaults={
                'name': 'Ghana Tax Configuration 2026',
                'overtime_annual_salary_threshold': Decimal('18000'),
                'overtime_basic_percentage_threshold': Decimal('50'),
                'overtime_rate_below_threshold': Decimal('5'),
                'overtime_rate_above_threshold': Decimal('10'),
                'bonus_annual_basic_percentage_threshold': Decimal('15'),
                'bonus_flat_rate': Decimal('5'),
                'bonus_excess_to_paye': True,
                'non_resident_overtime_rate': Decimal('20'),
                'non_resident_bonus_rate': Decimal('20'),
                'is_active': True,
            }
        )
        self.results['overtime_config_created'] = 1 if created else 0
        self._log(f'  Overtime/bonus config: {"created" if created else "already exists"}')
        self._update_progress(2, 100)

    def phase3_create_pay_components(self):
        """Phase 3: Create 21 pay components (13 earnings + 8 deductions)."""
        from payroll.models import PayComponent

        self._log('Phase 3: Creating Pay Components...')
        self._update_progress(3, 0)

        components = [
            # Earnings
            {
                'code': 'BASIC', 'name': 'Basic Salary', 'component_type': 'EARNING',
                'calculation_type': 'FIXED', 'category': 'BASIC',
                'is_taxable': True, 'is_part_of_basic': True, 'is_part_of_gross': True,
                'affects_ssnit': True, 'is_statutory': False, 'display_order': 1,
            },
            {
                'code': 'UTILITY', 'name': 'Utility Allowance', 'component_type': 'EARNING',
                'calculation_type': 'PCT_BASIC', 'category': 'ALLOWANCE',
                'percentage_value': Decimal('0.0600'),
                'is_taxable': True, 'is_part_of_gross': True, 'display_order': 2,
            },
            {
                'code': 'VEHICLE_MAINT', 'name': 'Vehicle Maintenance Allowance', 'component_type': 'EARNING',
                'calculation_type': 'PCT_BASIC', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_gross': True, 'display_order': 3,
            },
            {
                'code': 'FUEL', 'name': 'Fuel Allowance', 'component_type': 'EARNING',
                'calculation_type': 'FIXED', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_gross': True, 'display_order': 4,
            },
            {
                'code': 'SECURITY', 'name': 'Security Allowance', 'component_type': 'EARNING',
                'calculation_type': 'PCT_BASIC', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_gross': True, 'display_order': 5,
            },
            {
                'code': 'ENTERTAINMENT', 'name': 'Entertainment Allowance', 'component_type': 'EARNING',
                'calculation_type': 'PCT_BASIC', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_gross': True, 'display_order': 6,
            },
            {
                'code': 'DOMESTIC', 'name': 'Domestic Servant Allowance', 'component_type': 'EARNING',
                'calculation_type': 'PCT_BASIC', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_gross': True, 'display_order': 7,
            },
            {
                'code': 'RESPONSIBILITY', 'name': 'Responsibility Allowance', 'component_type': 'EARNING',
                'calculation_type': 'PCT_BASIC', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_gross': True, 'display_order': 8,
            },
            {
                'code': 'RENT_ALLOW', 'name': 'Rent Allowance', 'component_type': 'EARNING',
                'calculation_type': 'PCT_BASIC', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_gross': True, 'display_order': 9,
            },
            {
                'code': 'TRANSPORT', 'name': 'Transport Allowance', 'component_type': 'EARNING',
                'calculation_type': 'FIXED', 'category': 'ALLOWANCE',
                'is_taxable': True, 'is_part_of_gross': True, 'display_order': 10,
            },
            # Deductions
            {
                'code': 'SSNIT_EMP', 'name': 'SSNIT Employee Contribution', 'component_type': 'DEDUCTION',
                'calculation_type': 'PCT_BASIC', 'category': 'STATUTORY',
                'percentage_value': Decimal('0.0550'),
                'is_taxable': False, 'reduces_taxable': True, 'affects_ssnit': True,
                'is_statutory': True, 'display_order': 11,
            },
            {
                'code': 'PAYE', 'name': 'Pay As You Earn (Income Tax)', 'component_type': 'DEDUCTION',
                'calculation_type': 'LOOKUP', 'category': 'STATUTORY',
                'is_taxable': False, 'is_statutory': True, 'display_order': 12,
            },
            {
                'code': 'PF', 'name': 'Provident Fund', 'component_type': 'DEDUCTION',
                'calculation_type': 'PCT_BASIC', 'category': 'FUND',
                'is_taxable': False, 'reduces_taxable': True, 'display_order': 13,
            },
            {
                'code': 'UNICOF', 'name': 'UNICOF Union Dues', 'component_type': 'DEDUCTION',
                'calculation_type': 'PCT_BASIC', 'category': 'OTHER',
                'percentage_value': Decimal('0.0200'),
                'is_taxable': False, 'display_order': 14,
            },
            {
                'code': 'PAWU', 'name': 'PAWU Union Dues', 'component_type': 'DEDUCTION',
                'calculation_type': 'PCT_BASIC', 'category': 'OTHER',
                'percentage_value': Decimal('0.0150'),
                'is_taxable': False, 'display_order': 15,
            },
            {
                'code': 'RENT_DED', 'name': 'Rent Deduction', 'component_type': 'DEDUCTION',
                'calculation_type': 'FIXED', 'category': 'OTHER',
                'is_taxable': False, 'display_order': 16,
            },
            # Overtime Earnings
            {
                'code': 'OT_WEEKDAY', 'name': 'Weekday Overtime', 'component_type': 'EARNING',
                'calculation_type': 'FORMULA', 'category': 'OVERTIME',
                'formula': 'basic / 176 * 1.5',
                'is_overtime': True, 'is_taxable': False, 'is_recurring': False,
                'is_prorated': False, 'is_part_of_gross': True, 'affects_ssnit': False,
                'display_order': 20, 'show_on_payslip': True,
            },
            {
                'code': 'OT_WEEKEND', 'name': 'Weekend Overtime', 'component_type': 'EARNING',
                'calculation_type': 'FORMULA', 'category': 'OVERTIME',
                'formula': 'basic / 176 * 2.0',
                'is_overtime': True, 'is_taxable': False, 'is_recurring': False,
                'is_prorated': False, 'is_part_of_gross': True, 'affects_ssnit': False,
                'display_order': 21, 'show_on_payslip': True,
            },
            {
                'code': 'OT_HOLIDAY', 'name': 'Holiday Overtime', 'component_type': 'EARNING',
                'calculation_type': 'FORMULA', 'category': 'OVERTIME',
                'formula': 'basic / 176 * 2.5',
                'is_overtime': True, 'is_taxable': False, 'is_recurring': False,
                'is_prorated': False, 'is_part_of_gross': True, 'affects_ssnit': False,
                'display_order': 22, 'show_on_payslip': True,
            },
            # Overtime/Bonus Tax Deductions
            {
                'code': 'OVERTIME_TAX', 'name': 'Overtime Tax', 'component_type': 'DEDUCTION',
                'calculation_type': 'FIXED', 'category': 'STATUTORY',
                'is_taxable': False, 'is_statutory': True, 'is_recurring': False,
                'is_prorated': False, 'display_order': 23, 'show_on_payslip': True,
            },
            {
                'code': 'BONUS_TAX', 'name': 'Bonus Tax', 'component_type': 'DEDUCTION',
                'calculation_type': 'FIXED', 'category': 'STATUTORY',
                'is_taxable': False, 'is_statutory': True, 'is_recurring': False,
                'is_prorated': False, 'display_order': 24, 'show_on_payslip': True,
            },
        ]

        created_count = 0
        for idx, comp_data in enumerate(components):
            code = comp_data.pop('code')
            name = comp_data.pop('name')

            defaults = {'name': name, 'is_active': True}
            # Only set fields that are in comp_data
            for field in [
                'component_type', 'calculation_type', 'category', 'percentage_value',
                'default_amount', 'formula', 'is_taxable', 'reduces_taxable',
                'is_overtime', 'is_bonus', 'is_part_of_basic',
                'is_part_of_gross', 'affects_ssnit', 'is_statutory', 'display_order',
                'is_recurring', 'is_prorated', 'show_on_payslip',
            ]:
                if field in comp_data:
                    defaults[field] = comp_data[field]

            _, created = PayComponent.objects.get_or_create(
                code=code,
                defaults=defaults,
            )
            if created:
                created_count += 1

            pct = (idx + 1) / len(components) * 100
            self._update_progress(3, pct, {
                'components_created': created_count,
                'components_total': len(components),
            })

        self.results['pay_components_created'] = created_count
        self._log(f'  Phase 3 complete: {created_count} pay components created')
        self._update_progress(3, 100)

    def phase4_create_employee_salaries(self):
        """Phase 4: Create EmployeeSalary records for employees with salary_notch."""
        from employees.models import Employee
        from payroll.models import EmployeeSalary

        self._log('Phase 4: Creating Employee Salaries...')
        self._update_progress(4, 0)

        # Get all employees with salary_notch that don't have a current salary
        employees_with_notch = Employee.objects.filter(
            salary_notch__isnull=False,
            status='ACTIVE',
        ).select_related('salary_notch').exclude(
            salaries__is_current=True
        )

        total = employees_with_notch.count()
        created_count = 0
        batch = []

        for idx, employee in enumerate(employees_with_notch.iterator()):
            try:
                salary = EmployeeSalary(
                    employee=employee,
                    basic_salary=employee.salary_notch.amount,
                    effective_from=EFFECTIVE_DATE,
                    is_current=True,
                    reason='Payroll implementation setup',
                    created_by=self.user,
                )
                batch.append(salary)

                if len(batch) >= 500:
                    EmployeeSalary.objects.bulk_create(batch, ignore_conflicts=True, batch_size=500)
                    created_count += len(batch)
                    batch = []

            except Exception as e:
                self.results['errors'].append(f"Salary for {employee.employee_number}: {str(e)}")

            if (idx + 1) % 500 == 0 or idx == total - 1:
                pct = (idx + 1) / max(total, 1) * 100
                self._update_progress(4, pct, {
                    'processed': idx + 1,
                    'total': total,
                    'salaries_created': created_count + len(batch),
                })

        # Final batch
        if batch:
            EmployeeSalary.objects.bulk_create(batch, ignore_conflicts=True, batch_size=500)
            created_count += len(batch)

        self.results['employee_salaries_created'] = created_count
        self._log(f'  Phase 4 complete: {created_count} employee salaries created')
        self._update_progress(4, 100)

    def phase5_create_employee_transactions(self, allowances_data, staff_data):
        """Phase 5: Create EmployeeTransactions (grade-based + individual)."""
        from employees.models import Employee
        from payroll.models import PayComponent, EmployeeTransaction

        self._log('Phase 5: Creating Employee Transactions...')
        self._update_progress(5, 0)

        # Load pay components
        components = {c.code: c for c in PayComponent.objects.filter(is_active=True)}

        # Build staff data lookup
        staff_lookup = {}
        for emp_data in staff_data:
            staff_lookup[emp_data['staff_id']] = emp_data

        # Get active employees with grade and salary_notch
        employees = Employee.objects.filter(
            status='ACTIVE',
            salary_notch__isnull=False,
        ).select_related(
            'grade', 'salary_notch__level__band'
        )

        total = employees.count()
        created_count = 0
        batch = []

        for idx, employee in enumerate(employees.iterator()):
            try:
                band_code = None
                if employee.salary_notch and employee.salary_notch.level and employee.salary_notch.level.band:
                    band_code = employee.salary_notch.level.band.code.upper().replace(' ', '').replace('_', '')
                    if not band_code.startswith('BAND'):
                        band_code = f'BAND{band_code}'
                    band_code = band_code.replace('BAND_', 'BAND')

                if not band_code or band_code not in allowances_data:
                    continue

                band_policy = allowances_data[band_code]
                emp_data = staff_lookup.get(employee.employee_number, {})
                basic = employee.salary_notch.amount

                # Determine if employee has vehicle or transport
                has_vehicle = emp_data.get('vehicle_allowance', 0) > 0
                has_transport = emp_data.get('transport', 0) > 0

                # Grade-based transactions
                txns = self._build_grade_transactions(
                    employee, band_code, band_policy, basic, has_vehicle, has_transport, components
                )
                batch.extend(txns)

                # Individual transactions (PF, Union, Rent)
                ind_txns = self._build_individual_transactions(
                    employee, emp_data, components
                )
                batch.extend(ind_txns)

                # Bulk create in batches
                if len(batch) >= 1000:
                    EmployeeTransaction.objects.bulk_create(batch, ignore_conflicts=True, batch_size=1000)
                    created_count += len(batch)
                    batch = []

            except Exception as e:
                self.results['errors'].append(f"Transactions for {employee.employee_number}: {str(e)}")

            if (idx + 1) % 500 == 0 or idx == total - 1:
                pct = (idx + 1) / max(total, 1) * 100
                self._update_progress(5, pct, {
                    'processed': idx + 1,
                    'total': total,
                    'transactions_created': created_count + len(batch),
                })

        # Final batch
        if batch:
            EmployeeTransaction.objects.bulk_create(batch, ignore_conflicts=True, batch_size=1000)
            created_count += len(batch)

        self.results['transactions_created'] = created_count
        self._log(f'  Phase 5 complete: {created_count} transactions created')
        self._update_progress(5, 100)

    def _build_grade_transactions(self, employee, band_code, band_policy, basic, has_vehicle, has_transport, components):
        """Build grade-based allowance transactions for an employee."""
        from payroll.models import EmployeeTransaction

        txns = []
        band_num = int(band_code.replace('BAND', ''))

        # UTILITY - all bands get utility (6% of basic)
        if 'UTILITY' in components:
            txns.append(self._make_transaction(
                employee, components['UTILITY'],
                override_type='PCT', override_percentage=Decimal(str(band_policy.get('utility', 0.06))),
            ))

        if band_num <= 3:
            # Bands 1-3: Transport (fixed 300)
            if 'TRANSPORT' in components:
                transport_amt = Decimal(str(band_policy.get('transport', 300)))
                txns.append(self._make_transaction(
                    employee, components['TRANSPORT'],
                    override_type='FIXED', override_amount=transport_amt,
                ))

        elif band_num == 4:
            if has_vehicle:
                # Band 4 with vehicle: Vehicle Maint (fixed 360) + Fuel (fixed 840.72)
                if 'VEHICLE_MAINT' in components:
                    txns.append(self._make_transaction(
                        employee, components['VEHICLE_MAINT'],
                        override_type='FIXED',
                        override_amount=Decimal(str(band_policy.get('vehicle_maint_fixed', 360))),
                    ))
                if 'FUEL' in components:
                    txns.append(self._make_transaction(
                        employee, components['FUEL'],
                        override_type='FIXED',
                        override_amount=Decimal(str(band_policy.get('fuel_fixed', 840.72))),
                    ))
            else:
                # Band 4 without vehicle: Transport (fixed 450)
                if 'TRANSPORT' in components:
                    txns.append(self._make_transaction(
                        employee, components['TRANSPORT'],
                        override_type='FIXED',
                        override_amount=Decimal(str(band_policy.get('transport', 450))),
                    ))

        elif band_num == 5:
            # Band 5: Vehicle Maint (18%) + Fuel (fixed 2101.80)
            if 'VEHICLE_MAINT' in components:
                txns.append(self._make_transaction(
                    employee, components['VEHICLE_MAINT'],
                    override_type='PCT',
                    override_percentage=Decimal(str(band_policy.get('vehicle_maint', 0.18))),
                ))
            if 'FUEL' in components:
                txns.append(self._make_transaction(
                    employee, components['FUEL'],
                    override_type='FIXED',
                    override_amount=Decimal(str(band_policy.get('fuel_fixed', 2101.80))),
                ))

        elif band_num >= 6:
            # Bands 6-7: 8 allowances + Fuel
            pct_allowances = {
                'VEHICLE_MAINT': 'vehicle_maint',
                'SECURITY': 'security',
                'ENTERTAINMENT': 'entertainment',
                'DOMESTIC': 'domestic',
                'RESPONSIBILITY': 'responsibility',
                'RENT_ALLOW': 'rent_allowance',
            }
            for comp_code, policy_key in pct_allowances.items():
                if comp_code in components and policy_key in band_policy:
                    txns.append(self._make_transaction(
                        employee, components[comp_code],
                        override_type='PCT',
                        override_percentage=Decimal(str(band_policy[policy_key])),
                    ))

            if 'FUEL' in components:
                txns.append(self._make_transaction(
                    employee, components['FUEL'],
                    override_type='FIXED',
                    override_amount=Decimal(str(band_policy.get('fuel_fixed', 2802.40 if band_num == 6 else 3503.00))),
                ))

        return txns

    def _build_individual_transactions(self, employee, emp_data, components):
        """Build individual deduction transactions (PF, Union, Rent)."""
        from payroll.models import EmployeeTransaction

        txns = []

        # Provident Fund
        pf_rate = emp_data.get('pf_rate', 0)
        if pf_rate > 0 and 'PF' in components:
            txns.append(self._make_transaction(
                employee, components['PF'],
                override_type='PCT',
                override_percentage=Decimal(str(pf_rate)),
            ))

        # Union dues
        union = emp_data.get('union', '')
        union_rate = emp_data.get('union_rate', 0)
        if union == 'UNICOF' and union_rate > 0 and 'UNICOF' in components:
            txns.append(self._make_transaction(
                employee, components['UNICOF'],
                override_type='PCT',
                override_percentage=Decimal(str(union_rate)),
            ))
        elif union == 'PAWU' and union_rate > 0 and 'PAWU' in components:
            txns.append(self._make_transaction(
                employee, components['PAWU'],
                override_type='PCT',
                override_percentage=Decimal(str(union_rate)),
            ))

        # Rent deduction
        rent = emp_data.get('rent', 0)
        if rent > 0 and 'RENT_DED' in components:
            txns.append(self._make_transaction(
                employee, components['RENT_DED'],
                override_type='FIXED',
                override_amount=Decimal(str(rent)),
            ))

        return txns

    def _make_transaction(self, employee, pay_component, override_type='NONE',
                          override_amount=None, override_percentage=None):
        """Create an EmployeeTransaction instance (not yet saved)."""
        from payroll.models import EmployeeTransaction

        return EmployeeTransaction(
            reference_number=EmployeeTransaction.generate_reference_number(),
            employee=employee,
            pay_component=pay_component,
            override_type=override_type,
            override_amount=override_amount,
            override_percentage=override_percentage,
            is_recurring=True,
            effective_from=EFFECTIVE_DATE,
            status='ACTIVE',
            description=f'Payroll implementation setup - {pay_component.name}',
            created_by=self.user,
        )

    @staticmethod
    def reset_payroll_data():
        """Clear all payroll data for re-run."""
        from payroll.models import (
            PayComponent, EmployeeSalary, EmployeeTransaction,
            TaxBracket, SSNITRate, OvertimeBonusTaxConfig,
        )

        counts = {
            'transactions_deleted': EmployeeTransaction.objects.count(),
            'salaries_deleted': EmployeeSalary.objects.count(),
            'components_deleted': PayComponent.objects.count(),
            'tax_brackets_deleted': TaxBracket.objects.count(),
            'ssnit_rates_deleted': SSNITRate.objects.count(),
        }

        EmployeeTransaction.objects.all().delete()
        EmployeeSalary.objects.all().delete()
        PayComponent.objects.all().delete()
        TaxBracket.objects.all().delete()
        SSNITRate.objects.all().delete()
        OvertimeBonusTaxConfig.objects.all().delete()

        return counts
