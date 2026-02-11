#!/usr/bin/env python3
"""
Migration Safety Analyzer for NHIA HRMS.

Analyzes pending Django migrations and flags potentially dangerous operations
for an enterprise system with 1M+ records. Designed to run in CI and locally.

Usage:
    python scripts/migration/check-migration-safety.py
    python scripts/migration/check-migration-safety.py --strict  # Fail on warnings too
    python scripts/migration/check-migration-safety.py --app employees

Exit codes:
    0 = No issues found
    1 = Dangerous operations detected
    2 = Warnings only (fails in --strict mode)
"""

import ast
import os
import re
import sys
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

# ── Setup Django ─────────────────────────────────────────────────────────────

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent / "HRMS" / "backend"
sys.path.insert(0, str(BACKEND_DIR))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ.setdefault("DJANGO_ENV", "development")
os.environ.setdefault("SECRET_KEY", "migration-check-placeholder")

import django  # noqa: E402

django.setup()

from django.core.management import call_command  # noqa: E402
from django.db import connection  # noqa: E402
from django.db.migrations.loader import MigrationLoader  # noqa: E402
from django.db.migrations.operations import (  # noqa: E402
    AddField,
    AddIndex,
    AlterField,
    AlterModelTable,
    CreateModel,
    DeleteModel,
    RemoveField,
    RemoveIndex,
    RenameField,
    RenameModel,
    RunSQL,
)

# ── Configuration ────────────────────────────────────────────────────────────

# Tables known to have 100K+ rows in production
LARGE_TABLES = {
    "employees_employee": 100_000,
    "payroll_payrollrecord": 500_000,
    "payroll_payslip": 1_000_000,
    "payroll_payslipline": 5_000_000,
    "leave_leaverequest": 200_000,
    "leave_leavebalance": 100_000,
    "core_auditlog": 1_000_000,
    "imports_importrecord": 500_000,
    "accounts_user": 50_000,
}

# Threshold for flagging large table operations
ROW_THRESHOLD = 100_000


class Severity(Enum):
    DANGER = "DANGER"
    WARNING = "WARNING"
    INFO = "INFO"


@dataclass
class Finding:
    severity: Severity
    migration: str
    operation: str
    message: str
    recommendation: str


@dataclass
class AnalysisResult:
    findings: list = field(default_factory=list)

    @property
    def has_dangers(self):
        return any(f.severity == Severity.DANGER for f in self.findings)

    @property
    def has_warnings(self):
        return any(f.severity == Severity.WARNING for f in self.findings)


# ── Analysis Functions ───────────────────────────────────────────────────────


def get_table_name(app_label, model_name):
    """Convert app_label + model_name to database table name."""
    return f"{app_label}_{model_name.lower()}"


def estimate_table_size(table_name):
    """Estimate table size from known large tables or live database."""
    if table_name in LARGE_TABLES:
        return LARGE_TABLES[table_name]

    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT reltuples::bigint FROM pg_class WHERE relname = %s",
                [table_name],
            )
            row = cursor.fetchone()
            return int(row[0]) if row and row[0] > 0 else 0
    except Exception:
        return 0


def is_large_table(table_name):
    return estimate_table_size(table_name) >= ROW_THRESHOLD


def analyze_add_field(app_label, migration_name, op, model_state):
    """Analyze AddField operations for safety."""
    findings = []
    table_name = get_table_name(app_label, op.model_name)
    field = op.field

    # NOT NULL without default on large table
    if is_large_table(table_name) and not field.null and field.default is None:
        if not hasattr(field, "has_default") or not field.has_default():
            findings.append(
                Finding(
                    severity=Severity.DANGER,
                    migration=migration_name,
                    operation=f"AddField({op.model_name}.{op.name})",
                    message=(
                        f"Adding NOT NULL column without default to large table "
                        f"'{table_name}' (~{estimate_table_size(table_name):,} rows). "
                        f"This requires a full table rewrite and will lock the table."
                    ),
                    recommendation=(
                        "Split into 3 migrations:\n"
                        "  1. AddField with null=True, default=None\n"
                        "  2. RunPython to backfill data in batches\n"
                        "  3. AlterField to set null=False with default"
                    ),
                )
            )

    # Any field addition on very large tables (>500K)
    size = estimate_table_size(table_name)
    if size >= 500_000:
        findings.append(
            Finding(
                severity=Severity.WARNING,
                migration=migration_name,
                operation=f"AddField({op.model_name}.{op.name})",
                message=(
                    f"Adding column to very large table '{table_name}' "
                    f"(~{size:,} rows). May cause brief lock."
                ),
                recommendation=(
                    "In PostgreSQL, adding a nullable column with no default is "
                    "instant. Adding with a default or NOT NULL requires a rewrite. "
                    "Ensure this column is nullable with no server-default."
                ),
            )
        )

    return findings


def analyze_alter_field(app_label, migration_name, op):
    """Analyze AlterField operations for safety."""
    findings = []
    table_name = get_table_name(app_label, op.model_name)

    if is_large_table(table_name):
        findings.append(
            Finding(
                severity=Severity.WARNING,
                migration=migration_name,
                operation=f"AlterField({op.model_name}.{op.name})",
                message=(
                    f"Altering column on large table '{table_name}' "
                    f"(~{estimate_table_size(table_name):,} rows). "
                    f"Some alterations (type change, adding NOT NULL) may lock the table."
                ),
                recommendation=(
                    "Safe alterations: changing help_text, verbose_name, validators.\n"
                    "Unsafe alterations: changing type, adding NOT NULL, changing max_length.\n"
                    "For unsafe changes, use SeparateDatabaseAndState."
                ),
            )
        )

    return findings


def analyze_remove_field(app_label, migration_name, op):
    """Analyze RemoveField operations for safety."""
    findings = []
    table_name = get_table_name(app_label, op.model_name)

    findings.append(
        Finding(
            severity=Severity.DANGER,
            migration=migration_name,
            operation=f"RemoveField({op.model_name}.{op.name})",
            message=(
                f"Removing column '{op.name}' from '{table_name}'. "
                f"This is irreversible data loss."
            ),
            recommendation=(
                "Deploy in phases:\n"
                "  1. Deploy code that no longer reads/writes the column\n"
                "  2. Wait for all old code revisions to drain\n"
                "  3. Then apply the column removal migration\n"
                "  4. Consider keeping a backup of the data first"
            ),
        )
    )

    return findings


def analyze_rename_field(app_label, migration_name, op):
    """Analyze RenameField operations for safety."""
    table_name = get_table_name(app_label, op.model_name)
    return [
        Finding(
            severity=Severity.DANGER,
            migration=migration_name,
            operation=f"RenameField({op.model_name}.{op.old_name} -> {op.new_name})",
            message=(
                f"Renaming column on '{table_name}'. Running code referencing the "
                f"old name will break during deployment."
            ),
            recommendation=(
                "Use SeparateDatabaseAndState for zero-downtime renames:\n"
                "  1. Add new column (AddField)\n"
                "  2. Deploy code that writes to both old and new columns\n"
                "  3. Backfill new column from old column\n"
                "  4. Deploy code that only reads from new column\n"
                "  5. Remove old column"
            ),
        )
    ]


def analyze_delete_model(app_label, migration_name, op):
    """Analyze DeleteModel operations for safety."""
    return [
        Finding(
            severity=Severity.DANGER,
            migration=migration_name,
            operation=f"DeleteModel({op.name})",
            message=f"Dropping table for model '{op.name}'. All data will be lost.",
            recommendation=(
                "Ensure:\n"
                "  1. All data has been migrated or is no longer needed\n"
                "  2. No other code references this table\n"
                "  3. A database backup exists before running this migration"
            ),
        )
    ]


def analyze_rename_model(app_label, migration_name, op):
    """Analyze RenameModel operations for safety."""
    return [
        Finding(
            severity=Severity.DANGER,
            migration=migration_name,
            operation=f"RenameModel({op.old_name} -> {op.new_name})",
            message=(
                f"Renaming model/table from '{op.old_name}' to '{op.new_name}'. "
                f"This renames the table and all foreign key references."
            ),
            recommendation=(
                "Use SeparateDatabaseAndState. Create the new table, migrate data, "
                "update foreign keys, then drop the old table — all in separate steps."
            ),
        )
    ]


def analyze_add_index(app_label, migration_name, op):
    """Analyze AddIndex operations for safety."""
    findings = []
    table_name = get_table_name(app_label, op.model_name)

    if is_large_table(table_name):
        findings.append(
            Finding(
                severity=Severity.WARNING,
                migration=migration_name,
                operation=f"AddIndex({op.model_name}, {op.index.name})",
                message=(
                    f"Adding index to large table '{table_name}' "
                    f"(~{estimate_table_size(table_name):,} rows). "
                    f"Standard CREATE INDEX locks the table for writes."
                ),
                recommendation=(
                    "Use RunSQL with CREATE INDEX CONCURRENTLY instead:\n\n"
                    "  migrations.SeparateDatabaseAndState(\n"
                    "      state_operations=[migrations.AddIndex(...)],\n"
                    "      database_operations=[\n"
                    "          migrations.RunSQL(\n"
                    "              'CREATE INDEX CONCURRENTLY ...',\n"
                    "              'DROP INDEX CONCURRENTLY ...',\n"
                    "          )\n"
                    "      ],\n"
                    "  )\n\n"
                    "Also set: Migration.atomic = False (required for CONCURRENTLY)"
                ),
            )
        )

    return findings


def analyze_run_sql(app_label, migration_name, op):
    """Analyze RunSQL for dangerous patterns."""
    findings = []
    sql = op.sql if isinstance(op.sql, str) else " ".join(str(s) for s in op.sql)
    sql_upper = sql.upper()

    # Check for non-concurrent index creation on large tables
    if "CREATE INDEX" in sql_upper and "CONCURRENTLY" not in sql_upper:
        # Try to extract table name
        match = re.search(r"ON\s+(\w+)", sql, re.IGNORECASE)
        if match:
            table = match.group(1)
            if is_large_table(table):
                findings.append(
                    Finding(
                        severity=Severity.DANGER,
                        migration=migration_name,
                        operation="RunSQL(CREATE INDEX)",
                        message=(
                            f"CREATE INDEX without CONCURRENTLY on large table '{table}'. "
                            f"This will lock the table for writes."
                        ),
                        recommendation=(
                            "Use CREATE INDEX CONCURRENTLY and set Migration.atomic = False."
                        ),
                    )
                )

    # Check for DROP TABLE / TRUNCATE
    if "DROP TABLE" in sql_upper or "TRUNCATE" in sql_upper:
        findings.append(
            Finding(
                severity=Severity.DANGER,
                migration=migration_name,
                operation="RunSQL(DROP/TRUNCATE)",
                message="Raw SQL contains DROP TABLE or TRUNCATE — data will be lost.",
                recommendation="Ensure this is intentional and backups exist.",
            )
        )

    # Check for ALTER TABLE on large tables
    if "ALTER TABLE" in sql_upper:
        match = re.search(r"ALTER\s+TABLE\s+(\w+)", sql, re.IGNORECASE)
        if match and is_large_table(match.group(1)):
            findings.append(
                Finding(
                    severity=Severity.WARNING,
                    migration=migration_name,
                    operation="RunSQL(ALTER TABLE)",
                    message=(
                        f"ALTER TABLE on large table '{match.group(1)}'. "
                        f"Review for potential table locks."
                    ),
                    recommendation="Verify this ALTER is lock-safe (e.g., ADD COLUMN with NULL).",
                )
            )

    return findings


# ── Main Analyzer ────────────────────────────────────────────────────────────


def get_pending_migrations():
    """Return list of (app_label, migration_name) for unapplied migrations."""
    loader = MigrationLoader(connection)
    applied = set(loader.applied_migrations)
    pending = []

    for key, migration in loader.disk_migrations.items():
        if key not in applied:
            pending.append((key[0], key[1], migration))

    return pending


def analyze_migration(app_label, migration_name, migration):
    """Analyze a single migration for safety issues."""
    findings = []

    for op in migration.operations:
        if isinstance(op, AddField):
            findings.extend(
                analyze_add_field(app_label, migration_name, op, None)
            )
        elif isinstance(op, AlterField):
            findings.extend(analyze_alter_field(app_label, migration_name, op))
        elif isinstance(op, RemoveField):
            findings.extend(analyze_remove_field(app_label, migration_name, op))
        elif isinstance(op, RenameField):
            findings.extend(analyze_rename_field(app_label, migration_name, op))
        elif isinstance(op, DeleteModel):
            findings.extend(analyze_delete_model(app_label, migration_name, op))
        elif isinstance(op, RenameModel):
            findings.extend(analyze_rename_model(app_label, migration_name, op))
        elif isinstance(op, AddIndex):
            findings.extend(analyze_add_index(app_label, migration_name, op))
        elif isinstance(op, RunSQL):
            findings.extend(analyze_run_sql(app_label, migration_name, op))

    return findings


def print_findings(result: AnalysisResult):
    """Pretty-print analysis findings."""
    if not result.findings:
        print("\n\033[32m✓ No migration safety issues found.\033[0m\n")
        return

    # Group by severity
    for severity in [Severity.DANGER, Severity.WARNING, Severity.INFO]:
        items = [f for f in result.findings if f.severity == severity]
        if not items:
            continue

        colors = {
            Severity.DANGER: "\033[31m",  # Red
            Severity.WARNING: "\033[33m",  # Yellow
            Severity.INFO: "\033[36m",  # Cyan
        }
        color = colors[severity]
        reset = "\033[0m"

        print(f"\n{color}{'═' * 70}")
        print(f"  {severity.value} ({len(items)} issue{'s' if len(items) > 1 else ''})")
        print(f"{'═' * 70}{reset}\n")

        for i, finding in enumerate(items, 1):
            print(f"  {color}{i}. [{finding.migration}]{reset}")
            print(f"     Operation: {finding.operation}")
            print(f"     Issue:     {finding.message}")
            print(f"     Fix:       {finding.recommendation}")
            print()


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Analyze Django migrations for safety")
    parser.add_argument("--strict", action="store_true", help="Fail on warnings too")
    parser.add_argument("--app", help="Only check migrations for this app")
    parser.add_argument("--ci", action="store_true", help="Output in CI-friendly format")
    args = parser.parse_args()

    print("=" * 70)
    print("  NHIA HRMS — Migration Safety Analyzer")
    print("=" * 70)

    pending = get_pending_migrations()

    if args.app:
        pending = [(a, n, m) for a, n, m in pending if a == args.app]

    if not pending:
        print("\n\033[32m✓ No pending migrations to analyze.\033[0m\n")
        sys.exit(0)

    print(f"\nFound {len(pending)} pending migration(s):")
    for app_label, name, _ in pending:
        print(f"  - {app_label}.{name}")

    result = AnalysisResult()
    for app_label, name, migration in pending:
        result.findings.extend(analyze_migration(app_label, name, migration))

    print_findings(result)

    # CI output (GitHub Actions annotations)
    if args.ci:
        for f in result.findings:
            level = "error" if f.severity == Severity.DANGER else "warning"
            print(f"::{level}::{f.migration}: {f.message}")

    # Summary
    dangers = sum(1 for f in result.findings if f.severity == Severity.DANGER)
    warnings = sum(1 for f in result.findings if f.severity == Severity.WARNING)
    print(f"\nSummary: {dangers} danger(s), {warnings} warning(s)")

    if result.has_dangers:
        print("\n\033[31mFAILED: Dangerous migration operations detected.\033[0m")
        print("Fix the issues above or add them to the safety allowlist.\n")
        sys.exit(1)
    elif result.has_warnings and args.strict:
        print("\n\033[33mFAILED (strict mode): Warnings detected.\033[0m\n")
        sys.exit(2)
    else:
        print("\n\033[32mPASSED\033[0m\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
