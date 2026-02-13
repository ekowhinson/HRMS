"""
Database query benchmark command for HRMS.

Profiles common queries against each major model, reports timing,
row counts, and flags slow queries. Useful for identifying performance
regressions after migrations or index changes.

Usage:
    python manage.py benchmark_queries
    python manage.py benchmark_queries --model employees.Employee
    python manage.py benchmark_queries --threshold 50
    python manage.py benchmark_queries --explain
"""

import time

from django.core.management.base import BaseCommand
from django.db import connection


class Command(BaseCommand):
    help = "Benchmark common database queries and report timing"

    # Models and their typical query patterns
    BENCHMARKS = [
        {
            'label': 'employees.Employee — full list',
            'sql': 'SELECT COUNT(*) FROM employees_employee',
        },
        {
            'label': 'employees.Employee — active only',
            'sql': "SELECT COUNT(*) FROM employees_employee WHERE employment_status = 'ACTIVE'",
        },
        {
            'label': 'employees.Employee — by department',
            'sql': (
                'SELECT d.name, COUNT(*) '
                'FROM employees_employee e '
                'JOIN organization_department d ON e.department_id = d.id '
                "WHERE e.employment_status = 'ACTIVE' "
                'GROUP BY d.name '
                'ORDER BY COUNT(*) DESC '
                'LIMIT 20'
            ),
        },
        {
            'label': 'employees.Employee — search by name',
            'sql': (
                "SELECT id, first_name, last_name, employee_number "
                "FROM employees_employee "
                "WHERE UPPER(first_name) LIKE UPPER('%%john%%') "
                "OR UPPER(last_name) LIKE UPPER('%%john%%') "
                "LIMIT 25"
            ),
        },
        {
            'label': 'payroll.Payslip — latest period',
            'sql': (
                'SELECT COUNT(*) FROM payroll_payslip ps '
                'JOIN payroll_payperiod pp ON ps.pay_period_id = pp.id '
                'ORDER BY pp.start_date DESC LIMIT 1'
            ),
        },
        {
            'label': 'payroll.PayslipLine — aggregation',
            'sql': (
                'SELECT COUNT(*) FROM payroll_payslipline'
            ),
        },
        {
            'label': 'leave.LeaveRequest — pending approvals',
            'sql': (
                "SELECT COUNT(*) FROM leave_leaverequest WHERE status = 'PENDING'"
            ),
        },
        {
            'label': 'core.AuditLog — recent entries',
            'sql': (
                'SELECT COUNT(*) FROM core_auditlog '
                "WHERE created_at > NOW() - INTERVAL '24 hours'"
            ),
        },
        {
            'label': 'pg_stat_user_tables — table sizes',
            'sql': (
                'SELECT relname, n_live_tup '
                'FROM pg_stat_user_tables '
                'ORDER BY n_live_tup DESC '
                'LIMIT 15'
            ),
        },
        {
            'label': 'pg_stat_user_indexes — unused indexes',
            'sql': (
                'SELECT schemaname, relname, indexrelname, idx_scan '
                'FROM pg_stat_user_indexes '
                'WHERE idx_scan = 0 '
                'AND indexrelname NOT LIKE %%_pkey '
                'ORDER BY relname '
                'LIMIT 20'
            ),
        },
    ]

    def add_arguments(self, parser):
        parser.add_argument(
            '--model',
            type=str,
            help='Run benchmarks only for a specific model (e.g., employees.Employee)',
        )
        parser.add_argument(
            '--threshold',
            type=int,
            default=100,
            help='Flag queries slower than this (ms). Default: 100',
        )
        parser.add_argument(
            '--explain',
            action='store_true',
            help='Run EXPLAIN ANALYZE on each query (WARNING: may be slow)',
        )
        parser.add_argument(
            '--custom-sql',
            type=str,
            help='Benchmark a custom SQL query',
        )

    def handle(self, *args, **options):
        threshold = options['threshold']
        explain = options['explain']
        model_filter = options['model']
        custom_sql = options['custom_sql']

        # Check if we're using PostgreSQL
        engine = connection.settings_dict.get('ENGINE', '')
        if 'postgresql' not in engine:
            self.stderr.write(self.style.WARNING(
                f"Connected to {engine}. Some benchmarks require PostgreSQL."
            ))

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO(
            '=' * 70
        ))
        self.stdout.write(self.style.HTTP_INFO(
            '  HRMS — Database Query Benchmark'
        ))
        self.stdout.write(self.style.HTTP_INFO(
            '=' * 70
        ))
        self.stdout.write(f'  Threshold: {threshold}ms')
        self.stdout.write(f'  EXPLAIN:   {"yes" if explain else "no"}')
        self.stdout.write('')

        benchmarks = self.BENCHMARKS[:]

        if custom_sql:
            benchmarks = [{'label': 'Custom query', 'sql': custom_sql}]
        elif model_filter:
            model_filter_lower = model_filter.lower()
            benchmarks = [
                b for b in benchmarks
                if model_filter_lower in b['label'].lower()
            ]
            if not benchmarks:
                self.stderr.write(f"No benchmarks match '{model_filter}'.")
                return

        results = []
        total_time = 0

        for bench in benchmarks:
            label = bench['label']
            sql = bench['sql']

            try:
                start = time.monotonic()
                with connection.cursor() as cursor:
                    cursor.execute(sql)
                    rows = cursor.fetchall()
                elapsed_ms = round((time.monotonic() - start) * 1000, 2)
                total_time += elapsed_ms

                row_count = len(rows)
                # For COUNT(*) queries, show the count value
                display_count = rows[0][0] if row_count == 1 and len(rows[0]) == 1 else row_count

                is_slow = elapsed_ms >= threshold
                style = self.style.ERROR if is_slow else self.style.SUCCESS

                self.stdout.write(
                    f'  {style("SLOW" if is_slow else " OK ")} '
                    f'{elapsed_ms:>8.1f}ms  '
                    f'{str(display_count):>10s} rows  '
                    f'{label}'
                )

                results.append({
                    'label': label,
                    'elapsed_ms': elapsed_ms,
                    'rows': display_count,
                    'slow': is_slow,
                })

                if explain and 'postgresql' in engine:
                    self._run_explain(sql, label)

            except Exception as e:
                self.stdout.write(
                    f'  {self.style.WARNING("SKIP")} '
                    f'{"N/A":>8s}      '
                    f'{"":>10s}       '
                    f'{label}: {e}'
                )
                results.append({
                    'label': label,
                    'elapsed_ms': 0,
                    'rows': 0,
                    'slow': False,
                    'error': str(e),
                })

        # Summary
        slow_count = sum(1 for r in results if r.get('slow'))
        error_count = sum(1 for r in results if 'error' in r)

        self.stdout.write('')
        self.stdout.write(self.style.HTTP_INFO('-' * 70))
        self.stdout.write(f'  Total:     {total_time:.1f}ms across {len(results)} queries')
        self.stdout.write(f'  Slow:      {slow_count} queries >= {threshold}ms')
        if error_count:
            self.stdout.write(f'  Errors:    {error_count} queries failed')
        self.stdout.write('')

        if slow_count > 0:
            self.stdout.write(self.style.WARNING(
                f'  {slow_count} slow queries detected. '
                f'Run with --explain for query plans.'
            ))
            self.stdout.write('')

    def _run_explain(self, sql, label):
        """Run EXPLAIN ANALYZE and print the plan."""
        try:
            with connection.cursor() as cursor:
                cursor.execute(f'EXPLAIN ANALYZE {sql}')
                plan = cursor.fetchall()

            self.stdout.write(self.style.MIGRATE_LABEL(f'\n  EXPLAIN: {label}'))
            for row in plan:
                self.stdout.write(f'    {row[0]}')
            self.stdout.write('')
        except Exception as e:
            self.stdout.write(f'    EXPLAIN failed: {e}')
