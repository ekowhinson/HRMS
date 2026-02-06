"""
Multi-file import orchestrator.
Coordinates the import of multiple files with automatic type detection,
dependency ordering, and coordinated processing.

Uses 3 AI agents for intelligent analysis:
1. FileProfilerAgent - Analyzes file structure and content
2. SchemaMatcherAgent - Matches files to database models
3. ImportPlannerAgent - Creates optimal import execution plan
"""

import logging
import os
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass, field
from django.db import transaction
from django.utils import timezone

from .models import MultiFileImportBatch, ImportJob
from .analyzer import FileAnalyzer, FileAnalysisResult, MODEL_DEPENDENCIES, MODEL_CATEGORIES
from .mapper import ColumnMapper
from .processor import ImportProcessor, ImportResult
from .parsers import parse_file, FileParser

logger = logging.getLogger(__name__)

# Check if AI agents are available
AI_AGENTS_AVAILABLE = bool(os.getenv('ANTHROPIC_API_KEY'))


@dataclass
class FileInfo:
    """Information about a file to be processed."""
    filename: str
    content: bytes
    file_type: str
    headers: List[str]
    sample_data: List[List[Any]]
    total_rows: int
    analysis: FileAnalysisResult = None


@dataclass
class BatchAnalysisResult:
    """Result of analyzing a batch of files."""
    files: Dict[str, FileInfo]
    processing_order: List[str]
    detected_models: Dict[str, str]
    confidence_scores: Dict[str, float]
    dependencies: Dict[str, List[str]]
    warnings: List[str]
    errors: List[str]


@dataclass
class BatchProcessingResult:
    """Result of processing a batch of files."""
    batch_id: str
    total_files: int
    completed_files: int
    failed_files: int
    total_rows: int
    success_count: int
    error_count: int
    skip_count: int
    file_results: Dict[str, ImportResult]
    errors: List[Dict]


class MultiFileOrchestrator:
    """
    Orchestrates the import of multiple files with automatic detection
    and dependency-aware processing.

    Supports two analysis modes:
    1. Rule-based (fallback): Uses pattern matching and heuristics
    2. AI-powered (default when available): Uses 3 Claude agents for intelligent analysis
    """

    def __init__(self, user=None, use_ai: bool = True):
        self.user = user
        self.analyzer = FileAnalyzer()
        self.mapper = ColumnMapper()
        self.processor = ImportProcessor()
        self.use_ai = use_ai and AI_AGENTS_AVAILABLE
        self._ai_orchestrator = None

    @property
    def ai_orchestrator(self):
        """Lazy load AI orchestrator only when needed."""
        if self._ai_orchestrator is None and self.use_ai:
            try:
                from .ai_agents import AIImportOrchestrator
                self._ai_orchestrator = AIImportOrchestrator()
            except Exception as e:
                logger.warning(f"Failed to initialize AI agents: {e}")
                self.use_ai = False
        return self._ai_orchestrator

    def analyze_files_with_ai(
        self,
        files: List[Tuple[str, bytes]],
        instructions: str = None
    ) -> BatchAnalysisResult:
        """
        Analyze files using AI agents.

        This method uses 3 specialized AI agents:
        1. FileProfilerAgent - Analyzes file structure and content
        2. SchemaMatcherAgent - Matches files to database models
        3. ImportPlannerAgent - Creates optimal import execution plan
        """
        file_infos = {}
        warnings = []
        errors = []
        ai_analysis = None

        # First, parse all files to get headers and sample data
        files_data = []
        for filename, content in files:
            try:
                file_type = FileParser.detect_type(filename, content)
                parsed = parse_file(content, filename)

                files_data.append({
                    'filename': filename,
                    'headers': parsed.headers,
                    'sample_data': parsed.sample_rows,
                    'row_count': parsed.total_rows
                })

                # Store basic file info
                file_infos[filename] = FileInfo(
                    filename=filename,
                    content=content,
                    file_type=file_type,
                    headers=parsed.headers,
                    sample_data=parsed.sample_rows,
                    total_rows=parsed.total_rows,
                    analysis=None  # Will be populated from AI analysis
                )

            except Exception as e:
                errors.append(f"Failed to parse '{filename}': {str(e)}")
                logger.exception(f"Error parsing file {filename}")

        if not files_data:
            return BatchAnalysisResult(
                files={},
                processing_order=[],
                detected_models={},
                confidence_scores={},
                dependencies={},
                warnings=warnings,
                errors=errors
            )

        # Run AI analysis
        try:
            logger.info(f"Starting AI analysis of {len(files_data)} files")
            ai_result = self.ai_orchestrator.analyze_files(files_data)
            ai_analysis = ai_result

            # Process AI results and create FileAnalysisResult objects
            matches = ai_result.get('matches', [])
            plan = ai_result.get('plan', {})

            for match in matches:
                filename = match.get('filename')
                if filename in file_infos:
                    # Convert AI match to FileAnalysisResult
                    analysis = FileAnalysisResult(
                        detected_model=match.get('target_model', ''),
                        confidence=match.get('confidence', 0),
                        matched_fields=match.get('column_mapping', {}),
                        model_scores={match.get('target_model', ''): match.get('confidence', 0)},
                        file_category=self._get_model_category(match.get('target_model', '')),
                        dependencies=MODEL_DEPENDENCIES.get(match.get('target_model', ''), []),
                        reason=match.get('reasoning', '')
                    )
                    file_infos[filename].analysis = analysis

                    if match.get('confidence', 0) < 0.5:
                        warnings.append(
                            f"Low confidence ({match.get('confidence', 0):.0%}) for '{filename}' "
                            f"detected as '{match.get('target_model', 'unknown')}'"
                        )

            # Add warnings and recommendations from the plan
            warnings.extend(plan.get('warnings', []))

            # Determine processing order from AI plan
            processing_order = []
            ai_files = plan.get('files', [])
            if ai_files:
                # Sort by processing_order field
                sorted_files = sorted(ai_files, key=lambda x: x.get('processing_order', 999))
                processing_order = [f['filename'] for f in sorted_files]
            else:
                # Fallback to plan's processing order
                model_order = plan.get('processing_order', [])
                model_to_file = {
                    file_infos[fn].analysis.detected_model: fn
                    for fn in file_infos
                    if file_infos[fn].analysis
                }
                processing_order = [
                    model_to_file[m]
                    for m in model_order
                    if m in model_to_file
                ]
                # Add any files not in the order
                for fn in file_infos:
                    if fn not in processing_order:
                        processing_order.append(fn)

        except Exception as e:
            logger.exception(f"AI analysis failed: {e}")
            errors.append(f"AI analysis failed: {str(e)}. Falling back to rule-based analysis.")

            # Fallback to rule-based analysis
            return self._analyze_files_rule_based(files, instructions)

        return BatchAnalysisResult(
            files=file_infos,
            processing_order=processing_order,
            detected_models={fn: fi.analysis.detected_model for fn, fi in file_infos.items() if fi.analysis},
            confidence_scores={fn: fi.analysis.confidence for fn, fi in file_infos.items() if fi.analysis},
            dependencies={fn: fi.analysis.dependencies for fn, fi in file_infos.items() if fi.analysis},
            warnings=warnings,
            errors=errors
        )

    def _get_model_category(self, model_name: str) -> str:
        """Get the category for a model."""
        for category, models in MODEL_CATEGORIES.items():
            if model_name in models:
                return category
        return 'unknown'

    def _analyze_files_rule_based(
        self,
        files: List[Tuple[str, bytes]],
        instructions: str = None
    ) -> BatchAnalysisResult:
        """Original rule-based file analysis (fallback method)."""
        file_infos = {}
        warnings = []
        errors = []

        for filename, content in files:
            try:
                file_type = FileParser.detect_type(filename, content)
                parsed = parse_file(content, filename)
                analysis = self.analyzer.analyze(
                    headers=parsed.headers,
                    sample_data=parsed.sample_rows,
                    filename=filename
                )

                file_infos[filename] = FileInfo(
                    filename=filename,
                    content=content,
                    file_type=file_type,
                    headers=parsed.headers,
                    sample_data=parsed.sample_rows,
                    total_rows=parsed.total_rows,
                    analysis=analysis
                )

                if analysis.confidence < 0.5:
                    warnings.append(
                        f"Low confidence ({analysis.confidence:.0%}) for '{filename}' "
                        f"detected as '{analysis.detected_model}'"
                    )

            except Exception as e:
                errors.append(f"Failed to analyze '{filename}': {str(e)}")
                logger.exception(f"Error analyzing file {filename}")

        if not file_infos:
            return BatchAnalysisResult(
                files={},
                processing_order=[],
                detected_models={},
                confidence_scores={},
                dependencies={},
                warnings=warnings,
                errors=errors
            )

        analysis_results = {fn: fi.analysis for fn, fi in file_infos.items()}
        ordered = self.analyzer.get_processing_order(analysis_results)
        processing_order = [fn for fn, _ in ordered]

        return BatchAnalysisResult(
            files=file_infos,
            processing_order=processing_order,
            detected_models={fn: fi.analysis.detected_model for fn, fi in file_infos.items()},
            confidence_scores={fn: fi.analysis.confidence for fn, fi in file_infos.items()},
            dependencies={fn: fi.analysis.dependencies for fn, fi in file_infos.items()},
            warnings=warnings,
            errors=errors
        )

    def analyze_files(
        self,
        files: List[Tuple[str, bytes]],
        instructions: str = None
    ) -> BatchAnalysisResult:
        """
        Analyze multiple files to detect their types and determine processing order.

        Uses AI-powered analysis when available (ANTHROPIC_API_KEY set),
        falls back to rule-based analysis otherwise.

        AI Analysis uses 3 specialized agents:
        1. FileProfilerAgent - Analyzes file structure and content
        2. SchemaMatcherAgent - Matches files to database models
        3. ImportPlannerAgent - Creates optimal import execution plan

        Args:
            files: List of (filename, content) tuples
            instructions: Optional user instructions

        Returns:
            BatchAnalysisResult with analysis details
        """
        if self.use_ai and self.ai_orchestrator:
            logger.info("Using AI-powered analysis with 3 agents")
            return self.analyze_files_with_ai(files, instructions)
        else:
            logger.info("Using rule-based analysis (AI not available)")
            return self._analyze_files_rule_based(files, instructions)

    def create_batch(
        self,
        analysis: BatchAnalysisResult,
        name: str = None,
        instructions: str = None,
        auto_create_dependencies: bool = True,
        update_existing: bool = True
    ) -> MultiFileImportBatch:
        """
        Create a batch import from analysis results.

        Args:
            analysis: BatchAnalysisResult from analyze_files
            name: Optional batch name
            instructions: Optional user instructions
            auto_create_dependencies: Auto-create missing setup records
            update_existing: Update existing records if found

        Returns:
            MultiFileImportBatch instance
        """
        # Calculate total rows
        total_rows = sum(fi.total_rows for fi in analysis.files.values())

        # Build analysis results JSON
        analysis_json = {}
        for filename, file_info in analysis.files.items():
            analysis_json[filename] = {
                'detected_model': file_info.analysis.detected_model,
                'confidence': file_info.analysis.confidence,
                'matched_fields': file_info.analysis.matched_fields,
                'file_category': file_info.analysis.file_category,
                'dependencies': file_info.analysis.dependencies,
                'reason': file_info.analysis.reason,
                'total_rows': file_info.total_rows,
            }

        # Create batch
        batch = MultiFileImportBatch.objects.create(
            name=name or f"Batch Import ({len(analysis.files)} files)",
            instructions=instructions,
            status=MultiFileImportBatch.Status.READY,
            analysis_results=analysis_json,
            processing_order=analysis.processing_order,
            file_count=len(analysis.files),
            total_rows=total_rows,
            auto_create_dependencies=auto_create_dependencies,
            update_existing=update_existing,
            created_by=self.user
        )

        # Create individual import jobs for each file
        for order, filename in enumerate(analysis.processing_order):
            file_info = analysis.files[filename]

            # Generate column mapping
            if file_info.analysis.detected_model:
                mapping_results = self.mapper.map_columns(
                    headers=file_info.headers,
                    target_model=file_info.analysis.detected_model,
                    instructions=instructions
                )
                column_mapping = {
                    result.source_column: result.target_field
                    for result in mapping_results.values()
                    if result.confidence >= 0.5
                }
                mapping_confidence = {
                    result.source_column: {
                        'target_field': result.target_field,
                        'confidence': result.confidence,
                        'reason': result.reason
                    }
                    for result in mapping_results.values()
                }
            else:
                column_mapping = {}
                mapping_confidence = {}

            job = ImportJob.objects.create(
                original_filename=filename,
                file_type=file_info.file_type,
                target_model=file_info.analysis.detected_model or '',
                column_mapping=column_mapping,
                mapping_confidence=mapping_confidence,
                headers=file_info.headers,
                sample_data=file_info.sample_data,
                total_rows=file_info.total_rows,
                status=ImportJob.Status.PREVIEW,
                batch=batch,
                processing_order=order,
                detected_model=file_info.analysis.detected_model or '',
                detection_confidence=file_info.analysis.confidence,
                created_by=self.user
            )

            # Store file data
            job.set_file(file_info.content, filename)
            job.save()

        return batch

    def process_batch(
        self,
        batch: MultiFileImportBatch,
        override_mappings: Dict[str, Dict[str, str]] = None
    ) -> BatchProcessingResult:
        """
        Process all files in a batch in the correct order.

        Args:
            batch: The batch to process
            override_mappings: Optional dict of {filename: {column_mapping}} to override

        Returns:
            BatchProcessingResult with details
        """
        result = BatchProcessingResult(
            batch_id=str(batch.id),
            total_files=batch.file_count,
            completed_files=0,
            failed_files=0,
            total_rows=batch.total_rows,
            success_count=0,
            error_count=0,
            skip_count=0,
            file_results={},
            errors=[]
        )

        try:
            batch.start_processing()

            # Get jobs in processing order
            jobs = batch.jobs.order_by('processing_order')

            for job in jobs:
                # Apply override mapping if provided
                if override_mappings and job.original_filename in override_mappings:
                    job.column_mapping = override_mappings[job.original_filename]
                    job.save(update_fields=['column_mapping'])

                # Skip jobs without a target model
                if not job.target_model:
                    result.errors.append({
                        'file': job.original_filename,
                        'message': 'No target model detected'
                    })
                    result.failed_files += 1
                    continue

                # Process the job
                try:
                    job_result = self.processor.process(job)
                    result.file_results[job.original_filename] = job_result
                    result.success_count += job_result.success_count
                    result.error_count += job_result.error_count
                    result.skip_count += job_result.skip_count

                    if job_result.error_count == 0 or job_result.success_count > 0:
                        result.completed_files += 1
                        batch.files_completed += 1
                    else:
                        result.failed_files += 1
                        batch.files_failed += 1

                except Exception as e:
                    logger.exception(f"Error processing job {job.id}")
                    result.errors.append({
                        'file': job.original_filename,
                        'message': str(e)
                    })
                    result.failed_files += 1
                    batch.files_failed += 1
                    job.fail(str(e))

                # Update batch progress
                batch.processed_rows += job.processed_rows
                batch.success_count = result.success_count
                batch.error_count = result.error_count
                batch.save(update_fields=[
                    'processed_rows', 'success_count', 'error_count',
                    'files_completed', 'files_failed'
                ])

                # Refresh FK caches after setup data imports
                if job.target_model in MODEL_CATEGORIES.get('setup', []):
                    self.processor._cache_foreign_keys(job.target_model)

            batch.complete()

        except Exception as e:
            logger.exception(f"Batch {batch.id} failed: {str(e)}")
            batch.fail(str(e))
            result.errors.append({
                'type': 'system',
                'message': str(e)
            })

        return result

    def get_batch_summary(self, batch: MultiFileImportBatch) -> Dict[str, Any]:
        """Get a summary of a batch's status and results."""
        jobs = batch.jobs.all()

        file_summaries = []
        for job in jobs.order_by('processing_order'):
            file_summaries.append({
                'filename': job.original_filename,
                'detected_model': job.detected_model,
                'detection_confidence': job.detection_confidence,
                'target_model': job.target_model,
                'status': job.status,
                'total_rows': job.total_rows,
                'success_count': job.success_count,
                'error_count': job.error_count,
                'processing_order': job.processing_order,
            })

        return {
            'id': str(batch.id),
            'name': batch.name,
            'status': batch.status,
            'file_count': batch.file_count,
            'files_completed': batch.files_completed,
            'files_failed': batch.files_failed,
            'total_rows': batch.total_rows,
            'processed_rows': batch.processed_rows,
            'success_count': batch.success_count,
            'error_count': batch.error_count,
            'progress_percentage': batch.progress_percentage,
            'processing_order': batch.processing_order,
            'files': file_summaries,
            'started_at': batch.started_at,
            'completed_at': batch.completed_at,
        }


def quick_analyze(files: List[Tuple[str, bytes]]) -> Dict[str, Dict[str, Any]]:
    """
    Quick utility function to analyze files without creating a batch.

    Args:
        files: List of (filename, content) tuples

    Returns:
        Dict mapping filename to analysis details
    """
    orchestrator = MultiFileOrchestrator()
    analysis = orchestrator.analyze_files(files)

    return {
        'files': {
            fn: {
                'detected_model': fi.analysis.detected_model,
                'confidence': fi.analysis.confidence,
                'matched_fields': fi.analysis.matched_fields,
                'file_category': fi.analysis.file_category,
                'total_rows': fi.total_rows,
                'reason': fi.analysis.reason
            }
            for fn, fi in analysis.files.items()
        },
        'processing_order': analysis.processing_order,
        'warnings': analysis.warnings,
        'errors': analysis.errors
    }
