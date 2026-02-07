"""
Recruitment services - Shortlisting and scoring logic.
"""

from decimal import Decimal
from django.db import transaction
from django.utils import timezone

from .models import (
    Vacancy, Applicant, ShortlistCriteria, ShortlistRun, ShortlistResult,
    ShortlistTemplate, ShortlistTemplateCriteria, ApplicantStatusHistory
)

import logging
logger = logging.getLogger(__name__)


class ShortlistingService:
    """
    Service for automatic applicant shortlisting based on defined criteria.
    """

    # Education level hierarchy (higher = better)
    EDUCATION_LEVELS = {
        'phd': 7,
        'doctorate': 7,
        'masters': 6,
        'mba': 6,
        'msc': 6,
        'ma': 6,
        'bachelors': 5,
        'bsc': 5,
        'ba': 5,
        'btech': 5,
        'hnd': 4,
        'diploma': 3,
        'certificate': 2,
        'ssce': 1,
        'secondary': 1,
        'high school': 1,
    }

    def __init__(self, shortlist_run: ShortlistRun):
        self.run = shortlist_run
        self.vacancy = shortlist_run.vacancy
        self.criteria = list(self.vacancy.shortlist_criteria.all().order_by('sort_order'))

    def execute(self):
        """Execute the shortlisting process."""
        try:
            self.run.status = ShortlistRun.Status.PROCESSING
            self.run.save(update_fields=['status'])

            # Get all applicants for this vacancy (exclude already rejected/withdrawn)
            applicants = Applicant.objects.filter(
                vacancy=self.vacancy,
                status__in=['NEW', 'SCREENING']
            )

            self.run.total_applicants = applicants.count()

            qualified_count = 0
            disqualified_count = 0

            with transaction.atomic():
                for applicant in applicants:
                    result = self._score_applicant(applicant)
                    if result.outcome == ShortlistResult.Outcome.QUALIFIED:
                        qualified_count += 1
                    elif result.outcome == ShortlistResult.Outcome.DISQUALIFIED:
                        disqualified_count += 1

                # Update ranks for qualified applicants
                self._calculate_ranks()

                self.run.qualified_count = qualified_count
                self.run.disqualified_count = disqualified_count
                self.run.status = ShortlistRun.Status.COMPLETED
                self.run.save()

            return self.run

        except Exception as e:
            self.run.status = ShortlistRun.Status.FAILED
            self.run.error_message = str(e)
            self.run.save(update_fields=['status', 'error_message'])
            raise

    def _score_applicant(self, applicant: Applicant) -> ShortlistResult:
        """Score a single applicant against all criteria."""
        score_breakdown = {}
        failed_mandatory = []
        total_weighted_score = Decimal('0')
        max_possible_score = Decimal('0')

        for criterion in self.criteria:
            score, max_score, matched = self._evaluate_criterion(criterion, applicant)
            weighted_score = score * criterion.weight

            score_breakdown[criterion.name] = {
                'criterion_type': criterion.criteria_type,
                'score': float(score),
                'max_score': float(max_score),
                'weighted_score': float(weighted_score),
                'weight': float(criterion.weight),
                'matched': matched,
                'is_mandatory': criterion.is_mandatory,
            }

            total_weighted_score += weighted_score
            max_possible_score += Decimal(criterion.max_score) * criterion.weight

            if criterion.is_mandatory and not matched:
                failed_mandatory.append({
                    'criterion': criterion.name,
                    'type': criterion.criteria_type,
                    'reason': f'Failed mandatory criterion: {criterion.name}'
                })

        # Calculate percentage
        if max_possible_score > 0:
            percentage_score = (total_weighted_score / max_possible_score) * 100
        else:
            percentage_score = Decimal('0')

        # Factor in screening score if configured
        criteria_score = total_weighted_score
        screening_score_used = Decimal('0')
        final_score = total_weighted_score

        if self.run.include_screening_score and applicant.screening_score is not None:
            screening_score_used = Decimal(applicant.screening_score)
            # Weighted combination
            screening_weight = self.run.screening_weight
            criteria_weight = 1 - screening_weight
            final_score = (criteria_score * criteria_weight) + (screening_score_used * screening_weight)

        # Determine outcome
        if failed_mandatory:
            outcome = ShortlistResult.Outcome.DISQUALIFIED
        elif percentage_score >= self.run.pass_score:
            outcome = ShortlistResult.Outcome.QUALIFIED
        else:
            outcome = ShortlistResult.Outcome.NOT_QUALIFIED

        # Create or update result
        result, _ = ShortlistResult.objects.update_or_create(
            shortlist_run=self.run,
            applicant=applicant,
            defaults={
                'criteria_score': criteria_score,
                'screening_score_used': screening_score_used,
                'final_score': final_score,
                'percentage_score': percentage_score,
                'outcome': outcome,
                'score_breakdown': score_breakdown,
                'failed_mandatory': failed_mandatory,
            }
        )

        return result

    def _evaluate_criterion(self, criterion: ShortlistCriteria, applicant: Applicant):
        """
        Evaluate a single criterion for an applicant.
        Returns: (score, max_score, matched)
        """
        max_score = criterion.max_score
        evaluators = {
            ShortlistCriteria.CriteriaType.EDUCATION: self._evaluate_education,
            ShortlistCriteria.CriteriaType.EXPERIENCE: self._evaluate_experience,
            ShortlistCriteria.CriteriaType.SKILL: self._evaluate_skill,
            ShortlistCriteria.CriteriaType.QUALIFICATION: self._evaluate_qualification,
            ShortlistCriteria.CriteriaType.AGE_RANGE: self._evaluate_age,
            ShortlistCriteria.CriteriaType.LOCATION: self._evaluate_location,
            ShortlistCriteria.CriteriaType.CUSTOM: self._evaluate_custom,
        }

        evaluator = evaluators.get(criterion.criteria_type, self._evaluate_custom)
        return evaluator(criterion, applicant)

    def _evaluate_education(self, criterion: ShortlistCriteria, applicant: Applicant):
        """Evaluate education level criterion."""
        max_score = criterion.max_score

        applicant_edu = (applicant.highest_education or '').lower().strip()
        required_edu = (criterion.value_text or '').lower().strip()

        # Get education levels
        applicant_level = self._get_education_level(applicant_edu)
        required_level = self._get_education_level(required_edu)

        if criterion.match_type == ShortlistCriteria.MatchType.EXACT:
            if applicant_level == required_level:
                return (max_score, max_score, True)
            return (0, max_score, False)

        elif criterion.match_type == ShortlistCriteria.MatchType.MINIMUM:
            if applicant_level >= required_level:
                # Score proportionally to how much they exceed
                excess = applicant_level - required_level
                bonus = min(excess * 2, max_score * 0.2)  # Up to 20% bonus
                score = min(max_score + bonus, max_score)
                return (max_score, max_score, True)
            else:
                # Partial score for being close
                ratio = applicant_level / required_level if required_level > 0 else 0
                return (max_score * Decimal(ratio) * Decimal('0.5'), max_score, False)

        return (0, max_score, False)

    def _get_education_level(self, education_str: str) -> int:
        """Convert education string to numeric level."""
        education_str = education_str.lower()
        for key, level in self.EDUCATION_LEVELS.items():
            if key in education_str:
                return level
        return 0

    def _evaluate_experience(self, criterion: ShortlistCriteria, applicant: Applicant):
        """Evaluate years of experience criterion."""
        max_score = criterion.max_score
        applicant_years = applicant.years_of_experience or 0

        if criterion.match_type == ShortlistCriteria.MatchType.RANGE:
            min_years = float(criterion.value_min or 0)
            max_years = float(criterion.value_max or 100)

            if min_years <= applicant_years <= max_years:
                # Full score if within range
                return (max_score, max_score, True)
            elif applicant_years < min_years:
                # Partial score for being close
                ratio = applicant_years / min_years if min_years > 0 else 0
                return (max_score * Decimal(ratio) * Decimal('0.5'), max_score, False)
            else:
                # Over-qualified, still passes but note it
                return (max_score, max_score, True)

        elif criterion.match_type == ShortlistCriteria.MatchType.MINIMUM:
            required_years = float(criterion.value_number or 0)

            if applicant_years >= required_years:
                return (max_score, max_score, True)
            else:
                ratio = applicant_years / required_years if required_years > 0 else 0
                return (max_score * Decimal(ratio), max_score, False)

        elif criterion.match_type == ShortlistCriteria.MatchType.MAXIMUM:
            max_years = float(criterion.value_number or 100)

            if applicant_years <= max_years:
                return (max_score, max_score, True)
            return (0, max_score, False)

        return (0, max_score, False)

    def _evaluate_skill(self, criterion: ShortlistCriteria, applicant: Applicant):
        """Evaluate skill criterion by keyword matching."""
        max_score = criterion.max_score
        required_skill = (criterion.value_text or '').lower()

        # Search in multiple fields
        search_fields = [
            applicant.cover_letter or '',
            applicant.current_position or '',
            applicant.notes or '',
        ]

        search_text = ' '.join(search_fields).lower()

        # Check for skill presence
        if required_skill in search_text:
            return (max_score, max_score, True)

        # Partial match for similar terms
        skill_words = required_skill.split()
        matches = sum(1 for word in skill_words if word in search_text)
        if matches > 0:
            ratio = matches / len(skill_words)
            return (max_score * Decimal(ratio) * Decimal('0.5'), max_score, False)

        return (0, max_score, False)

    def _evaluate_qualification(self, criterion: ShortlistCriteria, applicant: Applicant):
        """Evaluate professional qualification criterion."""
        max_score = criterion.max_score
        required_qual = (criterion.value_text or '').lower()

        # Search in education and cover letter
        search_fields = [
            applicant.highest_education or '',
            applicant.institution or '',
            applicant.cover_letter or '',
        ]
        search_text = ' '.join(search_fields).lower()

        if required_qual in search_text:
            return (max_score, max_score, True)

        return (0, max_score, False)

    def _evaluate_age(self, criterion: ShortlistCriteria, applicant: Applicant):
        """Evaluate age range criterion."""
        max_score = criterion.max_score

        if not applicant.date_of_birth:
            return (0, max_score, False)

        from datetime import date
        today = date.today()
        age = today.year - applicant.date_of_birth.year
        if today.month < applicant.date_of_birth.month or \
           (today.month == applicant.date_of_birth.month and today.day < applicant.date_of_birth.day):
            age -= 1

        min_age = int(criterion.value_min or 0)
        max_age = int(criterion.value_max or 100)

        if min_age <= age <= max_age:
            return (max_score, max_score, True)

        return (0, max_score, False)

    def _evaluate_location(self, criterion: ShortlistCriteria, applicant: Applicant):
        """Evaluate location/region criterion."""
        max_score = criterion.max_score
        required_location = (criterion.value_text or '').lower()

        applicant_location = ' '.join([
            applicant.city or '',
            applicant.region or '',
            applicant.address or ''
        ]).lower()

        if required_location in applicant_location:
            return (max_score, max_score, True)

        return (0, max_score, False)

    def _evaluate_custom(self, criterion: ShortlistCriteria, applicant: Applicant):
        """Evaluate custom criterion (requires manual review)."""
        # Custom criteria always require manual review
        return (0, criterion.max_score, False)

    def _calculate_ranks(self):
        """Calculate ranks for all results in this run."""
        results = self.run.results.filter(
            outcome=ShortlistResult.Outcome.QUALIFIED
        ).order_by('-final_score')

        for rank, result in enumerate(results, start=1):
            result.rank = rank
            result.save(update_fields=['rank'])


def apply_template_to_vacancy(vacancy: Vacancy, template: ShortlistTemplate, clear_existing=False):
    """
    Apply a shortlist template to a vacancy.
    """
    if clear_existing:
        vacancy.shortlist_criteria.all().delete()

    template_criteria = template.criteria.all().order_by('sort_order')

    for idx, tc in enumerate(template_criteria):
        ShortlistCriteria.objects.create(
            vacancy=vacancy,
            criteria_type=tc.criteria_type,
            match_type=tc.match_type,
            name=tc.name,
            description=tc.description,
            weight=tc.weight,
            max_score=tc.max_score,
            is_mandatory=tc.is_mandatory,
            sort_order=idx,
        )

    return vacancy.shortlist_criteria.count()


def auto_shortlist_applicant(applicant: Applicant):
    """
    Automatically evaluate a single applicant against the vacancy's shortlisting
    criteria and update their status to SHORTLISTED if they qualify.

    Called when an applicant is created (admin or public application).
    Returns the outcome string or None if no criteria exist / auto-shortlist disabled.
    """
    vacancy = applicant.vacancy

    # Check if auto-shortlist is enabled for this vacancy
    if not getattr(vacancy, 'auto_shortlist', True):
        return None

    criteria = list(vacancy.shortlist_criteria.all().order_by('sort_order'))
    if not criteria:
        return None

    # Use the same scoring logic as ShortlistingService
    service = ShortlistingService.__new__(ShortlistingService)
    service.criteria = criteria
    service.vacancy = vacancy

    # Score the applicant
    score_breakdown = {}
    failed_mandatory = []
    total_weighted_score = Decimal('0')
    max_possible_score = Decimal('0')

    for criterion in criteria:
        score, max_score, matched = service._evaluate_criterion(criterion, applicant)
        weighted_score = score * criterion.weight

        score_breakdown[criterion.name] = {
            'criterion_type': criterion.criteria_type,
            'score': float(score),
            'max_score': float(max_score),
            'weighted_score': float(weighted_score),
            'weight': float(criterion.weight),
            'matched': matched,
            'is_mandatory': criterion.is_mandatory,
        }

        total_weighted_score += weighted_score
        max_possible_score += Decimal(criterion.max_score) * criterion.weight

        if criterion.is_mandatory and not matched:
            failed_mandatory.append({
                'criterion': criterion.name,
                'type': criterion.criteria_type,
            })

    # Calculate percentage
    if max_possible_score > 0:
        percentage_score = (total_weighted_score / max_possible_score) * 100
    else:
        percentage_score = Decimal('0')

    pass_score = Decimal('60')  # Default pass threshold

    # Determine outcome
    if failed_mandatory:
        outcome = 'DISQUALIFIED'
    elif percentage_score >= pass_score:
        outcome = 'QUALIFIED'
    else:
        outcome = 'NOT_QUALIFIED'

    # Save score on applicant
    applicant.screening_score = int(percentage_score)
    applicant.screening_notes = f'Auto-evaluated: {outcome} ({percentage_score:.1f}%)'

    if outcome == 'QUALIFIED':
        old_status = applicant.status
        applicant.status = Applicant.Status.SHORTLISTED
        applicant.save(update_fields=['status', 'screening_score', 'screening_notes'])

        ApplicantStatusHistory.objects.create(
            applicant=applicant,
            old_status=old_status,
            new_status=Applicant.Status.SHORTLISTED,
            notes=f'Auto-shortlisted (Score: {percentage_score:.1f}%)',
            is_visible_to_applicant=True,
            public_message='Congratulations! You have been shortlisted for further consideration.',
        )
        logger.info(f'Auto-shortlisted applicant {applicant.applicant_number} '
                     f'for vacancy {vacancy.vacancy_number} (score: {percentage_score:.1f}%)')
    else:
        applicant.save(update_fields=['screening_score', 'screening_notes'])
        logger.info(f'Auto-evaluation for applicant {applicant.applicant_number}: '
                     f'{outcome} (score: {percentage_score:.1f}%)')

    return outcome
