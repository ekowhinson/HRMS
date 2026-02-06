"""
Management command to analyze import files using the AI-powered file analyzer.
This allows testing the file analysis without creating an import batch.
"""

import os
from django.core.management.base import BaseCommand, CommandError

from imports.analyzer import FileAnalyzer, analyze_file
from imports.parsers import parse_file, FileParser
from imports.orchestrator import MultiFileOrchestrator, quick_analyze


def simple_table(headers, rows, col_widths=None):
    """Simple table formatting without external dependencies."""
    if not col_widths:
        col_widths = []
        for i, h in enumerate(headers):
            max_width = len(str(h))
            for row in rows:
                if i < len(row):
                    max_width = max(max_width, len(str(row[i])))
            col_widths.append(max_width + 2)

    # Header
    header_line = '|'
    for i, h in enumerate(headers):
        header_line += f' {str(h):<{col_widths[i]}} |'

    sep_line = '+' + '+'.join('-' * (w + 2) for w in col_widths) + '+'

    lines = [sep_line, header_line, sep_line]
    for row in rows:
        row_line = '|'
        for i, val in enumerate(row):
            if i < len(col_widths):
                row_line += f' {str(val):<{col_widths[i]}} |'
        lines.append(row_line)
    lines.append(sep_line)

    return '\n'.join(lines)


class Command(BaseCommand):
    help = 'Analyze import files to detect their data types and processing order'

    def add_arguments(self, parser):
        parser.add_argument(
            'files',
            nargs='+',
            type=str,
            help='Paths to files to analyze'
        )
        parser.add_argument(
            '--details',
            '-d',
            action='store_true',
            help='Show detailed analysis including all model scores'
        )
        parser.add_argument(
            '--show-mapping',
            '-m',
            action='store_true',
            help='Show suggested column mappings'
        )

    def handle(self, *args, **options):
        files = options['files']
        verbose = options['details']
        show_mapping = options['show_mapping']

        # Validate files exist
        valid_files = []
        for filepath in files:
            if not os.path.exists(filepath):
                self.stderr.write(self.style.ERROR(f'File not found: {filepath}'))
                continue
            valid_files.append(filepath)

        if not valid_files:
            raise CommandError('No valid files to analyze')

        self.stdout.write(f'\nAnalyzing {len(valid_files)} file(s)...\n')

        # Read files
        files_data = []
        for filepath in valid_files:
            with open(filepath, 'rb') as f:
                content = f.read()
            filename = os.path.basename(filepath)
            files_data.append((filename, content))

        # Analyze
        orchestrator = MultiFileOrchestrator()
        analysis = orchestrator.analyze_files(files_data)

        # Display results
        self.stdout.write('\n' + '=' * 80)
        self.stdout.write(self.style.SUCCESS('ANALYSIS RESULTS'))
        self.stdout.write('=' * 80 + '\n')

        # Summary table
        summary_data = []
        for filename in analysis.processing_order:
            file_info = analysis.files[filename]
            summary_data.append([
                filename,
                file_info.analysis.detected_model or 'Unknown',
                f'{file_info.analysis.confidence:.0%}',
                file_info.analysis.file_category,
                file_info.total_rows,
            ])

        self.stdout.write(simple_table(
            ['File', 'Detected Type', 'Confidence', 'Category', 'Rows'],
            summary_data
        ))

        # Processing order
        self.stdout.write('\n' + '-' * 40)
        self.stdout.write(self.style.WARNING('Processing Order:'))
        for i, filename in enumerate(analysis.processing_order, 1):
            file_info = analysis.files[filename]
            deps = file_info.analysis.dependencies
            dep_str = f' (depends on: {", ".join(deps)})' if deps else ''
            self.stdout.write(f'  {i}. {filename} → {file_info.analysis.detected_model}{dep_str}')

        # Detailed analysis per file
        if verbose or show_mapping:
            for filename, file_info in analysis.files.items():
                self.stdout.write('\n' + '=' * 80)
                self.stdout.write(self.style.HTTP_INFO(f'FILE: {filename}'))
                self.stdout.write('=' * 80)

                self.stdout.write(f'\nDetected Model: {file_info.analysis.detected_model}')
                self.stdout.write(f'Confidence: {file_info.analysis.confidence:.0%}')
                self.stdout.write(f'Category: {file_info.analysis.file_category}')
                self.stdout.write(f'Reason: {file_info.analysis.reason}')

                if verbose and file_info.analysis.model_scores:
                    self.stdout.write('\n' + '-' * 40)
                    self.stdout.write('Top Model Scores:')
                    sorted_scores = sorted(
                        file_info.analysis.model_scores.items(),
                        key=lambda x: x[1],
                        reverse=True
                    )[:5]
                    for model, score in sorted_scores:
                        self.stdout.write(f'  {model}: {score:.3f}')

                if show_mapping:
                    self.stdout.write('\n' + '-' * 40)
                    self.stdout.write('Suggested Column Mappings:')
                    if file_info.analysis.matched_fields:
                        mapping_data = [
                            [h, f]
                            for h, f in file_info.analysis.matched_fields.items()
                        ]
                        self.stdout.write(simple_table(
                            ['Source Column', 'Target Field'],
                            mapping_data
                        ))

                        # Show unmatched columns
                        unmatched = [
                            h for h in file_info.headers
                            if h not in file_info.analysis.matched_fields
                        ]
                        if unmatched:
                            self.stdout.write(f'\nUnmatched columns: {", ".join(unmatched)}')
                    else:
                        self.stdout.write('  No column mappings detected')

        # Warnings and errors
        if analysis.warnings:
            self.stdout.write('\n' + '-' * 40)
            self.stdout.write(self.style.WARNING('Warnings:'))
            for warning in analysis.warnings:
                self.stdout.write(f'  ⚠ {warning}')

        if analysis.errors:
            self.stdout.write('\n' + '-' * 40)
            self.stdout.write(self.style.ERROR('Errors:'))
            for error in analysis.errors:
                self.stdout.write(f'  ✗ {error}')

        self.stdout.write('\n')
