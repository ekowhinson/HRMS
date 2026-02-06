"""
AI-powered file analyzer for automatic data type detection.
Analyzes file columns and data to determine the most likely target model.
"""

import logging
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from collections import Counter

from .mapper import MODEL_FIELDS, FieldDefinition

logger = logging.getLogger(__name__)


@dataclass
class FileAnalysisResult:
    """Result of analyzing a file's contents."""
    detected_model: str
    confidence: float
    matched_fields: Dict[str, str]
    model_scores: Dict[str, float]
    file_category: str  # 'setup', 'main', 'transaction'
    dependencies: List[str]
    reason: str


@dataclass
class ModelScore:
    """Score for a potential target model."""
    model: str
    score: float
    matched_fields: int
    required_matched: int
    total_required: int
    field_matches: Dict[str, Tuple[str, float]]


# Define processing order and categories
MODEL_CATEGORIES = {
    # Setup data - must be imported first
    'setup': [
        'divisions',
        'directorates',
        'departments',
        'grades',
        'positions',
        'job_categories',
        'work_locations',
        'banks',
        'bank_branches',
        'staff_categories',
        'salary_bands',
        'salary_levels',
        'salary_notches',
        'pay_components',
        'leave_types',
        'holidays',
    ],
    # Main entity data
    'main': [
        'employees',
    ],
    # Transaction/relationship data - depends on main entities
    'transaction': [
        'bank_accounts',
        'leave_balances',
        'transactions',
    ],
}

# Dependencies between models
MODEL_DEPENDENCIES = {
    'directorates': ['divisions'],
    'departments': ['directorates'],
    'positions': ['departments', 'grades'],
    'bank_branches': ['banks'],
    'salary_levels': ['salary_bands'],
    'salary_notches': ['salary_levels'],
    'employees': ['departments', 'positions', 'grades', 'directorates', 'work_locations', 'staff_categories', 'salary_notches'],
    'bank_accounts': ['employees', 'banks', 'bank_branches'],
    'leave_balances': ['employees', 'leave_types'],
    'transactions': ['employees', 'pay_components'],
}

# Signature columns that strongly indicate a model type
MODEL_SIGNATURES = {
    'employees': ['employee_number', 'emp_no', 'staff_id', 'first_name', 'last_name', 'surname', 'date_of_birth', 'dob', 'ghana_card', 'ssnit'],
    'departments': ['dept_code', 'department_code', 'department_name', 'dept_name'],
    'divisions': ['division_code', 'division_name', 'div_code'],
    'directorates': ['directorate_code', 'directorate_name', 'dir_code'],
    'positions': ['position_code', 'job_title', 'job_code', 'position_name'],
    'grades': ['grade_code', 'job_grade', 'grade_level', 'min_salary', 'max_salary'],
    'banks': ['bank_code', 'bank_name', 'swift_code'],
    'bank_branches': ['branch_code', 'branch_name', 'sort_code', 'routing_number'],
    'bank_accounts': ['account_number', 'account_no', 'acct_no', 'account_name', 'bank_branch'],
    'staff_categories': ['category_code', 'staff_type', 'payroll_group'],
    'salary_bands': ['band_code', 'band_name', 'salary_band'],
    'salary_levels': ['level_code', 'level_name', 'salary_level'],
    'salary_notches': ['notch_code', 'notch_name', 'notch', 'base_salary'],
    'pay_components': ['component_code', 'component_name', 'earning_type', 'deduction_type', 'is_taxable'],
    'leave_types': ['leave_code', 'leave_name', 'leave_type', 'default_days', 'is_paid'],
    'leave_balances': ['earned', 'taken', 'opening_balance', 'leave_year'],
    'transactions': ['pay_component', 'override_amount', 'effective_from', 'effective_to', 'is_recurring'],
    'holidays': ['holiday_name', 'holiday_date', 'holiday_type', 'is_paid'],
    'work_locations': ['location_code', 'location_name', 'office_address', 'is_headquarters'],
    'job_categories': ['category_code', 'job_category', 'category_name'],
}


class FileAnalyzer:
    """
    AI-powered file analyzer that determines the most likely target model
    based on column headers and sample data.
    """

    def __init__(self):
        self.model_fields = MODEL_FIELDS

    def analyze(
        self,
        headers: List[str],
        sample_data: List[List[Any]] = None,
        filename: str = None
    ) -> FileAnalysisResult:
        """
        Analyze file contents and determine the best target model.

        Args:
            headers: Column headers from the file
            sample_data: Optional sample rows for additional analysis
            filename: Original filename (can provide hints)

        Returns:
            FileAnalysisResult with detected model and confidence
        """
        scores = {}

        # Score each model
        for model_name in self.model_fields:
            score = self._score_model(model_name, headers, sample_data, filename)
            scores[model_name] = score

        # Sort by score
        sorted_scores = sorted(
            scores.items(),
            key=lambda x: (x[1].score, x[1].matched_fields),
            reverse=True
        )

        if not sorted_scores or sorted_scores[0][1].score == 0:
            return FileAnalysisResult(
                detected_model='',
                confidence=0.0,
                matched_fields={},
                model_scores={m: s.score for m, s in scores.items()},
                file_category='unknown',
                dependencies=[],
                reason='No matching model found'
            )

        best_model, best_score = sorted_scores[0]

        # Calculate confidence based on score gap
        confidence = best_score.score
        if len(sorted_scores) > 1:
            second_score = sorted_scores[1][1].score
            if second_score > 0:
                # Adjust confidence based on gap between first and second
                gap = (best_score.score - second_score) / best_score.score
                confidence = min(confidence, 0.5 + (gap * 0.5))

        # Determine category and dependencies
        file_category = self._get_model_category(best_model)
        dependencies = MODEL_DEPENDENCIES.get(best_model, [])

        # Build reason
        reason = self._build_reason(best_score, headers)

        return FileAnalysisResult(
            detected_model=best_model,
            confidence=round(confidence, 2),
            matched_fields={h: m[0] for h, m in best_score.field_matches.items()},
            model_scores={m: round(s.score, 3) for m, s in scores.items()},
            file_category=file_category,
            dependencies=dependencies,
            reason=reason
        )

    def _score_model(
        self,
        model_name: str,
        headers: List[str],
        sample_data: List[List[Any]] = None,
        filename: str = None
    ) -> ModelScore:
        """Score how well headers match a model's fields."""
        fields = self.model_fields[model_name]

        field_matches = {}
        matched_required = 0
        total_required = sum(1 for f in fields.values() if f.required)

        normalized_headers = [self._normalize(h) for h in headers]

        # Check signature columns first (strong indicators)
        signature_bonus = 0
        signatures = MODEL_SIGNATURES.get(model_name, [])
        for sig in signatures:
            normalized_sig = self._normalize(sig)
            for i, norm_header in enumerate(normalized_headers):
                if normalized_sig == norm_header or self._similarity(normalized_sig, norm_header) > 0.85:
                    signature_bonus += 0.15
                    break

        # Match each header to fields
        for i, header in enumerate(headers):
            normalized_header = normalized_headers[i]

            best_match = None
            best_match_score = 0.0

            for field_name, field_def in fields.items():
                match_score = self._match_header_to_field(
                    normalized_header, header, field_name, field_def
                )

                if match_score > best_match_score:
                    best_match_score = match_score
                    best_match = (field_name, match_score)

            if best_match and best_match_score > 0.5:
                field_matches[header] = best_match
                if fields[best_match[0]].required:
                    matched_required += 1

        # Calculate overall score
        if not fields:
            return ModelScore(
                model=model_name,
                score=0.0,
                matched_fields=len(field_matches),
                required_matched=0,
                total_required=0,
                field_matches={}
            )

        # Score components:
        # 1. Percentage of headers that matched (0.4 weight)
        header_match_ratio = len(field_matches) / len(headers) if headers else 0

        # 2. Percentage of required fields matched (0.4 weight)
        required_match_ratio = matched_required / total_required if total_required else 1.0

        # 3. Average confidence of matches (0.2 weight)
        avg_confidence = (
            sum(m[1] for m in field_matches.values()) / len(field_matches)
            if field_matches else 0
        )

        base_score = (
            header_match_ratio * 0.4 +
            required_match_ratio * 0.4 +
            avg_confidence * 0.2
        )

        # Add signature bonus (capped)
        final_score = min(1.0, base_score + min(signature_bonus, 0.3))

        # Bonus for filename hints
        if filename:
            filename_lower = filename.lower()
            if model_name in filename_lower or model_name.rstrip('s') in filename_lower:
                final_score = min(1.0, final_score + 0.1)

        return ModelScore(
            model=model_name,
            score=final_score,
            matched_fields=len(field_matches),
            required_matched=matched_required,
            total_required=total_required,
            field_matches=field_matches
        )

    def _match_header_to_field(
        self,
        normalized_header: str,
        original_header: str,
        field_name: str,
        field_def: FieldDefinition
    ) -> float:
        """Calculate match score between a header and field."""
        normalized_field = self._normalize(field_name)

        # Exact match with field name
        if normalized_header == normalized_field:
            return 1.0

        # Check aliases
        if field_def.aliases:
            for alias in field_def.aliases:
                normalized_alias = self._normalize(alias)

                # Exact alias match
                if normalized_header == normalized_alias:
                    return 0.95

                # Contains check
                if normalized_alias in normalized_header:
                    return 0.8 * (len(normalized_alias) / len(normalized_header))

                if normalized_header in normalized_alias:
                    return 0.7 * (len(normalized_header) / len(normalized_alias))

                # Fuzzy similarity
                sim = self._similarity(normalized_header, normalized_alias)
                if sim > 0.75:
                    return sim * 0.9

        # Fuzzy match with field name
        sim = self._similarity(normalized_header, normalized_field)
        if sim > 0.75:
            return sim * 0.85

        return 0.0

    def _normalize(self, text: str) -> str:
        """Normalize text for comparison."""
        import re
        text = text.lower()
        text = re.sub(r'[_\-./]', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()
        return text

    def _similarity(self, a: str, b: str) -> float:
        """Calculate string similarity (0-1)."""
        return SequenceMatcher(None, a, b).ratio()

    def _get_model_category(self, model_name: str) -> str:
        """Get the category for a model."""
        for category, models in MODEL_CATEGORIES.items():
            if model_name in models:
                return category
        return 'unknown'

    def _build_reason(self, score: ModelScore, headers: List[str]) -> str:
        """Build a human-readable reason for the detection."""
        parts = []

        if score.matched_fields:
            parts.append(f"Matched {score.matched_fields}/{len(headers)} columns")

        if score.required_matched and score.total_required:
            parts.append(f"Found {score.required_matched}/{score.total_required} required fields")

        if score.field_matches:
            key_matches = list(score.field_matches.items())[:3]
            match_strs = [f"'{h}'→{f[0]}" for h, f in key_matches]
            parts.append(f"Key matches: {', '.join(match_strs)}")

        return "; ".join(parts) if parts else "Low confidence match"

    def analyze_multiple_files(
        self,
        files_data: List[Dict[str, Any]]
    ) -> Dict[str, FileAnalysisResult]:
        """
        Analyze multiple files and return ordered results.

        Args:
            files_data: List of dicts with 'filename', 'headers', 'sample_data'

        Returns:
            Dict mapping filename to analysis result, ordered by processing sequence
        """
        results = {}

        for file_info in files_data:
            filename = file_info.get('filename', 'unknown')
            headers = file_info.get('headers', [])
            sample_data = file_info.get('sample_data', [])

            result = self.analyze(headers, sample_data, filename)
            results[filename] = result

        return results

    def get_processing_order(
        self,
        analysis_results: Dict[str, FileAnalysisResult]
    ) -> List[Tuple[str, FileAnalysisResult]]:
        """
        Determine the optimal processing order for multiple files.
        Setup files first, then main, then transactions.
        Within categories, respect dependencies.

        Returns:
            List of (filename, result) tuples in processing order
        """
        # Group by category
        categorized = {'setup': [], 'main': [], 'transaction': [], 'unknown': []}

        for filename, result in analysis_results.items():
            category = result.file_category
            if category in categorized:
                categorized[category].append((filename, result))
            else:
                categorized['unknown'].append((filename, result))

        # Sort within categories by dependencies
        ordered = []

        # Process setup files first, ordered by dependencies
        setup_order = self._topological_sort(
            categorized['setup'],
            lambda x: x[1].dependencies
        )
        ordered.extend(setup_order)

        # Then main files
        ordered.extend(categorized['main'])

        # Then transaction files
        ordered.extend(categorized['transaction'])

        # Finally unknown
        ordered.extend(categorized['unknown'])

        return ordered

    def _topological_sort(
        self,
        items: List[Tuple[str, FileAnalysisResult]],
        get_deps_fn
    ) -> List[Tuple[str, FileAnalysisResult]]:
        """
        Topological sort items based on dependencies.
        """
        if not items:
            return []

        # Build dependency map
        item_map = {item[1].detected_model: item for item in items}

        # Sort by dependency depth
        def get_depth(model: str, visited: set = None) -> int:
            if visited is None:
                visited = set()
            if model in visited:
                return 0  # Circular dependency protection
            visited.add(model)

            if model not in item_map:
                return 0

            deps = MODEL_DEPENDENCIES.get(model, [])
            if not deps:
                return 0

            # Only count dependencies that are in our item set
            relevant_deps = [d for d in deps if d in item_map]
            if not relevant_deps:
                return 0

            return 1 + max(get_depth(d, visited.copy()) for d in relevant_deps)

        # Sort by depth
        sorted_items = sorted(
            items,
            key=lambda x: get_depth(x[1].detected_model)
        )

        return sorted_items


def analyze_file(
    headers: List[str],
    sample_data: List[List[Any]] = None,
    filename: str = None
) -> FileAnalysisResult:
    """Convenience function to analyze a single file."""
    analyzer = FileAnalyzer()
    return analyzer.analyze(headers, sample_data, filename)
