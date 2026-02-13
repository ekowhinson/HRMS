"""
Discipline seeder: Misconduct categories and grievance categories.
"""

from .base import BaseSeeder


class DisciplineSeeder(BaseSeeder):
    module_name = 'discipline'

    def seed(self):
        self._seed_misconduct_categories()
        self._seed_grievance_categories()
        return self.stats

    def _seed_misconduct_categories(self):
        from discipline.models import MisconductCategory

        categories = [
            {
                'code': 'LATE',
                'name': 'Late Attendance',
                'description': 'Persistent lateness to work without acceptable reason',
                'severity': 'MINOR',
                'recommended_action': 'Verbal warning, followed by written warning on repeat',
            },
            {
                'code': 'UNAUTH_ABS',
                'name': 'Unauthorized Absence',
                'description': 'Absence from work without prior approval or notification',
                'severity': 'MINOR',
                'recommended_action': 'Written warning, salary deduction for days absent',
            },
            {
                'code': 'INSUBORD',
                'name': 'Insubordination',
                'description': 'Refusal to follow lawful and reasonable instructions from supervisor',
                'severity': 'MODERATE',
                'recommended_action': 'Written warning, possible suspension',
            },
            {
                'code': 'NEGLIGENCE',
                'name': 'Negligence',
                'description': 'Failure to exercise reasonable care in performing duties',
                'severity': 'MODERATE',
                'recommended_action': 'Written warning, retraining, possible demotion',
            },
            {
                'code': 'REPEAT',
                'name': 'Repeated Misconduct',
                'description': 'Pattern of repeated minor or moderate offenses after prior warnings',
                'severity': 'MAJOR',
                'recommended_action': 'Final written warning, suspension without pay',
            },
            {
                'code': 'HARASSMENT',
                'name': 'Harassment',
                'description': 'Sexual harassment, bullying, or any form of workplace harassment',
                'severity': 'MAJOR',
                'recommended_action': 'Suspension pending investigation, possible termination',
            },
            {
                'code': 'THEFT',
                'name': 'Theft / Fraud',
                'description': 'Theft of organizational property, fraud, or embezzlement',
                'severity': 'GROSS',
                'recommended_action': 'Summary dismissal, report to law enforcement',
            },
            {
                'code': 'FALSIFY',
                'name': 'Falsification of Records',
                'description': 'Falsifying official documents, attendance records, or qualifications',
                'severity': 'GROSS',
                'recommended_action': 'Summary dismissal',
            },
            {
                'code': 'VIOLENCE',
                'name': 'Violence',
                'description': 'Physical violence, assault, or threats of violence in the workplace',
                'severity': 'GROSS',
                'recommended_action': 'Summary dismissal, report to law enforcement',
            },
            {
                'code': 'SUBSTANCE',
                'name': 'Substance Abuse',
                'description': 'Being under the influence of alcohol or drugs at work',
                'severity': 'GROSS',
                'recommended_action': 'Suspension, mandatory counseling, possible termination',
            },
        ]

        for data in categories:
            code = data.pop('code')
            self._update_or_create(MisconductCategory, {'code': code}, data)

    def _seed_grievance_categories(self):
        from discipline.models import GrievanceCategory

        categories = [
            {
                'code': 'WORK_COND',
                'name': 'Working Conditions',
                'description': 'Grievances related to physical work environment, facilities, and working conditions',
            },
            {
                'code': 'HARASS_DISC',
                'name': 'Harassment / Discrimination',
                'description': 'Grievances related to harassment, discrimination, or unfair treatment',
            },
            {
                'code': 'COMP_BEN',
                'name': 'Compensation & Benefits',
                'description': 'Grievances related to salary, allowances, benefits, or entitlements',
            },
            {
                'code': 'MGMT_ISSUE',
                'name': 'Management Issues',
                'description': 'Grievances related to management decisions, supervision, or leadership',
            },
            {
                'code': 'HEALTH_SAFE',
                'name': 'Health & Safety',
                'description': 'Grievances related to health hazards, safety violations, or unsafe practices',
            },
            {
                'code': 'POLICY_DISP',
                'name': 'Policy Disputes',
                'description': 'Grievances related to unfair application of organizational policies',
            },
        ]

        for data in categories:
            code = data.pop('code')
            self._update_or_create(GrievanceCategory, {'code': code}, data)
