"""
Management command: Clear all recruitment data and seed a full recruitment cycle.

Creates realistic data showing the complete journey from vacancy creation
through to employee onboarding, including:
  - Vacancies at various stages
  - Applicants progressing through every status
  - Shortlist criteria, runs, and results
  - Interviews with panels, feedback, and scoring sheets
  - Reference checks
  - Job offers through approval → acceptance
  - Final employee records for hired candidates
"""
import random
from datetime import date, time, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.utils import timezone


# ── Ghanaian name pools ────────────────────────────────────────
MALE_NAMES = [
    'Kwame', 'Kofi', 'Kwasi', 'Yaw', 'Kojo', 'Kweku', 'Nana',
    'Ebo', 'Fiifi', 'Papa', 'Ofori', 'Ato', 'Mensah', 'Emmanuel',
    'Daniel', 'Isaac', 'Samuel', 'Michael', 'Joseph', 'Benjamin',
]
FEMALE_NAMES = [
    'Ama', 'Akua', 'Abena', 'Yaa', 'Adjoa', 'Afua', 'Efua',
    'Adwoa', 'Nana', 'Akosua', 'Esi', 'Araba', 'Ekua', 'Aba',
    'Grace', 'Priscilla', 'Joyce', 'Patience', 'Comfort', 'Millicent',
]
LAST_NAMES = [
    'Asante', 'Mensah', 'Osei', 'Boateng', 'Agyemang', 'Owusu',
    'Appiah', 'Amoah', 'Dartey', 'Quaye', 'Tetteh', 'Adjei',
    'Frimpong', 'Antwi', 'Sarpong', 'Bonsu', 'Gyasi', 'Nkrumah',
    'Adu', 'Ankrah', 'Baah', 'Debrah', 'Edusei', 'Forson',
]
INSTITUTIONS = [
    'University of Ghana', 'KNUST', 'University of Cape Coast',
    'Ashesi University', 'GIMPA', 'University of Education, Winneba',
    'Central University', 'Ghana Institute of Management',
]
STREETS = [
    '14 Independence Ave, Accra', '23 Kwame Nkrumah Circle, Accra',
    '7 Oxford Street, Osu, Accra', '45 Liberation Road, Accra',
    '12 Cantonments Rd, Accra', '31 Ring Road Central, Accra',
    '9 Achimota Mile 7, Accra', '55 East Legon, Accra',
]
REF_COMPANIES = [
    'Deloitte Ghana', 'PwC Ghana', 'Ernst & Young Ghana',
    'KPMG Ghana', 'Bank of Ghana', 'GCB Bank', 'Ecobank Ghana',
    'MTN Ghana', 'Vodafone Ghana', 'Stanbic Bank Ghana',
]


def _rand_phone():
    return f'+233{random.choice(["20","24","26","27","50","54","55","57"])}{random.randint(1000000,9999999)}'


class Command(BaseCommand):
    help = 'Clear all recruitment data and seed a complete recruitment cycle'

    def add_arguments(self, parser):
        parser.add_argument('--no-clear', action='store_true',
                            help='Skip clearing existing data')

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('═' * 60))
        self.stdout.write(self.style.SUCCESS(' RECRUITMENT CYCLE SEEDER'))
        self.stdout.write(self.style.SUCCESS('═' * 60))

        self._load_dependencies()

        if not options['no_clear']:
            self._clear_recruitment_data()

        self._create_vacancies()
        self._create_applicants()
        self._create_shortlist_criteria_and_runs()
        self._create_interviews()
        self._create_scoring_templates_and_sheets()
        self._create_references()
        self._create_job_offers()
        self._hire_and_create_employees()

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('═' * 60))
        self.stdout.write(self.style.SUCCESS(' RECRUITMENT CYCLE COMPLETE'))
        self.stdout.write(self.style.SUCCESS('═' * 60))
        self._print_summary()

    # ── Load dependencies ────────────────────────────────────────
    def _load_dependencies(self):
        from organization.models import Organization, Department, JobPosition, JobGrade, WorkLocation
        from employees.models import Employee
        from accounts.models import User

        self.org = Organization.objects.first()
        self.admin_user = User.objects.filter(is_superuser=True).first()

        # Build lookup dicts
        self.departments = {d.code: d for d in Department.objects.all()}
        self.positions = {p.code: p for p in JobPosition.objects.all()}
        self.grades = {g.code: g for g in JobGrade.objects.all()}
        self.locations = {w.code: w for w in WorkLocation.objects.all()}

        # Get some employees as interviewers/panel members
        self.employees = list(Employee.objects.filter(
            status='ACTIVE'
        ).select_related('department', 'position')[:20])

        self.stdout.write(f'  Loaded: {len(self.departments)} departments, '
                          f'{len(self.positions)} positions, {len(self.employees)} employees')

    # ── Clear existing data ──────────────────────────────────────
    def _clear_recruitment_data(self):
        from recruitment.models import (
            Vacancy, Applicant, Interview, InterviewPanel, InterviewFeedback,
            Reference, JobOffer, InterviewScoreTemplate, InterviewScoreCategory,
            InterviewScoringSheet, InterviewScoreItem, InterviewReport,
            VacancyURL, VacancyURLView, ApplicantPortalAccess,
            ApplicantStatusHistory, ApplicantDocument, ApplicantAttachment,
            ShortlistCriteria, ShortlistTemplate, ShortlistTemplateCriteria,
            ShortlistRun, ShortlistResult,
        )

        models_to_clear = [
            ('Interview Score Items', InterviewScoreItem),
            ('Interview Scoring Sheets', InterviewScoringSheet),
            ('Interview Reports', InterviewReport),
            ('Interview Score Categories', InterviewScoreCategory),
            ('Interview Score Templates', InterviewScoreTemplate),
            ('Shortlist Results', ShortlistResult),
            ('Shortlist Runs', ShortlistRun),
            ('Shortlist Template Criteria', ShortlistTemplateCriteria),
            ('Shortlist Templates', ShortlistTemplate),
            ('Shortlist Criteria', ShortlistCriteria),
            ('Applicant Documents', ApplicantDocument),
            ('Applicant Attachments', ApplicantAttachment),
            ('Applicant Status History', ApplicantStatusHistory),
            ('Applicant Portal Access', ApplicantPortalAccess),
            ('Vacancy URL Views', VacancyURLView),
            ('Vacancy URLs', VacancyURL),
            ('Interview Feedback', InterviewFeedback),
            ('Interview Panel', InterviewPanel),
            ('Interviews', Interview),
            ('References', Reference),
            ('Job Offers', JobOffer),
            ('Applicants', Applicant),
            ('Vacancies', Vacancy),
        ]

        self.stdout.write('\n  Clearing recruitment data...')
        for name, model in models_to_clear:
            count = model.all_objects.count() if hasattr(model, 'all_objects') else model.objects.count()
            if count > 0:
                if hasattr(model, 'all_objects'):
                    model.all_objects.all().delete()
                else:
                    model.objects.all().delete()
                self.stdout.write(f'    Deleted {count} {name}')
        self.stdout.write(self.style.SUCCESS('  ✓ All recruitment data cleared\n'))

    # ══════════════════════════════════════════════════════════════
    # PHASE 1: VACANCIES
    # ══════════════════════════════════════════════════════════════
    def _create_vacancies(self):
        from recruitment.models import Vacancy

        self.stdout.write('  Phase 1: Creating Vacancies...')
        today = date.today()
        org = self.org
        admin = self.admin_user

        # Find a location for HQ, fallback to first available
        hq_loc = None
        for code in ['LOC-HQ', 'ABLEKUMA', 'HEAD_OFFICE']:
            if code in self.locations:
                hq_loc = self.locations[code]
                break
        if not hq_loc:
            hq_loc = list(self.locations.values())[0] if self.locations else None

        vacancy_defs = [
            {
                'vacancy_number': 'VAC-2026-001',
                'position_code': 'POS-SOFF',
                'dept_code': 'DEP-MTO',
                'job_title': 'Senior Revenue Officer',
                'num_positions': 2,
                'status': 'CLOSED',
                'employment_type': 'PERMANENT',
                'posting_type': 'BOTH',
                'publish_date': today - timedelta(days=90),
                'closing_date': today - timedelta(days=30),
                'target_hire_date': today - timedelta(days=10),
                'description': (
                    'We are seeking an experienced Senior Revenue Officer to join our '
                    'Medium Taxpayer Office. The successful candidate will oversee tax '
                    'compliance operations, conduct audits, and ensure accurate revenue '
                    'collection for the Ghana Revenue Authority.'
                ),
                'requirements': (
                    '• BSc/BA in Accounting, Finance, Economics or related field\n'
                    '• Minimum 5 years experience in tax administration or revenue collection\n'
                    '• Professional certification (ACCA, ICA-Ghana) preferred\n'
                    '• Strong knowledge of Ghana tax laws and regulations\n'
                    '• Excellent analytical and communication skills'
                ),
                'responsibilities': (
                    '• Conduct compliance audits for medium taxpayer segment\n'
                    '• Review and process tax returns and assessments\n'
                    '• Manage taxpayer inquiries and disputes\n'
                    '• Prepare monthly revenue reports\n'
                    '• Mentor junior revenue officers'
                ),
                'salary_min': Decimal('8000'), 'salary_max': Decimal('14000'),
            },
            {
                'vacancy_number': 'VAC-2026-002',
                'position_code': 'POS-ITAN',
                'dept_code': 'BUSINESS_SYSTEM',
                'job_title': 'IT Analyst - Business Systems',
                'num_positions': 1,
                'status': 'PUBLISHED',
                'employment_type': 'PERMANENT',
                'posting_type': 'EXTERNAL',
                'publish_date': today - timedelta(days=21),
                'closing_date': today + timedelta(days=14),
                'target_hire_date': today + timedelta(days=60),
                'description': (
                    'GRA is looking for a skilled IT Analyst to support our Business '
                    'Systems unit. You will analyze requirements, design solutions, and '
                    'support the implementation of digital tax administration systems.'
                ),
                'requirements': (
                    '• BSc in Computer Science, IT, or related field\n'
                    '• 3+ years experience in systems analysis or software development\n'
                    '• Proficiency in Python, SQL, and web technologies\n'
                    '• Experience with ERP or government IT systems preferred\n'
                    '• ITIL or similar certification a plus'
                ),
                'responsibilities': (
                    '• Gather and document business requirements\n'
                    '• Design technical solutions for tax administration needs\n'
                    '• Support system integration and testing\n'
                    '• Provide level-2 support for production systems\n'
                    '• Create user documentation and training materials'
                ),
                'salary_min': Decimal('7000'), 'salary_max': Decimal('12000'),
            },
            {
                'vacancy_number': 'VAC-2026-003',
                'position_code': 'POS-ACCT',
                'dept_code': 'DEP-ACC',
                'job_title': 'Accountant',
                'num_positions': 1,
                'status': 'CLOSED',
                'employment_type': 'PERMANENT',
                'posting_type': 'BOTH',
                'publish_date': today - timedelta(days=75),
                'closing_date': today - timedelta(days=25),
                'target_hire_date': today - timedelta(days=5),
                'description': (
                    'The Accounts Department requires a qualified Accountant to manage '
                    'financial records, prepare reports, and ensure compliance with '
                    'government accounting standards.'
                ),
                'requirements': (
                    '• BSc in Accounting or Finance\n'
                    '• ICA-Ghana or ACCA qualification required\n'
                    '• 3+ years experience in public sector accounting\n'
                    '• Proficiency in accounting software and Excel\n'
                    '• Knowledge of IPSAS standards'
                ),
                'responsibilities': (
                    '• Maintain general ledger and financial records\n'
                    '• Prepare monthly and annual financial statements\n'
                    '• Process payments and reconcile accounts\n'
                    '• Support internal and external audits\n'
                    '• Ensure compliance with PFM Act regulations'
                ),
                'salary_min': Decimal('6500'), 'salary_max': Decimal('11000'),
            },
            {
                'vacancy_number': 'VAC-2026-004',
                'position_code': 'POS-DRIV',
                'dept_code': 'ADMINISTRATION_DIREC',
                'job_title': 'Driver',
                'num_positions': 2,
                'status': 'PUBLISHED',
                'employment_type': 'PERMANENT',
                'posting_type': 'EXTERNAL',
                'publish_date': today - timedelta(days=7),
                'closing_date': today + timedelta(days=28),
                'target_hire_date': today + timedelta(days=90),
                'description': (
                    'GRA seeks reliable and experienced Drivers for official duties. '
                    'The role involves transporting staff and goods safely.'
                ),
                'requirements': (
                    '• Valid DVLA license (Class B or C)\n'
                    '• Minimum 3 years professional driving experience\n'
                    '• Clean driving record\n'
                    '• Basic vehicle maintenance knowledge\n'
                    '• BECE or WASSCE certificate'
                ),
                'responsibilities': (
                    '• Drive official vehicles for staff and goods transport\n'
                    '• Maintain vehicle cleanliness and basic upkeep\n'
                    '• Report vehicle faults and maintenance needs\n'
                    '• Ensure compliance with road safety regulations\n'
                    '• Maintain accurate trip logs'
                ),
                'salary_min': Decimal('2500'), 'salary_max': Decimal('4500'),
            },
            {
                'vacancy_number': 'VAC-2026-005',
                'position_code': 'POS-AUDT',
                'dept_code': 'DEP-IA',
                'job_title': 'Internal Auditor',
                'num_positions': 1,
                'status': 'DRAFT',
                'employment_type': 'PERMANENT',
                'posting_type': 'BOTH',
                'publish_date': None,
                'closing_date': None,
                'target_hire_date': today + timedelta(days=120),
                'description': (
                    'Internal Auditor position to strengthen the Authority\'s audit '
                    'function and ensure compliance with financial regulations.'
                ),
                'requirements': (
                    '• BSc Accounting, Finance, or related field\n'
                    '• CIA, CISA, or ICA-Ghana qualification\n'
                    '• 4+ years audit experience\n'
                    '• Knowledge of INTOSAI standards'
                ),
                'responsibilities': (
                    '• Conduct risk-based internal audits\n'
                    '• Evaluate internal controls and processes\n'
                    '• Prepare audit reports with recommendations\n'
                    '• Follow up on audit findings'
                ),
                'salary_min': Decimal('8000'), 'salary_max': Decimal('13000'),
            },
        ]

        self.vacancies = {}
        for vd in vacancy_defs:
            dept = self.departments.get(vd['dept_code'])
            pos = self.positions.get(vd['position_code'])
            if not dept or not pos:
                self.stdout.write(self.style.WARNING(
                    f'    Skipping {vd["vacancy_number"]}: dept={vd["dept_code"]} pos={vd["position_code"]} not found'))
                continue

            v = Vacancy.objects.create(
                vacancy_number=vd['vacancy_number'],
                position=pos,
                department=dept,
                grade=pos.grade,
                work_location=hq_loc,
                number_of_positions=vd['num_positions'],
                employment_type=vd['employment_type'],
                posting_type=vd['posting_type'],
                job_title=vd['job_title'],
                job_description=vd['description'],
                requirements=vd['requirements'],
                responsibilities=vd['responsibilities'],
                qualifications=vd.get('qualifications', ''),
                salary_range_min=vd['salary_min'],
                salary_range_max=vd['salary_max'],
                show_salary=True,
                status=vd['status'],
                approved_by=admin if vd['status'] not in ('DRAFT',) else None,
                approved_at=timezone.now() - timedelta(days=95) if vd['status'] not in ('DRAFT',) else None,
                publish_date=vd['publish_date'],
                closing_date=vd['closing_date'],
                target_hire_date=vd['target_hire_date'],
                auto_shortlist=True,
                tenant=org,
            )
            self.vacancies[vd['vacancy_number']] = v

        self.stdout.write(self.style.SUCCESS(f'    ✓ {len(self.vacancies)} vacancies created'))

    # ══════════════════════════════════════════════════════════════
    # PHASE 2: APPLICANTS
    # ══════════════════════════════════════════════════════════════
    def _create_applicants(self):
        from recruitment.models import Applicant

        self.stdout.write('  Phase 2: Creating Applicants...')
        org = self.org
        today = date.today()

        # Define applicants per vacancy with their target status
        # VAC-001: Senior Revenue Officer (CLOSED, fully completed) — 10 applicants
        # VAC-002: IT Analyst (PUBLISHED, in progress) — 8 applicants
        # VAC-003: Accountant (CLOSED, filled) — 7 applicants
        # VAC-004: Driver (PUBLISHED, just started) — 4 applicants (all new)
        # VAC-005: Internal Auditor (DRAFT) — 0 applicants

        applicant_plan = []

        # --- VAC-2026-001: Senior Revenue Officer (10 applicants, full cycle) ---
        vac1 = self.vacancies.get('VAC-2026-001')
        if vac1:
            applicant_plan.extend([
                (vac1, 'HIRED',           'M', 0),   # → will become employee
                (vac1, 'HIRED',           'F', 1),   # → will become employee
                (vac1, 'OFFER',           'M', 2),   # offer made but declined
                (vac1, 'REFERENCE_CHECK', 'F', 3),   # checking refs
                (vac1, 'INTERVIEW',       'M', 4),   # passed 1st round, awaiting 2nd
                (vac1, 'INTERVIEW',       'F', 5),   # in interview
                (vac1, 'SHORTLISTED',     'M', 6),   # shortlisted, not yet interviewed
                (vac1, 'REJECTED',        'F', 7),   # rejected after screening
                (vac1, 'REJECTED',        'M', 8),   # rejected after interview
                (vac1, 'WITHDRAWN',       'F', 9),   # withdrew application
            ])

        # --- VAC-2026-002: IT Analyst (8 applicants, in progress) ---
        vac2 = self.vacancies.get('VAC-2026-002')
        if vac2:
            applicant_plan.extend([
                (vac2, 'INTERVIEW',   'M', 10),
                (vac2, 'INTERVIEW',   'F', 11),
                (vac2, 'SHORTLISTED', 'M', 12),
                (vac2, 'SHORTLISTED', 'F', 13),
                (vac2, 'SCREENING',   'M', 14),
                (vac2, 'NEW',         'F', 15),
                (vac2, 'NEW',         'M', 16),
                (vac2, 'REJECTED',    'F', 17),
            ])

        # --- VAC-2026-003: Accountant (7 applicants, filled) ---
        vac3 = self.vacancies.get('VAC-2026-003')
        if vac3:
            applicant_plan.extend([
                (vac3, 'HIRED',           'F', 18),  # → will become employee
                (vac3, 'REFERENCE_CHECK', 'M', 19),
                (vac3, 'INTERVIEW',       'F', 20),
                (vac3, 'SHORTLISTED',     'M', 21),
                (vac3, 'REJECTED',        'F', 22),
                (vac3, 'REJECTED',        'M', 23),
                (vac3, 'WITHDRAWN',       'M', 24),
            ])

        # --- VAC-2026-004: Driver (4 applicants, just started) ---
        vac4 = self.vacancies.get('VAC-2026-004')
        if vac4:
            applicant_plan.extend([
                (vac4, 'NEW', 'M', 25),
                (vac4, 'NEW', 'M', 26),
                (vac4, 'NEW', 'F', 27),
                (vac4, 'NEW', 'M', 28),
            ])

        self.applicants = []
        self.hired_applicants = []

        for vac, status, gender, idx in applicant_plan:
            names_m = MALE_NAMES
            names_f = FEMALE_NAMES
            first = (names_m if gender == 'M' else names_f)[idx % len(names_m if gender == 'M' else names_f)]
            last = LAST_NAMES[idx % len(LAST_NAMES)]

            education = random.choice(['BSc Accounting', 'BSc Finance', 'MSc Economics',
                                       'MBA', 'HND Accounting', 'BSc Computer Science',
                                       'MSc IT', 'BSc Business Admin'])
            institution = INSTITUTIONS[idx % len(INSTITUTIONS)]
            yoe = random.randint(2, 12)
            source = random.choice(['WEBSITE', 'LINKEDIN', 'REFERRAL', 'JOB_BOARD'])
            app_date = vac.publish_date + timedelta(days=random.randint(1, 20)) if vac.publish_date else today

            app = Applicant.objects.create(
                applicant_number=f'APP-2026-{idx + 1:04d}',
                vacancy=vac,
                first_name=first,
                middle_name=random.choice(MALE_NAMES[:5]) if random.random() > 0.5 else '',
                last_name=last,
                email=f'{first.lower()}.{last.lower()}{idx}@email.com',
                phone=_rand_phone(),
                date_of_birth=date(1985 + (idx % 15), (idx % 12) + 1, min((idx * 3) % 28 + 1, 28)),
                gender=gender,
                nationality='Ghanaian',
                address=STREETS[idx % len(STREETS)],
                city=random.choice(['Accra', 'Kumasi', 'Tamale', 'Takoradi']),
                region=random.choice(['Greater Accra', 'Ashanti', 'Northern', 'Western']),
                cover_letter=f'Dear Hiring Manager,\n\nI am writing to express my interest in the {vac.job_title} position at GRA. With {yoe} years of experience in the field, I am confident I can contribute effectively to your team.\n\nSincerely,\n{first} {last}',
                highest_education=education,
                institution=institution,
                graduation_year=2010 + (idx % 12),
                current_employer=random.choice(['GCB Bank', 'Ecobank', 'MTN Ghana', 'GNPC', 'AngloGold Ashanti', '']),
                current_position=random.choice(['Analyst', 'Officer', 'Manager', 'Supervisor', '']),
                years_of_experience=yoe,
                current_salary=Decimal(str(random.randint(3000, 10000))),
                expected_salary=Decimal(str(random.randint(6000, 15000))),
                notice_period=random.choice(['Immediate', '1 month', '2 months', '3 months']),
                previous_employer_email=f'hr@{random.choice(["gcb", "ecobank", "mtn"])}.com.gh',
                previous_employer_phone=_rand_phone(),
                status=status,
                source=source,
                screening_score=random.randint(50, 95) if status not in ('NEW',) else None,
                screening_notes=f'Candidate has {yoe} years relevant experience. Education: {education}.' if status not in ('NEW',) else '',
                overall_score=Decimal(str(random.randint(60, 95))) if status in ('HIRED', 'OFFER', 'REFERENCE_CHECK') else None,
                overall_rating='Excellent' if status == 'HIRED' else ('Good' if status in ('OFFER', 'REFERENCE_CHECK') else ''),
                rejection_reason='Does not meet minimum qualification requirements.' if status == 'REJECTED' else '',
                tenant=org,
            )
            self.applicants.append(app)
            if status == 'HIRED':
                self.hired_applicants.append(app)

        self.stdout.write(self.style.SUCCESS(f'    ✓ {len(self.applicants)} applicants created '
                                             f'({len(self.hired_applicants)} hired)'))

    # ══════════════════════════════════════════════════════════════
    # PHASE 3: SHORTLIST CRITERIA & RUNS
    # ══════════════════════════════════════════════════════════════
    def _create_shortlist_criteria_and_runs(self):
        from recruitment.models import ShortlistCriteria, ShortlistRun, ShortlistResult

        self.stdout.write('  Phase 3: Creating Shortlist Criteria & Runs...')
        org = self.org
        admin = self.admin_user
        criteria_count = 0
        run_count = 0

        for vac_num, vac in self.vacancies.items():
            if vac.status == 'DRAFT':
                continue

            # Define criteria for each vacancy
            criteria_defs = [
                ('EDUCATION', 'MINIMUM', 'Minimum Education Level', 'BSc or equivalent',
                 None, None, None, Decimal('2.0'), 10, True),
                ('EXPERIENCE', 'MINIMUM', 'Minimum Years of Experience', '',
                 Decimal('3'), None, None, Decimal('2.5'), 10, True),
                ('QUALIFICATION', 'CONTAINS', 'Professional Certification', 'ACCA, ICA-Ghana, or equivalent',
                 None, None, None, Decimal('1.5'), 10, False),
                ('SKILL', 'CONTAINS', 'Relevant Technical Skills', 'Analytical, communication',
                 None, None, None, Decimal('1.5'), 10, False),
            ]

            for i, (c_type, m_type, name, val_text, val_num, val_min, val_max, weight, max_sc, mandatory) in enumerate(criteria_defs):
                ShortlistCriteria.objects.create(
                    vacancy=vac,
                    criteria_type=c_type,
                    match_type=m_type,
                    name=name,
                    description=f'{name} criterion for {vac.job_title}',
                    value_text=val_text,
                    value_number=val_num,
                    value_min=val_min,
                    value_max=val_max,
                    weight=weight,
                    max_score=max_sc,
                    is_mandatory=mandatory,
                    sort_order=i,
                    tenant=org,
                )
                criteria_count += 1

            # Create shortlist run for vacancies past screening
            vac_applicants = [a for a in self.applicants if a.vacancy_id == vac.id]
            eligible = [a for a in vac_applicants if a.status not in ('NEW', 'WITHDRAWN')]

            if not eligible:
                continue

            run = ShortlistRun.objects.create(
                vacancy=vac,
                run_number=f'SLR-{vac_num[-3:]}-001',
                run_by=admin,
                pass_score=Decimal('60'),
                include_screening_score=True,
                screening_weight=Decimal('0.30'),
                status='COMPLETED',
                total_applicants=len(vac_applicants),
                qualified_count=len([a for a in eligible if a.status not in ('REJECTED',)]),
                disqualified_count=len([a for a in eligible if a.status == 'REJECTED']),
                notes=f'Auto-shortlist run for {vac.job_title}',
                tenant=org,
            )
            run_count += 1

            # Create results for each eligible applicant
            for rank, app in enumerate(sorted(eligible, key=lambda a: -(a.screening_score or 0)), 1):
                is_qualified = app.status not in ('REJECTED',)
                score = Decimal(str(app.screening_score or 50))
                ShortlistResult.objects.create(
                    shortlist_run=run,
                    applicant=app,
                    criteria_score=score * Decimal('0.7'),
                    screening_score_used=score * Decimal('0.3'),
                    final_score=score,
                    percentage_score=score,
                    rank=rank,
                    outcome='QUALIFIED' if is_qualified else 'NOT_QUALIFIED',
                    score_breakdown={
                        'education': random.randint(6, 10),
                        'experience': random.randint(5, 10),
                        'certification': random.randint(4, 10),
                        'skills': random.randint(5, 10),
                    },
                    notes=f'Rank {rank} - {"Qualified" if is_qualified else "Not qualified"}',
                    tenant=org,
                )

        self.stdout.write(self.style.SUCCESS(
            f'    ✓ {criteria_count} criteria, {run_count} shortlist runs created'))

    # ══════════════════════════════════════════════════════════════
    # PHASE 4: INTERVIEWS
    # ══════════════════════════════════════════════════════════════
    def _create_interviews(self):
        from recruitment.models import Interview, InterviewPanel, InterviewFeedback

        self.stdout.write('  Phase 4: Creating Interviews...')
        org = self.org
        today = date.today()

        # Interview candidates: those who reached INTERVIEW or beyond
        interview_statuses = ('INTERVIEW', 'ASSESSMENT', 'REFERENCE_CHECK', 'OFFER', 'HIRED')
        interview_apps = [a for a in self.applicants if a.status in interview_statuses]

        self.interviews = []
        panel_count = 0
        feedback_count = 0

        interview_types = ['PHONE', 'IN_PERSON', 'VIDEO', 'PANEL', 'TECHNICAL']

        for i, app in enumerate(interview_apps):
            # Round 1: Phone/Video screening
            sched_date = (app.vacancy.publish_date or today) + timedelta(days=25 + i * 2)
            is_completed = app.status in ('REFERENCE_CHECK', 'OFFER', 'HIRED')
            is_passed = app.status in ('REFERENCE_CHECK', 'OFFER', 'HIRED', 'INTERVIEW')

            intv1 = Interview.objects.create(
                applicant=app,
                interview_type='PHONE' if i % 2 == 0 else 'VIDEO',
                round_number=1,
                scheduled_date=sched_date,
                scheduled_time=time(10, 0),
                duration_minutes=45,
                location='Virtual' if i % 2 else 'GRA Head Office',
                meeting_link='https://meet.google.com/abc-defg-hij' if i % 2 == 0 else '',
                status='COMPLETED' if is_completed else ('SCHEDULED' if not is_completed else 'COMPLETED'),
                result='PASSED' if is_passed else 'PENDING',
                notes=f'Round 1 screening for {app.first_name} {app.last_name}',
                scheduled_by=self.admin_user,
                tenant=org,
            )
            self.interviews.append(intv1)

            # Add panel (2-3 members)
            panel_size = random.randint(2, min(3, len(self.employees)))
            panel_members = random.sample(self.employees[:10], panel_size)
            for j, emp in enumerate(panel_members):
                InterviewPanel.objects.create(
                    interview=intv1,
                    interviewer=emp,
                    role='LEAD' if j == 0 else 'MEMBER',
                    confirmed=True,
                    tenant=org,
                )
                panel_count += 1

                # Add feedback for completed interviews
                if is_completed:
                    InterviewFeedback.objects.create(
                        interview=intv1,
                        interviewer=emp,
                        technical_skills=random.randint(3, 5),
                        communication=random.randint(3, 5),
                        problem_solving=random.randint(3, 5),
                        cultural_fit=random.randint(3, 5),
                        leadership=random.randint(2, 5),
                        overall_rating=random.randint(3, 5),
                        strengths=random.choice([
                            'Strong analytical skills and attention to detail.',
                            'Excellent communication and interpersonal skills.',
                            'Deep technical knowledge and problem-solving ability.',
                            'Good leadership potential and team orientation.',
                        ]),
                        weaknesses=random.choice([
                            'Could improve on presentation skills.',
                            'Limited experience with GRA-specific regulations.',
                            'Needs more exposure to public sector processes.',
                            'Time management could be improved.',
                        ]),
                        comments=f'Overall a {"strong" if app.status in ("HIRED", "OFFER") else "decent"} candidate.',
                        recommendation=random.choice(['STRONGLY_RECOMMEND', 'RECOMMEND']) if app.status in ('HIRED', 'OFFER', 'REFERENCE_CHECK') else 'RESERVATIONS',
                        tenant=org,
                    )
                    feedback_count += 1

            # Round 2: In-person/Panel interview for advanced candidates
            if app.status in ('REFERENCE_CHECK', 'OFFER', 'HIRED'):
                intv2 = Interview.objects.create(
                    applicant=app,
                    interview_type='PANEL',
                    round_number=2,
                    scheduled_date=sched_date + timedelta(days=7),
                    scheduled_time=time(9, 0),
                    duration_minutes=90,
                    location='GRA Head Office, Board Room',
                    status='COMPLETED',
                    result='PASSED',
                    notes=f'Round 2 panel interview for {app.first_name} {app.last_name}',
                    scheduled_by=self.admin_user,
                    tenant=org,
                )
                self.interviews.append(intv2)

                # Panel for round 2 (3-4 senior members)
                r2_panel = random.sample(self.employees[:15], min(4, len(self.employees[:15])))
                for j, emp in enumerate(r2_panel):
                    InterviewPanel.objects.create(
                        interview=intv2,
                        interviewer=emp,
                        role='LEAD' if j == 0 else ('OBSERVER' if j == 3 else 'MEMBER'),
                        confirmed=True,
                        tenant=org,
                    )
                    panel_count += 1

                    InterviewFeedback.objects.create(
                        interview=intv2,
                        interviewer=emp,
                        technical_skills=random.randint(4, 5),
                        communication=random.randint(4, 5),
                        problem_solving=random.randint(3, 5),
                        cultural_fit=random.randint(4, 5),
                        leadership=random.randint(3, 5),
                        overall_rating=random.randint(4, 5),
                        strengths='Demonstrated excellent knowledge and suitability for the role.',
                        weaknesses='Minor areas for development identified in onboarding plan.',
                        comments=f'Highly recommended for the {app.vacancy.job_title} position.',
                        recommendation='STRONGLY_RECOMMEND' if app.status == 'HIRED' else 'RECOMMEND',
                        tenant=org,
                    )
                    feedback_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'    ✓ {len(self.interviews)} interviews, {panel_count} panel members, '
            f'{feedback_count} feedback entries'))

    # ══════════════════════════════════════════════════════════════
    # PHASE 5: SCORING TEMPLATES & SHEETS
    # ══════════════════════════════════════════════════════════════
    def _create_scoring_templates_and_sheets(self):
        from recruitment.models import (
            InterviewScoreTemplate, InterviewScoreCategory,
            InterviewScoringSheet, InterviewScoreItem, InterviewReport,
        )

        self.stdout.write('  Phase 5: Creating Scoring Templates & Sheets...')
        org = self.org

        # Create a scoring template
        template = InterviewScoreTemplate.objects.create(
            code='TMPL-RECRUIT-001',
            name='Standard Recruitment Assessment',
            template_type='RECRUITMENT',
            description='Standard scoring template for recruitment interviews at GRA',
            max_total_score=100,
            pass_score=60,
            instructions=(
                'Rate each candidate on a scale of 0-10 for each category.\n'
                'Consider both the interview responses and supporting documentation.\n'
                'Provide specific comments to justify your scores.'
            ),
            is_active=True,
            tenant=org,
        )

        # Create scoring categories
        categories_def = [
            ('Technical Knowledge', 'Domain expertise and relevant skills', 10, Decimal('2.5'), True,
             '0-3: Below expectations, 4-6: Meets expectations, 7-9: Exceeds, 10: Outstanding'),
            ('Communication Skills', 'Clarity, articulation, listening', 10, Decimal('2.0'), True,
             '0-3: Poor, 4-6: Adequate, 7-9: Good, 10: Excellent'),
            ('Problem Solving', 'Analytical thinking, decision making', 10, Decimal('2.0'), True,
             '0-3: Weak, 4-6: Average, 7-9: Strong, 10: Exceptional'),
            ('Leadership & Initiative', 'Self-motivation, team orientation', 10, Decimal('1.5'), False,
             '0-3: Limited, 4-6: Shows potential, 7-9: Demonstrated, 10: Outstanding'),
            ('Cultural Fit', 'Alignment with GRA values, professionalism', 10, Decimal('1.0'), True,
             '0-3: Misaligned, 4-6: Acceptable, 7-9: Good fit, 10: Excellent fit'),
            ('Relevant Experience', 'Years and depth of relevant work', 10, Decimal('1.0'), True,
             '0-3: Insufficient, 4-6: Adequate, 7-9: Strong, 10: Exceptional'),
        ]

        categories = []
        for i, (name, desc, max_sc, weight, required, guide) in enumerate(categories_def):
            cat = InterviewScoreCategory.objects.create(
                template=template,
                name=name,
                description=desc,
                max_score=max_sc,
                weight=weight,
                sort_order=i,
                is_required=required,
                scoring_guide=guide,
                tenant=org,
            )
            categories.append(cat)

        # Create driver-specific template
        driver_template = InterviewScoreTemplate.objects.create(
            code='TMPL-DRIVER-001',
            name='Driver Recruitment Assessment',
            template_type='DRIVER',
            description='Scoring template specifically for driver recruitment including DVLA verification',
            max_total_score=100,
            pass_score=65,
            instructions='Include DVLA license verification results and driving test scores.',
            is_active=True,
            tenant=org,
        )

        driver_categories_def = [
            ('Driving Skills', 'Practical driving assessment', 10, Decimal('3.0'), True, ''),
            ('Vehicle Knowledge', 'Maintenance and safety knowledge', 10, Decimal('2.0'), True, ''),
            ('Safety Awareness', 'Road safety and regulations', 10, Decimal('2.5'), True, ''),
            ('Communication', 'Basic communication skills', 10, Decimal('1.0'), False, ''),
            ('Reliability', 'Punctuality and dependability', 10, Decimal('1.5'), True, ''),
        ]

        driver_categories = []
        for i, (name, desc, max_sc, weight, required, guide) in enumerate(driver_categories_def):
            cat = InterviewScoreCategory.objects.create(
                template=driver_template,
                name=name,
                description=desc,
                max_score=max_sc,
                weight=weight,
                sort_order=i,
                is_required=required,
                scoring_guide=guide,
                tenant=org,
            )
            driver_categories.append(cat)

        # Create scoring sheets for completed round-2 interviews
        sheet_count = 0
        report_count = 0
        round2_interviews = [iv for iv in self.interviews if iv.round_number == 2 and iv.status == 'COMPLETED']

        for intv in round2_interviews:
            panels = intv.panel_members.select_related('interviewer').all()
            sheets_for_interview = []

            for pm in panels:
                total = 0
                weighted = 0
                sheet = InterviewScoringSheet.objects.create(
                    interview=intv,
                    template=template,
                    interviewer=pm.interviewer,
                    strengths='Solid overall performance with clear domain knowledge.',
                    weaknesses='Some areas could benefit from additional training.',
                    overall_comments=f'Recommend proceeding with this candidate for {intv.applicant.vacancy.job_title}.',
                    recommendation='STRONGLY_RECOMMEND' if intv.applicant.status == 'HIRED' else 'RECOMMEND',
                    status='SUBMITTED',
                    submitted_at=timezone.now() - timedelta(days=random.randint(5, 30)),
                    tenant=org,
                )

                for cat in categories:
                    score = random.randint(6, 10) if intv.applicant.status == 'HIRED' else random.randint(5, 9)
                    InterviewScoreItem.objects.create(
                        scoring_sheet=sheet,
                        category=cat,
                        score=score,
                        comments=f'Score: {score}/10',
                        tenant=org,
                    )
                    total += score
                    weighted += float(score) * float(cat.weight)

                max_weighted = sum(float(c.max_score) * float(c.weight) for c in categories)
                pct = (weighted / max_weighted * 100) if max_weighted > 0 else 0
                sheet.total_score = Decimal(str(total))
                sheet.weighted_score = Decimal(str(round(weighted, 2)))
                sheet.percentage_score = Decimal(str(round(pct, 2)))
                sheet.save()
                sheets_for_interview.append(sheet)
                sheet_count += 1

            # Generate interview report
            if sheets_for_interview:
                scores = [float(s.percentage_score) for s in sheets_for_interview]
                rec_counts = {}
                for s in sheets_for_interview:
                    rec_counts[s.recommendation] = rec_counts.get(s.recommendation, 0) + 1

                report = InterviewReport.objects.create(
                    interview=intv,
                    panel_size=len(panels),
                    panel_composition=', '.join([f'{pm.interviewer.first_name} {pm.interviewer.last_name} ({pm.role})' for pm in panels]),
                    average_score=Decimal(str(round(sum(scores) / len(scores), 2))),
                    highest_score=Decimal(str(round(max(scores), 2))),
                    lowest_score=Decimal(str(round(min(scores), 2))),
                    score_breakdown={cat.name: random.randint(6, 10) for cat in categories},
                    recommendations_summary=rec_counts,
                    consensus_strengths='Candidate demonstrated strong technical expertise and professional demeanor.',
                    consensus_weaknesses='Minor gap in public sector experience which can be addressed through onboarding.',
                    key_observations='Panel consensus: suitable candidate for the role.',
                    training_needs='Orientation on GRA-specific systems and procedures.',
                    final_decision='HIRE' if intv.applicant.status == 'HIRED' else 'HOLD',
                    decision_rationale='Meets all requirements. Strong interview performance across all categories.',
                    decided_by=self.admin_user,
                    decided_at=timezone.now() - timedelta(days=random.randint(1, 15)),
                    tenant=org,
                )
                report_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'    ✓ 2 templates, {len(categories) + len(driver_categories)} categories, '
            f'{sheet_count} scoring sheets, {report_count} reports'))

    # ══════════════════════════════════════════════════════════════
    # PHASE 6: REFERENCES
    # ══════════════════════════════════════════════════════════════
    def _create_references(self):
        from recruitment.models import Reference

        self.stdout.write('  Phase 6: Creating References...')
        org = self.org
        ref_count = 0

        # Create references for shortlisted+ candidates
        ref_statuses = ('SHORTLISTED', 'INTERVIEW', 'REFERENCE_CHECK', 'OFFER', 'HIRED')
        ref_apps = [a for a in self.applicants if a.status in ref_statuses]

        for app in ref_apps:
            num_refs = 2 if app.status in ('REFERENCE_CHECK', 'OFFER', 'HIRED') else 1
            for j in range(num_refs):
                ref_first = random.choice(MALE_NAMES + FEMALE_NAMES)
                ref_last = random.choice(LAST_NAMES)
                is_checked = app.status in ('REFERENCE_CHECK', 'OFFER', 'HIRED') and j == 0

                Reference.objects.create(
                    applicant=app,
                    name=f'{ref_first} {ref_last}',
                    relationship=random.choice(['Former Manager', 'Former Supervisor', 'Colleague', 'Professor', 'Mentor']),
                    company=REF_COMPANIES[(ref_count + j) % len(REF_COMPANIES)],
                    position=random.choice(['Director', 'Senior Manager', 'Manager', 'Head of Department']),
                    email=f'{ref_first.lower()}.{ref_last.lower()}@{random.choice(["gmail.com", "outlook.com", "company.com"])}',
                    phone=_rand_phone(),
                    status='COMPLETED' if is_checked else 'PENDING',
                    verified_employment=True if is_checked else None,
                    verified_position=True if is_checked else None,
                    verified_dates=True if is_checked else None,
                    would_rehire=True if is_checked else None,
                    overall_feedback=(
                        f'{app.first_name} was an excellent team member. '
                        f'Highly dedicated, professional, and competent. '
                        f'I would recommend them without reservation.'
                    ) if is_checked else '',
                    checked_by=self.admin_user if is_checked else None,
                    checked_at=timezone.now() - timedelta(days=random.randint(5, 20)) if is_checked else None,
                    tenant=org,
                )
                ref_count += 1

        self.stdout.write(self.style.SUCCESS(f'    ✓ {ref_count} references created'))

    # ══════════════════════════════════════════════════════════════
    # PHASE 7: JOB OFFERS
    # ══════════════════════════════════════════════════════════════
    def _create_job_offers(self):
        from recruitment.models import JobOffer

        self.stdout.write('  Phase 7: Creating Job Offers...')
        org = self.org
        admin = self.admin_user
        today = date.today()

        offer_apps = [a for a in self.applicants if a.status in ('OFFER', 'HIRED')]
        self.job_offers = []

        for i, app in enumerate(offer_apps):
            vac = app.vacancy
            basic = vac.salary_range_min + (vac.salary_range_max - vac.salary_range_min) * Decimal(str(random.uniform(0.4, 0.8)))
            basic = basic.quantize(Decimal('1.00'))
            allowances = (basic * Decimal('0.25')).quantize(Decimal('1.00'))

            is_accepted = app.status == 'HIRED'
            is_declined = app.status == 'OFFER'  # one offer that was not accepted

            if is_accepted:
                status = 'ACCEPTED'
            elif is_declined:
                status = 'DECLINED'
            else:
                status = 'SENT'

            offer = JobOffer.objects.create(
                offer_number=f'JO-2026-{i + 1:04d}',
                applicant=app,
                vacancy=vac,
                position=vac.position,
                department=vac.department,
                grade=vac.grade,
                reporting_to=self.employees[i % len(self.employees)] if self.employees else None,
                basic_salary=basic,
                allowances=allowances,
                total_compensation=basic + allowances,
                compensation_notes=f'Basic: GHS {basic}, Housing: GHS {(allowances * Decimal("0.4")).quantize(Decimal("1.00"))}, Transport: GHS {(allowances * Decimal("0.3")).quantize(Decimal("1.00"))}, Other: GHS {(allowances * Decimal("0.3")).quantize(Decimal("1.00"))}',
                offer_date=today - timedelta(days=random.randint(15, 35)),
                response_deadline=today - timedelta(days=random.randint(1, 10)),
                proposed_start_date=today + timedelta(days=random.randint(5, 30)) if is_accepted else today + timedelta(days=30),
                status=status,
                approved_by=admin,
                approved_at=timezone.now() - timedelta(days=random.randint(20, 40)),
                sent_at=timezone.now() - timedelta(days=random.randint(15, 35)),
                responded_at=timezone.now() - timedelta(days=random.randint(5, 15)) if status in ('ACCEPTED', 'DECLINED') else None,
                decline_reason='Accepted a position at another organization.' if is_declined else '',
                negotiation_notes='Candidate requested higher salary. Counter-offer made within approved band.' if i == 0 else '',
                counter_offer_salary=basic + Decimal('500') if i == 0 else None,
                tenant=org,
            )
            self.job_offers.append(offer)

        self.stdout.write(self.style.SUCCESS(f'    ✓ {len(self.job_offers)} job offers created'))

    # ══════════════════════════════════════════════════════════════
    # PHASE 8: HIRE & CREATE EMPLOYEES
    # ══════════════════════════════════════════════════════════════
    def _hire_and_create_employees(self):
        from employees.models import Employee
        from recruitment.models import ApplicantStatusHistory, ApplicantDocument

        self.stdout.write('  Phase 8: Creating Employee Records for Hired Candidates...')
        org = self.org
        today = date.today()
        new_employees = []

        for app in self.hired_applicants:
            offer = self.job_offers[0] if self.job_offers else None
            # Find the matching offer
            for jo in self.job_offers:
                if jo.applicant_id == app.id and jo.status == 'ACCEPTED':
                    offer = jo
                    break

            if not offer:
                continue

            # Generate employee number
            existing_max = Employee.objects.order_by('-employee_number').first()
            if existing_max:
                try:
                    num = int(''.join(filter(str.isdigit, existing_max.employee_number))) + 1
                except ValueError:
                    num = 90001
            else:
                num = 90001
            emp_number = f'GRA-R{num}'

            start_date = offer.proposed_start_date or today

            emp = Employee.objects.create(
                employee_number=emp_number,
                first_name=app.first_name,
                middle_name=app.middle_name or '',
                last_name=app.last_name,
                date_of_birth=app.date_of_birth or date(1990, 1, 1),
                gender=app.gender or 'M',
                marital_status='SINGLE',
                nationality=app.nationality or 'Ghanaian',
                personal_email=app.email,
                work_email=f'{app.first_name.lower()}.{app.last_name.lower()}@gra.gov.gh',
                mobile_phone=app.phone,
                residential_address=app.address or '1 Independence Ave, Accra',
                residential_city=app.city or 'Accra',
                status='PROBATION',
                employment_type='PERMANENT',
                date_of_joining=start_date,
                probation_end_date=start_date + timedelta(days=180),
                department=offer.department,
                position=offer.position,
                grade=offer.grade,
                work_location=offer.vacancy.work_location,
                division=offer.department.directorate.division if hasattr(offer.department, 'directorate') and offer.department.directorate and hasattr(offer.department.directorate, 'division') else None,
                directorate=offer.department.directorate if hasattr(offer.department, 'directorate') else None,
                supervisor=offer.reporting_to,
                tenant=org,
            )
            new_employees.append(emp)

            # Create status history for the applicant
            statuses_timeline = ['NEW', 'SCREENING', 'SHORTLISTED', 'INTERVIEW', 'REFERENCE_CHECK', 'OFFER', 'HIRED']
            for j, s in enumerate(statuses_timeline):
                prev = statuses_timeline[j - 1] if j > 0 else ''
                ApplicantStatusHistory.objects.create(
                    applicant=app,
                    old_status=prev,
                    new_status=s,
                    changed_by=self.admin_user,
                    notes=f'Status changed to {s}',
                    is_visible_to_applicant=True,
                    tenant=org,
                )

            # Create required onboarding documents (pending upload)
            doc_types = [
                'ACCEPTANCE_LETTER', 'PERSONAL_HISTORY', 'POLICE_REPORT',
                'MEDICAL_REPORT', 'BANK_DETAILS', 'PROVIDENT_FUND', 'TIER_2_FORM',
            ]
            for doc_type in doc_types:
                ApplicantDocument.objects.create(
                    applicant=app,
                    document_type=doc_type,
                    status='PENDING',
                    notes=f'Required for onboarding - {doc_type.replace("_", " ").title()}',
                    tenant=org,
                )

        self.stdout.write(self.style.SUCCESS(
            f'    ✓ {len(new_employees)} employees created from hired applicants'))
        for emp in new_employees:
            self.stdout.write(f'      → {emp.employee_number}: {emp.first_name} {emp.last_name} '
                              f'({emp.position.title} @ {emp.department.name})')

    # ── Summary ──────────────────────────────────────────────────
    def _print_summary(self):
        from recruitment.models import (
            Vacancy, Applicant, Interview, InterviewPanel, InterviewFeedback,
            Reference, JobOffer, InterviewScoreTemplate, InterviewScoringSheet,
            InterviewReport, ShortlistCriteria, ShortlistRun, ShortlistResult,
            ApplicantStatusHistory, ApplicantDocument,
        )
        from employees.models import Employee

        self.stdout.write('')
        self.stdout.write('  ┌─────────────────────────────────────────────┐')
        self.stdout.write('  │           RECRUITMENT DATA SUMMARY          │')
        self.stdout.write('  ├─────────────────────────────────────────────┤')
        self.stdout.write(f'  │  Vacancies:             {Vacancy.objects.count():>5}              │')
        self.stdout.write(f'  │  Applicants:            {Applicant.objects.count():>5}              │')
        self.stdout.write(f'  │  Shortlist Criteria:    {ShortlistCriteria.objects.count():>5}              │')
        self.stdout.write(f'  │  Shortlist Runs:        {ShortlistRun.objects.count():>5}              │')
        self.stdout.write(f'  │  Shortlist Results:     {ShortlistResult.objects.count():>5}              │')
        self.stdout.write(f'  │  Interviews:            {Interview.objects.count():>5}              │')
        self.stdout.write(f'  │  Panel Members:         {InterviewPanel.objects.count():>5}              │')
        self.stdout.write(f'  │  Interview Feedback:    {InterviewFeedback.objects.count():>5}              │')
        self.stdout.write(f'  │  Score Templates:       {InterviewScoreTemplate.objects.count():>5}              │')
        self.stdout.write(f'  │  Scoring Sheets:        {InterviewScoringSheet.objects.count():>5}              │')
        self.stdout.write(f'  │  Interview Reports:     {InterviewReport.objects.count():>5}              │')
        self.stdout.write(f'  │  References:            {Reference.objects.count():>5}              │')
        self.stdout.write(f'  │  Job Offers:            {JobOffer.objects.count():>5}              │')
        self.stdout.write(f'  │  Status History:        {ApplicantStatusHistory.objects.count():>5}              │')
        self.stdout.write(f'  │  Onboarding Documents:  {ApplicantDocument.objects.count():>5}              │')
        self.stdout.write('  ├─────────────────────────────────────────────┤')
        self.stdout.write(f'  │  Total Employees:       {Employee.objects.count():>5}              │')
        self.stdout.write(f'  │  New Hires (Probation): {Employee.objects.filter(status="PROBATION").count():>5}              │')
        self.stdout.write('  └─────────────────────────────────────────────┘')
        self.stdout.write('')

        # Vacancy breakdown
        self.stdout.write('  Vacancy Pipeline:')
        for v in Vacancy.objects.all().order_by('vacancy_number'):
            app_count = Applicant.objects.filter(vacancy=v).count()
            hired = Applicant.objects.filter(vacancy=v, status='HIRED').count()
            self.stdout.write(f'    {v.vacancy_number} │ {v.job_title:<30} │ {v.status:<12} │ '
                              f'{app_count} applicants │ {hired} hired')
