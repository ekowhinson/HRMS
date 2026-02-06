"""
Data merge engine for combining multiple files based on join configurations.
Uses pandas for efficient data manipulation.
"""

import io
import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class MergeResult:
    """Result of a merge operation."""
    success: bool
    headers: List[str] = field(default_factory=list)
    data: List[List[Any]] = field(default_factory=list)
    row_count: int = 0
    statistics: Dict[str, int] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class DatasetMerger:
    """
    Merges multiple data files based on join configurations.
    Uses pandas for efficient data manipulation.
    """

    def __init__(self):
        self.max_rows = 100000  # Maximum rows to process

    def merge_files(
        self,
        files: List[Dict[str, Any]],
        joins: List[Dict[str, Any]],
        column_prefix: bool = True
    ) -> MergeResult:
        """
        Merge multiple files according to join configurations.

        Args:
            files: List of file data with 'file_id', 'alias', 'data' (binary), 'file_name', 'file_type'
            joins: List of join configs with 'left_file_id', 'left_column', 'right_file_id',
                   'right_column', 'join_type', 'order'
            column_prefix: If True, prefix columns with file alias to avoid collisions

        Returns:
            MergeResult with merged data
        """
        try:
            # Load all files into DataFrames
            dataframes = {}
            file_aliases = {}

            for file_info in files:
                file_id = str(file_info['file_id'])
                alias = file_info.get('alias', f'file_{file_id}')
                file_aliases[file_id] = alias

                df = self._load_file(
                    file_info['data'],
                    file_info['file_name'],
                    file_info.get('file_type', 'csv')
                )

                if df is None:
                    return MergeResult(
                        success=False,
                        errors=[f"Failed to load file: {file_info['file_name']}"]
                    )

                # Check row limit
                if len(df) > self.max_rows:
                    return MergeResult(
                        success=False,
                        errors=[f"File {file_info['file_name']} has {len(df)} rows, exceeding limit of {self.max_rows}"]
                    )

                # Add prefix to column names if needed
                if column_prefix:
                    df.columns = [f"{alias}.{col}" for col in df.columns]

                dataframes[file_id] = df

            if not dataframes:
                return MergeResult(
                    success=False,
                    errors=["No valid files to merge"]
                )

            # Sort joins by order
            sorted_joins = sorted(joins, key=lambda j: j.get('order', 0))

            if not sorted_joins:
                # No joins - just return the first file
                first_file_id = list(dataframes.keys())[0]
                result_df = dataframes[first_file_id]
            else:
                # Execute joins in order
                result_df = None
                merged_file_ids = set()
                statistics = {
                    'total_left_rows': 0,
                    'total_right_rows': 0,
                    'matched_rows': 0,
                    'unmatched_left': 0,
                    'unmatched_right': 0,
                }
                warnings = []

                for join_config in sorted_joins:
                    left_file_id = str(join_config['left_file_id'])
                    right_file_id = str(join_config['right_file_id'])
                    left_alias = file_aliases.get(left_file_id, left_file_id)
                    right_alias = file_aliases.get(right_file_id, right_file_id)

                    # Get column names with prefix
                    if column_prefix:
                        left_col = f"{left_alias}.{join_config['left_column']}"
                        right_col = f"{right_alias}.{join_config['right_column']}"
                    else:
                        left_col = join_config['left_column']
                        right_col = join_config['right_column']

                    join_type = join_config.get('join_type', 'left')

                    # Determine left and right DataFrames
                    if result_df is None:
                        # First join
                        left_df = dataframes.get(left_file_id)
                        if left_df is None:
                            return MergeResult(
                                success=False,
                                errors=[f"File not found: {left_file_id}"]
                            )
                        result_df = left_df.copy()
                        merged_file_ids.add(left_file_id)
                        statistics['total_left_rows'] = len(left_df)

                    right_df = dataframes.get(right_file_id)
                    if right_df is None:
                        return MergeResult(
                            success=False,
                            errors=[f"File not found: {right_file_id}"]
                        )

                    statistics['total_right_rows'] += len(right_df)

                    # Check if columns exist
                    if left_col not in result_df.columns:
                        return MergeResult(
                            success=False,
                            errors=[f"Column '{left_col}' not found in merged data"]
                        )
                    if right_col not in right_df.columns:
                        return MergeResult(
                            success=False,
                            errors=[f"Column '{right_col}' not found in file '{right_alias}'"]
                        )

                    # Perform the merge
                    rows_before = len(result_df)

                    result_df = pd.merge(
                        result_df,
                        right_df,
                        left_on=left_col,
                        right_on=right_col,
                        how=join_type,
                        suffixes=('', '_dup')
                    )

                    # Track statistics
                    merged_file_ids.add(right_file_id)

                    # Check for significant row changes
                    if len(result_df) == 0:
                        warnings.append(f"Join resulted in 0 rows. Check join columns: {left_col} ↔ {right_col}")
                    elif len(result_df) > rows_before * 10:
                        warnings.append(
                            f"Join caused significant row expansion ({rows_before} → {len(result_df)}). "
                            f"This may indicate a many-to-many relationship."
                        )

                # Remove duplicate columns
                dup_cols = [col for col in result_df.columns if col.endswith('_dup')]
                if dup_cols:
                    result_df = result_df.drop(columns=dup_cols)

            # Convert result to list format
            headers = result_df.columns.tolist()
            data = result_df.fillna('').values.tolist()

            return MergeResult(
                success=True,
                headers=headers,
                data=data,
                row_count=len(data),
                statistics={
                    'total_rows': len(data),
                    'total_columns': len(headers),
                    'files_merged': len(dataframes),
                },
                warnings=warnings if 'warnings' in locals() else []
            )

        except Exception as e:
            logger.exception("Error during merge")
            return MergeResult(
                success=False,
                errors=[f"Merge failed: {str(e)}"]
            )

    def preview_merge(
        self,
        files: List[Dict[str, Any]],
        joins: List[Dict[str, Any]],
        limit: int = 100
    ) -> MergeResult:
        """
        Preview merge with limited rows for performance.

        Args:
            files: List of file data (same as merge_files)
            joins: List of join configs (same as merge_files)
            limit: Maximum rows to return

        Returns:
            MergeResult with preview data
        """
        result = self.merge_files(files, joins)

        if result.success and len(result.data) > limit:
            result.data = result.data[:limit]
            result.warnings.append(f"Showing first {limit} of {result.row_count} rows")

        return result

    def _load_file(
        self,
        file_data: bytes,
        file_name: str,
        file_type: str
    ) -> Optional[pd.DataFrame]:
        """Load file data into a pandas DataFrame."""
        try:
            if file_type in ['xlsx', 'xls']:
                df = pd.read_excel(io.BytesIO(file_data))
            else:  # Default to CSV
                # Try different encodings
                for encoding in ['utf-8', 'latin-1', 'cp1252']:
                    try:
                        df = pd.read_csv(io.BytesIO(file_data), encoding=encoding)
                        break
                    except UnicodeDecodeError:
                        continue
                else:
                    logger.error(f"Could not decode file {file_name}")
                    return None

            # Clean column names
            df.columns = df.columns.str.strip()

            return df

        except Exception as e:
            logger.error(f"Error loading file {file_name}: {e}")
            return None

    def export_to_csv(self, result: MergeResult) -> bytes:
        """Export merge result to CSV bytes."""
        if not result.success or not result.data:
            return b''

        df = pd.DataFrame(result.data, columns=result.headers)
        output = io.BytesIO()
        df.to_csv(output, index=False)
        return output.getvalue()

    def export_to_excel(self, result: MergeResult) -> bytes:
        """Export merge result to Excel bytes."""
        if not result.success or not result.data:
            return b''

        df = pd.DataFrame(result.data, columns=result.headers)
        output = io.BytesIO()
        df.to_excel(output, index=False, engine='openpyxl')
        return output.getvalue()


class DataJoinAnalyzerRuleBased:
    """
    Rule-based join analysis when AI is not available.
    Uses column name matching and data pattern analysis.
    """

    # Common patterns for join keys
    KEY_PATTERNS = [
        'id', '_id', 'key', 'code', 'no', 'num', 'number',
        'ref', 'reference', 'employee', 'dept', 'department'
    ]

    def analyze_files(
        self,
        files_data: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Analyze files and suggest joins using rule-based matching.
        """
        suggestions = []

        # Compare each pair of files
        for i, file1 in enumerate(files_data):
            for file2 in files_data[i + 1:]:
                pair_suggestions = self._find_matching_columns(file1, file2)
                suggestions.extend(pair_suggestions)

        return suggestions

    def _find_matching_columns(
        self,
        file1: Dict[str, Any],
        file2: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Find matching columns between two files."""
        suggestions = []

        headers1 = [h.lower().strip() for h in file1.get('headers', [])]
        headers2 = [h.lower().strip() for h in file2.get('headers', [])]
        original_headers1 = file1.get('headers', [])
        original_headers2 = file2.get('headers', [])

        for i, h1 in enumerate(headers1):
            for j, h2 in enumerate(headers2):
                confidence = self._calculate_column_match_confidence(h1, h2)

                if confidence >= 0.5:
                    suggestions.append({
                        'left_file': file1['filename'],
                        'left_column': original_headers1[i],
                        'right_file': file2['filename'],
                        'right_column': original_headers2[j],
                        'confidence': confidence,
                        'join_type_recommendation': 'left',
                        'reasoning': f"Column name similarity: {h1} ↔ {h2}",
                        'relationship_type': 'N:1',
                    })

        # Sort by confidence
        suggestions.sort(key=lambda x: x['confidence'], reverse=True)

        return suggestions

    def _calculate_column_match_confidence(
        self,
        col1: str,
        col2: str
    ) -> float:
        """Calculate match confidence between two column names."""
        # Exact match
        if col1 == col2:
            return 1.0

        # Normalize column names
        norm1 = col1.replace('_', '').replace(' ', '').replace('-', '')
        norm2 = col2.replace('_', '').replace(' ', '').replace('-', '')

        if norm1 == norm2:
            return 0.95

        # Check if one contains the other
        if norm1 in norm2 or norm2 in norm1:
            return 0.8

        # Check for common key patterns
        has_key_pattern1 = any(p in col1 for p in self.KEY_PATTERNS)
        has_key_pattern2 = any(p in col2 for p in self.KEY_PATTERNS)

        if has_key_pattern1 and has_key_pattern2:
            # Check if they share a common base
            common_base = self._find_common_base(col1, col2)
            if common_base:
                return 0.7

        return 0.0

    def _find_common_base(self, col1: str, col2: str) -> Optional[str]:
        """Find common base word in column names."""
        words1 = set(col1.replace('_', ' ').replace('-', ' ').split())
        words2 = set(col2.replace('_', ' ').replace('-', ' ').split())

        common = words1 & words2
        # Filter out generic words
        common = {w for w in common if w not in ['id', 'no', 'code', 'num']}

        return list(common)[0] if common else None
