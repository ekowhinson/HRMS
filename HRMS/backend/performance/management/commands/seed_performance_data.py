"""
Management command to seed comprehensive performance/appraisal sample data.
Creates rating scales, competencies, goal categories, appraisal cycles, and sample appraisals.
"""

import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from employees.models import Employee
from performance.models import (
    AppraisalCycle, RatingScale, RatingScaleLevel, Competency, CompetencyLevel,
    GoalCategory, Appraisal, Goal, CompetencyAssessment, CoreValue,
    CoreValueAssessment, TrainingNeed, DevelopmentPlan, DevelopmentActivity
)


class Command(BaseCommand):
    help = 'Seed comprehensive performance/appraisal sample data for HRMS'

    # Rating Scale Definition (5-point scale)
    RATING_SCALE = {
        'name': 'HRMS Performance Rating Scale',
        'description': 'Standard 5-point rating scale for performance assessment',
        'levels': [
            {'level': 1, 'name': 'Unsatisfactory', 'description': 'Performance falls significantly below expectations', 'min_pct': 0, 'max_pct': 39},
            {'level': 2, 'name': 'Needs Improvement', 'description': 'Performance meets some expectations but requires improvement', 'min_pct': 40, 'max_pct': 59},
            {'level': 3, 'name': 'Meets Expectations', 'description': 'Performance consistently meets all expectations', 'min_pct': 60, 'max_pct': 74},
            {'level': 4, 'name': 'Exceeds Expectations', 'description': 'Performance frequently exceeds expectations', 'min_pct': 75, 'max_pct': 89},
            {'level': 5, 'name': 'Outstanding', 'description': 'Performance consistently exceeds all expectations', 'min_pct': 90, 'max_pct': 100},
        ]
    }

    # Core Competencies
    COMPETENCIES = [
        # Core Competencies (all employees)
        {
            'code': 'COMM',
            'name': 'Communication',
            'description': 'Ability to clearly express ideas verbally and in writing, and to actively listen and respond appropriately.',
            'category': 'CORE',
            'levels': [
                {'level': 1, 'name': 'Basic', 'description': 'Communicates simple information clearly'},
                {'level': 2, 'name': 'Developing', 'description': 'Communicates routine information effectively'},
                {'level': 3, 'name': 'Proficient', 'description': 'Communicates complex information clearly to diverse audiences'},
                {'level': 4, 'name': 'Advanced', 'description': 'Influences and persuades through effective communication'},
                {'level': 5, 'name': 'Expert', 'description': 'Master communicator who shapes organizational messaging'},
            ]
        },
        {
            'code': 'PROB',
            'name': 'Problem Solving',
            'description': 'Ability to identify problems, analyze root causes, and develop effective solutions.',
            'category': 'CORE',
            'levels': [
                {'level': 1, 'name': 'Basic', 'description': 'Solves routine problems with guidance'},
                {'level': 2, 'name': 'Developing', 'description': 'Independently solves common problems'},
                {'level': 3, 'name': 'Proficient', 'description': 'Analyzes complex problems and implements solutions'},
                {'level': 4, 'name': 'Advanced', 'description': 'Anticipates problems and implements preventive measures'},
                {'level': 5, 'name': 'Expert', 'description': 'Solves unprecedented problems with innovative approaches'},
            ]
        },
        {
            'code': 'ADAPT',
            'name': 'Adaptability',
            'description': 'Ability to adjust to changing priorities, situations, and responsibilities.',
            'category': 'CORE',
            'levels': [
                {'level': 1, 'name': 'Basic', 'description': 'Accepts change with guidance and support'},
                {'level': 2, 'name': 'Developing', 'description': 'Adapts to routine changes positively'},
                {'level': 3, 'name': 'Proficient', 'description': 'Proactively adapts to significant changes'},
                {'level': 4, 'name': 'Advanced', 'description': 'Leads others through change'},
                {'level': 5, 'name': 'Expert', 'description': 'Champions change and drives transformation'},
            ]
        },
        # Functional Competencies
        {
            'code': 'TECH',
            'name': 'Technical Expertise',
            'description': 'Depth of knowledge and skill in job-specific technical areas.',
            'category': 'FUNCTIONAL',
            'levels': [
                {'level': 1, 'name': 'Novice', 'description': 'Learning technical fundamentals'},
                {'level': 2, 'name': 'Developing', 'description': 'Applies technical knowledge with supervision'},
                {'level': 3, 'name': 'Proficient', 'description': 'Independently applies technical expertise'},
                {'level': 4, 'name': 'Advanced', 'description': 'Recognized technical expert in area'},
                {'level': 5, 'name': 'Master', 'description': 'Industry-level expertise and innovation'},
            ]
        },
        {
            'code': 'PLAN',
            'name': 'Planning & Organization',
            'description': 'Ability to plan work, manage time, and organize resources effectively.',
            'category': 'FUNCTIONAL',
            'levels': [
                {'level': 1, 'name': 'Basic', 'description': 'Plans daily tasks with guidance'},
                {'level': 2, 'name': 'Developing', 'description': 'Plans and organizes own work effectively'},
                {'level': 3, 'name': 'Proficient', 'description': 'Plans team activities and manages resources'},
                {'level': 4, 'name': 'Advanced', 'description': 'Develops strategic plans across departments'},
                {'level': 5, 'name': 'Expert', 'description': 'Drives organizational strategic planning'},
            ]
        },
        # Leadership Competencies
        {
            'code': 'LEAD',
            'name': 'Leadership',
            'description': 'Ability to guide, motivate, and develop others to achieve objectives.',
            'category': 'LEADERSHIP',
            'levels': [
                {'level': 1, 'name': 'Emerging', 'description': 'Shows potential for leadership'},
                {'level': 2, 'name': 'Developing', 'description': 'Leads small teams or projects'},
                {'level': 3, 'name': 'Proficient', 'description': 'Effectively leads and develops teams'},
                {'level': 4, 'name': 'Advanced', 'description': 'Leads multiple teams or departments'},
                {'level': 5, 'name': 'Executive', 'description': 'Provides strategic organizational leadership'},
            ]
        },
        {
            'code': 'DEC',
            'name': 'Decision Making',
            'description': 'Ability to make timely, well-informed decisions in various situations.',
            'category': 'LEADERSHIP',
            'levels': [
                {'level': 1, 'name': 'Basic', 'description': 'Makes routine decisions with guidance'},
                {'level': 2, 'name': 'Developing', 'description': 'Makes independent decisions within scope'},
                {'level': 3, 'name': 'Proficient', 'description': 'Makes sound decisions in complex situations'},
                {'level': 4, 'name': 'Advanced', 'description': 'Makes strategic decisions with organizational impact'},
                {'level': 5, 'name': 'Executive', 'description': 'Makes critical decisions shaping organizational direction'},
            ]
        },
    ]

    # Goal Categories
    GOAL_CATEGORIES = [
        {'name': 'Service Delivery', 'description': 'Goals related to providing services to members and beneficiaries', 'weight': 30},
        {'name': 'Operational Excellence', 'description': 'Goals related to improving internal processes and efficiency', 'weight': 25},
        {'name': 'Financial Performance', 'description': 'Goals related to budget management and cost control', 'weight': 20},
        {'name': 'Learning & Development', 'description': 'Goals related to skill acquisition and professional growth', 'weight': 15},
        {'name': 'Innovation', 'description': 'Goals related to new ideas and process improvements', 'weight': 10},
    ]

    # Sample Goals by Category
    SAMPLE_GOALS = {
        'Service Delivery': [
            {'title': 'Reduce claim processing time', 'description': 'Reduce average claim processing time from 5 days to 3 days by Q3'},
            {'title': 'Improve member satisfaction score', 'description': 'Achieve member satisfaction score of 85% or higher in quarterly surveys'},
            {'title': 'Resolve complaints within SLA', 'description': 'Ensure 95% of member complaints are resolved within 48 hours'},
            {'title': 'Increase enrollment accuracy', 'description': 'Maintain 99% accuracy rate in member enrollment data'},
        ],
        'Operational Excellence': [
            {'title': 'Streamline document workflow', 'description': 'Implement digital document management to reduce paper usage by 50%'},
            {'title': 'Improve reporting timeliness', 'description': 'Submit all monthly reports within 2 business days of month-end'},
            {'title': 'Reduce process errors', 'description': 'Decrease data entry errors by 30% through quality checks'},
            {'title': 'Enhance system uptime', 'description': 'Maintain 99.5% system availability for critical applications'},
        ],
        'Financial Performance': [
            {'title': 'Manage department budget', 'description': 'Keep departmental expenses within 95-100% of approved budget'},
            {'title': 'Identify cost savings', 'description': 'Identify and implement cost savings of at least GHS 50,000 annually'},
            {'title': 'Improve collection rates', 'description': 'Increase premium collection rate to 98% of billed amount'},
        ],
        'Learning & Development': [
            {'title': 'Complete professional certification', 'description': 'Obtain relevant professional certification by end of year'},
            {'title': 'Mentor junior staff', 'description': 'Successfully mentor 2 junior staff members throughout the year'},
            {'title': 'Attend training programs', 'description': 'Complete 40 hours of professional development training'},
        ],
        'Innovation': [
            {'title': 'Propose process improvements', 'description': 'Submit at least 3 process improvement proposals during the year'},
            {'title': 'Lead digital initiative', 'description': 'Lead implementation of at least one digital transformation project'},
        ],
    }

    # Training Needs Types
    TRAINING_NEEDS = [
        {'title': 'Customer Service Excellence', 'description': 'Advanced customer service skills for handling difficult situations', 'type': 'TRAINING', 'priority': 'HIGH'},
        {'title': 'Data Analysis with Excel', 'description': 'Advanced Excel skills including pivot tables, VLOOKUP, and data visualization', 'type': 'TRAINING', 'priority': 'MEDIUM'},
        {'title': 'Project Management Fundamentals', 'description': 'Introduction to project management methodologies and tools', 'type': 'WORKSHOP', 'priority': 'MEDIUM'},
        {'title': 'Leadership Development Program', 'description': 'Comprehensive leadership skills development for emerging leaders', 'type': 'TRAINING', 'priority': 'HIGH'},
        {'title': 'Health Insurance Regulations', 'description': 'Updates on HRMS regulations and compliance requirements', 'type': 'WORKSHOP', 'priority': 'HIGH'},
        {'title': 'Time Management Skills', 'description': 'Techniques for effective time management and productivity', 'type': 'ONLINE', 'priority': 'LOW'},
        {'title': 'Communication Skills', 'description': 'Effective written and verbal communication skills', 'type': 'TRAINING', 'priority': 'MEDIUM'},
        {'title': 'Python for Data Analysis', 'description': 'Introduction to Python programming for data analysis', 'type': 'ONLINE', 'priority': 'LOW'},
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Delete existing data and recreate',
        )
        parser.add_argument(
            '--appraisals-count',
            type=int,
            default=20,
            help='Number of sample appraisals to create (default: 20)',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        force = options.get('force', False)
        appraisals_count = options.get('appraisals_count', 20)

        self.stdout.write('='*60)
        self.stdout.write('Seeding HRMS Performance Management Data')
        self.stdout.write('='*60 + '\n')

        # 1. Seed Rating Scale
        rating_scale = self.seed_rating_scale(force)

        # 2. Seed Core Values (call existing command logic)
        self.seed_core_values(force)

        # 3. Seed Competencies
        self.seed_competencies(force)

        # 4. Seed Goal Categories
        self.seed_goal_categories(force)

        # 5. Seed Appraisal Cycle
        cycle = self.seed_appraisal_cycle(force)

        if cycle:
            # 6. Seed Sample Appraisals with Goals and Assessments
            self.seed_appraisals(cycle, appraisals_count, force)

        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS('Performance data seeding complete!'))
        self.stdout.write('='*60)

    def seed_rating_scale(self, force):
        """Seed the rating scale with levels."""
        self.stdout.write('\n[1/6] Seeding Rating Scale...')

        existing = RatingScale.objects.filter(name=self.RATING_SCALE['name']).first()

        if existing and not force:
            self.stdout.write(f'  Skipped (exists): {existing.name}')
            return existing

        if existing and force:
            existing.delete()

        scale = RatingScale.objects.create(
            name=self.RATING_SCALE['name'],
            description=self.RATING_SCALE['description'],
            is_active=True,
            is_default=True
        )

        for level_data in self.RATING_SCALE['levels']:
            RatingScaleLevel.objects.create(
                rating_scale=scale,
                level=level_data['level'],
                name=level_data['name'],
                description=level_data['description'],
                min_percentage=level_data['min_pct'],
                max_percentage=level_data['max_pct']
            )

        self.stdout.write(self.style.SUCCESS(f'  Created: {scale.name} with 5 levels'))
        return scale

    def seed_core_values(self, force):
        """Seed HRMS core values."""
        from performance.management.commands.seed_core_values import Command as CoreValueCommand

        self.stdout.write('\n[2/6] Seeding Core Values...')

        cv_command = CoreValueCommand()
        cv_command.stdout = self.stdout
        cv_command.style = self.style

        for value_data in cv_command.CORE_VALUES:
            code = value_data['code']
            existing = CoreValue.objects.filter(code=code).first()

            if existing and not force:
                self.stdout.write(f'  Skipped (exists): {code} - {value_data["name"]}')
            else:
                if existing:
                    existing.delete()
                CoreValue.objects.create(**value_data)
                self.stdout.write(self.style.SUCCESS(f'  Created: {code} - {value_data["name"]}'))

    def seed_competencies(self, force):
        """Seed competencies with proficiency levels."""
        self.stdout.write('\n[3/6] Seeding Competencies...')

        for comp_data in self.COMPETENCIES:
            code = comp_data['code']
            existing = Competency.objects.filter(code=code).first()

            if existing and not force:
                self.stdout.write(f'  Skipped (exists): {code} - {comp_data["name"]}')
                continue

            if existing:
                existing.delete()

            competency = Competency.objects.create(
                code=comp_data['code'],
                name=comp_data['name'],
                description=comp_data['description'],
                category=comp_data['category'],
                is_active=True
            )

            for level_data in comp_data['levels']:
                CompetencyLevel.objects.create(
                    competency=competency,
                    level=level_data['level'],
                    name=level_data['name'],
                    description=level_data['description']
                )

            self.stdout.write(self.style.SUCCESS(f'  Created: {code} - {comp_data["name"]} ({comp_data["category"]})'))

    def seed_goal_categories(self, force):
        """Seed goal categories."""
        self.stdout.write('\n[4/6] Seeding Goal Categories...')

        for cat_data in self.GOAL_CATEGORIES:
            existing = GoalCategory.objects.filter(name=cat_data['name']).first()

            if existing and not force:
                self.stdout.write(f'  Skipped (exists): {cat_data["name"]}')
                continue

            if existing:
                existing.delete()

            GoalCategory.objects.create(
                name=cat_data['name'],
                description=cat_data['description'],
                weight=cat_data['weight'],
                is_active=True
            )
            self.stdout.write(self.style.SUCCESS(f'  Created: {cat_data["name"]} (Weight: {cat_data["weight"]}%)'))

    def seed_appraisal_cycle(self, force):
        """Seed current year appraisal cycle."""
        self.stdout.write('\n[5/6] Seeding Appraisal Cycle...')

        current_year = timezone.now().year
        cycle_name = f'HRMS Performance Appraisal {current_year}'

        existing = AppraisalCycle.objects.filter(name=cycle_name).first()

        if existing and not force:
            self.stdout.write(f'  Skipped (exists): {cycle_name}')
            return existing

        if existing:
            existing.delete()

        # Create cycle with realistic dates
        cycle = AppraisalCycle.objects.create(
            name=cycle_name,
            description=f'Annual performance appraisal cycle for {current_year}',
            year=current_year,
            start_date=date(current_year, 1, 1),
            end_date=date(current_year, 12, 31),
            goal_setting_start=date(current_year, 1, 1),
            goal_setting_end=date(current_year, 1, 31),
            mid_year_start=date(current_year, 7, 1),
            mid_year_end=date(current_year, 7, 31),
            year_end_start=date(current_year, 12, 1),
            year_end_end=date(current_year, 12, 31),
            status=AppraisalCycle.Status.ACTIVE,
            is_active=True,
            allow_self_assessment=True,
            allow_peer_feedback=True,
            require_manager_approval=True,
            min_goals=3,
            max_goals=7,
            objectives_weight=Decimal('60.00'),
            competencies_weight=Decimal('20.00'),
            values_weight=Decimal('20.00'),
            pass_mark=Decimal('60.00'),
            increment_threshold=Decimal('70.00'),
            promotion_threshold=Decimal('85.00'),
            pip_threshold=Decimal('40.00'),
        )

        self.stdout.write(self.style.SUCCESS(f'  Created: {cycle_name}'))
        self.stdout.write(f'    Weights: Objectives {cycle.objectives_weight}%, Competencies {cycle.competencies_weight}%, Values {cycle.values_weight}%')
        self.stdout.write(f'    Thresholds: Pass {cycle.pass_mark}%, Increment {cycle.increment_threshold}%, Promotion {cycle.promotion_threshold}%')

        return cycle

    def seed_appraisals(self, cycle, count, force):
        """Seed sample appraisals with goals and assessments."""
        self.stdout.write(f'\n[6/6] Seeding Sample Appraisals ({count})...')

        # Get active employees
        employees = Employee.objects.filter(status='ACTIVE').order_by('?')[:count]

        if not employees.exists():
            self.stdout.write(self.style.WARNING('  No active employees found. Skipping appraisals.'))
            return

        goal_categories = list(GoalCategory.objects.filter(is_active=True))
        competencies = list(Competency.objects.filter(is_active=True))
        core_values = list(CoreValue.objects.filter(is_active=True))

        created_count = 0
        skipped_count = 0

        for employee in employees:
            # Check if appraisal already exists
            existing = Appraisal.objects.filter(employee=employee, appraisal_cycle=cycle).first()

            if existing and not force:
                skipped_count += 1
                continue

            if existing:
                existing.delete()

            # Create appraisal
            manager = employee.supervisor if employee.supervisor else None

            # Generate random ratings (weighted towards good performance)
            status = random.choice([
                Appraisal.Status.GOALS_APPROVED,
                Appraisal.Status.IN_PROGRESS,
                Appraisal.Status.SELF_ASSESSMENT,
                Appraisal.Status.MANAGER_REVIEW,
                Appraisal.Status.COMPLETED,
            ])

            appraisal = Appraisal.objects.create(
                employee=employee,
                appraisal_cycle=cycle,
                manager=manager,
                status=status,
            )

            # Add Goals (3-5 goals)
            num_goals = random.randint(3, 5)
            total_weight = Decimal('0')

            for i, category in enumerate(random.sample(goal_categories, min(num_goals, len(goal_categories)))):
                sample_goals = self.SAMPLE_GOALS.get(category.name, [])
                if not sample_goals:
                    continue

                goal_data = random.choice(sample_goals)
                weight = Decimal(str(random.randint(15, 30)))

                if i == num_goals - 1:  # Last goal gets remaining weight
                    weight = Decimal('100') - total_weight

                total_weight += weight

                goal_status = random.choice([
                    Goal.Status.APPROVED,
                    Goal.Status.IN_PROGRESS,
                    Goal.Status.COMPLETED,
                ])

                # Generate ratings if status is appropriate
                self_rating = random.randint(3, 5) if status in [Appraisal.Status.SELF_ASSESSMENT, Appraisal.Status.MANAGER_REVIEW, Appraisal.Status.COMPLETED] else None
                manager_rating = random.randint(3, 5) if status in [Appraisal.Status.MANAGER_REVIEW, Appraisal.Status.COMPLETED] else None
                final_rating = manager_rating if status == Appraisal.Status.COMPLETED else None

                Goal.objects.create(
                    appraisal=appraisal,
                    category=category,
                    title=goal_data['title'],
                    description=goal_data['description'],
                    success_criteria=f"Measurable outcomes for: {goal_data['title']}",
                    weight=weight,
                    target_date=date(cycle.year, 12, 15),
                    status=goal_status,
                    progress_percentage=random.randint(30, 100) if goal_status in [Goal.Status.IN_PROGRESS, Goal.Status.COMPLETED] else 0,
                    self_rating=self_rating,
                    manager_rating=manager_rating,
                    final_rating=final_rating,
                )

            # Add Competency Assessments
            for competency in competencies:
                self_rating = random.randint(3, 5) if status in [Appraisal.Status.SELF_ASSESSMENT, Appraisal.Status.MANAGER_REVIEW, Appraisal.Status.COMPLETED] else None
                manager_rating = random.randint(3, 5) if status in [Appraisal.Status.MANAGER_REVIEW, Appraisal.Status.COMPLETED] else None

                CompetencyAssessment.objects.create(
                    appraisal=appraisal,
                    competency=competency,
                    self_rating=self_rating,
                    self_comments=f"Self-assessment comments for {competency.name}" if self_rating else "",
                    manager_rating=manager_rating,
                    manager_comments=f"Manager assessment comments for {competency.name}" if manager_rating else "",
                    final_rating=manager_rating if status == Appraisal.Status.COMPLETED else None,
                )

            # Add Core Value Assessments
            for core_value in core_values:
                self_rating = random.randint(3, 5) if status in [Appraisal.Status.SELF_ASSESSMENT, Appraisal.Status.MANAGER_REVIEW, Appraisal.Status.COMPLETED] else None
                manager_rating = random.randint(3, 5) if status in [Appraisal.Status.MANAGER_REVIEW, Appraisal.Status.COMPLETED] else None

                CoreValueAssessment.objects.create(
                    appraisal=appraisal,
                    core_value=core_value,
                    self_rating=self_rating,
                    self_comments=f"Self-assessment of {core_value.name}" if self_rating else "",
                    manager_rating=manager_rating,
                    manager_comments=f"Manager assessment of {core_value.name}" if manager_rating else "",
                    final_rating=manager_rating if status == Appraisal.Status.COMPLETED else None,
                )

            # Add Training Needs for some employees
            if random.random() < 0.7:  # 70% chance
                training_data = random.choice(self.TRAINING_NEEDS)
                TrainingNeed.objects.create(
                    employee=employee,
                    appraisal=appraisal,
                    title=training_data['title'],
                    description=training_data['description'],
                    training_type=training_data['type'],
                    priority=training_data['priority'],
                    target_date=date(cycle.year, random.randint(6, 12), 28),
                    status='IDENTIFIED',
                )

            # Add Development Plan for some employees
            if random.random() < 0.5:  # 50% chance
                dev_plan = DevelopmentPlan.objects.create(
                    employee=employee,
                    appraisal=appraisal,
                    title=f'Development Plan {cycle.year}',
                    description=f'Individual development plan for {employee.full_name}',
                    career_aspiration='Advance to senior role within 3 years',
                    strengths='Strong technical skills, good team player',
                    development_areas='Leadership skills, strategic thinking',
                    start_date=date(cycle.year, 1, 1),
                    target_completion=date(cycle.year, 12, 31),
                    is_active=True,
                )

                # Add activities
                for activity_type in random.sample(['TRAINING', 'MENTORING', 'PROJECT'], 2):
                    DevelopmentActivity.objects.create(
                        development_plan=dev_plan,
                        title=f'{activity_type.title()} Activity',
                        description=f'Development activity - {activity_type}',
                        activity_type=activity_type,
                        target_date=date(cycle.year, random.randint(3, 11), 15),
                        status='PLANNED',
                    )

            # Update appraisal ratings based on goals and assessments
            if status == Appraisal.Status.COMPLETED:
                self._calculate_appraisal_scores(appraisal, cycle)

            created_count += 1

        self.stdout.write(self.style.SUCCESS(f'  Created: {created_count} appraisals'))
        if skipped_count > 0:
            self.stdout.write(f'  Skipped: {skipped_count} (already exist)')

    def _calculate_appraisal_scores(self, appraisal, cycle):
        """Calculate and update appraisal scores."""
        # Calculate goals rating
        goals = appraisal.goals.filter(final_rating__isnull=False)
        if goals.exists():
            total_weight = sum(g.weight for g in goals)
            if total_weight > 0:
                weighted_sum = sum((g.final_rating or 0) * float(g.weight) for g in goals)
                goals_score = Decimal(str(weighted_sum / float(total_weight)))
                appraisal.goals_final_rating = (goals_score / 5) * 100  # Convert to percentage

        # Calculate competency rating
        comp_assessments = appraisal.competency_assessments.filter(final_rating__isnull=False)
        if comp_assessments.exists():
            avg_comp = sum(c.final_rating for c in comp_assessments) / comp_assessments.count()
            appraisal.competency_final_rating = (Decimal(str(avg_comp)) / 5) * 100

        # Calculate values rating
        value_assessments = appraisal.value_assessments.filter(final_rating__isnull=False)
        if value_assessments.exists():
            avg_val = sum(v.final_rating for v in value_assessments) / value_assessments.count()
            appraisal.values_final_rating = (Decimal(str(avg_val)) / 5) * 100

        # Calculate weighted scores
        if appraisal.goals_final_rating:
            appraisal.weighted_objectives_score = appraisal.goals_final_rating * (cycle.objectives_weight / 100)
        if appraisal.competency_final_rating:
            appraisal.weighted_competencies_score = appraisal.competency_final_rating * (cycle.competencies_weight / 100)
        if appraisal.values_final_rating:
            appraisal.weighted_values_score = appraisal.values_final_rating * (cycle.values_weight / 100)

        # Calculate overall
        weighted_total = (
            (appraisal.weighted_objectives_score or Decimal('0')) +
            (appraisal.weighted_competencies_score or Decimal('0')) +
            (appraisal.weighted_values_score or Decimal('0'))
        )
        appraisal.overall_final_rating = weighted_total

        # Set recommendations based on score
        if weighted_total >= cycle.promotion_threshold:
            appraisal.promotion_recommended = True
            appraisal.increment_recommended = True
        elif weighted_total >= cycle.increment_threshold:
            appraisal.increment_recommended = True
        elif weighted_total < cycle.pip_threshold:
            appraisal.pip_recommended = True

        appraisal.save()
