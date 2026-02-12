"""
Seed command for interview scoring templates.
"""

from django.core.management.base import BaseCommand
from recruitment.models import InterviewScoreTemplate, InterviewScoreCategory


class Command(BaseCommand):
    help = 'Seed standard interview scoring templates'

    def handle(self, *args, **options):
        templates = [
            {
                'code': 'RECRUIT-STD',
                'name': 'Standard Recruitment Interview Form',
                'template_type': InterviewScoreTemplate.TemplateType.RECRUITMENT,
                'description': 'Standard interview scoring form for external recruitment candidates (100 points)',
                'max_total_score': 100,
                'pass_score': 60,
                'instructions': '''
Rate each category from 1-10 (or as specified).
Total score is calculated as weighted sum.
Pass mark: 60 points (60%)
'''.strip(),
                'categories': [
                    {'name': 'Educational Qualification', 'max_score': 10, 'weight': 1.0,
                     'description': 'Relevance and level of education',
                     'scoring_guide': '1-3: Below requirements, 4-6: Meets minimum, 7-8: Exceeds, 9-10: Exceptional'},
                    {'name': 'Work Experience', 'max_score': 15, 'weight': 1.0,
                     'description': 'Relevant work experience and accomplishments',
                     'scoring_guide': '1-5: Limited, 6-10: Adequate, 11-13: Strong, 14-15: Exceptional'},
                    {'name': 'Technical Knowledge', 'max_score': 15, 'weight': 1.0,
                     'description': 'Technical skills relevant to the position',
                     'scoring_guide': '1-5: Basic, 6-10: Competent, 11-13: Proficient, 14-15: Expert'},
                    {'name': 'Communication Skills', 'max_score': 15, 'weight': 1.0,
                     'description': 'Verbal and written communication ability',
                     'scoring_guide': '1-5: Poor, 6-10: Adequate, 11-13: Good, 14-15: Excellent'},
                    {'name': 'Problem Solving', 'max_score': 15, 'weight': 1.0,
                     'description': 'Analytical thinking and problem-solving ability',
                     'scoring_guide': '1-5: Limited, 6-10: Adequate, 11-13: Strong, 14-15: Outstanding'},
                    {'name': 'Cultural Fit', 'max_score': 10, 'weight': 1.0,
                     'description': 'Alignment with organizational values and culture',
                     'scoring_guide': '1-3: Poor fit, 4-6: Acceptable, 7-8: Good fit, 9-10: Excellent fit'},
                    {'name': 'Motivation & Attitude', 'max_score': 10, 'weight': 1.0,
                     'description': 'Enthusiasm, attitude, and career motivation',
                     'scoring_guide': '1-3: Low, 4-6: Moderate, 7-8: High, 9-10: Exceptional'},
                    {'name': 'Presentation & Appearance', 'max_score': 10, 'weight': 1.0,
                     'description': 'Professional presentation and demeanor',
                     'scoring_guide': '1-3: Poor, 4-6: Acceptable, 7-8: Professional, 9-10: Outstanding'},
                ]
            },
            {
                'code': 'PROMO-INT',
                'name': 'Promotion Interview Form',
                'template_type': InterviewScoreTemplate.TemplateType.PROMOTION,
                'description': 'Interview scoring form for internal promotion candidates (100 points)',
                'max_total_score': 100,
                'pass_score': 60,
                'instructions': '''
Rate each category from 1-10 (or as specified).
Considers current performance and potential for new role.
Pass mark: 60 points (60%)
'''.strip(),
                'categories': [
                    {'name': 'Current Performance', 'max_score': 15, 'weight': 1.0,
                     'description': 'Performance in current role based on appraisal records',
                     'scoring_guide': '1-5: Below expectations, 6-10: Meets expectations, 11-13: Exceeds, 14-15: Outstanding'},
                    {'name': 'Leadership Potential', 'max_score': 15, 'weight': 1.0,
                     'description': 'Demonstrated leadership qualities and potential',
                     'scoring_guide': '1-5: Limited, 6-10: Developing, 11-13: Strong, 14-15: Exceptional'},
                    {'name': 'Technical Competency', 'max_score': 15, 'weight': 1.0,
                     'description': 'Technical skills required for the new position',
                     'scoring_guide': '1-5: Needs development, 6-10: Competent, 11-13: Proficient, 14-15: Expert'},
                    {'name': 'Strategic Thinking', 'max_score': 10, 'weight': 1.0,
                     'description': 'Ability to think strategically about organizational goals',
                     'scoring_guide': '1-3: Limited, 4-6: Developing, 7-8: Good, 9-10: Excellent'},
                    {'name': 'Team Management', 'max_score': 10, 'weight': 1.0,
                     'description': 'Ability to manage and develop team members',
                     'scoring_guide': '1-3: Limited, 4-6: Developing, 7-8: Good, 9-10: Excellent'},
                    {'name': 'Decision Making', 'max_score': 10, 'weight': 1.0,
                     'description': 'Sound judgment and decision-making ability',
                     'scoring_guide': '1-3: Poor, 4-6: Developing, 7-8: Good, 9-10: Excellent'},
                    {'name': 'Initiative & Innovation', 'max_score': 10, 'weight': 1.0,
                     'description': 'Proactive approach and innovative thinking',
                     'scoring_guide': '1-3: Reactive, 4-6: Moderate, 7-8: Proactive, 9-10: Highly innovative'},
                    {'name': 'Organizational Knowledge', 'max_score': 10, 'weight': 1.0,
                     'description': 'Understanding of organizational operations and policies',
                     'scoring_guide': '1-3: Limited, 4-6: Basic, 7-8: Good, 9-10: Comprehensive'},
                    {'name': 'Peer Relationships', 'max_score': 5, 'weight': 1.0,
                     'description': 'Working relationships with colleagues',
                     'scoring_guide': '1: Poor, 2: Acceptable, 3: Good, 4: Very good, 5: Excellent'},
                ]
            },
            {
                'code': 'DRIVER-INT',
                'name': 'Drivers Interview Form',
                'template_type': InterviewScoreTemplate.TemplateType.DRIVER,
                'description': 'Interview scoring form for driver positions with DVLA verification (100 points)',
                'max_total_score': 100,
                'pass_score': 60,
                'instructions': '''
Rate each category from 1-10 (or as specified).
Requires DVLA license verification and practical driving test.
Pass mark: 60 points (60%)
Note: DVLA verification and driving test results recorded separately.
'''.strip(),
                'categories': [
                    {'name': 'DVLA License Validity', 'max_score': 15, 'weight': 1.0,
                     'description': 'Valid DVLA license with appropriate class',
                     'scoring_guide': '0: Invalid/Expired, 10: Valid basic, 15: Valid with required class'},
                    {'name': 'Driving Experience', 'max_score': 15, 'weight': 1.0,
                     'description': 'Years of driving experience and types of vehicles',
                     'scoring_guide': '1-5: 0-2 years, 6-10: 3-5 years, 11-13: 5-10 years, 14-15: 10+ years'},
                    {'name': 'Driving Test Score', 'max_score': 20, 'weight': 1.0,
                     'description': 'Score from practical driving assessment',
                     'scoring_guide': 'Recorded from practical test (0-20)'},
                    {'name': 'Vehicle Knowledge', 'max_score': 10, 'weight': 1.0,
                     'description': 'Understanding of vehicle maintenance and operation',
                     'scoring_guide': '1-3: Basic, 4-6: Good, 7-8: Very good, 9-10: Excellent'},
                    {'name': 'Safety Knowledge', 'max_score': 10, 'weight': 1.0,
                     'description': 'Knowledge of road safety and regulations',
                     'scoring_guide': '1-3: Limited, 4-6: Adequate, 7-8: Good, 9-10: Comprehensive'},
                    {'name': 'Route Knowledge', 'max_score': 10, 'weight': 1.0,
                     'description': 'Familiarity with local routes and navigation',
                     'scoring_guide': '1-3: Limited, 4-6: Some knowledge, 7-8: Good, 9-10: Expert'},
                    {'name': 'Communication Skills', 'max_score': 5, 'weight': 1.0,
                     'description': 'Ability to communicate effectively',
                     'scoring_guide': '1: Poor, 2: Basic, 3: Good, 4: Very good, 5: Excellent'},
                    {'name': 'Physical Fitness', 'max_score': 5, 'weight': 1.0,
                     'description': 'Physical ability to perform driving duties',
                     'scoring_guide': '1: Poor, 2: Below average, 3: Average, 4: Good, 5: Excellent'},
                    {'name': 'Attitude & Reliability', 'max_score': 10, 'weight': 1.0,
                     'description': 'Professional attitude and dependability',
                     'scoring_guide': '1-3: Concerning, 4-6: Acceptable, 7-8: Good, 9-10: Excellent'},
                ]
            },
            {
                'code': 'TECH-ASSESS',
                'name': 'Technical Assessment Form',
                'template_type': InterviewScoreTemplate.TemplateType.TECHNICAL,
                'description': 'Technical assessment scoring form for specialized positions (100 points)',
                'max_total_score': 100,
                'pass_score': 70,
                'instructions': '''
Rate each category from 1-10 (or as specified).
For technical and specialist positions.
Pass mark: 70 points (70%)
'''.strip(),
                'categories': [
                    {'name': 'Domain Knowledge', 'max_score': 25, 'weight': 1.0,
                     'description': 'Depth of knowledge in the specific domain',
                     'scoring_guide': '1-8: Basic, 9-15: Intermediate, 16-21: Advanced, 22-25: Expert'},
                    {'name': 'Technical Skills', 'max_score': 25, 'weight': 1.0,
                     'description': 'Proficiency in required technical skills',
                     'scoring_guide': '1-8: Basic, 9-15: Intermediate, 16-21: Advanced, 22-25: Expert'},
                    {'name': 'Problem-Solving Ability', 'max_score': 20, 'weight': 1.0,
                     'description': 'Ability to solve complex technical problems',
                     'scoring_guide': '1-6: Limited, 7-12: Adequate, 13-17: Strong, 18-20: Exceptional'},
                    {'name': 'Analytical Skills', 'max_score': 15, 'weight': 1.0,
                     'description': 'Data analysis and logical reasoning',
                     'scoring_guide': '1-5: Basic, 6-10: Good, 11-13: Strong, 14-15: Excellent'},
                    {'name': 'Communication of Technical Concepts', 'max_score': 15, 'weight': 1.0,
                     'description': 'Ability to explain technical concepts clearly',
                     'scoring_guide': '1-5: Poor, 6-10: Adequate, 11-13: Good, 14-15: Excellent'},
                ]
            },
        ]

        created_count = 0
        updated_count = 0

        for template_data in templates:
            categories_data = template_data.pop('categories')
            code = template_data['code']

            template, created = InterviewScoreTemplate.objects.update_or_create(
                code=code,
                defaults=template_data
            )

            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f'Created template: {template.name}'))
            else:
                updated_count += 1
                self.stdout.write(self.style.WARNING(f'Updated template: {template.name}'))

            # Create or update categories
            for idx, cat_data in enumerate(categories_data):
                cat_data['sort_order'] = idx
                InterviewScoreCategory.objects.update_or_create(
                    template=template,
                    name=cat_data['name'],
                    defaults=cat_data
                )

        self.stdout.write(self.style.SUCCESS(
            f'\nInterview templates seeding complete: {created_count} created, {updated_count} updated'
        ))
