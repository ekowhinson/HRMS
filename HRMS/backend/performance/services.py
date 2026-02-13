"""
Business logic services for performance management.
"""

from decimal import Decimal
from typing import Dict, Optional, Any
from datetime import date, timedelta
from django.db.models import Avg, Q
from django.utils import timezone


class AppraisalScoreCalculator:
    """Calculate weighted appraisal scores."""

    def __init__(self, appraisal):
        self.appraisal = appraisal
        self.cycle = appraisal.appraisal_cycle

    def calculate_objectives_score(self) -> Optional[Decimal]:
        """Calculate average score from goals/objectives."""
        goals = self.appraisal.goals.filter(final_rating__isnull=False)
        if not goals.exists():
            return None

        # Weight-based calculation if weights are set
        total_weight = sum(g.weight for g in goals if g.weight)
        if total_weight > 0:
            weighted_sum = sum(
                (g.final_rating * g.weight) for g in goals
                if g.final_rating and g.weight
            )
            # Normalize to percentage (assuming 5-point scale)
            return (Decimal(weighted_sum) / Decimal(total_weight)) * 20
        else:
            # Simple average
            avg = goals.aggregate(avg=Avg('final_rating'))['avg']
            if avg:
                return Decimal(str(avg)) * 20  # 5-point scale to 100
        return None

    def calculate_competencies_score(self) -> Optional[Decimal]:
        """Calculate average score from competency assessments."""
        assessments = self.appraisal.competency_assessments.filter(
            final_rating__isnull=False
        )
        if not assessments.exists():
            return None

        avg = assessments.aggregate(avg=Avg('final_rating'))['avg']
        if avg:
            return Decimal(str(avg)) * 20  # 5-point scale to 100
        return None

    def calculate_values_score(self) -> Optional[Decimal]:
        """Calculate average score from core value assessments."""
        assessments = self.appraisal.value_assessments.filter(
            final_rating__isnull=False
        )
        if not assessments.exists():
            return None

        avg = assessments.aggregate(avg=Avg('final_rating'))['avg']
        if avg:
            return Decimal(str(avg)) * 20  # 5-point scale to 100
        return None

    def calculate_weighted_score(self) -> Dict[str, Any]:
        """Calculate final weighted score from all components."""
        obj_score = self.calculate_objectives_score()
        comp_score = self.calculate_competencies_score()
        val_score = self.calculate_values_score()

        # Apply weights
        weighted_obj = None
        weighted_comp = None
        weighted_val = None

        if obj_score is not None:
            weighted_obj = obj_score * (self.cycle.objectives_weight / 100)

        if comp_score is not None:
            weighted_comp = comp_score * (self.cycle.competencies_weight / 100)

        if val_score is not None:
            weighted_val = val_score * (self.cycle.values_weight / 100)

        # Calculate final score only if we have all components
        final_score = None
        scores = [weighted_obj, weighted_comp, weighted_val]
        valid_scores = [s for s in scores if s is not None]

        if valid_scores:
            final_score = sum(valid_scores)

        result = {
            'objectives_score': obj_score,
            'competencies_score': comp_score,
            'values_score': val_score,
            'weighted_objectives': weighted_obj,
            'weighted_competencies': weighted_comp,
            'weighted_values': weighted_val,
            'final_score': final_score,
            'passed': final_score >= self.cycle.pass_mark if final_score else None,
            'increment_eligible': final_score >= self.cycle.increment_threshold if final_score else None,
            'promotion_eligible': final_score >= self.cycle.promotion_threshold if final_score else None,
            'pip_required': final_score < self.cycle.pip_threshold if final_score else None,
        }

        return result

    def update_appraisal_scores(self) -> None:
        """Update the appraisal with calculated scores."""
        scores = self.calculate_weighted_score()

        # Update component scores
        self.appraisal.goals_final_rating = scores['objectives_score']
        self.appraisal.competency_final_rating = scores['competencies_score']
        self.appraisal.values_final_rating = scores['values_score']

        # Update weighted scores
        self.appraisal.weighted_objectives_score = scores['weighted_objectives']
        self.appraisal.weighted_competencies_score = scores['weighted_competencies']
        self.appraisal.weighted_values_score = scores['weighted_values']

        # Update overall rating
        self.appraisal.overall_final_rating = scores['final_score']

        # Update recommendations
        if scores['final_score']:
            self.appraisal.increment_recommended = scores['increment_eligible']
            self.appraisal.promotion_recommended = scores['promotion_eligible']
            self.appraisal.pip_recommended = scores['pip_required']

        self.appraisal.save()


class ProbationService:
    """Handle probation assessment logic."""

    PERIOD_DAYS = {
        '3M': 90,
        '6M': 180,
        '12M': 365,
    }

    def get_due_assessments(self, days_ahead: int = 30):
        """
        Get employees due for probation assessment.

        Args:
            days_ahead: Number of days to look ahead for due assessments
        """
        from employees.models import Employee
        from .models import ProbationAssessment

        today = date.today()
        future_date = today + timedelta(days=days_ahead)

        # Get employees on probation
        probation_employees = Employee.objects.filter(
            status='PROBATION'
        )

        due_assessments = []

        for emp in probation_employees:
            if not emp.date_of_joining:
                continue

            # Check if 3-month assessment is due
            three_month_date = emp.date_of_joining + timedelta(days=90)
            six_month_date = emp.date_of_joining + timedelta(days=180)
            twelve_month_date = emp.date_of_joining + timedelta(days=365)

            # Check which assessments already exist
            existing = ProbationAssessment.objects.filter(employee=emp).values_list(
                'assessment_period', flat=True
            )

            # Determine director status (12-month probation)
            is_director = emp.position and 'director' in emp.position.title.lower()

            if '3M' not in existing and today <= three_month_date <= future_date:
                due_assessments.append({
                    'employee': emp,
                    'period': '3M',
                    'due_date': three_month_date
                })

            if '6M' not in existing and today <= six_month_date <= future_date:
                due_assessments.append({
                    'employee': emp,
                    'period': '6M',
                    'due_date': six_month_date
                })

            if is_director and '12M' not in existing and today <= twelve_month_date <= future_date:
                due_assessments.append({
                    'employee': emp,
                    'period': '12M',
                    'due_date': twelve_month_date
                })

        return due_assessments

    def create_assessment(self, employee, period: str):
        """Create probation assessment for employee."""
        from .models import ProbationAssessment

        if period not in self.PERIOD_DAYS:
            raise ValueError(f'Invalid period: {period}')

        due_date = employee.hire_date + timedelta(days=self.PERIOD_DAYS[period])

        assessment = ProbationAssessment.objects.create(
            employee=employee,
            assessment_period=period,
            assessment_date=date.today(),
            due_date=due_date,
            status=ProbationAssessment.Status.DRAFT
        )

        return assessment

    def confirm_employee(self, assessment):
        """Confirm employee after successful probation."""
        from employees.models import Employee

        assessment.status = assessment.Status.CONFIRMED
        assessment.approved_at = timezone.now()
        assessment.save()

        # Update employee status
        employee = assessment.employee
        employee.employment_status = 'ACTIVE'
        employee.save()

        return assessment

    def extend_probation(self, assessment, extension_months: int, reason: str):
        """Extend probation period."""
        assessment.status = assessment.Status.EXTENDED
        assessment.extension_duration = extension_months
        assessment.recommendation = reason
        assessment.save()

        return assessment


class TrainingNeedService:
    """Service for managing training needs from appraisals."""

    def identify_from_appraisal(self, appraisal):
        """
        Identify training needs based on appraisal results.
        Creates training needs for competencies with low scores.
        """
        from .models import TrainingNeed

        training_needs = []

        # Check competency assessments with low scores (below 3 on 5-point scale)
        low_competencies = appraisal.competency_assessments.filter(
            final_rating__lt=3
        ).select_related('competency')

        for assessment in low_competencies:
            need, created = TrainingNeed.objects.get_or_create(
                employee=appraisal.employee,
                appraisal=appraisal,
                competency=assessment.competency,
                defaults={
                    'title': f'Improve {assessment.competency.name}',
                    'description': f'Training need identified from appraisal. '
                                   f'Current rating: {assessment.final_rating}/5',
                    'priority': 'HIGH' if assessment.final_rating == 1 else 'MEDIUM',
                    'status': TrainingNeed.Status.IDENTIFIED
                }
            )
            if created:
                training_needs.append(need)

        # Check core value assessments with low scores
        low_values = appraisal.value_assessments.filter(
            final_rating__lt=3
        ).select_related('core_value')

        for assessment in low_values:
            need, created = TrainingNeed.objects.get_or_create(
                employee=appraisal.employee,
                appraisal=appraisal,
                title=f'Strengthen {assessment.core_value.name}',
                defaults={
                    'description': f'Core value development need identified from appraisal. '
                                   f'Current rating: {assessment.final_rating}/5',
                    'priority': 'MEDIUM',
                    'training_type': TrainingNeed.Type.WORKSHOP,
                    'status': TrainingNeed.Status.IDENTIFIED
                }
            )
            if created:
                training_needs.append(need)

        return training_needs


class PerformanceAppealService:
    """Service for managing performance appeals."""

    def submit_appeal(self, appraisal, grounds: str, disputed_ratings: dict,
                      requested_remedy: str, supporting_evidence: str = ''):
        """Submit a new performance appeal."""
        from .models import PerformanceAppeal

        appeal = PerformanceAppeal.objects.create(
            appraisal=appraisal,
            grounds=grounds,
            disputed_ratings=disputed_ratings,
            requested_remedy=requested_remedy,
            supporting_evidence=supporting_evidence,
            status=PerformanceAppeal.Status.SUBMITTED
        )

        return appeal

    def schedule_hearing(self, appeal, hearing_date, reviewer):
        """Schedule appeal hearing."""
        appeal.hearing_date = hearing_date
        appeal.reviewer = reviewer
        appeal.status = appeal.Status.HEARING_SCHEDULED
        appeal.save()

        return appeal

    def record_decision(self, appeal, decision: str, status: str,
                        revised_ratings: dict = None, decided_by=None):
        """Record the appeal decision."""
        appeal.decision = decision
        appeal.status = status
        appeal.decision_date = timezone.now()
        appeal.decided_by = decided_by

        if revised_ratings:
            appeal.revised_ratings = revised_ratings

            # If appeal upheld, update appraisal ratings
            if status in ['UPHELD', 'PARTIAL']:
                self._apply_revised_ratings(appeal.appraisal, revised_ratings)

        appeal.save()
        return appeal

    def _apply_revised_ratings(self, appraisal, revised_ratings: dict):
        """Apply revised ratings to the appraisal."""
        if 'goals_final_rating' in revised_ratings:
            appraisal.goals_final_rating = revised_ratings['goals_final_rating']

        if 'competency_final_rating' in revised_ratings:
            appraisal.competency_final_rating = revised_ratings['competency_final_rating']

        if 'values_final_rating' in revised_ratings:
            appraisal.values_final_rating = revised_ratings['values_final_rating']

        if 'overall_final_rating' in revised_ratings:
            appraisal.overall_final_rating = revised_ratings['overall_final_rating']

        appraisal.save()

        # Recalculate weighted scores
        calculator = AppraisalScoreCalculator(appraisal)
        calculator.update_appraisal_scores()
