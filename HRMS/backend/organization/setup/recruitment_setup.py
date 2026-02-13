"""
Recruitment seeder: Interview score templates with scoring categories.
Adapted from seed_interview_templates.py management command.
"""

from .base import BaseSeeder


class RecruitmentSeeder(BaseSeeder):
    module_name = 'recruitment'

    def seed(self):
        self._seed_interview_templates()
        return self.stats

    def _seed_interview_templates(self):
        from recruitment.models import InterviewScoreTemplate, InterviewScoreCategory

        templates = [
            {
                'code': 'STD_RECRUIT',
                'name': 'Standard Recruitment Interview',
                'template_type': 'RECRUITMENT',
                'description': 'Standard interview scoring template for general recruitment',
                'max_total_score': 100,
                'pass_score': 60,
                'instructions': 'Score each category from 0 to maximum points. Total must reach pass mark.',
                'categories': [
                    {'name': 'Technical/Professional Knowledge', 'max_score': 25, 'weight': 25, 'sort_order': 1, 'description': 'Depth of knowledge in relevant field'},
                    {'name': 'Communication Skills', 'max_score': 15, 'weight': 15, 'sort_order': 2, 'description': 'Verbal and written communication ability'},
                    {'name': 'Problem Solving', 'max_score': 20, 'weight': 20, 'sort_order': 3, 'description': 'Analytical and problem-solving abilities'},
                    {'name': 'Experience & Qualifications', 'max_score': 20, 'weight': 20, 'sort_order': 4, 'description': 'Relevance of experience and qualifications'},
                    {'name': 'Cultural Fit & Attitude', 'max_score': 10, 'weight': 10, 'sort_order': 5, 'description': 'Alignment with organizational values'},
                    {'name': 'Presentation & Appearance', 'max_score': 10, 'weight': 10, 'sort_order': 6, 'description': 'Professional presentation'},
                ],
            },
            {
                'code': 'PROMOTION',
                'name': 'Promotion Interview',
                'template_type': 'PROMOTION',
                'description': 'Interview template for internal promotion assessments',
                'max_total_score': 100,
                'pass_score': 65,
                'instructions': 'Assess candidate based on current role performance and readiness for promotion.',
                'categories': [
                    {'name': 'Current Role Performance', 'max_score': 25, 'weight': 25, 'sort_order': 1, 'description': 'Track record in current position'},
                    {'name': 'Leadership Potential', 'max_score': 20, 'weight': 20, 'sort_order': 2, 'description': 'Demonstrated leadership ability'},
                    {'name': 'Technical Competence', 'max_score': 20, 'weight': 20, 'sort_order': 3, 'description': 'Technical skills for target role'},
                    {'name': 'Strategic Thinking', 'max_score': 15, 'weight': 15, 'sort_order': 4, 'description': 'Strategic and forward-thinking ability'},
                    {'name': 'Organizational Knowledge', 'max_score': 10, 'weight': 10, 'sort_order': 5, 'description': 'Understanding of organization'},
                    {'name': 'Development Plan', 'max_score': 10, 'weight': 10, 'sort_order': 6, 'description': 'Career development and growth plans'},
                ],
            },
            {
                'code': 'DRIVER_INT',
                'name': 'Drivers Interview',
                'template_type': 'DRIVER',
                'description': 'Interview template for driver recruitment',
                'max_total_score': 100,
                'pass_score': 70,
                'instructions': 'Assess driving competence, safety awareness, and fitness for role.',
                'categories': [
                    {'name': 'Driving Experience', 'max_score': 25, 'weight': 25, 'sort_order': 1, 'description': 'Years and type of driving experience'},
                    {'name': 'Vehicle Knowledge', 'max_score': 20, 'weight': 20, 'sort_order': 2, 'description': 'Knowledge of vehicle maintenance'},
                    {'name': 'Safety Awareness', 'max_score': 25, 'weight': 25, 'sort_order': 3, 'description': 'Road safety knowledge and practices'},
                    {'name': 'Route Knowledge', 'max_score': 15, 'weight': 15, 'sort_order': 4, 'description': 'Knowledge of local routes and geography'},
                    {'name': 'Physical Fitness', 'max_score': 15, 'weight': 15, 'sort_order': 5, 'description': 'Physical fitness and medical clearance'},
                ],
            },
            {
                'code': 'TECH_ASSESS',
                'name': 'Technical Assessment',
                'template_type': 'TECHNICAL',
                'description': 'Technical assessment template for IT and engineering roles',
                'max_total_score': 100,
                'pass_score': 65,
                'instructions': 'Assess technical depth, practical skills, and problem-solving ability.',
                'categories': [
                    {'name': 'Core Technical Skills', 'max_score': 30, 'weight': 30, 'sort_order': 1, 'description': 'Proficiency in required technologies'},
                    {'name': 'Practical Problem Solving', 'max_score': 25, 'weight': 25, 'sort_order': 2, 'description': 'Ability to solve technical problems'},
                    {'name': 'System Design', 'max_score': 20, 'weight': 20, 'sort_order': 3, 'description': 'System design and architecture thinking'},
                    {'name': 'Code Quality', 'max_score': 15, 'weight': 15, 'sort_order': 4, 'description': 'Code quality, standards, and best practices'},
                    {'name': 'Learning Ability', 'max_score': 10, 'weight': 10, 'sort_order': 5, 'description': 'Ability and willingness to learn new technologies'},
                ],
            },
        ]

        for data in templates:
            categories_data = data.pop('categories')
            code = data.pop('code')

            template, _ = self._update_or_create(
                InterviewScoreTemplate,
                {'code': code},
                data
            )

            for cat_data in categories_data:
                cat_name = cat_data.pop('name')
                self._update_or_create(
                    InterviewScoreCategory,
                    {'template': template, 'name': cat_name},
                    cat_data
                )
