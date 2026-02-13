"""
Workflow seeder: Approval workflow definitions for all modules.
Adapted from setup_approval_workflows.py management command.
"""

from django.contrib.contenttypes.models import ContentType

from .base import BaseSeeder


class WorkflowSeeder(BaseSeeder):
    module_name = 'workflow'

    def seed(self):
        self._seed_workflows()
        return self.stats

    def _seed_workflows(self):
        from workflow.models import WorkflowDefinition, ApprovalLevel, ApproverType
        from accounts.models import Role

        # Build role cache
        role_cache = {}
        for role in Role.objects.all():
            role_cache[role.code] = role

        workflows = self._get_workflow_definitions()

        for wf_data in workflows:
            levels_data = wf_data.pop('levels')
            ct_str = wf_data.pop('content_type')

            # Resolve content type
            try:
                app_label, model = ct_str.split('.')
                content_type = ContentType.objects.get(
                    app_label=app_label, model=model
                )
            except ContentType.DoesNotExist:
                self._log(f'SKIP {wf_data["code"]}: content type {ct_str} not found')
                self.stats['skipped'] += 1
                continue

            code = wf_data.pop('code')
            wf_data['content_type'] = content_type
            wf_data['is_active'] = True

            wf, created = self._update_or_create(
                WorkflowDefinition,
                {'code': code, 'version': 1},
                wf_data
            )

            # Create/update approval levels
            for level_data in levels_data:
                approver_role = None
                role_code = level_data.pop('approver_role', None)
                if role_code:
                    approver_role = role_cache.get(role_code)

                level_num = level_data.pop('level')
                level_data['approver_role'] = approver_role

                self._update_or_create(
                    ApprovalLevel,
                    {'workflow': wf, 'level': level_num},
                    level_data
                )

    def _get_workflow_definitions(self):
        """Return all workflow definitions."""
        AT = 'workflow.models.ApproverType'  # noqa - just for reference
        return [
            # Leave - Head Office
            {
                'code': 'LEAVE_HO',
                'name': 'Leave Approval - Head Office',
                'description': 'Leave approval workflow for head office staff',
                'content_type': 'leave.leaverequest',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'Supervisor Approval', 'description': 'Direct supervisor approves the leave', 'approver_type': 'SUPERVISOR'},
                    {'level': 2, 'name': 'Department Head', 'description': 'Department head reviews and approves', 'approver_type': 'DEPARTMENT_HEAD', 'skip_if_same_as_previous': True},
                    {'level': 3, 'name': 'HR Review', 'description': 'HR reviews leave balance and policy compliance', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                    {'level': 4, 'name': 'Directorate Head', 'description': 'Directorate head for extended leave', 'approver_type': 'DIRECTORATE_HEAD', 'can_skip': True},
                ],
            },
            # Leave - District
            {
                'code': 'LEAVE_DIST',
                'name': 'Leave Approval - District',
                'description': 'Leave approval workflow for district staff',
                'content_type': 'leave.leaverequest',
                'levels': [
                    {'level': 1, 'name': 'Supervisor Approval', 'description': 'Direct supervisor approves', 'approver_type': 'SUPERVISOR'},
                    {'level': 2, 'name': 'District Head', 'description': 'District head approves', 'approver_type': 'DISTRICT_HEAD'},
                    {'level': 3, 'name': 'Regional Director', 'description': 'Regional director for extended leave', 'approver_type': 'REGIONAL_DIRECTOR', 'can_skip': True},
                ],
            },
            # Benefits / Loans
            {
                'code': 'LOAN_APPROVAL',
                'name': 'Loan Approval',
                'description': 'Loan application approval workflow',
                'content_type': 'benefits.loanaccount',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'Supervisor Recommendation', 'description': 'Supervisor recommends the loan', 'approver_type': 'SUPERVISOR'},
                    {'level': 2, 'name': 'HR Review', 'description': 'HR verifies eligibility and policy', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                    {'level': 3, 'name': 'Finance Approval', 'description': 'Finance verifies budget availability', 'approver_type': 'ROLE', 'approver_role': 'FINANCE_DIRECTOR'},
                    {'level': 4, 'name': 'DCE Approval', 'description': 'DCE final approval for large amounts', 'approver_type': 'DCE', 'can_skip': True},
                ],
            },
            # Performance - Appraisal
            {
                'code': 'APPRAISAL',
                'name': 'Appraisal Review',
                'description': 'Performance appraisal review and approval',
                'content_type': 'performance.appraisal',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'Supervisor Review', 'description': 'Supervisor reviews appraisal', 'approver_type': 'SUPERVISOR'},
                    {'level': 2, 'name': 'Department Head Review', 'description': 'Department head calibration', 'approver_type': 'DEPARTMENT_HEAD', 'skip_if_same_as_previous': True},
                    {'level': 3, 'name': 'HR Review', 'description': 'HR final review', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                ],
            },
            # Performance - Goals
            {
                'code': 'GOAL_APPROVAL',
                'name': 'Goal Setting Approval',
                'description': 'Goal approval workflow',
                'content_type': 'performance.appraisal',
                'levels': [
                    {'level': 1, 'name': 'Supervisor Approval', 'description': 'Supervisor approves goals', 'approver_type': 'SUPERVISOR'},
                    {'level': 2, 'name': 'Department Head', 'description': 'Department head aligns goals', 'approver_type': 'DEPARTMENT_HEAD', 'can_skip': True},
                ],
            },
            # Discipline
            {
                'code': 'DISCIPLINE',
                'name': 'Disciplinary Action',
                'description': 'Disciplinary process escalation',
                'content_type': 'discipline.disciplinarycase',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'Supervisor Report', 'description': 'Supervisor initiates and reports', 'approver_type': 'SUPERVISOR'},
                    {'level': 2, 'name': 'Department Head Review', 'description': 'Department head reviews the case', 'approver_type': 'DEPARTMENT_HEAD', 'skip_if_same_as_previous': True},
                    {'level': 3, 'name': 'HR Investigation', 'description': 'HR investigates and recommends action', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                    {'level': 4, 'name': 'DCE Admin & HR Review', 'description': 'DCE reviews for serious cases', 'approver_type': 'DCE', 'can_skip': True},
                ],
            },
            # Grievance
            {
                'code': 'GRIEVANCE',
                'name': 'Grievance Resolution',
                'description': 'Grievance escalation per Collective Agreement',
                'content_type': 'discipline.grievance',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'Line Manager Response', 'description': 'Line manager responds within 5 working days', 'approver_type': 'SUPERVISOR'},
                    {'level': 2, 'name': 'Department Head Review', 'description': 'If unresolved at line manager level', 'approver_type': 'DEPARTMENT_HEAD', 'skip_if_same_as_previous': True, 'can_skip': True},
                    {'level': 3, 'name': 'Division Head Review', 'description': 'Escalated if unresolved', 'approver_type': 'DIVISION_HEAD', 'skip_if_same_as_previous': True, 'can_skip': True},
                    {'level': 4, 'name': 'DCE Admin & HR Review', 'description': 'DCE review', 'approver_type': 'DCE', 'can_skip': True},
                    {'level': 5, 'name': 'CEO Resolution', 'description': 'Final escalation', 'approver_type': 'CEO', 'can_skip': True},
                ],
            },
            # Payroll
            {
                'code': 'PAYROLL_RUN',
                'name': 'Payroll Run Approval',
                'description': 'Payroll locking and approval workflow',
                'content_type': 'payroll.payrollrun',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'HR Manager Review', 'description': 'HR reviews payroll calculations', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                    {'level': 2, 'name': 'Finance Director Approval', 'description': 'Finance verifies totals', 'approver_type': 'ROLE', 'approver_role': 'FINANCE_DIRECTOR'},
                    {'level': 3, 'name': 'DCE Finance Approval', 'description': 'DCE authorizes payment', 'approver_type': 'DCE'},
                    {'level': 4, 'name': 'CEO Final Approval', 'description': 'CEO final authorization', 'approver_type': 'CEO'},
                ],
            },
            # Back Pay
            {
                'code': 'BACKPAY',
                'name': 'Back Pay Request Approval',
                'description': 'Arrears/retroactive payment approval',
                'content_type': 'payroll.backpayrequest',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'HR Review', 'description': 'HR verifies calculation', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                    {'level': 2, 'name': 'Finance Approval', 'description': 'Finance approves payment', 'approver_type': 'ROLE', 'approver_role': 'FINANCE_DIRECTOR'},
                    {'level': 3, 'name': 'DCE Finance Approval', 'description': 'DCE authorizes', 'approver_type': 'DCE', 'can_skip': True},
                ],
            },
            # Data Update
            {
                'code': 'DATA_UPDATE',
                'name': 'Employee Data Update Approval',
                'description': 'Employee data correction workflow',
                'content_type': 'employees.dataupdaterequest',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'Supervisor Verification', 'description': 'Supervisor verifies request', 'approver_type': 'SUPERVISOR'},
                    {'level': 2, 'name': 'HR Approval', 'description': 'HR reviews and approves', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                ],
            },
            # Exit
            {
                'code': 'EXIT_REQUEST',
                'name': 'Exit / Separation Approval',
                'description': 'Employee exit/separation approval',
                'content_type': 'exits.exitrequest',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'Supervisor Acknowledgement', 'description': 'Supervisor acknowledges', 'approver_type': 'SUPERVISOR'},
                    {'level': 2, 'name': 'Department Head Approval', 'description': 'Department head reviews', 'approver_type': 'DEPARTMENT_HEAD', 'skip_if_same_as_previous': True},
                    {'level': 3, 'name': 'HR Processing', 'description': 'HR processes exit', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                    {'level': 4, 'name': 'DCE Admin & HR Approval', 'description': 'DCE final approval', 'approver_type': 'DCE', 'can_skip': True},
                ],
            },
            # Recruitment - Job Offer
            {
                'code': 'JOB_OFFER',
                'name': 'Job Offer Approval',
                'description': 'Job offer approval workflow',
                'content_type': 'recruitment.joboffer',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'HR Review', 'description': 'HR prepares and reviews offer', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                    {'level': 2, 'name': 'Directorate Head Approval', 'description': 'Directorate head approves', 'approver_type': 'DIRECTORATE_HEAD', 'skip_if_same_as_previous': True},
                    {'level': 3, 'name': 'DCE Approval', 'description': 'DCE approves offer', 'approver_type': 'DCE'},
                    {'level': 4, 'name': 'CEO Approval', 'description': 'CEO for senior positions', 'approver_type': 'CEO', 'can_skip': True},
                ],
            },
            # Recruitment - Vacancy
            {
                'code': 'VACANCY',
                'name': 'Vacancy Request Approval',
                'description': 'Vacancy request approval',
                'content_type': 'recruitment.vacancy',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'HR Review', 'description': 'HR reviews vacancy', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                    {'level': 2, 'name': 'DCE Approval', 'description': 'DCE approves vacancy', 'approver_type': 'DCE'},
                    {'level': 3, 'name': 'CEO Approval', 'description': 'CEO for director-level', 'approver_type': 'CEO', 'can_skip': True},
                ],
            },
            # Service Request
            {
                'code': 'SERVICE_REQ',
                'name': 'Service Request Approval',
                'description': 'General employee service request approval',
                'content_type': 'employees.servicerequest',
                'is_default': True,
                'levels': [
                    {'level': 1, 'name': 'Supervisor Approval', 'description': 'Supervisor reviews request', 'approver_type': 'SUPERVISOR'},
                    {'level': 2, 'name': 'HR Processing', 'description': 'HR processes request', 'approver_type': 'ROLE', 'approver_role': 'HR_MANAGER'},
                ],
            },
        ]
