"""
Seed comprehensive sample data for ALL HRMS/ERP/Payroll models.

Usage:
    python manage.py seed_all_data
    python manage.py seed_all_data --clear   # Wipe and re-seed
"""

import random
import uuid
import calendar as cal_mod
from datetime import date, timedelta, time
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

# ── Ghana-centric data pools ────────────────────────────────────────────────
GHANAIAN_FIRST_NAMES_M = [
    'Kwame', 'Kofi', 'Kwesi', 'Yaw', 'Kwaku', 'Kwabena', 'Kojo',
    'Nana', 'Ebo', 'Fiifi', 'Papa', 'Edem', 'Selorm', 'Dela',
    'Emmanuel',
]
GHANAIAN_FIRST_NAMES_F = [
    'Ama', 'Akua', 'Abena', 'Yaa', 'Adjoa', 'Afua', 'Afia',
    'Efua', 'Akosua', 'Adwoa', 'Naana', 'Esi', 'Serwaa', 'Dede',
    'Gifty',
]
GHANAIAN_LAST_NAMES = [
    'Mensah', 'Asante', 'Osei', 'Boateng', 'Agyemang', 'Owusu',
    'Appiah', 'Amoah', 'Danso', 'Antwi', 'Frimpong', 'Tetteh',
    'Adu', 'Quaye', 'Ampofo', 'Nyarko', 'Adom', 'Darkwa',
    'Adjei', 'Nkrumah', 'Badu', 'Gyasi', 'Sarpong', 'Manu',
    'Opoku', 'Boadu', 'Asare', 'Obeng', 'Ofori', 'Bekoe',
]
ACCRA_STREETS = [
    'Independence Ave, Accra', 'Kanda Highway, Accra',
    'Ring Road Central, Accra', 'Liberation Rd, Accra',
    'Oxford St, Osu', 'Patrice Lumumba Rd, Airport',
    'Spintex Rd, Accra', 'Achimota Mile 7, Accra',
    'East Legon, Accra', 'Dansoman, Accra',
]
KUMASI_STREETS = [
    'Harper Rd, Kumasi', 'Adum, Kumasi',
    'Kejetia Market Rd, Kumasi', 'KNUST Campus, Kumasi',
]
TAMALE_STREETS = ['Tamale Central, Tamale', 'Hospital Rd, Tamale']

SKILL_POOL = [
    ('Python', 'Technical'), ('Django', 'Technical'), ('React', 'Technical'),
    ('SQL', 'Technical'), ('Excel', 'Office'), ('Leadership', 'Soft Skill'),
    ('Communication', 'Soft Skill'), ('Project Management', 'Management'),
    ('Data Analysis', 'Technical'), ('Tax Law', 'Professional'),
    ('Accounting', 'Professional'), ('Audit', 'Professional'),
    ('Risk Management', 'Professional'), ('Public Speaking', 'Soft Skill'),
    ('Negotiation', 'Soft Skill'), ('Financial Modelling', 'Technical'),
]


def _rand_phone():
    return f"+233{random.choice(['20','24','26','27','54','55','57'])}{random.randint(1000000,9999999)}"


def _rand_digital():
    return f"GA-{random.randint(100,999)}-{random.randint(1000,9999)}"


def _rand_ssnit():
    return f"A00{random.randint(10000000,99999999)}"


def _rand_tin():
    return f"P00{random.randint(1000000,9999999)}"


def _rand_ghana_card():
    return f"GHA-{random.randint(100000000,999999999)}-{random.randint(1,9)}"


class Command(BaseCommand):
    help = 'Seed comprehensive sample data for every HRMS module.'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear all data before seeding.')

    def handle(self, *args, **options):
        if options['clear']:
            self._clear_all()

        with transaction.atomic():
            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 1: Foundation ══'))
            self._phase1_foundation()

            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 2: Payroll Setup ══'))
            self._phase2_payroll_setup()

            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 3: Employees ══'))
            self._phase3_employees()

            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 4: Leave ══'))
            self._phase4_leave()

            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 5: Payroll Processing ══'))
            self._phase5_payroll_processing()

            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 6: ERP / Finance ══'))
            self._phase6_erp()

            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 7: Performance ══'))
            self._phase7_performance()

            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 8: Benefits & Loans ══'))
            self._phase8_benefits()

            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 9: Recruitment ══'))
            self._phase9_recruitment()

            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 10: Training ══'))
            self._phase10_training()

            self.stdout.write(self.style.MIGRATE_HEADING('\n══ Phase 11: Discipline & Grievances ══'))
            self._phase11_discipline()

        self.stdout.write(self.style.SUCCESS('\n✓ All data seeded successfully!\n'))

    # ─── CLEAR ───────────────────────────────────────────────────────────────
    def _clear_all(self):
        self.stdout.write(self.style.WARNING('Clearing ALL seed data...'))

        # Discipline
        try:
            from discipline.models import (
                DisciplinaryAction, DisciplinaryHearing, DisciplinaryCase,
                Grievance, MisconductCategory, GrievanceCategory,
            )
            DisciplinaryAction.all_objects.all().delete()
            DisciplinaryHearing.all_objects.all().delete()
            DisciplinaryCase.all_objects.all().delete()
            Grievance.all_objects.all().delete()
            MisconductCategory.all_objects.all().delete()
            GrievanceCategory.all_objects.all().delete()
        except Exception:
            pass

        # Recruitment
        try:
            from recruitment.models import (
                InterviewFeedback, Interview, Reference, JobOffer, Applicant, Vacancy,
            )
            InterviewFeedback.all_objects.all().delete()
            Interview.all_objects.all().delete()
            Reference.all_objects.all().delete()
            JobOffer.all_objects.all().delete()
            Applicant.all_objects.all().delete()
            Vacancy.all_objects.all().delete()
        except Exception:
            pass

        # Performance
        try:
            from performance.models import (
                CompetencyAssessment, Goal, Appraisal, AppraisalCycle,
                RatingScaleLevel, RatingScale, Competency, GoalCategory,
                DevelopmentPlan, DevelopmentActivity, PerformanceImprovementPlan,
                PIPReview, TrainingNeed, CoreValue, CoreValueAssessment,
            )
            CoreValueAssessment.all_objects.all().delete()
            CompetencyAssessment.all_objects.all().delete()
            Goal.all_objects.all().delete()
            DevelopmentActivity.all_objects.all().delete()
            DevelopmentPlan.all_objects.all().delete()
            PIPReview.all_objects.all().delete()
            PerformanceImprovementPlan.all_objects.all().delete()
            TrainingNeed.all_objects.all().delete()
            Appraisal.all_objects.all().delete()
            AppraisalCycle.all_objects.all().delete()
            RatingScaleLevel.all_objects.all().delete()
            RatingScale.all_objects.all().delete()
            Competency.all_objects.all().delete()
            GoalCategory.all_objects.all().delete()
            CoreValue.all_objects.all().delete()
        except Exception:
            pass

        # Benefits
        try:
            from benefits.models import (
                LoanSchedule, LoanAccount, LoanType,
                BenefitClaim, BenefitEnrollment, BenefitType,
                ExpenseClaimItem, ExpenseClaim, ExpenseType,
                FuneralGrantType, ThirdPartyDeduction, ThirdPartyLender,
                ProfessionalSubscription, ProfessionalSubscriptionType,
            )
            LoanSchedule.all_objects.all().delete()
            LoanAccount.all_objects.all().delete()
            LoanType.all_objects.all().delete()
            BenefitClaim.all_objects.all().delete()
            BenefitEnrollment.all_objects.all().delete()
            BenefitType.all_objects.all().delete()
            ExpenseClaimItem.all_objects.all().delete()
            ExpenseClaim.all_objects.all().delete()
            ExpenseType.all_objects.all().delete()
            FuneralGrantType.all_objects.all().delete()
            ThirdPartyDeduction.all_objects.all().delete()
            ThirdPartyLender.all_objects.all().delete()
            ProfessionalSubscription.all_objects.all().delete()
            ProfessionalSubscriptionType.all_objects.all().delete()
        except Exception:
            pass

        # Leave
        try:
            from leave.models import (
                LeavePlanEntry, LeavePlan, LeaveRequest, LeaveBalance,
                LeavePolicy, LeaveType, LeaveApprovalWorkflowTemplate,
                LeaveApprovalWorkflowLevel,
            )
            LeavePlanEntry.all_objects.all().delete()
            LeavePlan.all_objects.all().delete()
            LeaveRequest.all_objects.all().delete()
            LeaveBalance.all_objects.all().delete()
            LeavePolicy.all_objects.all().delete()
            LeaveType.all_objects.all().delete()
            LeaveApprovalWorkflowLevel.all_objects.all().delete()
            LeaveApprovalWorkflowTemplate.all_objects.all().delete()
        except Exception:
            pass

        # Payroll processing
        try:
            from payroll.models import (
                PayrollItemDetail, PayrollItem, PayrollRun, PayrollPeriod,
                PayrollCalendar, PayrollSettings, EmployeeSalaryComponent,
                EmployeeSalary, AdHocPayment,
                SalaryStructureComponent, SalaryStructure,
                TaxBracket, TaxRelief, SSNITRate,
                SalaryNotch, SalaryLevel, SalaryBand, StaffCategory,
                PayComponent, BankBranch, Bank,
            )
            PayrollItemDetail.all_objects.all().delete()
            PayrollItem.all_objects.all().delete()
            PayrollRun.all_objects.all().delete()
            AdHocPayment.all_objects.all().delete()
            PayrollSettings.objects.all().delete()
            PayrollPeriod.all_objects.all().delete()
            PayrollCalendar.all_objects.all().delete()
            EmployeeSalaryComponent.all_objects.all().delete()
            EmployeeSalary.all_objects.all().delete()
            SalaryStructureComponent.all_objects.all().delete()
            SalaryStructure.all_objects.all().delete()
            TaxBracket.all_objects.all().delete()
            TaxRelief.all_objects.all().delete()
            SSNITRate.all_objects.all().delete()
            SalaryNotch.all_objects.all().delete()
            SalaryLevel.all_objects.all().delete()
            SalaryBand.all_objects.all().delete()
            StaffCategory.all_objects.all().delete()
            PayComponent.all_objects.all().delete()
            BankBranch.all_objects.all().delete()
            Bank.all_objects.all().delete()
        except Exception:
            pass

        # Employees
        try:
            from employees.models import (
                EmploymentHistory, BankAccount, Skill, Certification,
                WorkExperience, Education, Dependent, EmergencyContact, Employee,
            )
            EmploymentHistory.all_objects.all().delete()
            BankAccount.all_objects.all().delete()
            Skill.all_objects.all().delete()
            Certification.all_objects.all().delete()
            WorkExperience.all_objects.all().delete()
            Education.all_objects.all().delete()
            Dependent.all_objects.all().delete()
            EmergencyContact.all_objects.all().delete()
            Employee.all_objects.all().delete()
        except Exception:
            pass

        # Organization
        try:
            from organization.models import (
                Holiday, WorkLocation, CostCenter, JobPosition,
                JobCategory, JobGrade, Department, OrganizationUnit,
                Directorate, Division, Organization,
            )
            Holiday.all_objects.all().delete()
            CostCenter.all_objects.all().delete()
            JobPosition.all_objects.all().delete()
            JobCategory.all_objects.all().delete()
            JobGrade.all_objects.all().delete()
            Department.all_objects.all().delete()
            OrganizationUnit.all_objects.all().delete()
            Directorate.all_objects.all().delete()
            Division.all_objects.all().delete()
        except Exception:
            pass

        # Auth
        try:
            from accounts.models import UserRole, Role, User
            UserRole.objects.all().delete()
            Role.objects.all().delete()
            User.objects.filter(email__endswith='@gra.gov.gh').delete()
        except Exception:
            pass

        # Regions / Districts
        try:
            from core.models import District, Region, Country
            District.all_objects.all().delete()
            Region.all_objects.all().delete()
        except Exception:
            pass

        self.stdout.write(self.style.SUCCESS('  Cleared.'))

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 1 : FOUNDATION
    # ═══════════════════════════════════════════════════════════════════════
    def _phase1_foundation(self):
        from organization.models import (
            Organization, Division, Directorate, Department,
            OrganizationUnit, JobGrade, JobCategory, JobPosition,
            CostCenter, WorkLocation, Holiday,
        )
        from core.models import Region, District, Country
        from accounts.models import User, Role, UserRole

        # 1. Organization
        org, created = Organization.objects.get_or_create(
            code='GRA',
            defaults=dict(
                name='Ghana Revenue Authority',
                slug='gra',
                country='GHA',
                currency='GHS',
                currency_symbol='GH₵',
                timezone='Africa/Accra',
                date_format='DD/MM/YYYY',
                financial_year_start_month=1,
                email_domain='gra.gov.gh',
                website='https://gra.gov.gh',
                address='Revenue House, Accra',
                phone='+233302664661',
                subscription_plan='ENTERPRISE',
                max_employees=5000,
                setup_completed=True,
                modules_enabled=[
                    'employees', 'payroll', 'leave', 'performance',
                    'benefits', 'recruitment', 'discipline', 'finance',
                    'procurement', 'inventory', 'projects', 'training',
                ],
            ),
        )
        self.org = org
        if created:
            self.stdout.write(f'  Created Organization: {org.name}')
        else:
            self.stdout.write(f'  Organization exists: {org.name}')

        # 2. Country
        Country.objects.get_or_create(code='GHA', defaults={'name': 'Ghana', 'phone_code': '+233', 'currency_code': 'GHS'})

        # 3. Regions & Districts
        region_data = [
            ('GAR', 'Greater Accra', [('AMA', 'Accra Metropolitan'), ('TMA', 'Tema Metropolitan')]),
            ('ASH', 'Ashanti', [('KMA', 'Kumasi Metropolitan'), ('OBU', 'Obuasi Municipal')]),
            ('NOR', 'Northern', [('TAM', 'Tamale Metropolitan'), ('YEN', 'Yendi Municipal')]),
        ]
        self.regions = {}
        self.districts = {}
        for r_code, r_name, dists in region_data:
            reg, _ = Region.all_objects.get_or_create(code=r_code, defaults={'name': r_name, 'tenant': org})
            self.regions[r_code] = reg
            for d_code, d_name in dists:
                dist, _ = District.all_objects.get_or_create(code=d_code, defaults={'name': d_name, 'region': reg, 'tenant': org})
                self.districts[d_code] = dist
        self.stdout.write(f'  Regions: {len(self.regions)}, Districts: {len(self.districts)}')

        # 4. Divisions
        div_data = [
            ('DIV-RO', 'Revenue Operations', 1),
            ('DIV-CS', 'Corporate Services', 2),
            ('DIV-DT', 'Domestic Tax', 3),
        ]
        self.divisions = {}
        for code, name, order in div_data:
            d, _ = Division.all_objects.get_or_create(code=code, defaults={'name': name, 'sort_order': order, 'tenant': org})
            self.divisions[code] = d
        self.stdout.write(f'  Divisions: {len(self.divisions)}')

        # 5. Directorates (2 per division)
        dir_data = [
            ('DIR-COLL', 'Revenue Collection', 'DIV-RO', 1),
            ('DIR-ENFO', 'Enforcement & Compliance', 'DIV-RO', 2),
            ('DIR-HR', 'Human Resources', 'DIV-CS', 3),
            ('DIR-FIN', 'Finance & Administration', 'DIV-CS', 4),
            ('DIR-DTAX', 'Tax Assessment', 'DIV-DT', 5),
            ('DIR-AUDI', 'Internal Audit', 'DIV-DT', 6),
        ]
        self.directorates = {}
        for code, name, div_code, order in dir_data:
            d, _ = Directorate.all_objects.get_or_create(
                code=code,
                defaults={'name': name, 'division': self.divisions[div_code], 'sort_order': order, 'tenant': org},
            )
            self.directorates[code] = d
        self.stdout.write(f'  Directorates: {len(self.directorates)}')

        # 6. Organization Units (HQ)
        hq_unit, _ = OrganizationUnit.all_objects.get_or_create(
            code='OU-HQ',
            defaults={'name': 'GRA Headquarters', 'unit_type': 'HQ', 'level': 0, 'tenant': org},
        )

        # 7. Departments (2 per directorate)
        dept_data = [
            ('DEP-LTO', 'Large Taxpayer Office', 'DIR-COLL'),
            ('DEP-MTO', 'Medium Taxpayer Office', 'DIR-COLL'),
            ('DEP-COMP', 'Compliance Unit', 'DIR-ENFO'),
            ('DEP-INV', 'Investigation Unit', 'DIR-ENFO'),
            ('DEP-HRM', 'HR Management', 'DIR-HR'),
            ('DEP-TRN', 'Training & Development', 'DIR-HR'),
            ('DEP-ACC', 'Accounts', 'DIR-FIN'),
            ('DEP-PRO', 'Procurement', 'DIR-FIN'),
            ('DEP-INC', 'Income Tax', 'DIR-DTAX'),
            ('DEP-VAT', 'VAT & Excise', 'DIR-DTAX'),
            ('DEP-IA', 'Internal Audit', 'DIR-AUDI'),
            ('DEP-RM', 'Risk Management', 'DIR-AUDI'),
        ]
        self.departments = {}
        for code, name, dir_code in dept_data:
            ou, _ = OrganizationUnit.all_objects.get_or_create(
                code=code,
                defaults={'name': name, 'unit_type': 'DEPARTMENT', 'parent': hq_unit, 'level': 2, 'tenant': org},
            )
            dep, _ = Department.all_objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'directorate': self.directorates[dir_code],
                    'organization_unit': ou,
                    'tenant': org,
                },
            )
            self.departments[code] = dep
        self.stdout.write(f'  Departments: {len(self.departments)}')

        # 8. Job Grades
        grade_data = [
            ('GR-01', 'Grade 1 - Support', 1, False, 15, 7),
            ('GR-02', 'Grade 2 - Junior Officer', 2, False, 18, 8),
            ('GR-03', 'Grade 3 - Officer', 3, False, 21, 10),
            ('GR-04', 'Grade 4 - Senior Officer', 4, False, 25, 12),
            ('GR-05', 'Grade 5 - Manager', 5, True, 28, 14),
            ('GR-06', 'Grade 6 - Director', 6, True, 30, 15),
        ]
        self.grades = {}
        for code, name, level, is_mgmt, annual_leave, sick_leave in grade_data:
            g, _ = JobGrade.all_objects.get_or_create(
                code=code,
                defaults={
                    'name': name, 'level': level, 'is_management': is_mgmt,
                    'annual_leave_days': annual_leave, 'sick_leave_days': sick_leave,
                    'tenant': org,
                },
            )
            self.grades[code] = g
        self.stdout.write(f'  Job Grades: {len(self.grades)}')

        # 9. Job Categories
        cat_data = [('CAT-MGT', 'Management'), ('CAT-PRO', 'Professional'), ('CAT-TEC', 'Technical'), ('CAT-SUP', 'Support')]
        self.categories = {}
        for code, name in cat_data:
            c, _ = JobCategory.all_objects.get_or_create(code=code, defaults={'name': name, 'tenant': org})
            self.categories[code] = c

        # 10. Job Positions (spread across departments)
        pos_data = [
            ('POS-CEO', 'Commissioner General', 'DEP-HRM', 'GR-06', 'CAT-MGT', True),
            ('POS-DCEO', 'Deputy Commissioner', 'DEP-HRM', 'GR-06', 'CAT-MGT', True),
            ('POS-DIR', 'Director', 'DEP-HRM', 'GR-06', 'CAT-MGT', True),
            ('POS-DDIR', 'Deputy Director', 'DEP-HRM', 'GR-05', 'CAT-MGT', True),
            ('POS-MGR', 'Manager', 'DEP-HRM', 'GR-05', 'CAT-MGT', True),
            ('POS-SMGR', 'Senior Manager', 'DEP-HRM', 'GR-05', 'CAT-MGT', True),
            ('POS-SOFF', 'Senior Revenue Officer', 'DEP-LTO', 'GR-04', 'CAT-PRO', True),
            ('POS-ROFF', 'Revenue Officer', 'DEP-MTO', 'GR-03', 'CAT-PRO', False),
            ('POS-JOFF', 'Junior Revenue Officer', 'DEP-INC', 'GR-02', 'CAT-PRO', False),
            ('POS-ACCT', 'Accountant', 'DEP-ACC', 'GR-03', 'CAT-PRO', False),
            ('POS-AUDT', 'Internal Auditor', 'DEP-IA', 'GR-04', 'CAT-PRO', False),
            ('POS-ITAN', 'IT Analyst', 'DEP-HRM', 'GR-03', 'CAT-TEC', False),
            ('POS-DAAN', 'Data Analyst', 'DEP-RM', 'GR-03', 'CAT-TEC', False),
            ('POS-CLRK', 'Administrative Clerk', 'DEP-PRO', 'GR-01', 'CAT-SUP', False),
            ('POS-DRIV', 'Driver', 'DEP-PRO', 'GR-01', 'CAT-SUP', False),
            ('POS-HRMG', 'HR Manager', 'DEP-HRM', 'GR-05', 'CAT-MGT', True),
            ('POS-PAYR', 'Payroll Officer', 'DEP-ACC', 'GR-03', 'CAT-PRO', False),
            ('POS-PROC', 'Procurement Officer', 'DEP-PRO', 'GR-03', 'CAT-PRO', False),
            ('POS-COMP', 'Compliance Officer', 'DEP-COMP', 'GR-04', 'CAT-PRO', False),
            ('POS-TAXO', 'Tax Officer', 'DEP-VAT', 'GR-03', 'CAT-PRO', False),
        ]
        self.positions = {}
        for code, title, dep_code, grade_code, cat_code, is_sup in pos_data:
            p, _ = JobPosition.all_objects.get_or_create(
                code=code,
                defaults={
                    'title': title, 'department': self.departments[dep_code],
                    'grade': self.grades[grade_code], 'category': self.categories[cat_code],
                    'is_supervisor': is_sup, 'tenant': org,
                },
            )
            self.positions[code] = p
        self.stdout.write(f'  Job Positions: {len(self.positions)}')

        # 11. Cost Centers
        cc_data = [
            ('CC-COLL', 'Revenue Collection', 'DIR-COLL'),
            ('CC-ENFO', 'Enforcement', 'DIR-ENFO'),
            ('CC-HR', 'Human Resources', 'DIR-HR'),
            ('CC-FIN', 'Finance', 'DIR-FIN'),
            ('CC-DTAX', 'Domestic Tax', 'DIR-DTAX'),
            ('CC-AUDI', 'Audit', 'DIR-AUDI'),
        ]
        self.cost_centers = {}
        for code, name, dir_code in cc_data:
            cc, _ = CostCenter.all_objects.get_or_create(
                code=code,
                defaults={'name': name, 'tenant': org},
            )
            self.cost_centers[code] = cc

        # 12. Work Locations
        loc_data = [
            ('LOC-HQ', 'GRA Head Office', 'Revenue House, Kwame Nkrumah Ave', 'Accra', 'GAR', True),
            ('LOC-KSI', 'Kumasi Regional Office', 'Harper Road', 'Kumasi', 'ASH', False),
            ('LOC-TML', 'Tamale Regional Office', 'Hospital Road', 'Tamale', 'NOR', False),
            ('LOC-TMA', 'Tema District Office', 'Motorway Roundabout', 'Tema', 'GAR', False),
        ]
        self.locations = {}
        for code, name, addr, city, reg_code, is_hq in loc_data:
            loc, _ = WorkLocation.all_objects.get_or_create(
                code=code,
                defaults={
                    'name': name, 'address': addr, 'city': city,
                    'region': self.regions[reg_code], 'is_headquarters': is_hq,
                    'tenant': org,
                },
            )
            self.locations[code] = loc
        self.stdout.write(f'  Work Locations: {len(self.locations)}')

        # 13. Holidays 2025 + 2026
        holidays = [
            ("New Year's Day", '01-01'), ('Independence Day', '03-06'),
            ('Good Friday', '04-18'), ('Easter Monday', '04-21'),
            ('May Day', '05-01'), ('Eid al-Fitr', '03-31'),
            ('Republic Day', '07-01'), ('Founders Day', '08-04'),
            ('Eid al-Adha', '06-07'), ('Kwame Nkrumah Memorial Day', '09-21'),
            ('Farmers Day', '12-05'), ('Christmas Day', '12-25'),
            ('Boxing Day', '12-26'),
        ]
        hol_count = 0
        for year in [2025, 2026]:
            for name, md in holidays:
                m, d = int(md.split('-')[0]), int(md.split('-')[1])
                try:
                    dt = date(year, m, d)
                except ValueError:
                    continue
                _, created = Holiday.all_objects.get_or_create(
                    name=name, date=dt,
                    defaults={'holiday_type': 'PUBLIC', 'is_paid': True, 'year': year, 'tenant': org},
                )
                if created:
                    hol_count += 1
        self.stdout.write(f'  Holidays created: {hol_count}')

        # 14. Users & Roles
        role_data = [
            ('SUPER_ADMIN', 'Super Administrator', True, 100),
            ('HR_MANAGER', 'HR Manager', True, 80),
            ('PAYROLL_OFFICER', 'Payroll Officer', True, 60),
            ('DEPARTMENT_HEAD', 'Department Head', True, 40),
            ('EMPLOYEE', 'Employee', True, 10),
        ]
        self.roles = {}
        for code, name, is_sys, level in role_data:
            r, _ = Role.objects.get_or_create(code=code, defaults={'name': name, 'is_system_role': is_sys, 'level': level})
            self.roles[code] = r

        user_data = [
            ('admin@gra.gov.gh', 'System', 'Administrator', 'SUPER_ADMIN'),
            ('hr.manager@gra.gov.gh', 'Abena', 'Mensah', 'HR_MANAGER'),
            ('payroll@gra.gov.gh', 'Kofi', 'Asante', 'PAYROLL_OFFICER'),
            ('dept.head@gra.gov.gh', 'Yaw', 'Osei', 'DEPARTMENT_HEAD'),
            ('employee@gra.gov.gh', 'Ama', 'Boateng', 'EMPLOYEE'),
        ]
        self.users = {}
        for email, first, last, role_code in user_data:
            u, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': first, 'last_name': last,
                    'is_active': True, 'is_staff': role_code == 'SUPER_ADMIN',
                    'is_superuser': role_code == 'SUPER_ADMIN',
                    'organization': org,
                },
            )
            if created:
                u.set_password('Test@1234')
                u.save()
            self.users[role_code] = u
            UserRole.objects.get_or_create(
                user=u, role=self.roles[role_code],
                defaults={'is_primary': True, 'is_active': True},
            )
        self.stdout.write(f'  Users: {len(self.users)}, Roles: {len(self.roles)}')

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 2 : PAYROLL SETUP
    # ═══════════════════════════════════════════════════════════════════════
    def _phase2_payroll_setup(self):
        from payroll.models import (
            Bank, BankBranch, StaffCategory, SalaryBand, SalaryLevel,
            SalaryNotch, PayComponent, SalaryStructure, SalaryStructureComponent,
            TaxBracket, TaxRelief, SSNITRate,
        )
        org = self.org

        # Banks
        bank_data = [
            ('GCB', 'GCB Bank Limited', 'GHCBGHAC'),
            ('ECO', 'Ecobank Ghana', 'EABORGHAC'),
            ('STN', 'Stanbic Bank Ghana', 'SBICGHAC'),
            ('FID', 'Fidelity Bank Ghana', 'FBLIGHAC'),
            ('CAL', 'CalBank Limited', 'ACABORGH'),
            ('ADB', 'Agricultural Dev. Bank', 'ADNTGHAC'),
        ]
        self.banks = {}
        for code, name, swift in bank_data:
            b, _ = Bank.all_objects.get_or_create(
                code=code, defaults={'name': name, 'swift_code': swift, 'tenant': org},
            )
            self.banks[code] = b

        # Bank Branches (2 per bank)
        self.branches = {}
        for code, bank in self.banks.items():
            for i, (suffix, bname, city) in enumerate([
                ('HQ', f'{bank.name} - Head Office', 'Accra'),
                ('KSI', f'{bank.name} - Kumasi', 'Kumasi'),
            ]):
                br_code = f'{code}-{suffix}'
                br, _ = BankBranch.all_objects.get_or_create(
                    bank=bank, code=br_code,
                    defaults={'name': bname, 'city': city, 'tenant': org},
                )
                self.branches[br_code] = br
        self.stdout.write(f'  Banks: {len(self.banks)}, Branches: {len(self.branches)}')

        # Staff Categories
        sc_data = [
            ('SC-SMGT', 'Senior Management', 'Senior Management Payroll', 1),
            ('SC-MGT', 'Management', 'Management Payroll', 2),
            ('SC-SNR', 'Senior Staff', 'Senior Staff Payroll', 3),
            ('SC-JNR', 'Junior Staff', 'Junior Staff Payroll', 4),
        ]
        self.staff_categories = {}
        for code, name, pg, order in sc_data:
            sc, _ = StaffCategory.all_objects.get_or_create(
                code=code, defaults={'name': name, 'payroll_group': pg, 'sort_order': order, 'tenant': org},
            )
            self.staff_categories[code] = sc

        # Salary Bands
        band_data = [
            ('BAND-A', 'Band A - Support', Decimal('2000'), Decimal('4000'), 1),
            ('BAND-B', 'Band B - Junior Officer', Decimal('3500'), Decimal('6000'), 2),
            ('BAND-C', 'Band C - Officer', Decimal('5000'), Decimal('9000'), 3),
            ('BAND-D', 'Band D - Senior Officer', Decimal('8000'), Decimal('14000'), 4),
            ('BAND-E', 'Band E - Manager', Decimal('12000'), Decimal('20000'), 5),
            ('BAND-F', 'Band F - Director', Decimal('18000'), Decimal('30000'), 6),
        ]
        self.bands = {}
        for code, name, min_s, max_s, order in band_data:
            b, _ = SalaryBand.all_objects.get_or_create(
                code=code, defaults={'name': name, 'min_salary': min_s, 'max_salary': max_s, 'sort_order': order, 'tenant': org},
            )
            self.bands[code] = b

        # Link grades to bands
        grade_band_map = {
            'GR-01': 'BAND-A', 'GR-02': 'BAND-B', 'GR-03': 'BAND-C',
            'GR-04': 'BAND-D', 'GR-05': 'BAND-E', 'GR-06': 'BAND-F',
        }
        from organization.models import JobGrade
        for g_code, b_code in grade_band_map.items():
            JobGrade.all_objects.filter(code=g_code).update(salary_band=self.bands[b_code])

        # Salary Levels (3 per band)
        self.levels = {}
        for band_code, band in self.bands.items():
            spread = (band.max_salary - band.min_salary) / Decimal('3')
            for i in range(1, 4):
                lv_code = f'{band_code}-L{i}'
                lv_min = band.min_salary + spread * Decimal(str(i - 1))
                lv_max = band.min_salary + spread * Decimal(str(i))
                lv, _ = SalaryLevel.all_objects.get_or_create(
                    band=band, code=lv_code,
                    defaults={'name': f'{band.name} Level {i}', 'min_salary': lv_min.quantize(Decimal('0.01')), 'max_salary': lv_max.quantize(Decimal('0.01')), 'sort_order': i, 'tenant': org},
                )
                self.levels[lv_code] = lv

        # Salary Notches (3 per level)
        self.notches = {}
        for lv_code, lv in self.levels.items():
            spread = ((lv.max_salary or Decimal('0')) - (lv.min_salary or Decimal('0'))) / Decimal('3')
            for n in range(1, 4):
                n_code = f'{lv_code}-N{n}'
                amount = ((lv.min_salary or Decimal('0')) + spread * Decimal(str(n - 1)) + spread / 2).quantize(Decimal('0.01'))
                notch, _ = SalaryNotch.all_objects.get_or_create(
                    level=lv, code=n_code,
                    defaults={'name': f'Notch {n}', 'amount': amount, 'sort_order': n, 'tenant': org},
                )
                self.notches[n_code] = notch
        self.stdout.write(f'  Bands: {len(self.bands)}, Levels: {len(self.levels)}, Notches: {len(self.notches)}')

        # Pay Components
        comp_data = [
            ('BASIC', 'Basic Salary', 'EARNING', 'FIXED', 'BASIC', True, True, False, 1),
            ('HOUSING', 'Housing Allowance', 'EARNING', 'PCT_BASIC', 'ALLOWANCE', True, True, False, 2),
            ('TRANSPORT', 'Transport Allowance', 'EARNING', 'FIXED', 'ALLOWANCE', True, True, False, 3),
            ('MEDICAL', 'Medical Allowance', 'EARNING', 'FIXED', 'ALLOWANCE', True, True, False, 4),
            ('SSNIT_T1_EE', 'SSNIT Tier 1 (Employee)', 'DEDUCTION', 'PCT_BASIC', 'STATUTORY', False, False, True, 10),
            ('SSNIT_T1_ER', 'SSNIT Tier 1 (Employer)', 'EMPLOYER', 'PCT_BASIC', 'STATUTORY', False, False, True, 11),
            ('SSNIT_T2_ER', 'SSNIT Tier 2 (Employer)', 'EMPLOYER', 'PCT_BASIC', 'FUND', False, False, True, 12),
            ('SSNIT_T3', 'SSNIT Tier 3 (Voluntary)', 'DEDUCTION', 'PCT_BASIC', 'FUND', False, False, True, 13),
            ('PAYE', 'PAYE Income Tax', 'DEDUCTION', 'FORMULA', 'STATUTORY', False, False, False, 14),
            ('OVERTIME', 'Overtime Pay', 'EARNING', 'FORMULA', 'OVERTIME', True, True, False, 20),
            ('BONUS', 'Performance Bonus', 'EARNING', 'FIXED', 'BONUS', True, True, False, 21),
            ('PROF_ALLOW', 'Professional Allowance', 'EARNING', 'FIXED', 'ALLOWANCE', True, True, False, 5),
            ('RESP_ALLOW', 'Responsibility Allowance', 'EARNING', 'PCT_BASIC', 'ALLOWANCE', True, True, False, 6),
        ]
        self.components = {}
        for code, name, ctype, calc, cat, taxable, gross, ssnit, order in comp_data:
            pc, _ = PayComponent.all_objects.get_or_create(
                code=code,
                defaults={
                    'name': name, 'component_type': ctype, 'calculation_type': calc,
                    'category': cat, 'is_taxable': taxable, 'is_part_of_gross': gross,
                    'affects_ssnit': ssnit, 'is_statutory': cat == 'STATUTORY',
                    'display_order': order, 'tenant': org,
                },
            )
            self.components[code] = pc
        # Set percentages
        PayComponent.all_objects.filter(code='HOUSING').update(percentage_value=Decimal('20'))
        PayComponent.all_objects.filter(code='SSNIT_T1_EE').update(percentage_value=Decimal('5.5'))
        PayComponent.all_objects.filter(code='SSNIT_T1_ER').update(percentage_value=Decimal('13'))
        PayComponent.all_objects.filter(code='SSNIT_T2_ER').update(percentage_value=Decimal('5'))
        PayComponent.all_objects.filter(code='SSNIT_T3').update(percentage_value=Decimal('5'))
        PayComponent.all_objects.filter(code='RESP_ALLOW').update(percentage_value=Decimal('10'))
        PayComponent.all_objects.filter(code='TRANSPORT').update(default_amount=Decimal('300'))
        PayComponent.all_objects.filter(code='MEDICAL').update(default_amount=Decimal('200'))
        self.stdout.write(f'  Pay Components: {len(self.components)}')

        # Salary Structures (one per staff category)
        struct_map = {
            'SS-SMGT': ('Senior Management Structure', 'GR-06'),
            'SS-MGT': ('Management Structure', 'GR-05'),
            'SS-SNR': ('Senior Staff Structure', 'GR-03'),
            'SS-JNR': ('Junior Staff Structure', 'GR-01'),
        }
        self.structures = {}
        for code, (name, g_code) in struct_map.items():
            ss, _ = SalaryStructure.all_objects.get_or_create(
                code=code,
                defaults={
                    'name': name, 'grade': self.grades[g_code],
                    'effective_from': date(2025, 1, 1), 'is_active': True, 'tenant': org,
                },
            )
            self.structures[code] = ss
            # Link earning components
            for comp_code in ['BASIC', 'HOUSING', 'TRANSPORT', 'MEDICAL']:
                SalaryStructureComponent.all_objects.get_or_create(
                    salary_structure=ss, pay_component=self.components[comp_code],
                    defaults={'tenant': org},
                )

        # Tax Brackets (Ghana 2025 PAYE)
        brackets = [
            ('First GHS 490', Decimal('0'), Decimal('490'), Decimal('0'), 1),
            ('Next GHS 110', Decimal('490'), Decimal('600'), Decimal('5'), 2),
            ('Next GHS 130', Decimal('600'), Decimal('730'), Decimal('10'), 3),
            ('Next GHS 3000', Decimal('730'), Decimal('3730'), Decimal('17.5'), 4),
            ('Next GHS 16000', Decimal('3730'), Decimal('19730'), Decimal('25'), 5),
            ('Exceeding GHS 19730', Decimal('19730'), None, Decimal('30'), 6),
        ]
        for name, min_a, max_a, rate, order in brackets:
            TaxBracket.all_objects.get_or_create(
                name=name, effective_from=date(2025, 1, 1),
                defaults={
                    'min_amount': min_a, 'max_amount': max_a, 'rate': rate,
                    'order': order, 'is_active': True, 'tenant': org,
                },
            )

        # Tax Relief
        TaxRelief.all_objects.get_or_create(
            code='PERSONAL', defaults={
                'name': 'Personal Relief', 'relief_type': 'FIXED',
                'amount': Decimal('0'), 'effective_from': date(2025, 1, 1),
                'is_active': True, 'tenant': org,
            },
        )

        # SSNIT Rates
        for tier, er, ee in [('TIER_1', Decimal('13'), Decimal('5.5')), ('TIER_2', Decimal('5'), Decimal('0')), ('TIER_3', Decimal('0'), Decimal('5'))]:
            SSNITRate.all_objects.get_or_create(
                tier=tier, effective_from=date(2025, 1, 1),
                defaults={'employer_rate': er, 'employee_rate': ee, 'is_active': True, 'tenant': org},
            )
        self.stdout.write('  Tax brackets, SSNIT rates created.')

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 3 : EMPLOYEES
    # ═══════════════════════════════════════════════════════════════════════
    def _phase3_employees(self):
        from employees.models import (
            Employee, EmergencyContact, Dependent, Education,
            WorkExperience, Certification, Skill, BankAccount, EmploymentHistory,
        )
        org = self.org

        # Check if employees already exist
        existing = Employee.all_objects.filter(employee_number__startswith='GRA-').count()
        if existing >= 30:
            self.stdout.write(f'  Employees already exist ({existing}), skipping.')
            self.employees = list(Employee.all_objects.filter(employee_number__startswith='GRA-').order_by('employee_number')[:30])
            return

        dept_codes = list(self.departments.keys())
        location_codes = list(self.locations.keys())
        grade_codes = ['GR-01', 'GR-02', 'GR-03', 'GR-04', 'GR-05', 'GR-06']
        pos_codes = list(self.positions.keys())
        notch_keys = list(self.notches.keys())
        sc_codes = list(self.staff_categories.keys())
        bank_codes = list(self.banks.keys())
        branch_keys = list(self.branches.keys())

        statuses = (['ACTIVE'] * 25 + ['PROBATION'] * 2 + ['ON_LEAVE'] * 1 +
                     ['TERMINATED'] * 1 + ['RESIGNED'] * 1)
        emp_types = (['PERMANENT'] * 24 + ['CONTRACT'] * 3 + ['TEMPORARY'] * 2 + ['INTERN'] * 1)

        self.employees = []
        # Link user accounts to first 5 employees
        user_links = [
            (self.users.get('SUPER_ADMIN'), 'POS-CEO'),
            (self.users.get('HR_MANAGER'), 'POS-HRMG'),
            (self.users.get('PAYROLL_OFFICER'), 'POS-PAYR'),
            (self.users.get('DEPARTMENT_HEAD'), 'POS-SOFF'),
            (self.users.get('EMPLOYEE'), 'POS-ROFF'),
        ]

        for i in range(30):
            num = f'GRA-{i+1:03d}'
            if Employee.all_objects.filter(employee_number=num).exists():
                emp = Employee.all_objects.get(employee_number=num)
                self.employees.append(emp)
                continue

            gender = 'M' if i % 3 != 0 else 'F'
            first_names = GHANAIAN_FIRST_NAMES_M if gender == 'M' else GHANAIAN_FIRST_NAMES_F
            first_name = first_names[i % len(first_names)]
            last_name = GHANAIAN_LAST_NAMES[i % len(GHANAIAN_LAST_NAMES)]

            # Determine grade based on position in list
            if i < 3:
                grade_code = 'GR-06'
            elif i < 6:
                grade_code = 'GR-05'
            elif i < 12:
                grade_code = 'GR-04'
            elif i < 20:
                grade_code = 'GR-03'
            elif i < 26:
                grade_code = 'GR-02'
            else:
                grade_code = 'GR-01'

            grade = self.grades[grade_code]
            dept = self.departments[dept_codes[i % len(dept_codes)]]
            loc = self.locations[location_codes[i % len(location_codes)]]

            # Pick a position that matches the grade
            matching_positions = [
                p for pc, p in self.positions.items()
                if p.grade == grade
            ]
            if not matching_positions:
                matching_positions = list(self.positions.values())
            position = matching_positions[i % len(matching_positions)]

            # Staff category
            if grade_code == 'GR-06':
                sc_code = 'SC-SMGT'
            elif grade_code == 'GR-05':
                sc_code = 'SC-MGT'
            elif grade_code in ('GR-03', 'GR-04'):
                sc_code = 'SC-SNR'
            else:
                sc_code = 'SC-JNR'

            # Pick notch from matching band
            band_key = {'GR-01': 'BAND-A', 'GR-02': 'BAND-B', 'GR-03': 'BAND-C', 'GR-04': 'BAND-D', 'GR-05': 'BAND-E', 'GR-06': 'BAND-F'}[grade_code]
            band_notches = [k for k in notch_keys if k.startswith(band_key)]
            notch_key = random.choice(band_notches) if band_notches else notch_keys[0]

            dob = date(1970 + (i * 2 % 30), (i % 12) + 1, min((i * 3 % 28) + 1, 28))
            doj = date(2015 + (i % 9), (i % 12) + 1, min((i % 28) + 1, 28))

            streets = ACCRA_STREETS if i % 4 != 3 else (KUMASI_STREETS if i % 4 == 1 else TAMALE_STREETS)

            user_link = None
            if i < len(user_links):
                user_link = user_links[i][0]

            emp = Employee(
                employee_number=num,
                first_name=first_name,
                last_name=last_name,
                middle_name=random.choice(GHANAIAN_LAST_NAMES) if i % 4 == 0 else '',
                date_of_birth=dob,
                gender=gender,
                marital_status=random.choice(['SINGLE', 'MARRIED', 'MARRIED']),
                nationality='Ghanaian',
                ghana_card_number=_rand_ghana_card(),
                ssnit_number=_rand_ssnit(),
                tin_number=_rand_tin(),
                personal_email=f'{first_name.lower()}.{last_name.lower()}{i}@gmail.com',
                work_email=f'{first_name.lower()}.{last_name.lower()}@gra.gov.gh',
                mobile_phone=_rand_phone(),
                residential_address=random.choice(streets),
                residential_city='Accra' if 'Accra' in streets[0] else ('Kumasi' if 'Kumasi' in streets[0] else 'Tamale'),
                residential_region=self.regions.get('GAR'),
                digital_address=_rand_digital(),
                status=statuses[i],
                employment_type=emp_types[i],
                date_of_joining=doj,
                date_of_confirmation=doj + timedelta(days=180) if statuses[i] != 'PROBATION' else None,
                division=dept.directorate.division if dept.directorate else None,
                directorate=dept.directorate,
                department=dept,
                position=position,
                grade=grade,
                work_location=loc,
                cost_center=self.cost_centers.get(list(self.cost_centers.keys())[i % len(self.cost_centers)]),
                staff_category=self.staff_categories[sc_code],
                salary_notch=self.notches[notch_key],
                user=user_link,
                tenant=org,
            )
            emp.save()
            self.employees.append(emp)

        # Set supervisors: first 3 are top level, rest report to someone senior
        for i, emp in enumerate(self.employees):
            if i >= 3:
                sup_idx = max(0, i // 5)
                emp.supervisor = self.employees[sup_idx]
                emp.save(update_fields=['supervisor'])

        self.stdout.write(f'  Employees: {len(self.employees)}')

        # Emergency Contacts (1 per employee)
        for emp in self.employees:
            if not EmergencyContact.all_objects.filter(employee=emp).exists():
                EmergencyContact.objects.create(
                    employee=emp, name=f'{random.choice(GHANAIAN_FIRST_NAMES_F)} {emp.last_name}',
                    relationship=random.choice(['SPOUSE', 'PARENT', 'SIBLING']),
                    phone_primary=_rand_phone(), is_primary=True, tenant=org,
                )
        self.stdout.write(f'  Emergency contacts: {len(self.employees)}')

        # Dependents (~50)
        dep_count = 0
        for emp in self.employees:
            if Dependent.all_objects.filter(employee=emp).exists():
                continue
            n_deps = random.randint(0, 3)
            for j in range(n_deps):
                rel = 'SPOUSE' if j == 0 and emp.marital_status == 'MARRIED' else 'CHILD'
                g = random.choice(['M', 'F'])
                names = GHANAIAN_FIRST_NAMES_M if g == 'M' else GHANAIAN_FIRST_NAMES_F
                Dependent.objects.create(
                    employee=emp, name=f'{random.choice(names)} {emp.last_name}',
                    relationship=rel, date_of_birth=date(2005 + j, random.randint(1, 12), random.randint(1, 28)),
                    gender=g, is_student=rel == 'CHILD', tenant=org,
                )
                dep_count += 1
        self.stdout.write(f'  Dependents: {dep_count}')

        # Education (~45)
        edu_count = 0
        institutions = [
            'University of Ghana', 'KNUST', 'University of Cape Coast',
            'Ashesi University', 'University for Dev. Studies', 'GIMPA',
        ]
        for emp in self.employees:
            if Education.all_objects.filter(employee=emp).exists():
                continue
            for j in range(random.randint(1, 2)):
                Education.objects.create(
                    employee=emp,
                    qualification_level=random.choice(['BACHELORS', 'MASTERS', 'HND', 'DIPLOMA', 'PHD']),
                    qualification_name=random.choice(['BSc Accounting', 'MBA', 'HND Marketing', 'MSc Finance', 'BSc IT', 'LLB']),
                    field_of_study=random.choice(['Accounting', 'Finance', 'IT', 'Law', 'Economics', 'Management']),
                    institution=random.choice(institutions),
                    start_date=date(2005 + j * 3, 9, 1),
                    end_date=date(2008 + j * 3, 7, 1),
                    grade=random.choice(['First Class', 'Second Class Upper', 'Second Class Lower', 'Pass']),
                    is_verified=random.choice([True, True, False]),
                    tenant=org,
                )
                edu_count += 1
        self.stdout.write(f'  Education records: {edu_count}')

        # Work Experience (~40)
        we_count = 0
        companies = ['Deloitte Ghana', 'KPMG', 'MTN Ghana', 'Vodafone Ghana', 'Ghana Cocoa Board', 'Bank of Ghana']
        for emp in self.employees:
            if WorkExperience.all_objects.filter(employee=emp).exists():
                continue
            for j in range(random.randint(1, 2)):
                WorkExperience.objects.create(
                    employee=emp, company_name=random.choice(companies),
                    position=random.choice(['Accountant', 'Analyst', 'Officer', 'Manager', 'Consultant']),
                    start_date=date(2010 + j * 2, 1, 1),
                    end_date=date(2012 + j * 2, 12, 31),
                    reason_for_leaving='Career growth', tenant=org,
                )
                we_count += 1
        self.stdout.write(f'  Work experience: {we_count}')

        # Certifications (~15)
        cert_count = 0
        cert_names = ['ACCA', 'CPA', 'CIMA', 'CISA', 'PMP', 'SHRM-CP']
        for emp in self.employees[:15]:
            if Certification.all_objects.filter(employee=emp).exists():
                continue
            Certification.objects.create(
                employee=emp, name=random.choice(cert_names),
                issuing_organization=random.choice(['ACCA', 'AICPA', 'PMI', 'ISACA']),
                issue_date=date(2020, random.randint(1, 12), 1),
                does_not_expire=random.choice([True, False]),
                tenant=org,
            )
            cert_count += 1
        self.stdout.write(f'  Certifications: {cert_count}')

        # Skills (~80)
        sk_count = 0
        for emp in self.employees:
            if Skill.all_objects.filter(employee=emp).exists():
                continue
            for skill_name, skill_cat in random.sample(SKILL_POOL, min(3, len(SKILL_POOL))):
                Skill.objects.create(
                    employee=emp, name=skill_name, category=skill_cat,
                    proficiency=random.choice(['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']),
                    years_of_experience=random.randint(1, 10), tenant=org,
                )
                sk_count += 1
        self.stdout.write(f'  Skills: {sk_count}')

        # Bank Accounts (1 per employee)
        bank_list = list(self.banks.values())
        branch_list = list(self.branches.values())
        for emp in self.employees:
            if BankAccount.all_objects.filter(employee=emp).exists():
                continue
            bank = random.choice(bank_list)
            matching_branches = [b for b in branch_list if b.bank == bank]
            branch = random.choice(matching_branches) if matching_branches else random.choice(branch_list)
            BankAccount.objects.create(
                employee=emp, bank=bank, branch=branch,
                account_name=f'{emp.first_name} {emp.last_name}',
                account_number=f'{random.randint(1000000000, 9999999999)}',
                account_type=random.choice(['SAVINGS', 'CURRENT']),
                is_primary=True, is_active=True, tenant=org,
            )
        self.stdout.write(f'  Bank accounts: {len(self.employees)}')

        # Employment History (HIRE record per employee)
        for emp in self.employees:
            if EmploymentHistory.all_objects.filter(employee=emp).exists():
                continue
            EmploymentHistory.objects.create(
                employee=emp, change_type='HIRE',
                effective_date=emp.date_of_joining,
                new_department=emp.department, new_position=emp.position,
                new_grade=emp.grade, reason='Initial appointment', tenant=org,
            )
        self.stdout.write(f'  Employment history: {len(self.employees)} HIRE records')

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 4 : LEAVE
    # ═══════════════════════════════════════════════════════════════════════
    def _phase4_leave(self):
        from leave.models import (
            LeaveType, LeavePolicy, LeaveBalance, LeaveRequest,
            LeavePlan, LeavePlanEntry,
            LeaveApprovalWorkflowTemplate, LeaveApprovalWorkflowLevel,
        )
        org = self.org

        # Leave Types
        lt_data = [
            ('ANN', 'Annual Leave', 21, True, 5, 'YEARLY', '#3B82F6', 'A', 1),
            ('SICK', 'Sick Leave', 10, False, 0, 'YEARLY', '#EF4444', 'A', 2),
            ('MAT', 'Maternity Leave', 84, False, 0, 'NONE', '#EC4899', 'F', 3),
            ('PAT', 'Paternity Leave', 5, False, 0, 'NONE', '#8B5CF6', 'M', 4),
            ('COMP', 'Compassionate Leave', 5, False, 0, 'NONE', '#6B7280', 'A', 5),
            ('STUDY', 'Study Leave', 30, False, 0, 'NONE', '#F59E0B', 'A', 6),
            ('SABB', 'Sabbatical Leave', 180, False, 0, 'NONE', '#10B981', 'A', 7),
            ('UNPD', 'Unpaid Leave', 30, False, 0, 'NONE', '#D97706', 'A', 8),
        ]
        self.leave_types = {}
        for code, name, days, carry, max_cf, accrual, color, gender, order in lt_data:
            lt, _ = LeaveType.all_objects.get_or_create(
                code=code,
                defaults={
                    'name': name, 'default_days': days,
                    'allow_carry_forward': carry, 'max_carry_forward_days': max_cf,
                    'accrual_type': accrual, 'color_code': color,
                    'applies_to_gender': gender, 'sort_order': order,
                    'is_paid': code != 'UNPD', 'requires_approval': True,
                    'tenant': org,
                },
            )
            self.leave_types[code] = lt
        self.stdout.write(f'  Leave Types: {len(self.leave_types)}')

        # Leave Policies (default for each type)
        for code, lt in self.leave_types.items():
            LeavePolicy.all_objects.get_or_create(
                leave_type=lt, name=f'Default {lt.name} Policy',
                defaults={
                    'entitled_days': lt.default_days,
                    'effective_from': date(2025, 1, 1),
                    'is_active': True, 'tenant': org,
                },
            )

        # Workflow Templates
        for wf_code, wf_name, loc_cat in [
            ('WF-HQ', 'Head Office Approval', 'HEAD_OFFICE'),
            ('WF-REG', 'Regional Office Approval', 'REGIONAL'),
        ]:
            wf, _ = LeaveApprovalWorkflowTemplate.all_objects.get_or_create(
                code=wf_code,
                defaults={'name': wf_name, 'location_category': loc_cat, 'max_levels': 3, 'is_active': True, 'tenant': org},
            )
            # Add levels
            for lvl, name, atype in [(1, 'Supervisor', 'SUPERVISOR'), (2, 'Department Head', 'DEPT_HEAD')]:
                LeaveApprovalWorkflowLevel.all_objects.get_or_create(
                    template=wf, level=lvl,
                    defaults={'name': name, 'approver_type': atype, 'tenant': org},
                )

        # Leave Balances (4 types × 30 employees for 2025)
        bal_count = 0
        for emp in self.employees:
            for code in ['ANN', 'SICK', 'COMP', 'STUDY']:
                lt = self.leave_types[code]
                _, created = LeaveBalance.all_objects.get_or_create(
                    employee=emp, leave_type=lt, year=2025,
                    defaults={
                        'opening_balance': Decimal('0'),
                        'earned': lt.default_days,
                        'taken': Decimal(str(random.randint(0, min(5, int(lt.default_days))))),
                        'pending': Decimal('0'),
                        'tenant': org,
                    },
                )
                if created:
                    bal_count += 1
        self.stdout.write(f'  Leave Balances: {bal_count}')

        # Leave Requests (15)
        req_count = 0
        statuses = ['APPROVED', 'APPROVED', 'APPROVED', 'PENDING', 'PENDING',
                     'REJECTED', 'DRAFT', 'APPROVED', 'APPROVED', 'APPROVED',
                     'CANCELLED', 'APPROVED', 'APPROVED', 'PENDING', 'APPROVED']
        for i in range(15):
            emp = self.employees[i % len(self.employees)]
            lt = self.leave_types[random.choice(['ANN', 'SICK', 'COMP'])]
            start = date(2025, random.randint(1, 6), random.randint(1, 20))
            days = random.randint(1, 5)
            end = start + timedelta(days=days + (days // 5) * 2)  # skip weekends roughly
            req_num = f'LR-2025-{i+1:04d}'
            _, created = LeaveRequest.all_objects.get_or_create(
                request_number=req_num,
                defaults={
                    'employee': emp, 'leave_type': lt,
                    'start_date': start, 'end_date': end,
                    'number_of_days': days, 'reason': f'Personal leave request #{i+1}',
                    'status': statuses[i],
                    'submitted_at': timezone.now() if statuses[i] != 'DRAFT' else None,
                    'tenant': org,
                },
            )
            if created:
                req_count += 1
        self.stdout.write(f'  Leave Requests: {req_count}')

        # Leave Plans (5 employees)
        for emp in self.employees[:5]:
            lp, _ = LeavePlan.all_objects.get_or_create(
                employee=emp, year=2025,
                defaults={
                    'total_planned_days': 15, 'leave_entitlement': 21,
                    'status': 'APPROVED', 'tenant': org,
                },
            )
            if not LeavePlanEntry.all_objects.filter(leave_plan=lp).exists():
                for q in range(1, 4):
                    LeavePlanEntry.objects.create(
                        leave_plan=lp, leave_type=self.leave_types['ANN'],
                        start_date=date(2025, q * 3, 10),
                        end_date=date(2025, q * 3, 14),
                        number_of_days=5, status='PLANNED',
                        quarter=q, tenant=org,
                    )
        self.stdout.write('  Leave Plans: 5')

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 5 : PAYROLL PROCESSING
    # ═══════════════════════════════════════════════════════════════════════
    def _phase5_payroll_processing(self):
        from payroll.models import (
            PayrollCalendar, PayrollPeriod, PayrollSettings, PayrollRun,
            PayrollItem, PayrollItemDetail, EmployeeSalary,
            EmployeeSalaryComponent, AdHocPayment,
        )
        org = self.org

        # Payroll Calendar 2025
        PayrollCalendar.create_year_calendar(2025)
        self.stdout.write('  Payroll Calendar 2025: 12 months')

        # Payroll Periods 2025
        PayrollPeriod.create_year_periods(2025)
        periods = {p.month: p for p in PayrollPeriod.all_objects.filter(year=2025, is_supplementary=False)}

        # Update statuses: Jan-Mar PAID, Apr COMPUTED, May-Dec OPEN
        for m in range(1, 4):
            if m in periods:
                periods[m].status = 'PAID'
                periods[m].save(update_fields=['status'])
        if 4 in periods:
            periods[4].status = 'COMPUTED'
            periods[4].save(update_fields=['status'])
        self.stdout.write('  Payroll Periods: 12 (3 PAID, 1 COMPUTED, 8 OPEN)')

        # Payroll Settings
        april_cal = PayrollCalendar.all_objects.filter(year=2025, month=4).first()
        settings_obj, _ = PayrollSettings.objects.get_or_create(pk=1)
        settings_obj.active_calendar = april_cal
        settings_obj.active_period = periods.get(4)
        settings_obj.save()

        # Employee Salaries (30)
        sal_count = 0
        active_emps = [e for e in self.employees if e.status in ('ACTIVE', 'PROBATION', 'ON_LEAVE')]
        for emp in self.employees:
            if EmployeeSalary.all_objects.filter(employee=emp, is_current=True).exists():
                continue
            notch = emp.salary_notch
            basic = notch.amount if notch else Decimal('5000')
            gross = (basic * Decimal('1.3')).quantize(Decimal('0.01'))  # +30% allowances
            es = EmployeeSalary.objects.create(
                employee=emp, basic_salary=basic, gross_salary=gross,
                effective_from=emp.date_of_joining, is_current=True,
                tenant=org,
            )
            # Components
            for comp_code, amount in [
                ('BASIC', basic),
                ('HOUSING', (basic * Decimal('0.20')).quantize(Decimal('0.01'))),
                ('TRANSPORT', Decimal('300')),
                ('MEDICAL', Decimal('200')),
            ]:
                EmployeeSalaryComponent.objects.create(
                    employee_salary=es, pay_component=self.components[comp_code],
                    amount=amount, tenant=org,
                )
            sal_count += 1
        self.stdout.write(f'  Employee Salaries: {sal_count}')

        # Payroll Runs (3 months: Jan, Feb, Mar)
        run_count = 0
        for month in [1, 2, 3]:
            period = periods.get(month)
            if not period:
                continue
            run_num = f'PR-2025{month:02d}-001'
            if PayrollRun.all_objects.filter(run_number=run_num).exists():
                continue

            run = PayrollRun.objects.create(
                payroll_period=period, run_number=run_num,
                status='PAID', total_employees=len(active_emps),
                tenant=org,
            )

            total_gross = Decimal('0')
            total_deductions = Decimal('0')
            total_net = Decimal('0')

            for emp in active_emps:
                salary = EmployeeSalary.all_objects.filter(employee=emp, is_current=True).first()
                if not salary:
                    continue
                basic = salary.basic_salary
                gross = salary.gross_salary or basic
                ssnit_ee = (basic * Decimal('0.055')).quantize(Decimal('0.01'))
                paye = (gross * Decimal('0.15')).quantize(Decimal('0.01'))  # simplified
                total_ded = ssnit_ee + paye
                net = gross - total_ded

                pi = PayrollItem.objects.create(
                    payroll_run=run, employee=emp, employee_salary=salary,
                    status='PAID', basic_salary=basic,
                    gross_earnings=gross, total_deductions=total_ded,
                    net_salary=net, taxable_income=gross,
                    paye=paye, ssnit_employee=ssnit_ee,
                    days_worked=Decimal('22'), tenant=org,
                )

                # Item details
                for comp_code, amt in [('BASIC', basic), ('HOUSING', basic * Decimal('0.2')), ('TRANSPORT', Decimal('300')), ('MEDICAL', Decimal('200'))]:
                    PayrollItemDetail.objects.create(
                        payroll_item=pi, pay_component=self.components[comp_code],
                        amount=amt.quantize(Decimal('0.01')), tenant=org,
                    )
                for comp_code, amt in [('SSNIT_T1_EE', ssnit_ee), ('PAYE', paye)]:
                    PayrollItemDetail.objects.create(
                        payroll_item=pi, pay_component=self.components[comp_code],
                        amount=amt, tenant=org,
                    )

                total_gross += gross
                total_deductions += total_ded
                total_net += net

            run.total_gross = total_gross
            run.total_deductions = total_deductions
            run.total_net = total_net
            run.total_paye = PayrollItem.all_objects.filter(payroll_run=run).values_list('paye', flat=True)
            run.total_paye = sum(PayrollItem.all_objects.filter(payroll_run=run).values_list('paye', flat=True))
            run.total_ssnit_employee = sum(PayrollItem.all_objects.filter(payroll_run=run).values_list('ssnit_employee', flat=True))
            run.save()
            run_count += 1

        self.stdout.write(f'  Payroll Runs: {run_count} (with items & details)')

        # Ad Hoc Payments (3)
        if not AdHocPayment.all_objects.filter(payment_type='BONUS').exists():
            for i in range(3):
                AdHocPayment.objects.create(
                    employee=self.employees[i],
                    pay_component=self.components['BONUS'],
                    payment_type='BONUS',
                    amount=Decimal(str(random.randint(500, 3000))),
                    description=f'Q1 2025 performance bonus',
                    status='APPROVED',
                    payroll_period=periods.get(3),
                    tenant=org,
                )
        self.stdout.write('  Ad Hoc Payments: 3')

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 6 : ERP / FINANCE  (idempotent – skips if exists)
    # ═══════════════════════════════════════════════════════════════════════
    def _phase6_erp(self):
        try:
            from finance.models import Account
            if Account.all_objects.count() > 5:
                self.stdout.write('  ERP data already seeded – skipping. Run seed_erp_data for full ERP data.')
                return
        except Exception:
            self.stdout.write('  Finance app not available – skipping ERP phase.')
            return

        from django.core.management import call_command
        try:
            call_command('seed_erp_data')
            self.stdout.write('  Delegated to seed_erp_data command.')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  seed_erp_data failed: {e}'))

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 7 : PERFORMANCE
    # ═══════════════════════════════════════════════════════════════════════
    def _phase7_performance(self):
        from performance.models import (
            RatingScale, RatingScaleLevel, Competency, GoalCategory,
            AppraisalCycle, Appraisal, Goal, CompetencyAssessment,
            DevelopmentPlan, DevelopmentActivity, PerformanceImprovementPlan,
            PIPReview, TrainingNeed, CoreValue, CoreValueAssessment,
        )
        org = self.org

        # Rating Scale
        scale, _ = RatingScale.all_objects.get_or_create(
            name='5-Point Scale', defaults={'is_active': True, 'is_default': True, 'tenant': org},
        )
        levels_data = [
            (1, 'Unsatisfactory', 0, 39),
            (2, 'Below Expectations', 40, 59),
            (3, 'Meets Expectations', 60, 74),
            (4, 'Exceeds Expectations', 75, 89),
            (5, 'Outstanding', 90, 100),
        ]
        for lvl, name, pct_min, pct_max in levels_data:
            RatingScaleLevel.all_objects.get_or_create(
                rating_scale=scale, level=lvl,
                defaults={'name': name, 'min_percentage': Decimal(str(pct_min)), 'max_percentage': Decimal(str(pct_max)), 'tenant': org},
            )

        # Competencies
        comp_data = [
            ('LEAD', 'Leadership', 'LEADERSHIP'),
            ('COMM', 'Communication', 'CORE'),
            ('PROB', 'Problem Solving', 'FUNCTIONAL'),
            ('TEAM', 'Teamwork', 'CORE'),
            ('TECH', 'Technical Expertise', 'TECHNICAL'),
            ('CUST', 'Customer Focus', 'CORE'),
            ('INNO', 'Innovation', 'FUNCTIONAL'),
            ('PLAN', 'Planning & Organization', 'FUNCTIONAL'),
        ]
        competencies = {}
        for code, name, cat in comp_data:
            c, _ = Competency.all_objects.get_or_create(
                code=code, defaults={'name': name, 'description': f'{name} competency assessment.', 'category': cat, 'is_active': True, 'tenant': org},
            )
            competencies[code] = c

        # Core Values
        cv_data = [
            ('CV-INT', 'Integrity', 'Uphold ethical standards in all actions', 1),
            ('CV-EXC', 'Excellence', 'Strive for the highest quality in work delivery', 2),
            ('CV-ACC', 'Accountability', 'Take ownership of decisions and outcomes', 3),
            ('CV-SRV', 'Service', 'Put stakeholder needs at the forefront', 4),
        ]
        core_values = {}
        for code, name, desc, order in cv_data:
            cv, _ = CoreValue.all_objects.get_or_create(
                code=code,
                defaults={'name': name, 'description': desc, 'sort_order': order, 'tenant': org},
            )
            core_values[code] = cv

        # Goal Categories
        gc_data = [
            ('Revenue Target', Decimal('40')),
            ('Compliance', Decimal('25')),
            ('Professional Development', Decimal('20')),
            ('Innovation', Decimal('15')),
        ]
        goal_cats = {}
        for name, weight in gc_data:
            gc, _ = GoalCategory.all_objects.get_or_create(
                name=name, defaults={'weight': weight, 'tenant': org},
            )
            goal_cats[name] = gc

        # Appraisal Cycles (2024 COMPLETED, 2025 ACTIVE)
        cycles = {}
        for yr, status, is_active in [(2024, 'COMPLETED', False), (2025, 'ACTIVE', True)]:
            ac, _ = AppraisalCycle.all_objects.get_or_create(
                year=yr,
                defaults={
                    'name': f'Performance Appraisal {yr}', 'start_date': date(yr, 1, 1),
                    'end_date': date(yr, 12, 31), 'status': status, 'is_active': is_active,
                    'goal_setting_start': date(yr, 1, 1), 'goal_setting_end': date(yr, 1, 31),
                    'mid_year_start': date(yr, 6, 1), 'mid_year_end': date(yr, 6, 30),
                    'year_end_start': date(yr, 11, 1), 'year_end_end': date(yr, 12, 15),
                    'objectives_weight': Decimal('60'), 'competencies_weight': Decimal('20'),
                    'values_weight': Decimal('20'),
                    'tenant': org,
                },
            )
            cycles[yr] = ac
        self.stdout.write(f'  Appraisal Cycles: {len(cycles)}')

        # Appraisals (20 for 2025 cycle, first 20 employees)
        appraisal_count = 0
        active_emps = [e for e in self.employees if e.status == 'ACTIVE'][:20]
        for emp in active_emps:
            cycle = cycles[2025]
            manager = emp.supervisor
            appr, created = Appraisal.all_objects.get_or_create(
                employee=emp, appraisal_cycle=cycle,
                defaults={
                    'manager': manager, 'status': random.choice(['GOAL_SETTING', 'IN_PROGRESS', 'SELF_ASSESSMENT']),
                    'overall_self_rating': Decimal(str(random.randint(60, 95))),
                    'tenant': org,
                },
            )
            if not created:
                continue
            appraisal_count += 1

            # Goals (2 per appraisal)
            for j, (cat_name, gc) in enumerate(list(goal_cats.items())[:2]):
                Goal.objects.create(
                    appraisal=appr, category=gc,
                    title=f'{cat_name} Goal {j+1}',
                    description=f'Achieve {cat_name.lower()} targets for Q1-Q4 2025',
                    weight=Decimal('50'), target_date=date(2025, 12, 31),
                    progress_percentage=random.randint(10, 80),
                    self_rating=random.randint(3, 5),
                    tenant=org,
                )

            # Competency Assessments
            for code, comp in list(competencies.items())[:4]:
                CompetencyAssessment.objects.create(
                    appraisal=appr, competency=comp,
                    self_rating=random.randint(3, 5),
                    manager_rating=random.randint(2, 5) if manager else None,
                    tenant=org,
                )

            # Core Value Assessments
            for cv_code, cv in core_values.items():
                CoreValueAssessment.objects.create(
                    appraisal=appr, core_value=cv,
                    self_rating=random.randint(3, 5),
                    manager_rating=random.randint(3, 5) if manager else None,
                    tenant=org,
                )

        self.stdout.write(f'  Appraisals: {appraisal_count} (with goals, competencies, core values)')

        # Development Plans (5)
        for emp in self.employees[:5]:
            dp, created = DevelopmentPlan.all_objects.get_or_create(
                employee=emp, title=f'{emp.first_name} Development Plan 2025',
                defaults={
                    'career_aspiration': 'Senior Management role within 3 years',
                    'start_date': date(2025, 1, 1), 'target_completion': date(2025, 12, 31),
                    'tenant': org,
                },
            )
            if created:
                DevelopmentActivity.objects.create(
                    development_plan=dp, activity_type='TRAINING',
                    title='Core Skills Training',
                    competency=list(competencies.values())[0],
                    target_date=date(2025, 6, 30),
                    tenant=org,
                )

        # PIPs (2)
        for emp in self.employees[25:27]:
            PerformanceImprovementPlan.all_objects.get_or_create(
                employee=emp,
                defaults={
                    'pip_number': f'PIP-2025-{emp.employee_number[-3:]}',
                    'reason': 'Below expected performance in Q4 2024',
                    'performance_issues': 'Consistently missed deadlines and quality targets.',
                    'start_date': date(2025, 1, 15), 'end_date': date(2025, 4, 15),
                    'objectives': 'Achieve minimum 60% on all KPIs',
                    'success_criteria': 'Meet all assigned deadlines; achieve 60%+ on quarterly review.',
                    'manager': emp.supervisor, 'status': 'ACTIVE',
                    'tenant': org,
                },
            )

        # Training Needs (8)
        tn_count = 0
        training_titles = [
            'Tax Administration Workshop', 'Leadership Development',
            'Excel Advanced', 'Data Analytics', 'Project Management',
            'Customer Service Excellence', 'Anti-Money Laundering', 'IFRS Update',
        ]
        for i, title in enumerate(training_titles):
            emp = self.employees[i % len(self.employees)]
            _, created = TrainingNeed.all_objects.get_or_create(
                employee=emp, title=title,
                defaults={
                    'description': f'Training need identified: {title}',
                    'training_type': random.choice(['TRAINING', 'WORKSHOP', 'ONLINE', 'CERTIFICATION']),
                    'priority': random.choice(['HIGH', 'MEDIUM', 'LOW']),
                    'tenant': org,
                },
            )
            if created:
                tn_count += 1
        self.stdout.write(f'  Development Plans: 5, PIPs: 2, Training Needs: {tn_count}')

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 8 : BENEFITS & LOANS
    # ═══════════════════════════════════════════════════════════════════════
    def _phase8_benefits(self):
        from benefits.models import (
            LoanType, LoanAccount, LoanSchedule,
            BenefitType, BenefitEnrollment, BenefitClaim,
            ExpenseType, ExpenseClaim, ExpenseClaimItem,
            FuneralGrantType, ThirdPartyLender, ThirdPartyDeduction,
            ProfessionalSubscriptionType, ProfessionalSubscription,
        )
        org = self.org

        # Loan Types
        loan_types_data = [
            ('LN-SAL', 'Salary Advance', Decimal('10000'), 6, Decimal('0')),
            ('LN-CAR', 'Car Loan', Decimal('150000'), 60, Decimal('12')),
            ('LN-HSE', 'Housing Loan', Decimal('500000'), 120, Decimal('15')),
            ('LN-PER', 'Personal Loan', Decimal('50000'), 24, Decimal('18')),
        ]
        self.loan_types = {}
        for code, name, max_amt, tenure, rate in loan_types_data:
            lt, _ = LoanType.all_objects.get_or_create(
                code=code,
                defaults={
                    'name': name, 'max_amount': max_amt,
                    'max_tenure_months': tenure, 'interest_rate': rate,
                    'interest_type': 'SIMPLE' if rate == 0 else 'REDUCING',
                    'min_service_months': 6, 'tenant': org,
                },
            )
            self.loan_types[code] = lt

        # Loan Accounts (6)
        loan_count = 0
        loan_configs = [
            (0, 'LN-SAL', Decimal('5000'), 3, 'ACTIVE'),
            (1, 'LN-CAR', Decimal('80000'), 48, 'ACTIVE'),
            (2, 'LN-HSE', Decimal('300000'), 120, 'DISBURSED'),
            (5, 'LN-PER', Decimal('20000'), 12, 'ACTIVE'),
            (10, 'LN-SAL', Decimal('8000'), 6, 'COMPLETED'),
            (15, 'LN-PER', Decimal('30000'), 18, 'ACTIVE'),
        ]
        for emp_idx, lt_code, amount, tenure, status in loan_configs:
            emp = self.employees[emp_idx]
            lt = self.loan_types[lt_code]
            ln_num = f'LN-{emp.employee_number[-3:]}-{lt_code[-3:]}'
            loan, created = LoanAccount.all_objects.get_or_create(
                loan_number=ln_num,
                defaults={
                    'employee': emp, 'loan_type': lt,
                    'principal_amount': amount, 'interest_rate': lt.interest_rate,
                    'tenure_months': tenure, 'status': status,
                    'disbursed_amount': amount if status != 'DRAFT' else Decimal('0'),
                    'outstanding_balance': amount * Decimal('0.7') if status == 'ACTIVE' else Decimal('0'),
                    'disbursement_date': date(2024, 6, 1),
                    'first_deduction_date': date(2024, 7, 1),
                    'monthly_installment': (amount / tenure).quantize(Decimal('0.01')),
                    'tenant': org,
                },
            )
            if created:
                loan_count += 1
                # Schedule (first 6 installments)
                principal_per_month = (amount / tenure).quantize(Decimal('0.01'))
                interest_per_month = (amount * lt.interest_rate / 1200).quantize(Decimal('0.01'))
                for m in range(1, min(7, tenure + 1)):
                    opening = amount - (principal_per_month * (m - 1))
                    closing = opening - principal_per_month
                    LoanSchedule.objects.create(
                        loan_account=loan, installment_number=m,
                        due_date=date(2024, 6 + m, 1) if 6 + m <= 12 else date(2025, (6 + m) - 12, 1),
                        principal_amount=principal_per_month,
                        interest_amount=interest_per_month,
                        total_amount=(principal_per_month + interest_per_month),
                        opening_balance=opening.quantize(Decimal('0.01')),
                        closing_balance=max(closing, Decimal('0')).quantize(Decimal('0.01')),
                        tenant=org,
                    )
        self.stdout.write(f'  Loan Accounts: {loan_count}')

        # Benefit Types
        bt_data = [
            ('BT-MED', 'Medical Insurance', 'MEDICAL', Decimal('10000')),
            ('BT-LIF', 'Group Life Insurance', 'INSURANCE', Decimal('0')),
            ('BT-GYM', 'Gym Membership', 'OTHER', Decimal('2400')),
            ('BT-EDU', 'Education Assistance', 'EDUCATION', Decimal('15000')),
            ('BT-MBL', 'Mobile Allowance', 'OTHER', Decimal('3600')),
        ]
        benefit_types = {}
        for code, name, cat, limit in bt_data:
            bt, _ = BenefitType.all_objects.get_or_create(
                code=code,
                defaults={'name': name, 'category': cat, 'annual_limit': limit, 'tenant': org},
            )
            benefit_types[code] = bt

        # Benefit Enrollments (15)
        enr_count = 0
        for i in range(15):
            emp = self.employees[i]
            bt = list(benefit_types.values())[i % len(benefit_types)]
            _, created = BenefitEnrollment.all_objects.get_or_create(
                employee=emp, benefit_type=bt,
                defaults={'enrollment_date': date(2025, 1, 1), 'tenant': org},
            )
            if created:
                enr_count += 1
        self.stdout.write(f'  Benefit Enrollments: {enr_count}')

        # Benefit Claims (5)
        for i in range(5):
            emp = self.employees[i]
            bt = benefit_types['BT-MED']
            claim_dt = date(2025, random.randint(1, 4), random.randint(1, 28))
            BenefitClaim.all_objects.get_or_create(
                claim_number=f'BC-2025-{i+1:04d}',
                defaults={
                    'employee': emp, 'benefit_type': bt,
                    'claim_date': claim_dt,
                    'expense_date': claim_dt,
                    'claimed_amount': Decimal(str(random.randint(200, 2000))),
                    'description': 'Medical expense claim for consultation and medication.',
                    'status': random.choice(['SUBMITTED', 'APPROVED', 'APPROVED']),
                    'tenant': org,
                },
            )

        # Expense Types
        et_data = [
            ('ET-TRV', 'Travel', 'TRAVEL', Decimal('5000')),
            ('ET-MTG', 'Meals & Entertainment', 'MEALS', Decimal('500')),
            ('ET-OFF', 'Office Supplies', 'OFFICE', Decimal('1000')),
            ('ET-TEL', 'Telephone', 'COMMUNICATION', Decimal('300')),
        ]
        expense_types = {}
        for code, name, cat, max_amt in et_data:
            et, _ = ExpenseType.all_objects.get_or_create(
                code=code,
                defaults={'name': name, 'category': cat, 'max_amount': max_amt, 'tenant': org},
            )
            expense_types[code] = et

        # Expense Claims (5)
        for i in range(5):
            emp = self.employees[i + 5]
            claimed = Decimal(str(random.randint(500, 3000)))
            ec, created = ExpenseClaim.all_objects.get_or_create(
                claim_number=f'EC-2025-{i+1:04d}',
                defaults={
                    'employee': emp, 'purpose': f'Business trip to {random.choice(["Kumasi", "Tamale", "Cape Coast"])}',
                    'total_claimed': claimed,
                    'status': random.choice(['SUBMITTED', 'APPROVED']),
                    'tenant': org,
                },
            )
            if created:
                ExpenseClaimItem.objects.create(
                    expense_claim=ec,
                    expense_type=random.choice(list(expense_types.values())),
                    description='Hotel and transport',
                    quantity=Decimal('1'),
                    unit_amount=claimed,
                    claimed_amount=claimed,
                    expense_date=date(2025, 3, random.randint(1, 28)),
                    tenant=org,
                )

        # Funeral Grant Types
        FuneralGrantType.all_objects.get_or_create(
            beneficiary_type='SELF',
            defaults={'grant_amount': Decimal('5000'), 'max_occurrences': 1, 'tenant': org},
        )
        FuneralGrantType.all_objects.get_or_create(
            beneficiary_type='SPOUSE',
            defaults={'grant_amount': Decimal('3000'), 'max_occurrences': 1, 'tenant': org},
        )

        # Third Party Lenders
        lender_data = [
            ('TPL-CU', 'GRA Credit Union', 'CREDIT_UNION'),
            ('TPL-SL', 'Student Loan Trust Fund', 'STUDENT_LOAN'),
            ('TPL-INS', 'Star Assurance', 'INSURANCE'),
        ]
        lenders = {}
        for code, name, ltype in lender_data:
            l, _ = ThirdPartyLender.all_objects.get_or_create(
                code=code, defaults={'name': name, 'lender_type': ltype, 'tenant': org},
            )
            lenders[code] = l

        # Third Party Deductions (4)
        for i in range(4):
            emp = self.employees[i + 10]
            lender = list(lenders.values())[i % len(lenders)]
            ThirdPartyDeduction.all_objects.get_or_create(
                deduction_number=f'TPD-{emp.employee_number[-3:]}-{i+1}',
                defaults={
                    'employee': emp, 'lender': lender,
                    'deduction_type': 'FIXED',
                    'deduction_amount': Decimal(str(random.randint(100, 500))),
                    'start_date': date(2025, 1, 1),
                    'status': 'ACTIVE', 'tenant': org,
                },
            )

        # Professional Subscription Types
        pst_data = [
            ('PST-ICAG', 'ICAG Membership', Decimal('2000')),
            ('PST-ACCA', 'ACCA Membership', Decimal('3000')),
            ('PST-IIA', 'IIA Membership', Decimal('1500')),
        ]
        pst_types = {}
        for code, name, max_amt in pst_data:
            ps, _ = ProfessionalSubscriptionType.all_objects.get_or_create(
                code=code, defaults={'name': name, 'max_annual_amount': max_amt, 'tenant': org},
            )
            pst_types[code] = ps

        # Professional Subscriptions (5)
        for i in range(5):
            emp = self.employees[i]
            ps_type = list(pst_types.values())[i % len(pst_types)]
            ProfessionalSubscription.all_objects.get_or_create(
                claim_number=f'PS-2025-{i+1:04d}',
                defaults={
                    'employee': emp, 'subscription_type': ps_type,
                    'claim_year': 2025,
                    'professional_body': ps_type.name.replace(' Membership', ''),
                    'membership_number': f'MEM-{random.randint(10000, 99999)}',
                    'subscription_period_start': date(2025, 1, 1),
                    'subscription_period_end': date(2025, 12, 31),
                    'claimed_amount': Decimal(str(random.randint(800, 2500))),
                    'tenant': org,
                },
            )
        self.stdout.write('  Benefits, expenses, funeral grants, subscriptions created.')

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 9 : RECRUITMENT
    # ═══════════════════════════════════════════════════════════════════════
    def _phase9_recruitment(self):
        from recruitment.models import (
            Vacancy, Applicant, Interview, InterviewFeedback, Reference, JobOffer,
        )
        org = self.org

        # Vacancies (5)
        vac_data = [
            ('VAC-2025-001', 'POS-ROFF', 'DEP-MTO', 'Revenue Officer', 2, 'PUBLISHED'),
            ('VAC-2025-002', 'POS-ACCT', 'DEP-ACC', 'Accountant', 1, 'PUBLISHED'),
            ('VAC-2025-003', 'POS-ITAN', 'DEP-HRM', 'IT Analyst', 1, 'PUBLISHED'),
            ('VAC-2025-004', 'POS-CLRK', 'DEP-PRO', 'Administrative Clerk', 3, 'CLOSED'),
            ('VAC-2025-005', 'POS-AUDT', 'DEP-IA', 'Internal Auditor', 1, 'DRAFT'),
        ]
        vacancies = {}
        for vac_num, pos_code, dep_code, title, count, status in vac_data:
            v, _ = Vacancy.all_objects.get_or_create(
                vacancy_number=vac_num,
                defaults={
                    'position': self.positions[pos_code],
                    'department': self.departments[dep_code],
                    'grade': self.positions[pos_code].grade,
                    'work_location': self.locations['LOC-HQ'],
                    'number_of_positions': count,
                    'job_title': title, 'job_description': f'{title} role at GRA.',
                    'requirements': 'Minimum BSc degree, 2+ years experience.',
                    'status': status,
                    'publish_date': date(2025, 2, 1) if status == 'PUBLISHED' else None,
                    'closing_date': date(2025, 4, 30) if status != 'DRAFT' else None,
                    'salary_range_min': Decimal('5000'), 'salary_range_max': Decimal('12000'),
                    'tenant': org,
                },
            )
            vacancies[vac_num] = v
        self.stdout.write(f'  Vacancies: {len(vacancies)}')

        # Applicants (15)
        applicant_statuses = [
            'NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'INTERVIEW',
            'REFERENCE_CHECK', 'OFFER', 'HIRED', 'REJECTED', 'REJECTED',
            'NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'WITHDRAWN',
        ]
        applicants = []
        for i in range(15):
            gender = 'M' if i % 2 == 0 else 'F'
            names = GHANAIAN_FIRST_NAMES_M if gender == 'M' else GHANAIAN_FIRST_NAMES_F
            first = names[i % len(names)]
            last = GHANAIAN_LAST_NAMES[(i + 10) % len(GHANAIAN_LAST_NAMES)]
            vac = list(vacancies.values())[i % len(vacancies)]
            app_num = f'APP-2025-{i+1:04d}'

            app, created = Applicant.all_objects.get_or_create(
                applicant_number=app_num,
                defaults={
                    'vacancy': vac, 'first_name': first, 'last_name': last,
                    'email': f'{first.lower()}.{last.lower()}{i}@email.com',
                    'phone': _rand_phone(), 'gender': gender,
                    'highest_education': random.choice(['BSc', 'MSc', 'HND', 'MBA']),
                    'institution': random.choice(['University of Ghana', 'KNUST', 'UCC']),
                    'years_of_experience': random.randint(1, 10),
                    'current_salary': Decimal(str(random.randint(3000, 10000))),
                    'expected_salary': Decimal(str(random.randint(5000, 15000))),
                    'status': applicant_statuses[i],
                    'source': random.choice(['WEBSITE', 'LINKEDIN', 'REFERRAL']),
                    'tenant': org,
                },
            )
            applicants.append(app)
        self.stdout.write(f'  Applicants: {len(applicants)}')

        # Interviews (8)
        interview_apps = [a for a in applicants if a.status in ('INTERVIEW', 'REFERENCE_CHECK', 'OFFER', 'HIRED')][:8]
        interviews = []
        for i, app in enumerate(interview_apps):
            intv, created = Interview.all_objects.get_or_create(
                applicant=app, round_number=1,
                defaults={
                    'interview_type': random.choice(['PHONE', 'IN_PERSON', 'VIDEO']),
                    'scheduled_date': date(2025, 3, 10 + i),
                    'scheduled_time': time(10, 0),
                    'location': 'GRA Head Office, Conference Room A',
                    'status': 'COMPLETED' if app.status != 'INTERVIEW' else 'SCHEDULED',
                    'result': 'PASSED' if app.status in ('REFERENCE_CHECK', 'OFFER', 'HIRED') else '',
                    'tenant': org,
                },
            )
            interviews.append(intv)
        self.stdout.write(f'  Interviews: {len(interviews)}')

        # Interview Feedback (2 per interview)
        fb_count = 0
        for intv in interviews:
            if InterviewFeedback.all_objects.filter(interview=intv).exists():
                continue
            for j in range(2):
                interviewer = self.employees[j]
                InterviewFeedback.objects.create(
                    interview=intv, interviewer=interviewer,
                    technical_skills=random.randint(3, 5),
                    communication=random.randint(3, 5),
                    problem_solving=random.randint(3, 5),
                    cultural_fit=random.randint(3, 5),
                    overall_rating=random.randint(3, 5),
                    strengths='Strong analytical skills, good communicator.',
                    weaknesses='Could improve on technical depth.',
                    recommendation=random.choice(['STRONGLY_RECOMMEND', 'RECOMMEND', 'RESERVATIONS']),
                    tenant=org,
                )
                fb_count += 1
        self.stdout.write(f'  Interview Feedback: {fb_count}')

        # References (10)
        ref_apps = applicants[:10]
        for i, app in enumerate(ref_apps):
            Reference.all_objects.get_or_create(
                applicant=app, name=f'Ref-{random.choice(GHANAIAN_FIRST_NAMES_M)} {random.choice(GHANAIAN_LAST_NAMES)}',
                defaults={
                    'relationship': random.choice(['Former Manager', 'Colleague', 'Professor']),
                    'company': random.choice(['Deloitte', 'PwC', 'Ernst & Young', 'Bank of Ghana']),
                    'position': 'Senior Manager',
                    'email': f'ref{i}@company.com', 'phone': _rand_phone(),
                    'status': random.choice(['PENDING', 'COMPLETED', 'COMPLETED']),
                    'tenant': org,
                },
            )

        # Job Offers (3)
        offer_apps = [a for a in applicants if a.status in ('OFFER', 'HIRED')][:3]
        for i, app in enumerate(offer_apps):
            basic = Decimal(str(random.randint(6000, 12000)))
            JobOffer.all_objects.get_or_create(
                offer_number=f'JO-2025-{i+1:04d}',
                defaults={
                    'applicant': app, 'vacancy': app.vacancy,
                    'position': app.vacancy.position,
                    'department': app.vacancy.department,
                    'basic_salary': basic,
                    'total_compensation': basic + Decimal('2000'),
                    'offer_date': date(2025, 4, 1),
                    'response_deadline': date(2025, 4, 15),
                    'proposed_start_date': date(2025, 5, 1),
                    'status': 'ACCEPTED' if app.status == 'HIRED' else 'PENDING_APPROVAL',
                    'tenant': org,
                },
            )
        self.stdout.write(f'  References: {len(ref_apps)}, Job Offers: {len(offer_apps)}')

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 10 : TRAINING
    # ═══════════════════════════════════════════════════════════════════════
    def _phase10_training(self):
        try:
            from training.models import (
                TrainingProgram, TrainingSession, TrainingEnrollment, PostTrainingReport,
            )
        except ImportError:
            self.stdout.write('  Training app not available – skipping.')
            return

        org = self.org

        # Training Programs (6)
        prog_data = [
            ('TP-TAX', 'Tax Administration Fundamentals', 'INTERNAL', 'COMPLIANCE', 40),
            ('TP-LEAD', 'Leadership Development Program', 'EXTERNAL', 'LEADERSHIP', 80),
            ('TP-EXCEL', 'Advanced Excel for Finance', 'ONLINE', 'TECHNICAL', 24),
            ('TP-DATA', 'Data Analytics with Python', 'ONLINE', 'TECHNICAL', 40),
            ('TP-AML', 'Anti-Money Laundering', 'INTERNAL', 'COMPLIANCE', 16),
            ('TP-PROJ', 'Project Management Professional', 'EXTERNAL', 'TECHNICAL', 120),
        ]
        programs = {}
        for code, name, ttype, cat, hours in prog_data:
            p, _ = TrainingProgram.all_objects.get_or_create(
                code=code,
                defaults={
                    'name': name, 'training_type': ttype, 'category': cat,
                    'duration_hours': Decimal(str(hours)), 'is_active': True, 'tenant': org,
                },
            )
            programs[code] = p

        # Training Sessions (8)
        sessions = []
        session_configs = [
            ('TP-TAX', date(2025, 3, 10), date(2025, 3, 14), 'COMPLETED'),
            ('TP-TAX', date(2025, 6, 2), date(2025, 6, 6), 'SCHEDULED'),
            ('TP-LEAD', date(2025, 4, 1), date(2025, 4, 12), 'IN_PROGRESS'),
            ('TP-EXCEL', date(2025, 2, 15), date(2025, 2, 17), 'COMPLETED'),
            ('TP-DATA', date(2025, 5, 5), date(2025, 5, 9), 'SCHEDULED'),
            ('TP-AML', date(2025, 1, 20), date(2025, 1, 21), 'COMPLETED'),
            ('TP-PROJ', date(2025, 7, 1), date(2025, 7, 15), 'SCHEDULED'),
            ('TP-EXCEL', date(2025, 8, 4), date(2025, 8, 6), 'SCHEDULED'),
        ]
        for i, (prog_code, start, end, status) in enumerate(session_configs):
            sess, _ = TrainingSession.all_objects.get_or_create(
                program=programs[prog_code], start_date=start,
                defaults={
                    'title': f'{programs[prog_code].name} - Session {i+1}',
                    'end_date': end, 'status': status,
                    'venue': 'GRA Training Centre' if i % 2 == 0 else 'Online',
                    'max_participants': 20, 'tenant': org,
                },
            )
            sessions.append(sess)
        self.stdout.write(f'  Training Programs: {len(programs)}, Sessions: {len(sessions)}')

        # Training Enrollments (30)
        enr_count = 0
        for i, emp in enumerate(self.employees):
            sess = sessions[i % len(sessions)]
            _, created = TrainingEnrollment.all_objects.get_or_create(
                employee=emp, session=sess,
                defaults={
                    'status': 'COMPLETED' if sess.status == 'COMPLETED' else 'ENROLLED',
                    'tenant': org,
                },
            )
            if created:
                enr_count += 1
        self.stdout.write(f'  Training Enrollments: {enr_count}')

        # Post-Training Reports (10 for completed sessions)
        completed_enrollments = TrainingEnrollment.all_objects.filter(status='COMPLETED')[:10]
        rpt_count = 0
        for enr in completed_enrollments:
            _, created = PostTrainingReport.all_objects.get_or_create(
                enrollment=enr,
                defaults={
                    'overall_rating': random.randint(3, 5),
                    'key_learnings': 'Good understanding of core concepts and frameworks.',
                    'skills_acquired': 'Improved analytical and practical skills.',
                    'knowledge_application': 'Can apply techniques learned to daily tasks.',
                    'action_plan': 'Will implement learned skills within 30 days.',
                    'tenant': org,
                },
            )
            if created:
                rpt_count += 1
        self.stdout.write(f'  Post-Training Reports: {rpt_count}')

    # ═══════════════════════════════════════════════════════════════════════
    # PHASE 11 : DISCIPLINE & GRIEVANCES
    # ═══════════════════════════════════════════════════════════════════════
    def _phase11_discipline(self):
        from discipline.models import (
            MisconductCategory, DisciplinaryCase, DisciplinaryAction,
            DisciplinaryHearing, GrievanceCategory, Grievance,
        )
        org = self.org

        # Misconduct Categories
        mc_data = [
            ('MC-ABS', 'Absenteeism', 'MINOR', 'Persistent unauthorized absence from work.'),
            ('MC-INSU', 'Insubordination', 'MODERATE', 'Refusal to follow reasonable instructions.'),
            ('MC-THFT', 'Theft/Fraud', 'GROSS', 'Stealing or misappropriation of funds.'),
            ('MC-HARA', 'Harassment', 'MAJOR', 'Workplace bullying or harassment.'),
            ('MC-NEGL', 'Negligence', 'MODERATE', 'Failure to exercise due care in duties.'),
        ]
        mc_cats = {}
        for code, name, severity, desc in mc_data:
            mc, _ = MisconductCategory.all_objects.get_or_create(
                code=code, defaults={'name': name, 'severity': severity, 'description': desc, 'tenant': org},
            )
            mc_cats[code] = mc

        # Disciplinary Cases (3)
        case_data = [
            ('DC-2025-001', 20, 'MC-ABS', 'UNDER_INVESTIGATION'),
            ('DC-2025-002', 22, 'MC-INSU', 'DECISION_ISSUED'),
            ('DC-2025-003', 25, 'MC-NEGL', 'SHOW_CAUSE_ISSUED'),
        ]
        cases = {}
        for case_num, emp_idx, mc_code, status in case_data:
            emp = self.employees[emp_idx]
            c, created = DisciplinaryCase.all_objects.get_or_create(
                case_number=case_num,
                defaults={
                    'employee': emp, 'misconduct_category': mc_cats[mc_code],
                    'incident_date': date(2025, 2, random.randint(1, 28)),
                    'incident_description': f'Incident related to {mc_cats[mc_code].name.lower()}.',
                    'reported_date': date(2025, 2, random.randint(1, 28)),
                    'reported_by': self.employees[0],
                    'status': status, 'tenant': org,
                },
            )
            cases[case_num] = c

        # Disciplinary Actions (for case #2 which has a decision)
        if 'DC-2025-002' in cases:
            DisciplinaryAction.all_objects.get_or_create(
                case=cases['DC-2025-002'], action_type='WRITTEN_WARNING',
                defaults={
                    'action_date': date(2025, 3, 15), 'effective_date': date(2025, 3, 15),
                    'description': 'Written warning issued for insubordination.',
                    'tenant': org,
                },
            )

        # Hearings (2)
        for case_num in ['DC-2025-001', 'DC-2025-002']:
            if case_num in cases:
                DisciplinaryHearing.all_objects.get_or_create(
                    case=cases[case_num], hearing_number=1,
                    defaults={
                        'scheduled_date': date(2025, 3, 20),
                        'scheduled_time': time(10, 0),
                        'location': 'GRA HR Conference Room',
                        'status': 'COMPLETED' if case_num == 'DC-2025-002' else 'SCHEDULED',
                        'tenant': org,
                    },
                )
        self.stdout.write(f'  Disciplinary Cases: {len(cases)}, Actions: 1, Hearings: 2')

        # Grievance Categories
        gc_data = [
            ('GC-WRK', 'Working Conditions', 'Issues related to workplace environment.'),
            ('GC-PAY', 'Pay & Benefits', 'Disputes about compensation or benefits.'),
            ('GC-MGT', 'Management Conduct', 'Concerns about supervisory behavior.'),
            ('GC-POL', 'Policy Application', 'Disputes about policy interpretation.'),
        ]
        g_cats = {}
        for code, name, desc in gc_data:
            gc, _ = GrievanceCategory.all_objects.get_or_create(
                code=code, defaults={'name': name, 'description': desc, 'tenant': org},
            )
            g_cats[code] = gc

        # Grievances (3)
        grv_data = [
            ('GRV-2025-001', 8, 'GC-PAY', 'Salary discrepancy', 'SUBMITTED'),
            ('GRV-2025-002', 12, 'GC-WRK', 'Office equipment not provided', 'UNDER_INVESTIGATION'),
            ('GRV-2025-003', 18, 'GC-MGT', 'Unfair task assignment', 'RESOLVED'),
        ]
        for grv_num, emp_idx, gc_code, subject, status in grv_data:
            Grievance.all_objects.get_or_create(
                grievance_number=grv_num,
                defaults={
                    'employee': self.employees[emp_idx],
                    'category': g_cats[gc_code],
                    'subject': subject,
                    'description': f'Employee grievance regarding {subject.lower()}.',
                    'incident_date': date(2025, 2, random.randint(1, 15)),
                    'submitted_date': date(2025, 2, random.randint(16, 28)),
                    'status': status, 'priority': 'MEDIUM',
                    'tenant': org,
                },
            )
        self.stdout.write(f'  Grievance Categories: {len(g_cats)}, Grievances: 3')
