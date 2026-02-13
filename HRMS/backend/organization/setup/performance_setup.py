"""
Performance seeder: Rating scale, competencies, core values, goal categories.
"""

from .base import BaseSeeder


class PerformanceSeeder(BaseSeeder):
    module_name = 'performance'

    def seed(self):
        self._seed_rating_scale()
        self._seed_competencies()
        self._seed_core_values()
        self._seed_goal_categories()
        return self.stats

    def _seed_rating_scale(self):
        from performance.models import RatingScale, RatingScaleLevel

        scale, _ = self._update_or_create(
            RatingScale,
            {'name': 'Standard 5-Point Rating Scale'},
            {
                'description': 'Default performance rating scale with 5 levels',
                'is_default': True,
                'is_active': True,
            }
        )

        levels = [
            {'level': 1, 'name': 'Unsatisfactory', 'description': 'Performance is below minimum acceptable standards (0-39%)', 'min_percentage': 0, 'max_percentage': 39},
            {'level': 2, 'name': 'Below Expectations', 'description': 'Performance does not consistently meet expectations (40-59%)', 'min_percentage': 40, 'max_percentage': 59},
            {'level': 3, 'name': 'Meets Expectations', 'description': 'Performance consistently meets expected standards (60-74%)', 'min_percentage': 60, 'max_percentage': 74},
            {'level': 4, 'name': 'Exceeds Expectations', 'description': 'Performance frequently exceeds expected standards (75-89%)', 'min_percentage': 75, 'max_percentage': 89},
            {'level': 5, 'name': 'Outstanding', 'description': 'Performance is exceptional and consistently exceeds all expectations (90-100%)', 'min_percentage': 90, 'max_percentage': 100},
        ]

        for data in levels:
            level = data.pop('level')
            self._update_or_create(
                RatingScaleLevel,
                {'rating_scale': scale, 'level': level},
                data
            )

    def _seed_competencies(self):
        from performance.models import Competency, CompetencyLevel

        competencies = [
            {
                'code': 'COMM',
                'name': 'Communication',
                'description': 'Ability to communicate effectively in written and verbal forms',
                'category': 'CORE',
                'levels': [
                    {'level': 1, 'name': 'Basic', 'description': 'Communicates simple information clearly'},
                    {'level': 2, 'name': 'Developing', 'description': 'Adapts communication style to audience'},
                    {'level': 3, 'name': 'Proficient', 'description': 'Communicates complex ideas effectively'},
                    {'level': 4, 'name': 'Advanced', 'description': 'Influences through strategic communication'},
                    {'level': 5, 'name': 'Expert', 'description': 'Sets communication standards organization-wide'},
                ],
            },
            {
                'code': 'PROB_SOLV',
                'name': 'Problem Solving',
                'description': 'Ability to identify, analyze, and resolve problems effectively',
                'category': 'CORE',
                'levels': [
                    {'level': 1, 'name': 'Basic', 'description': 'Solves routine problems with guidance'},
                    {'level': 2, 'name': 'Developing', 'description': 'Independently resolves common problems'},
                    {'level': 3, 'name': 'Proficient', 'description': 'Analyzes complex issues systematically'},
                    {'level': 4, 'name': 'Advanced', 'description': 'Creates innovative solutions to complex problems'},
                    {'level': 5, 'name': 'Expert', 'description': 'Solves unprecedented organizational challenges'},
                ],
            },
            {
                'code': 'ADAPT',
                'name': 'Adaptability',
                'description': 'Ability to adjust to changing conditions and priorities',
                'category': 'CORE',
                'levels': [
                    {'level': 1, 'name': 'Basic', 'description': 'Accepts change when directed'},
                    {'level': 2, 'name': 'Developing', 'description': 'Adjusts to change with minimal disruption'},
                    {'level': 3, 'name': 'Proficient', 'description': 'Proactively adapts to new situations'},
                    {'level': 4, 'name': 'Advanced', 'description': 'Leads others through change'},
                    {'level': 5, 'name': 'Expert', 'description': 'Drives organizational transformation'},
                ],
            },
            {
                'code': 'TECH_EXP',
                'name': 'Technical Expertise',
                'description': 'Depth of knowledge and skill in relevant technical areas',
                'category': 'TECHNICAL',
                'levels': [
                    {'level': 1, 'name': 'Basic', 'description': 'Understands fundamental technical concepts'},
                    {'level': 2, 'name': 'Developing', 'description': 'Applies technical knowledge to routine tasks'},
                    {'level': 3, 'name': 'Proficient', 'description': 'Deep expertise in core technical areas'},
                    {'level': 4, 'name': 'Advanced', 'description': 'Recognized as technical authority'},
                    {'level': 5, 'name': 'Expert', 'description': 'Industry-level expertise, mentors others'},
                ],
            },
            {
                'code': 'PLAN_ORG',
                'name': 'Planning & Organization',
                'description': 'Ability to plan, prioritize, and organize work effectively',
                'category': 'CORE',
                'levels': [
                    {'level': 1, 'name': 'Basic', 'description': 'Completes assigned tasks on time'},
                    {'level': 2, 'name': 'Developing', 'description': 'Plans own work and meets deadlines'},
                    {'level': 3, 'name': 'Proficient', 'description': 'Manages multiple priorities effectively'},
                    {'level': 4, 'name': 'Advanced', 'description': 'Plans and coordinates team activities'},
                    {'level': 5, 'name': 'Expert', 'description': 'Drives strategic planning at organizational level'},
                ],
            },
            {
                'code': 'LEADERSHIP',
                'name': 'Leadership',
                'description': 'Ability to inspire, guide, and develop others',
                'category': 'LEADERSHIP',
                'levels': [
                    {'level': 1, 'name': 'Basic', 'description': 'Sets a positive example for peers'},
                    {'level': 2, 'name': 'Developing', 'description': 'Guides and supports team members'},
                    {'level': 3, 'name': 'Proficient', 'description': 'Effectively leads a team'},
                    {'level': 4, 'name': 'Advanced', 'description': 'Develops future leaders'},
                    {'level': 5, 'name': 'Expert', 'description': 'Shapes organizational culture and vision'},
                ],
            },
            {
                'code': 'CUST_FOCUS',
                'name': 'Customer Focus',
                'description': 'Commitment to understanding and meeting customer needs',
                'category': 'CORE',
                'levels': [
                    {'level': 1, 'name': 'Basic', 'description': 'Responds to customer requests'},
                    {'level': 2, 'name': 'Developing', 'description': 'Anticipates basic customer needs'},
                    {'level': 3, 'name': 'Proficient', 'description': 'Proactively addresses customer concerns'},
                    {'level': 4, 'name': 'Advanced', 'description': 'Develops customer-centric processes'},
                    {'level': 5, 'name': 'Expert', 'description': 'Transforms customer experience organization-wide'},
                ],
            },
        ]

        for data in competencies:
            levels_data = data.pop('levels')
            code = data.pop('code')
            comp, _ = self._update_or_create(Competency, {'code': code}, data)

            for level_data in levels_data:
                level = level_data.pop('level')
                self._update_or_create(
                    CompetencyLevel,
                    {'competency': comp, 'level': level},
                    level_data
                )

    def _seed_core_values(self):
        from performance.models import CoreValue

        values = [
            {
                'code': 'INTEGRITY',
                'name': 'Integrity',
                'description': 'Acting with honesty, transparency, and ethical conduct in all dealings',
                'behavioral_indicators': (
                    '- Demonstrates honesty in all interactions\n'
                    '- Takes responsibility for own actions\n'
                    '- Maintains confidentiality of sensitive information\n'
                    '- Follows through on commitments\n'
                    '- Reports unethical behavior'
                ),
                'sort_order': 1,
            },
            {
                'code': 'CUST_FIRST',
                'name': 'Customer Focus',
                'description': 'Putting the needs of customers and stakeholders at the center of all activities',
                'behavioral_indicators': (
                    '- Actively listens to customer needs\n'
                    '- Responds promptly to customer inquiries\n'
                    '- Goes beyond minimum requirements to serve customers\n'
                    '- Seeks feedback to improve service delivery\n'
                    '- Treats all customers with respect and dignity'
                ),
                'sort_order': 2,
            },
            {
                'code': 'TEAMWORK',
                'name': 'Teamwork',
                'description': 'Collaborating effectively with colleagues to achieve shared goals',
                'behavioral_indicators': (
                    '- Shares knowledge and resources freely\n'
                    '- Supports colleagues in achieving team objectives\n'
                    '- Respects diverse perspectives and opinions\n'
                    '- Contributes to a positive team environment\n'
                    '- Resolves conflicts constructively'
                ),
                'sort_order': 3,
            },
            {
                'code': 'ACCOUNTABILITY',
                'name': 'Accountability',
                'description': 'Taking ownership of responsibilities and delivering on commitments',
                'behavioral_indicators': (
                    '- Delivers work on time and to standard\n'
                    '- Takes ownership of mistakes and corrects them\n'
                    '- Uses resources responsibly and efficiently\n'
                    '- Reports progress and escalates issues proactively\n'
                    '- Holds self and others to high performance standards'
                ),
                'sort_order': 4,
            },
            {
                'code': 'EXCELLENCE',
                'name': 'Excellence',
                'description': 'Striving for the highest quality in all work and continuous improvement',
                'behavioral_indicators': (
                    '- Sets high standards for work quality\n'
                    '- Continuously seeks to improve processes\n'
                    '- Stays current with best practices\n'
                    '- Embraces innovation and new ideas\n'
                    '- Learns from feedback and experiences'
                ),
                'sort_order': 5,
            },
        ]

        for data in values:
            code = data.pop('code')
            self._update_or_create(CoreValue, {'code': code}, data)

    def _seed_goal_categories(self):
        from performance.models import GoalCategory

        categories = [
            {'name': 'Financial Performance', 'description': 'Revenue, cost management, and financial targets'},
            {'name': 'Customer Service', 'description': 'Customer satisfaction, retention, and service delivery'},
            {'name': 'Process Improvement', 'description': 'Operational efficiency, process optimization'},
            {'name': 'Learning & Growth', 'description': 'Professional development, skill acquisition'},
            {'name': 'Innovation', 'description': 'Creative solutions, new initiatives, digital transformation'},
        ]

        for data in categories:
            name = data.pop('name')
            self._update_or_create(GoalCategory, {'name': name}, data)
