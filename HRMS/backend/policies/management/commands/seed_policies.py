"""
Management command to seed sample policy categories and policies.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from policies.models import PolicyCategory, Policy


class Command(BaseCommand):
    help = 'Seed sample policy categories and policies'

    def handle(self, *args, **options):
        self.stdout.write('Seeding policy categories...')

        # Create policy categories
        categories = [
            {
                'name': 'Human Resources',
                'code': 'HR',
                'description': 'HR policies covering employment, conduct, and workplace guidelines',
                'icon': 'users',
                'sort_order': 1
            },
            {
                'name': 'Finance & Accounting',
                'code': 'FIN',
                'description': 'Financial policies and procedures',
                'icon': 'currency-dollar',
                'sort_order': 2
            },
            {
                'name': 'Information Technology',
                'code': 'IT',
                'description': 'IT security, usage, and data protection policies',
                'icon': 'computer-desktop',
                'sort_order': 3
            },
            {
                'name': 'Operations',
                'code': 'OPS',
                'description': 'Operational procedures and guidelines',
                'icon': 'cog',
                'sort_order': 4
            },
            {
                'name': 'Compliance & Legal',
                'code': 'LEGAL',
                'description': 'Legal and regulatory compliance policies',
                'icon': 'shield-check',
                'sort_order': 5
            },
            {
                'name': 'Health & Safety',
                'code': 'HSE',
                'description': 'Health, safety, and environmental policies',
                'icon': 'heart',
                'sort_order': 6
            },
            {
                'name': 'Administration',
                'code': 'ADMIN',
                'description': 'Administrative policies and procedures',
                'icon': 'building-office',
                'sort_order': 7
            },
        ]

        for cat_data in categories:
            cat, created = PolicyCategory.objects.get_or_create(
                code=cat_data['code'],
                defaults=cat_data
            )
            if created:
                self.stdout.write(f'  Created category: {cat.name}')
            else:
                self.stdout.write(f'  Category exists: {cat.name}')

        self.stdout.write(self.style.SUCCESS(f'Created {len(categories)} policy categories'))

        # Create sample policies
        self.stdout.write('\nSeeding sample policies...')

        hr_category = PolicyCategory.objects.get(code='HR')
        it_category = PolicyCategory.objects.get(code='IT')
        hse_category = PolicyCategory.objects.get(code='HSE')

        policies = [
            {
                'title': 'Code of Conduct',
                'code': 'HR-POL-001',
                'category': hr_category,
                'policy_type': Policy.Type.POLICY,
                'summary': 'Guidelines for professional conduct and ethical behavior in the workplace.',
                'content': '''# Code of Conduct

## 1. Purpose
This policy establishes the standards of professional conduct expected of all employees.

## 2. Scope
This policy applies to all employees, contractors, and representatives of the organization.

## 3. Standards of Conduct

### 3.1 Professional Behavior
- Treat colleagues, clients, and stakeholders with respect
- Maintain a professional demeanor in all interactions
- Avoid conflicts of interest
- Protect confidential information

### 3.2 Workplace Conduct
- Arrive on time and maintain regular attendance
- Complete assigned tasks diligently
- Collaborate effectively with team members
- Follow all organizational policies and procedures

### 3.3 Prohibited Conduct
- Harassment or discrimination of any kind
- Substance abuse in the workplace
- Theft or misuse of company property
- Falsification of records

## 4. Reporting Violations
Employees should report violations to their supervisor or HR department.

## 5. Consequences
Violations may result in disciplinary action up to and including termination.
''',
                'version': '1.0',
                'status': Policy.Status.PUBLISHED,
                'effective_date': timezone.now().date(),
                'requires_acknowledgement': True,
            },
            {
                'title': 'Leave Policy',
                'code': 'HR-POL-002',
                'category': hr_category,
                'policy_type': Policy.Type.POLICY,
                'summary': 'Policy governing employee leave entitlements and procedures.',
                'content': '''# Leave Policy

## 1. Purpose
To establish guidelines for leave management across the organization.

## 2. Types of Leave

### 2.1 Annual Leave
- Deputy Directors and below: 28 working days
- Directors: 36 working days
- Applications must be submitted 10 working days in advance

### 2.2 Sick Leave
- Excuse duty: Maximum 22 days per year
- Extended sick leave requires HR approval

### 2.3 Maternity Leave
- Normal delivery: 12 weeks (84 days)
- Abnormal delivery: 14 weeks (98 days)

### 2.4 Other Leave Types
- Compassionate Leave: Up to 5 days
- Study Leave: As approved
- Leave of Absence: Once in 5 years, max 1 year

## 3. Application Process
1. Submit leave request through the HRMS system
2. Await supervisor approval
3. Ensure proper handover before proceeding on leave

## 4. Leave Balance
- Maximum 5 days can be carried over to the next year
- Carry-over requires CEO approval
''',
                'version': '1.0',
                'status': Policy.Status.PUBLISHED,
                'effective_date': timezone.now().date(),
                'requires_acknowledgement': True,
            },
            {
                'title': 'Information Security Policy',
                'code': 'IT-POL-001',
                'category': it_category,
                'policy_type': Policy.Type.POLICY,
                'summary': 'Guidelines for protecting organizational information and IT resources.',
                'content': '''# Information Security Policy

## 1. Purpose
To protect the organization's information assets and IT infrastructure.

## 2. Password Requirements
- Minimum 8 characters
- Must include uppercase, lowercase, numbers, and special characters
- Change passwords every 90 days
- Do not share passwords with anyone

## 3. Email and Internet Usage
- Use company email for official business only
- Do not open suspicious attachments
- Report phishing attempts to IT immediately

## 4. Data Protection
- Classify data according to sensitivity
- Encrypt sensitive data in transit and at rest
- Do not store sensitive data on personal devices

## 5. Incident Reporting
Report all security incidents to IT immediately.
''',
                'version': '1.0',
                'status': Policy.Status.PUBLISHED,
                'effective_date': timezone.now().date(),
                'requires_acknowledgement': True,
            },
            {
                'title': 'Health and Safety Guidelines',
                'code': 'HSE-POL-001',
                'category': hse_category,
                'policy_type': Policy.Type.GUIDELINE,
                'summary': 'Workplace health and safety procedures and guidelines.',
                'content': '''# Health and Safety Guidelines

## 1. Purpose
To ensure a safe and healthy work environment for all employees.

## 2. General Safety Rules
- Keep work areas clean and organized
- Report hazards immediately
- Use personal protective equipment as required
- Follow emergency procedures

## 3. Emergency Procedures
- Know the location of fire exits
- Follow evacuation procedures during drills
- Report accidents and injuries immediately

## 4. First Aid
- First aid kits are located in designated areas
- Report all injuries to your supervisor

## 5. Reporting
Report all safety concerns to the HSE officer.
''',
                'version': '1.0',
                'status': Policy.Status.PUBLISHED,
                'effective_date': timezone.now().date(),
                'requires_acknowledgement': False,
            },
            {
                'title': 'Performance Management SOP',
                'code': 'HR-SOP-001',
                'category': hr_category,
                'policy_type': Policy.Type.SOP,
                'summary': 'Standard Operating Procedure for performance management and appraisals.',
                'content': '''# Performance Management SOP

## 1. Overview
This SOP outlines the performance management process.

## 2. Appraisal Cycle
1. **Goal Setting (January)**: Set objectives for the year
2. **Mid-Year Review (July)**: Review progress
3. **Year-End Appraisal (December)**: Final assessment

## 3. Components
- Performance Objectives: 60%
- Core Competencies: 20%
- Core Values: 20%

## 4. Rating Scale
| Rating | Description | Score |
|--------|-------------|-------|
| 5 | Outstanding | 90-100% |
| 4 | Exceeds Expectations | 75-89% |
| 3 | Meets Expectations | 60-74% |
| 2 | Needs Improvement | 40-59% |
| 1 | Unsatisfactory | 0-39% |

## 5. Outcomes
- Score >= 60%: Eligible for increment
- Score >= 85%: Eligible for promotion consideration
- Score < 40%: Performance Improvement Plan required
''',
                'version': '1.0',
                'status': Policy.Status.PUBLISHED,
                'effective_date': timezone.now().date(),
                'requires_acknowledgement': True,
            },
        ]

        for policy_data in policies:
            policy, created = Policy.objects.get_or_create(
                code=policy_data['code'],
                defaults={
                    **policy_data,
                    'published_at': timezone.now() if policy_data['status'] == Policy.Status.PUBLISHED else None
                }
            )
            if created:
                self.stdout.write(f'  Created policy: {policy.title}')
            else:
                self.stdout.write(f'  Policy exists: {policy.title}')

        self.stdout.write(self.style.SUCCESS(f'\nCreated {len(policies)} sample policies'))
        self.stdout.write(self.style.SUCCESS('\nPolicy module seeding complete!'))
