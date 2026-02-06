"""
AI-powered import agents using Claude for intelligent file analysis and import planning.

This module contains 3 specialized AI agents:
1. FileProfilerAgent - Analyzes file structure and content
2. SchemaMatcherAgent - Matches files to database models
3. ImportPlannerAgent - Creates optimal import execution plan
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime

import anthropic

from .mapper import MODEL_FIELDS

logger = logging.getLogger(__name__)


@dataclass
class FileProfile:
    """Profile of an analyzed file."""
    filename: str
    headers: List[str]
    row_count: int
    sample_data: List[List[Any]]
    data_types: Dict[str, str]  # column -> detected type
    patterns: Dict[str, Any]  # detected patterns (dates, IDs, etc.)
    summary: str  # AI-generated summary of the file contents


@dataclass
class SchemaMatch:
    """Match result between a file and database schema."""
    filename: str
    target_model: str
    confidence: float
    column_mapping: Dict[str, str]  # file_column -> db_field
    unmapped_columns: List[str]
    missing_required: List[str]
    reasoning: str


@dataclass
class ImportPlan:
    """Complete import execution plan."""
    files: List[Dict[str, Any]]  # Ordered list of files to import
    dependencies: Dict[str, List[str]]  # model -> depends_on
    processing_order: List[str]  # Ordered model names
    warnings: List[str]
    recommendations: List[str]
    estimated_records: int
    summary: str


class AIAgentBase:
    """Base class for AI agents."""

    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        if not self.api_key:
            raise ValueError("ANTHROPIC_API_KEY not found in environment")
        self.client = anthropic.Anthropic(api_key=self.api_key)
        self.model = "claude-sonnet-4-20250514"

    def _call_claude(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 4096
    ) -> str:
        """Make a call to Claude API."""
        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=max_tokens,
                system=system_prompt,
                messages=[
                    {"role": "user", "content": user_prompt}
                ]
            )
            return response.content[0].text
        except Exception as e:
            logger.error(f"Claude API error: {e}")
            raise

    def _parse_json_response(self, response: str) -> Dict[str, Any]:
        """Extract and parse JSON from Claude's response."""
        # Try to find JSON block in response
        try:
            # Try parsing the whole response as JSON
            return json.loads(response)
        except json.JSONDecodeError:
            pass

        # Try to extract JSON from markdown code blocks
        import re
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', response)
        if json_match:
            try:
                return json.loads(json_match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find JSON object or array in response
        for pattern in [r'\{[\s\S]*\}', r'\[[\s\S]*\]']:
            match = re.search(pattern, response)
            if match:
                try:
                    return json.loads(match.group())
                except json.JSONDecodeError:
                    continue

        raise ValueError(f"Could not parse JSON from response: {response[:500]}")


class FileProfilerAgent(AIAgentBase):
    """
    Agent 1: File Profiler
    Analyzes file structure, detects data types, and summarizes content.
    """

    SYSTEM_PROMPT = """You are a data file analysis expert. Your job is to analyze spreadsheet/CSV files and create detailed profiles of their contents.

For each file, you will:
1. Analyze column headers to understand what data they contain
2. Examine sample data to detect data types (text, number, date, ID, email, phone, etc.)
3. Identify patterns (employee IDs, department codes, date formats, currency values, etc.)
4. Provide a concise summary of what the file appears to contain

You must respond with valid JSON only. No additional text or explanation outside the JSON."""

    def profile_file(
        self,
        filename: str,
        headers: List[str],
        sample_data: List[List[Any]],
        row_count: int
    ) -> FileProfile:
        """Analyze a file and create a detailed profile."""

        # Prepare sample data for the prompt
        sample_str = self._format_sample_data(headers, sample_data)

        user_prompt = f"""Analyze this file and provide a detailed profile:

**Filename:** {filename}
**Total Rows:** {row_count}
**Columns ({len(headers)}):** {', '.join(headers)}

**Sample Data (first {len(sample_data)} rows):**
{sample_str}

Respond with JSON in this exact format:
{{
    "data_types": {{
        "column_name": "type (text|number|date|datetime|id|email|phone|currency|percentage|boolean|code)",
        ...
    }},
    "patterns": {{
        "id_columns": ["columns that appear to be identifiers"],
        "date_columns": ["columns containing dates"],
        "date_format": "detected date format (e.g., YYYY-MM-DD, DD/MM/YYYY)",
        "name_columns": ["columns containing person names"],
        "code_columns": ["columns containing codes/abbreviations"],
        "numeric_columns": ["columns with numeric data"],
        "reference_columns": ["columns that reference other data"]
    }},
    "summary": "A 2-3 sentence summary of what this file contains and what data it represents"
}}"""

        response = self._call_claude(self.SYSTEM_PROMPT, user_prompt)
        result = self._parse_json_response(response)

        return FileProfile(
            filename=filename,
            headers=headers,
            row_count=row_count,
            sample_data=sample_data,
            data_types=result.get('data_types', {}),
            patterns=result.get('patterns', {}),
            summary=result.get('summary', '')
        )

    def _format_sample_data(
        self,
        headers: List[str],
        sample_data: List[List[Any]]
    ) -> str:
        """Format sample data as a readable table."""
        if not sample_data:
            return "No sample data available"

        lines = []
        # Header row
        lines.append(" | ".join(str(h)[:20] for h in headers))
        lines.append("-" * 80)

        # Data rows
        for row in sample_data[:5]:
            row_data = []
            for i, val in enumerate(row):
                if i < len(headers):
                    val_str = str(val) if val is not None else ""
                    row_data.append(val_str[:20])
            lines.append(" | ".join(row_data))

        return "\n".join(lines)


class SchemaMatcherAgent(AIAgentBase):
    """
    Agent 2: Schema Matcher
    Matches file profiles to database models and maps columns.
    """

    def __init__(self, api_key: Optional[str] = None):
        super().__init__(api_key)
        self.schema_info = self._build_schema_info()

    def _build_schema_info(self) -> str:
        """Build a description of available database schemas."""
        schemas = []

        for model_name, fields in MODEL_FIELDS.items():
            field_info = []
            required_fields = []
            optional_fields = []

            for field_name, field_def in fields.items():
                aliases = f" (aliases: {', '.join(field_def.aliases)})" if field_def.aliases else ""
                field_str = f"  - {field_name}: {field_def.type}{aliases}"

                if field_def.required:
                    required_fields.append(field_str)
                else:
                    optional_fields.append(field_str)

            schema_str = f"""
### {model_name}
**Required fields:**
{chr(10).join(required_fields) if required_fields else '  None'}

**Optional fields:**
{chr(10).join(optional_fields[:10]) if optional_fields else '  None'}
{'  ... and more' if len(optional_fields) > 10 else ''}
"""
            schemas.append(schema_str)

        return "\n".join(schemas)

    SYSTEM_PROMPT = """You are a database schema matching expert. Your job is to analyze file profiles and match them to the most appropriate database table/model.

You will:
1. Analyze the file's columns and detected patterns
2. Match the file to the most appropriate database model
3. Map file columns to database fields
4. Calculate confidence based on match quality

You must respond with valid JSON only. Be thorough in your column mapping - try to map as many columns as possible."""

    def match_file(self, profile: FileProfile) -> SchemaMatch:
        """Match a file profile to a database schema."""

        user_prompt = f"""Match this file to the most appropriate database model:

**File Profile:**
- Filename: {profile.filename}
- Rows: {profile.row_count}
- Columns: {', '.join(profile.headers)}
- Summary: {profile.summary}
- Detected patterns: {json.dumps(profile.patterns, indent=2)}

**Available Database Models:**
{self.schema_info}

Respond with JSON in this exact format:
{{
    "target_model": "the best matching model name",
    "confidence": 0.85,
    "column_mapping": {{
        "file_column_name": "database_field_name",
        ...
    }},
    "unmapped_columns": ["columns that couldn't be mapped"],
    "missing_required": ["required db fields not found in file"],
    "reasoning": "Explanation of why this model was chosen and how columns were matched"
}}

Important:
- Confidence should be between 0 and 1
- Try to map as many columns as possible
- Use exact field names from the database models
- Consider the patterns detected (IDs, dates, names) when matching"""

        response = self._call_claude(self.SYSTEM_PROMPT, user_prompt)
        result = self._parse_json_response(response)

        return SchemaMatch(
            filename=profile.filename,
            target_model=result.get('target_model', ''),
            confidence=float(result.get('confidence', 0)),
            column_mapping=result.get('column_mapping', {}),
            unmapped_columns=result.get('unmapped_columns', []),
            missing_required=result.get('missing_required', []),
            reasoning=result.get('reasoning', '')
        )


class ImportPlannerAgent(AIAgentBase):
    """
    Agent 3: Import Planner
    Creates optimal import execution plan considering dependencies.
    """

    # Model dependencies - what needs to exist before importing
    MODEL_DEPENDENCIES = {
        'divisions': [],
        'directorates': ['divisions'],
        'departments': ['directorates'],
        'grades': [],
        'job_categories': [],
        'positions': ['departments', 'grades'],
        'work_locations': [],
        'banks': [],
        'bank_branches': ['banks'],
        'staff_categories': [],
        'salary_bands': ['staff_categories'],
        'salary_levels': ['salary_bands'],
        'salary_notches': ['salary_levels'],
        'pay_components': [],
        'leave_types': [],
        'holidays': [],
        'employees': ['departments', 'positions', 'grades', 'directorates', 'work_locations', 'staff_categories', 'salary_notches'],
        'bank_accounts': ['employees', 'banks', 'bank_branches'],
        'leave_balances': ['employees', 'leave_types'],
        'transactions': ['employees', 'pay_components'],
    }

    # Model categories for grouping
    MODEL_CATEGORIES = {
        'organization_setup': ['divisions', 'directorates', 'departments', 'grades', 'job_categories', 'positions', 'work_locations'],
        'payroll_setup': ['banks', 'bank_branches', 'staff_categories', 'salary_bands', 'salary_levels', 'salary_notches', 'pay_components'],
        'leave_setup': ['leave_types', 'holidays'],
        'main_records': ['employees'],
        'employee_data': ['bank_accounts', 'leave_balances', 'transactions'],
    }

    SYSTEM_PROMPT = """You are a data import planning expert. Your job is to create optimal import execution plans that respect data dependencies.

You will:
1. Analyze all files to be imported and their target models
2. Determine the correct import order based on dependencies
3. Identify potential issues or warnings
4. Provide recommendations for successful import

You must respond with valid JSON only."""

    def create_plan(self, matches: List[SchemaMatch]) -> ImportPlan:
        """Create an import execution plan from schema matches."""

        # Build file info for prompt
        files_info = []
        for match in matches:
            files_info.append({
                'filename': match.filename,
                'target_model': match.target_model,
                'confidence': match.confidence,
                'mapped_columns': len(match.column_mapping),
                'missing_required': match.missing_required
            })

        user_prompt = f"""Create an import execution plan for these files:

**Files to Import:**
{json.dumps(files_info, indent=2)}

**Model Dependencies:**
{json.dumps(self.MODEL_DEPENDENCIES, indent=2)}

**Model Categories:**
{json.dumps(self.MODEL_CATEGORIES, indent=2)}

Respond with JSON in this exact format:
{{
    "processing_order": ["model_name_1", "model_name_2", ...],
    "warnings": [
        "Any potential issues or concerns"
    ],
    "recommendations": [
        "Suggestions for successful import"
    ],
    "summary": "A brief summary of the import plan and what will be imported"
}}

Important considerations:
- Order models so dependencies are imported first
- Flag any missing dependencies (e.g., importing employees but no departments file)
- Warn about low confidence matches
- Recommend reviewing files with missing required fields"""

        response = self._call_claude(self.SYSTEM_PROMPT, user_prompt)
        result = self._parse_json_response(response)

        # Build ordered file list
        processing_order = result.get('processing_order', [])
        ordered_files = []

        # Sort matches by processing order
        model_to_match = {m.target_model: m for m in matches}

        for model in processing_order:
            if model in model_to_match:
                match = model_to_match[model]
                ordered_files.append({
                    'filename': match.filename,
                    'target_model': match.target_model,
                    'confidence': match.confidence,
                    'column_mapping': match.column_mapping,
                    'processing_order': processing_order.index(model),
                    'reasoning': match.reasoning
                })

        # Add any files not in the processing order
        for match in matches:
            if match.target_model not in processing_order:
                ordered_files.append({
                    'filename': match.filename,
                    'target_model': match.target_model,
                    'confidence': match.confidence,
                    'column_mapping': match.column_mapping,
                    'processing_order': len(processing_order),
                    'reasoning': match.reasoning
                })

        return ImportPlan(
            files=ordered_files,
            dependencies=self.MODEL_DEPENDENCIES,
            processing_order=processing_order,
            warnings=result.get('warnings', []),
            recommendations=result.get('recommendations', []),
            estimated_records=sum(1 for _ in matches),  # Will be updated with actual counts
            summary=result.get('summary', '')
        )


@dataclass
class JoinSuggestion:
    """Suggested join between two files."""
    left_file: str
    left_column: str
    right_file: str
    right_column: str
    confidence: float  # 0-1
    join_type_recommendation: str  # inner, left, right, outer
    reasoning: str
    relationship_type: str  # 1:1, 1:N, N:1, N:N
    sample_matches: List[Dict]


@dataclass
class DatasetAnalysisResult:
    """Complete analysis of multiple files for joining."""
    files: List[Dict[str, Any]]
    join_suggestions: List[JoinSuggestion]
    relationship_graph: Dict[str, Any]  # primary_file, relationships
    warnings: List[str]
    recommendations: List[str]


class DataJoinAnalyzerAgent(AIAgentBase):
    """
    Agent for analyzing multiple files and suggesting joins.
    Compares column names, data types, and value patterns to find relationships.
    """

    SYSTEM_PROMPT = """You are a data relationship analysis expert. Your job is to analyze multiple data files and suggest how they should be joined together.

You will:
1. Compare column names across files for semantic matches (e.g., "emp_id" ↔ "employee_number")
2. Analyze data types and value patterns to confirm matches
3. Determine relationship cardinality (1:1, 1:N, N:1, N:N)
4. Recommend join types based on data patterns
5. Provide confidence scores (0-1) based on match quality

You must respond with valid JSON only. Be thorough in finding all possible relationships."""

    def analyze_files(
        self,
        files_data: List[Dict[str, Any]]
    ) -> DatasetAnalysisResult:
        """
        Analyze multiple files and suggest joins.

        Args:
            files_data: List of dicts with 'filename', 'headers', 'sample_data', 'row_count', 'data_types'

        Returns:
            DatasetAnalysisResult with join suggestions
        """
        # Build file summary for prompt
        files_summary = []
        for f in files_data:
            files_summary.append({
                'filename': f['filename'],
                'headers': f['headers'],
                'row_count': f.get('row_count', 0),
                'data_types': f.get('data_types', {}),
                'sample_values': self._extract_sample_values(f.get('headers', []), f.get('sample_data', []))
            })

        user_prompt = f"""Analyze these files and suggest how they should be joined:

**Files:**
{json.dumps(files_summary, indent=2)}

Respond with JSON in this exact format:
{{
    "files": [
        {{
            "filename": "file.xlsx",
            "likely_role": "primary|secondary|reference",
            "key_columns": ["columns that could be join keys"],
            "description": "What this file contains"
        }}
    ],
    "join_suggestions": [
        {{
            "left_file": "employees.xlsx",
            "left_column": "employee_id",
            "right_file": "departments.xlsx",
            "right_column": "dept_id",
            "confidence": 0.95,
            "join_type_recommendation": "left",
            "reasoning": "Why these columns should be joined",
            "relationship_type": "N:1",
            "sample_matches": [
                {{"left_value": "EMP001", "right_value": "DEPT01"}}
            ]
        }}
    ],
    "relationship_graph": {{
        "primary_file": "employees.xlsx",
        "relationships": [
            {{"from": "employees.xlsx", "to": "departments.xlsx", "type": "N:1"}}
        ]
    }},
    "warnings": ["Any potential issues with the data"],
    "recommendations": ["Suggestions for optimal merging"]
}}

Important:
- Confidence should be 0-1 based on column name similarity and data pattern matching
- relationship_type: "1:1" (one-to-one), "1:N" (one-to-many), "N:1" (many-to-one), "N:N" (many-to-many)
- join_type_recommendation: "inner" (only matching), "left" (keep all from left), "right" (keep all from right), "outer" (keep all)
- Look for ID columns, code columns, and reference columns as potential join keys
- Consider column names like: id, _id, code, number, no, ref, key"""

        response = self._call_claude(self.SYSTEM_PROMPT, user_prompt)
        result = self._parse_json_response(response)

        # Build JoinSuggestion objects
        suggestions = []
        for s in result.get('join_suggestions', []):
            suggestions.append(JoinSuggestion(
                left_file=s.get('left_file', ''),
                left_column=s.get('left_column', ''),
                right_file=s.get('right_file', ''),
                right_column=s.get('right_column', ''),
                confidence=float(s.get('confidence', 0)),
                join_type_recommendation=s.get('join_type_recommendation', 'left'),
                reasoning=s.get('reasoning', ''),
                relationship_type=s.get('relationship_type', 'N:1'),
                sample_matches=s.get('sample_matches', [])
            ))

        return DatasetAnalysisResult(
            files=result.get('files', []),
            join_suggestions=suggestions,
            relationship_graph=result.get('relationship_graph', {}),
            warnings=result.get('warnings', []),
            recommendations=result.get('recommendations', [])
        )

    def _extract_sample_values(
        self,
        headers: List[str],
        sample_data: List[List[Any]]
    ) -> Dict[str, List[str]]:
        """Extract unique sample values for each column."""
        sample_values = {}
        for i, header in enumerate(headers):
            values = []
            for row in sample_data[:5]:
                if i < len(row) and row[i] is not None:
                    val = str(row[i]).strip()
                    if val and val not in values:
                        values.append(val)
            sample_values[header] = values[:3]  # Limit to 3 samples
        return sample_values

    def suggest_join_for_pair(
        self,
        file1: Dict[str, Any],
        file2: Dict[str, Any]
    ) -> List[JoinSuggestion]:
        """
        Suggest joins between two specific files.
        """
        files_data = [file1, file2]
        result = self.analyze_files(files_data)
        return result.join_suggestions


class AIImportOrchestrator:
    """
    Orchestrates the 3 AI agents to analyze files and create import plans.
    """

    def __init__(self, api_key: Optional[str] = None):
        self.profiler = FileProfilerAgent(api_key)
        self.matcher = SchemaMatcherAgent(api_key)
        self.planner = ImportPlannerAgent(api_key)

    def analyze_files(
        self,
        files_data: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Run the full AI analysis pipeline on multiple files.

        Args:
            files_data: List of dicts with 'filename', 'headers', 'sample_data', 'row_count'

        Returns:
            Complete analysis result with profiles, matches, and import plan
        """
        logger.info(f"Starting AI analysis of {len(files_data)} files")

        # Phase 1: Profile each file
        profiles = []
        for file_info in files_data:
            logger.info(f"Profiling file: {file_info['filename']}")
            try:
                profile = self.profiler.profile_file(
                    filename=file_info['filename'],
                    headers=file_info['headers'],
                    sample_data=file_info.get('sample_data', []),
                    row_count=file_info.get('row_count', 0)
                )
                profiles.append(profile)
            except Exception as e:
                logger.error(f"Error profiling {file_info['filename']}: {e}")
                # Create a basic profile on error
                profiles.append(FileProfile(
                    filename=file_info['filename'],
                    headers=file_info['headers'],
                    row_count=file_info.get('row_count', 0),
                    sample_data=file_info.get('sample_data', []),
                    data_types={},
                    patterns={},
                    summary=f"Error during profiling: {str(e)}"
                ))

        # Phase 2: Match each profile to database schema
        matches = []
        for profile in profiles:
            logger.info(f"Matching file to schema: {profile.filename}")
            try:
                match = self.matcher.match_file(profile)
                matches.append(match)
            except Exception as e:
                logger.error(f"Error matching {profile.filename}: {e}")
                matches.append(SchemaMatch(
                    filename=profile.filename,
                    target_model='',
                    confidence=0.0,
                    column_mapping={},
                    unmapped_columns=profile.headers,
                    missing_required=[],
                    reasoning=f"Error during matching: {str(e)}"
                ))

        # Phase 3: Create import plan
        logger.info("Creating import execution plan")
        try:
            plan = self.planner.create_plan(matches)
        except Exception as e:
            logger.error(f"Error creating plan: {e}")
            plan = ImportPlan(
                files=[asdict(m) for m in matches],
                dependencies={},
                processing_order=[],
                warnings=[f"Error creating plan: {str(e)}"],
                recommendations=["Review files manually"],
                estimated_records=0,
                summary="Plan generation failed"
            )

        # Build complete result
        result = {
            'analysis_timestamp': datetime.now().isoformat(),
            'file_count': len(files_data),
            'profiles': [asdict(p) for p in profiles],
            'matches': [asdict(m) for m in matches],
            'plan': asdict(plan)
        }

        logger.info(f"AI analysis complete. Plan: {plan.summary}")
        return result

    def analyze_single_file(
        self,
        filename: str,
        headers: List[str],
        sample_data: List[List[Any]],
        row_count: int
    ) -> SchemaMatch:
        """
        Quick analysis of a single file.
        """
        profile = self.profiler.profile_file(filename, headers, sample_data, row_count)
        match = self.matcher.match_file(profile)
        return match
