"""
Management command to set up NHIA approval workflows per the SRS.

Based on the Software Requirement Specification, the following approval
processes are defined:

LEAVE APPROVAL (SRS Section 3.1.3):
  District offices:
    - Staff/below: approved by District Manager
    - Line manager: approved by District Manager
    - District managers: approved by Regional Director
  Regional offices:
    - Officers: approved by Unit Head
    - Managers: approved by Regional Director
    - Regional directors: approved by Director MRO
  Claims Processing Centres (CPC):
    - Officers/below: approved by Supervisor
    - Managers: approved by Deputy Director Claims
    - Deputy Director Claims: approved by Director Claims
  Head Office:
    - Officers/below: approved by Unit Head (within directorate)
    - Managers: approved by Deputy Director
    - Deputy Directors: approved by Director
    - Directors: approved by respective DCE
    - DCEs: approved by CEO
  Standalone Directorates:
    - Internal Audit, Actuarial, Board Secretary: approved by CEO

BENEFITS / LOANS APPROVAL (SRS Section 3.1.4):
  Two levels: HR then Finance

APPRAISAL APPROVAL (SRS Section 3.1.5):
  Approval at each stage (target setting, mid-year, end-of-year)
  Employee -> Supervisor -> Department Head

DISCIPLINE (SRS Section 3.1.6):
  District: District Manager -> Regional Director
  Region: Regional Director -> Head Office HR
  Head Office: Director HR -> DCE Admin & HR -> Disciplinary Committee

PAYROLL (SRS Section 10.8):
  Payroll locking & approval workflow
  Payroll Officer -> HR Manager -> Finance Director -> DCE Finance -> CEO

EMPLOYEE DATA UPDATE (SRS Section 10.14):
  Employee submits -> HR reviews and approves

EXIT MANAGEMENT:
  Employee -> Supervisor -> HR -> Department Head -> DCE

RECRUITMENT:
  Vacancy: HR -> Director -> DCE -> CEO
"""

from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from accounts.models import Role
from workflow.models import WorkflowDefinition, ApprovalLevel, ApproverType


# ── Required Roles ────────────────────────────────────────────────

REQUIRED_ROLES = [
    {'code': 'HR_MANAGER', 'name': 'HR Manager', 'level': 50,
     'description': 'Human Resources Manager - reviews and approves HR-related requests'},
    {'code': 'HR_DIRECTOR', 'name': 'HR Director', 'level': 70,
     'description': 'Director of Human Resources'},
    {'code': 'FINANCE_MANAGER', 'name': 'Finance Manager', 'level': 50,
     'description': 'Finance Manager - reviews financial approvals and loan requests'},
    {'code': 'FINANCE_DIRECTOR', 'name': 'Finance Director', 'level': 70,
     'description': 'Director of Finance - approves payroll and financial transactions'},
    {'code': 'CEO', 'name': 'Chief Executive Officer', 'level': 100,
     'description': 'Chief Executive Officer of NHIA'},
    {'code': 'DCE', 'name': 'Deputy Chief Executive', 'level': 90,
     'description': 'Deputy Chief Executive (Admin & HR, Finance, or Operations)'},
]


# ── Workflow definitions ──────────────────────────────────────────

WORKFLOWS = [
    # ────────── LEAVE APPROVAL WORKFLOWS ──────────
    # Head Office workflow (most common / default)
    {
        'code': 'LEAVE_HO',
        'name': 'Leave Approval - Head Office',
        'description': (
            'Head Office leave approval chain: Officers approved by Unit Head, '
            'Managers by Deputy Director, Deputy Directors by Director, '
            'Directors by respective DCE, DCEs by CEO.'
        ),
        'content_type': 'leave.leaverequest',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Approval',
                'description': 'Direct supervisor reviews the leave request',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'Department Head Approval',
                'description': 'Department/Unit head approves the leave request',
                'approver_type': ApproverType.DEPARTMENT_HEAD,
                'skip_if_same_as_previous': True,
            },
            {
                'level': 3,
                'name': 'Directorate Head Approval',
                'description': 'Director of the directorate approves',
                'approver_type': ApproverType.DIRECTORATE_HEAD,
                'skip_if_same_as_previous': True,
            },
            {
                'level': 4,
                'name': 'DCE Approval',
                'description': 'Deputy Chief Executive (Admin & HR) approves for directors',
                'approver_type': ApproverType.DCE,
                'skip_if_same_as_previous': True,
                'can_skip': True,
            },
            {
                'level': 5,
                'name': 'CEO Approval',
                'description': 'CEO approves for DCEs',
                'approver_type': ApproverType.CEO,
                'skip_if_same_as_previous': True,
                'can_skip': True,
            },
        ],
    },
    # District Office workflow
    {
        'code': 'LEAVE_DIST',
        'name': 'Leave Approval - District Office',
        'description': (
            'District office leave approval: Staff approved by District Manager, '
            'District Managers approved by Regional Director.'
        ),
        'content_type': 'leave.leaverequest',
        'is_default': False,
        'levels': [
            {
                'level': 1,
                'name': 'District Manager Approval',
                'description': 'District manager approves leave for district staff',
                'approver_type': ApproverType.DISTRICT_HEAD,
            },
            {
                'level': 2,
                'name': 'Regional Director Approval',
                'description': 'Regional director approves leave for district managers',
                'approver_type': ApproverType.REGIONAL_DIRECTOR,
                'skip_if_same_as_previous': True,
                'can_skip': True,
            },
        ],
    },
    # Regional Office workflow
    {
        'code': 'LEAVE_REG',
        'name': 'Leave Approval - Regional Office',
        'description': (
            'Regional office leave approval: Officers approved by Unit Head, '
            'Managers by Regional Director, Regional Directors by Director MRO.'
        ),
        'content_type': 'leave.leaverequest',
        'is_default': False,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Approval',
                'description': 'Immediate supervisor reviews the leave request',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'Regional Director Approval',
                'description': 'Regional director approves for managers and above',
                'approver_type': ApproverType.REGIONAL_DIRECTOR,
                'skip_if_same_as_previous': True,
            },
            {
                'level': 3,
                'name': 'Division Head Approval',
                'description': 'Director MRO approves for regional directors',
                'approver_type': ApproverType.DIVISION_HEAD,
                'skip_if_same_as_previous': True,
                'can_skip': True,
            },
        ],
    },
    # CPC workflow
    {
        'code': 'LEAVE_CPC',
        'name': 'Leave Approval - Claims Processing Centre',
        'description': (
            'CPC leave approval: Officers approved by Supervisor, '
            'Managers by Deputy Director Claims, Deputy Director by Director Claims.'
        ),
        'content_type': 'leave.leaverequest',
        'is_default': False,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Approval',
                'description': 'Immediate supervisor approves for officers and below',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'Directorate Head Approval',
                'description': 'Deputy Director Claims / Director Claims approves',
                'approver_type': ApproverType.DIRECTORATE_HEAD,
                'skip_if_same_as_previous': True,
            },
            {
                'level': 3,
                'name': 'Division Head Approval',
                'description': 'Division head for escalated CPC approvals',
                'approver_type': ApproverType.DIVISION_HEAD,
                'skip_if_same_as_previous': True,
                'can_skip': True,
            },
        ],
    },
    # Standalone Directorates (Internal Audit, Actuarial, Board Secretary)
    {
        'code': 'LEAVE_SA',
        'name': 'Leave Approval - Standalone Directorate',
        'description': (
            'Standalone directorate (Internal Audit, Actuarial, Board Secretary) '
            'leave approval: All staff approved directly by CEO.'
        ),
        'content_type': 'leave.leaverequest',
        'is_default': False,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Approval',
                'description': 'Direct supervisor reviews the leave request',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'CEO Approval',
                'description': 'CEO approves for standalone directorate staff',
                'approver_type': ApproverType.CEO,
                'skip_if_same_as_previous': True,
            },
        ],
    },

    # ────────── LEAVE PLAN APPROVAL ──────────
    {
        'code': 'LEAVE_PLAN',
        'name': 'Leave Plan Approval',
        'description': (
            'Annual leave plan approval: employees plan leave for the year, '
            'supervisor approves the plan.'
        ),
        'content_type': 'leave.leaveplan',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Approval',
                'description': 'Supervisor reviews and approves the annual leave plan',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'Department Head Approval',
                'description': 'Department head gives final approval for the plan',
                'approver_type': ApproverType.DEPARTMENT_HEAD,
                'skip_if_same_as_previous': True,
            },
        ],
    },

    # ────────── LEAVE CARRY FORWARD / ROLLOVER ──────────
    {
        'code': 'LEAVE_ROLLOVER',
        'name': 'Leave Rollover Approval',
        'description': (
            'Leave days rollover request: requires CEO or representative approval. '
            'Leave days are not automatically rolled over without CEO approval.'
        ),
        'content_type': 'leave.leavecarryforwardrequest',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'HR Review',
                'description': 'HR reviews the rollover request and adjusts days if needed',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 2,
                'name': 'CEO Approval',
                'description': 'CEO or representative gives final approval for leave rollover',
                'approver_type': ApproverType.CEO,
            },
        ],
    },

    # ────────── BENEFITS / LOANS APPROVAL ──────────
    # Loan Account (Salary Advance, Special Advance, Car Loan, Personal Loan)
    {
        'code': 'LOAN_APPROVAL',
        'name': 'Loan / Advance Approval',
        'description': (
            'Two levels of approval for loans: HR then Finance. '
            'Covers salary advance, special advance, car loans, and personal loans. '
            'System checks disposable income before allowing.'
        ),
        'content_type': 'benefits.loanaccount',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'HR Approval',
                'description': 'HR reviews and verifies the loan application',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 2,
                'name': 'Finance Approval',
                'description': 'Finance reviews disposable income and approves posting to payroll',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'FINANCE_MANAGER',
            },
        ],
    },

    # Professional Subscription
    {
        'code': 'PROF_SUB',
        'name': 'Professional Subscription Approval',
        'description': (
            'Annual professional subscription approval. '
            'Two levels: HR and Finance.'
        ),
        'content_type': 'benefits.professionalsubscription',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'HR Approval',
                'description': 'HR verifies the professional subscription request',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 2,
                'name': 'Finance Approval',
                'description': 'Finance approves for payroll posting',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'FINANCE_MANAGER',
            },
        ],
    },

    # Funeral Grant
    {
        'code': 'FUNERAL_GRANT',
        'name': 'Funeral Grant Approval',
        'description': (
            'Funeral grant claim approval: HR then Finance. '
            'Based on beneficiary listed by employee.'
        ),
        'content_type': 'benefits.funeralgrantclaim',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'HR Approval',
                'description': 'HR verifies the funeral grant claim and beneficiary',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 2,
                'name': 'Finance Approval',
                'description': 'Finance approves for payment through payroll',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'FINANCE_MANAGER',
            },
        ],
    },

    # Medical Lens
    {
        'code': 'MEDICAL_LENS',
        'name': 'Medical Lens Benefit Approval',
        'description': (
            'Medical lens benefit claim approval (once every 2 years). '
            'Two levels: HR and Finance.'
        ),
        'content_type': 'benefits.medicallensclaim',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'HR Approval',
                'description': 'HR verifies eligibility (last claim must be 2+ years ago)',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 2,
                'name': 'Finance Approval',
                'description': 'Finance approves for payment',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'FINANCE_MANAGER',
            },
        ],
    },

    # Expense Claims
    {
        'code': 'EXPENSE_CLAIM',
        'name': 'Expense Claim Approval',
        'description': 'Expense claim approval: Supervisor then Finance.',
        'content_type': 'benefits.expenseclaim',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Approval',
                'description': 'Supervisor verifies the expense claim',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'Finance Approval',
                'description': 'Finance reviews and approves for reimbursement',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'FINANCE_MANAGER',
            },
        ],
    },

    # ────────── APPRAISAL / PERFORMANCE APPROVAL ──────────
    # Goal / Target Setting Approval
    {
        'code': 'GOAL_APPROVAL',
        'name': 'Performance Goal Approval',
        'description': (
            'Approval for performance goals/targets set by employees. '
            'At each stage, employee meets with supervisor to set and review targets.'
        ),
        'content_type': 'performance.goal',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Approval',
                'description': 'Supervisor reviews and agrees on targets with employee',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'Department Head Approval',
                'description': 'Department head reviews alignment with departmental objectives',
                'approver_type': ApproverType.DEPARTMENT_HEAD,
                'skip_if_same_as_previous': True,
            },
        ],
    },

    # Appraisal Approval
    {
        'code': 'APPRAISAL',
        'name': 'Appraisal Approval',
        'description': (
            'Appraisal approval at each stage (mid-year, end-of-year): '
            'Employee -> Supervisor -> Department Head -> HR.'
        ),
        'content_type': 'performance.appraisal',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Review',
                'description': 'Supervisor reviews employee performance assessment',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'Department Head Approval',
                'description': 'Department head validates appraisal scores',
                'approver_type': ApproverType.DEPARTMENT_HEAD,
                'skip_if_same_as_previous': True,
            },
            {
                'level': 3,
                'name': 'HR Approval',
                'description': 'HR gives final approval and links to increments',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
        ],
    },

    # Probation Assessment
    {
        'code': 'PROBATION',
        'name': 'Probation Assessment Approval',
        'description': (
            'Probation assessment approval for new hires (every 3 months, 6 months, '
            'and 1 year for Directors). Supervisor -> HR -> Directorate Head.'
        ),
        'content_type': 'performance.probationassessment',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Assessment',
                'description': 'Supervisor assesses the probationer',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'HR Review',
                'description': 'HR reviews probation assessment for confirmation',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 3,
                'name': 'Directorate Head Confirmation',
                'description': 'Directorate head confirms or extends probation',
                'approver_type': ApproverType.DIRECTORATE_HEAD,
                'skip_if_same_as_previous': True,
            },
        ],
    },

    # ────────── DISCIPLINE APPROVAL ──────────
    {
        'code': 'DISCIPLINE_DIST',
        'name': 'Disciplinary Action - District',
        'description': (
            'District-level disciplinary process: District Manager handles minor offences. '
            'After 4th minor offence in 12 months, escalates to Regional Director. '
            'Serious/major offences go directly to region.'
        ),
        'content_type': 'discipline.disciplinarycase',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'District Manager Review',
                'description': 'District manager queries employee and records response',
                'approver_type': ApproverType.DISTRICT_HEAD,
            },
            {
                'level': 2,
                'name': 'Regional Director Review',
                'description': 'Regional director handles escalated cases from district',
                'approver_type': ApproverType.REGIONAL_DIRECTOR,
                'skip_if_same_as_previous': True,
                'can_skip': True,
            },
            {
                'level': 3,
                'name': 'HR Director Review',
                'description': 'Director HR reviews serious/major cases from region',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_DIRECTOR',
                'can_skip': True,
            },
            {
                'level': 4,
                'name': 'DCE Admin & HR Review',
                'description': 'DCE Admin & HR gets notified and reviews',
                'approver_type': ApproverType.DCE,
                'can_skip': True,
            },
        ],
    },

    # Grievance
    {
        'code': 'GRIEVANCE',
        'name': 'Grievance Resolution',
        'description': (
            'Grievance escalation workflow per Collective Agreement: '
            'Line Manager (5 days) -> Department Head (5 days) -> '
            'Division Head (14 days) -> DCE Admin & HR (14 days) -> CEO (21 days).'
        ),
        'content_type': 'discipline.grievance',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Line Manager Response',
                'description': 'Line manager must respond within 5 working days',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'Department Head Review',
                'description': 'If unresolved at line manager level within 5 days',
                'approver_type': ApproverType.DEPARTMENT_HEAD,
                'skip_if_same_as_previous': True,
                'can_skip': True,
            },
            {
                'level': 3,
                'name': 'Division Head Review',
                'description': 'Escalated if unresolved for 14 days at department level',
                'approver_type': ApproverType.DIVISION_HEAD,
                'skip_if_same_as_previous': True,
                'can_skip': True,
            },
            {
                'level': 4,
                'name': 'DCE Admin & HR Review',
                'description': 'Escalated if unresolved for 14 days at division level',
                'approver_type': ApproverType.DCE,
                'can_skip': True,
            },
            {
                'level': 5,
                'name': 'CEO Resolution',
                'description': 'Final escalation if unresolved for 21 days at DCE level',
                'approver_type': ApproverType.CEO,
                'can_skip': True,
            },
        ],
    },

    # ────────── PAYROLL APPROVAL ──────────
    {
        'code': 'PAYROLL_RUN',
        'name': 'Payroll Run Approval',
        'description': (
            'Payroll locking and approval workflow: '
            'Payroll Officer validates -> HR Manager reviews -> '
            'Finance Director approves -> DCE Finance -> CEO.'
        ),
        'content_type': 'payroll.payrollrun',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'HR Manager Review',
                'description': 'HR Manager reviews payroll calculations and headcount',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 2,
                'name': 'Finance Director Approval',
                'description': 'Finance Director verifies payroll totals and funding',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'FINANCE_DIRECTOR',
            },
            {
                'level': 3,
                'name': 'DCE Finance Approval',
                'description': 'DCE Finance authorizes payroll payment',
                'approver_type': ApproverType.DCE,
            },
            {
                'level': 4,
                'name': 'CEO Final Approval',
                'description': 'CEO gives final authorization for payroll disbursement',
                'approver_type': ApproverType.CEO,
            },
        ],
    },

    # Back Pay Request
    {
        'code': 'BACKPAY',
        'name': 'Back Pay Request Approval',
        'description': (
            'Arrears/retroactive payment approval: '
            'HR -> Finance -> DCE Finance.'
        ),
        'content_type': 'payroll.backpayrequest',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'HR Review',
                'description': 'HR verifies the back pay calculation and justification',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 2,
                'name': 'Finance Approval',
                'description': 'Finance Director approves the payment',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'FINANCE_DIRECTOR',
            },
            {
                'level': 3,
                'name': 'DCE Finance Approval',
                'description': 'DCE Finance authorizes the back pay',
                'approver_type': ApproverType.DCE,
                'can_skip': True,
            },
        ],
    },

    # ────────── EMPLOYEE DATA UPDATE ──────────
    {
        'code': 'DATA_UPDATE',
        'name': 'Employee Data Update Approval',
        'description': (
            'Employee data correction workflow: employees update personal details '
            'during a specific period. Changes are not applied immediately — '
            'HR reviews and approves first. Once approved, changes are saved.'
        ),
        'content_type': 'employees.dataupdaterequest',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Verification',
                'description': 'Supervisor verifies the data update request',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'HR Approval',
                'description': 'HR reviews supporting documents and approves the update',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
        ],
    },

    # ────────── EXIT MANAGEMENT ──────────
    {
        'code': 'EXIT_REQUEST',
        'name': 'Exit / Separation Approval',
        'description': (
            'Employee exit/separation approval workflow: '
            'Supervisor -> Department Head -> HR -> DCE Admin & HR.'
        ),
        'content_type': 'exits.exitrequest',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Acknowledgement',
                'description': 'Supervisor acknowledges the exit request',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'Department Head Approval',
                'description': 'Department head reviews and approves the exit',
                'approver_type': ApproverType.DEPARTMENT_HEAD,
                'skip_if_same_as_previous': True,
            },
            {
                'level': 3,
                'name': 'HR Processing',
                'description': 'HR processes exit clearance, asset return, final settlement',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 4,
                'name': 'DCE Admin & HR Approval',
                'description': 'DCE Admin & HR gives final approval for separation',
                'approver_type': ApproverType.DCE,
                'can_skip': True,
            },
        ],
    },

    # Exit Clearance
    {
        'code': 'EXIT_CLEARANCE',
        'name': 'Exit Clearance Approval',
        'description': (
            'Exit clearance across departments: each department clears the employee. '
            'HR does the final check.'
        ),
        'content_type': 'exits.exitclearance',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Department Clearance',
                'description': 'Employee department confirms no outstanding items',
                'approver_type': ApproverType.DEPARTMENT_HEAD,
            },
            {
                'level': 2,
                'name': 'HR Final Clearance',
                'description': 'HR confirms all clearance is complete',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
        ],
    },

    # ────────── RECRUITMENT ──────────
    {
        'code': 'JOB_OFFER',
        'name': 'Job Offer Approval',
        'description': (
            'Job offer approval workflow: HR prepares offer -> '
            'Director reviews -> DCE approves -> CEO for senior positions.'
        ),
        'content_type': 'recruitment.joboffer',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'HR Review',
                'description': 'HR prepares and reviews the job offer details',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 2,
                'name': 'Directorate Head Approval',
                'description': 'Requesting directorate head approves the offer',
                'approver_type': ApproverType.DIRECTORATE_HEAD,
                'skip_if_same_as_previous': True,
            },
            {
                'level': 3,
                'name': 'DCE Approval',
                'description': 'DCE Admin & HR approves the job offer',
                'approver_type': ApproverType.DCE,
            },
            {
                'level': 4,
                'name': 'CEO Approval',
                'description': 'CEO approves for senior positions',
                'approver_type': ApproverType.CEO,
                'can_skip': True,
            },
        ],
    },

    # Vacancy
    {
        'code': 'VACANCY',
        'name': 'Vacancy Request Approval',
        'description': (
            'Vacancy request approval: Department requests -> HR reviews -> '
            'DCE approves -> CEO for director-level positions.'
        ),
        'content_type': 'recruitment.vacancy',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'HR Review',
                'description': 'HR reviews the vacancy request and requirements',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
            {
                'level': 2,
                'name': 'DCE Approval',
                'description': 'DCE approves the vacancy for advertisement',
                'approver_type': ApproverType.DCE,
            },
            {
                'level': 3,
                'name': 'CEO Approval',
                'description': 'CEO approves for director-level vacancies',
                'approver_type': ApproverType.CEO,
                'can_skip': True,
            },
        ],
    },

    # ────────── SERVICE REQUEST ──────────
    {
        'code': 'SERVICE_REQ',
        'name': 'Service Request Approval',
        'description': (
            'General employee service request approval: '
            'Supervisor -> HR.'
        ),
        'content_type': 'employees.servicerequest',
        'is_default': True,
        'levels': [
            {
                'level': 1,
                'name': 'Supervisor Approval',
                'description': 'Supervisor reviews the service request',
                'approver_type': ApproverType.SUPERVISOR,
            },
            {
                'level': 2,
                'name': 'HR Processing',
                'description': 'HR processes and completes the service request',
                'approver_type': ApproverType.ROLE,
                'approver_role': 'HR_MANAGER',
            },
        ],
    },
]


class Command(BaseCommand):
    help = 'Set up NHIA approval workflows per the SRS requirements'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Delete all existing workflows before creating new ones',
        )

    def _create_roles(self):
        """Create required roles if they don't exist."""
        role_map = {}
        for role_data in REQUIRED_ROLES:
            role, created = Role.objects.get_or_create(
                code=role_data['code'],
                defaults={
                    'name': role_data['name'],
                    'level': role_data['level'],
                    'description': role_data['description'],
                    'is_system_role': True,
                    'is_active': True,
                },
            )
            role_map[role_data['code']] = role
            if created:
                self.stdout.write(self.style.SUCCESS(
                    f'  ROLE created: {role.code} ({role.name})'
                ))
            else:
                self.stdout.write(f'  ROLE exists: {role.code}')
        return role_map

    def handle(self, *args, **options):
        if options['reset']:
            count = WorkflowDefinition.objects.count()
            WorkflowDefinition.objects.all().delete()
            self.stdout.write(self.style.WARNING(f'Deleted {count} existing workflows'))

        # Step 1: Create required roles
        self.stdout.write(self.style.SUCCESS('\n=== CREATING ROLES ==='))
        role_map = self._create_roles()

        # Step 2: Create workflows
        self.stdout.write(self.style.SUCCESS('\n=== CREATING WORKFLOWS ==='))
        created = 0
        skipped = 0

        for wf_data in WORKFLOWS:
            code = wf_data['code']
            levels_data = wf_data.pop('levels')
            ct_str = wf_data.pop('content_type')

            # Resolve content type
            try:
                app_label, model = ct_str.split('.')
                content_type = ContentType.objects.get(
                    app_label=app_label, model=model
                )
            except ContentType.DoesNotExist:
                self.stdout.write(self.style.WARNING(
                    f'  SKIP {code}: content type {ct_str} not found'
                ))
                skipped += 1
                wf_data['levels'] = levels_data
                wf_data['content_type'] = ct_str
                continue

            # Check if already exists
            if WorkflowDefinition.objects.filter(code=code).exists():
                self.stdout.write(self.style.WARNING(
                    f'  SKIP {code}: already exists'
                ))
                skipped += 1
                wf_data['levels'] = levels_data
                wf_data['content_type'] = ct_str
                continue

            # Create workflow
            workflow = WorkflowDefinition.objects.create(
                code=code,
                name=wf_data['name'],
                description=wf_data.get('description', ''),
                content_type=content_type,
                is_active=True,
                is_default=wf_data.get('is_default', False),
            )

            # Create approval levels
            for level_data in levels_data:
                approver_role = None
                role_code = level_data.get('approver_role')
                if role_code:
                    approver_role = role_map.get(role_code)
                    if not approver_role:
                        # Try to find in DB
                        approver_role = Role.objects.filter(code=role_code).first()

                ApprovalLevel.objects.create(
                    workflow=workflow,
                    level=level_data['level'],
                    name=level_data['name'],
                    description=level_data.get('description', ''),
                    approver_type=level_data['approver_type'],
                    approver_role=approver_role,
                    approver_user=None,
                    can_skip=level_data.get('can_skip', False),
                    skip_if_same_as_previous=level_data.get('skip_if_same_as_previous', False),
                    allow_self_approval=level_data.get('allow_self_approval', False),
                )

            level_count = len(levels_data)
            self.stdout.write(self.style.SUCCESS(
                f'  CREATED {code}: "{wf_data["name"]}" '
                f'({level_count} levels) -> {ct_str}'
            ))
            created += 1

            # Restore for potential re-use
            wf_data['levels'] = levels_data
            wf_data['content_type'] = ct_str

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(
            f'Done! Created {created} workflows, skipped {skipped}'
        ))

        # Summary
        self.stdout.write(self.style.SUCCESS('\n=== WORKFLOW SUMMARY ==='))
        for wf in WorkflowDefinition.objects.all().order_by('code'):
            levels = wf.approval_levels.count()
            ct = f'{wf.content_type.app_label}.{wf.content_type.model}'
            default = ' [DEFAULT]' if wf.is_default else ''
            level_details = []
            for lvl in wf.approval_levels.all():
                role_info = f' ({lvl.approver_role.code})' if lvl.approver_role else ''
                skip_info = ' [skip-same]' if lvl.skip_if_same_as_previous else ''
                can_skip = ' [optional]' if lvl.can_skip else ''
                level_details.append(
                    f'    L{lvl.level}: {lvl.name} [{lvl.approver_type}]{role_info}{skip_info}{can_skip}'
                )
            self.stdout.write(
                f'\n  {wf.code}: {wf.name}{default}'
            )
            self.stdout.write(f'    Module: {ct} | Levels: {levels}')
            for detail in level_details:
                self.stdout.write(detail)
