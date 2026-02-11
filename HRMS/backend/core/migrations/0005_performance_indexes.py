"""
Performance indexes for 1M+ record optimization.
All indexes use RunSQL to correctly reference cross-app tables.
"""

from django.db import migrations


class Migration(migrations.Migration):

    atomic = False  # Required for CREATE INDEX CONCURRENTLY

    dependencies = [
        ('core', '0004_remove_payroll_audit_bloat'),
        ('employees', '0001_initial'),
        ('payroll', '0001_initial'),
        ('leave', '0001_initial'),
        ('recruitment', '0001_initial'),
        ('performance', '0001_initial'),
    ]

    operations = [
        # ── Employee composite indexes ──
        # Table: employees (custom db_table)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS emp_dept_status_idx ON employees (department_id, status);",
            reverse_sql="DROP INDEX IF EXISTS emp_dept_status_idx;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS emp_grade_status_idx ON employees (grade_id, status);",
            reverse_sql="DROP INDEX IF EXISTS emp_grade_status_idx;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS emp_supervisor_status_idx ON employees (supervisor_id, status);",
            reverse_sql="DROP INDEX IF EXISTS emp_supervisor_status_idx;",
        ),
        # Employee single-field indexes
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS emp_employment_type_idx ON employees (employment_type);",
            reverse_sql="DROP INDEX IF EXISTS emp_employment_type_idx;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS emp_work_email_idx ON employees (work_email);",
            reverse_sql="DROP INDEX IF EXISTS emp_work_email_idx;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS emp_assignment_status_idx ON employees (assignment_status);",
            reverse_sql="DROP INDEX IF EXISTS emp_assignment_status_idx;",
        ),

        # ── Payroll composite indexes ──
        # Table: payroll_runs (custom db_table)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS run_period_status_idx ON payroll_runs (payroll_period_id, status);",
            reverse_sql="DROP INDEX IF EXISTS run_period_status_idx;",
        ),
        # Table: payroll_items (custom db_table)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS item_emp_run_idx ON payroll_items (employee_id, payroll_run_id);",
            reverse_sql="DROP INDEX IF EXISTS item_emp_run_idx;",
        ),
        # Table: employee_salaries (custom db_table)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS salary_emp_current_idx ON employee_salaries (employee_id, is_current, effective_from);",
            reverse_sql="DROP INDEX IF EXISTS salary_emp_current_idx;",
        ),
        # Table: adhoc_payments (custom db_table)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS adhoc_emp_status_idx ON adhoc_payments (employee_id, status);",
            reverse_sql="DROP INDEX IF EXISTS adhoc_emp_status_idx;",
        ),
        # Table: payroll_calendar (custom db_table)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS cal_year_month_active_idx ON payroll_calendar (year, month, is_active);",
            reverse_sql="DROP INDEX IF EXISTS cal_year_month_active_idx;",
        ),

        # ── Leave composite indexes ──
        # Table: leave_requests (custom db_table)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS lreq_emp_status_idx ON leave_requests (employee_id, status);",
            reverse_sql="DROP INDEX IF EXISTS lreq_emp_status_idx;",
        ),
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS lreq_dates_status_idx ON leave_requests (start_date, end_date, status);",
            reverse_sql="DROP INDEX IF EXISTS lreq_dates_status_idx;",
        ),
        # Table: leave_balances (custom db_table)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS lbal_emp_year_idx ON leave_balances (employee_id, year);",
            reverse_sql="DROP INDEX IF EXISTS lbal_emp_year_idx;",
        ),

        # ── Recruitment composite indexes ──
        # Table: recruitment_vacancy (Django default)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS vacancy_status_created_idx ON recruitment_vacancy (status, created_at DESC);",
            reverse_sql="DROP INDEX IF EXISTS vacancy_status_created_idx;",
        ),
        # Table: recruitment_applicant (Django default)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS applicant_vac_status_idx ON recruitment_applicant (vacancy_id, status);",
            reverse_sql="DROP INDEX IF EXISTS applicant_vac_status_idx;",
        ),

        # ── Performance composite indexes ──
        # Table: performance_appraisal (Django default)
        migrations.RunSQL(
            sql="CREATE INDEX CONCURRENTLY IF NOT EXISTS appraisal_emp_cycle_idx ON performance_appraisal (employee_id, appraisal_cycle_id);",
            reverse_sql="DROP INDEX IF EXISTS appraisal_emp_cycle_idx;",
        ),

        # ── Partial indexes (PostgreSQL only) ──
        migrations.RunSQL(
            sql="""CREATE INDEX CONCURRENTLY IF NOT EXISTS emp_active_status_idx
                   ON employees (status, department_id)
                   WHERE is_deleted = false;""",
            reverse_sql="DROP INDEX IF EXISTS emp_active_status_idx;",
        ),
        migrations.RunSQL(
            sql="""CREATE INDEX CONCURRENTLY IF NOT EXISTS lreq_active_idx
                   ON leave_requests (employee_id, start_date, end_date)
                   WHERE status = 'APPROVED' AND is_deleted = false;""",
            reverse_sql="DROP INDEX IF EXISTS lreq_active_idx;",
        ),
        migrations.RunSQL(
            sql="""CREATE INDEX CONCURRENTLY IF NOT EXISTS salary_current_idx
                   ON employee_salaries (employee_id)
                   WHERE is_current = true AND is_deleted = false;""",
            reverse_sql="DROP INDEX IF EXISTS salary_current_idx;",
        ),

        # ── GIN indexes for queried JSONFields ──
        migrations.RunSQL(
            sql="""CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_changes_gin
                   ON audit_logs USING GIN (changes);""",
            reverse_sql="DROP INDEX IF EXISTS audit_changes_gin;",
        ),
        migrations.RunSQL(
            sql="""CREATE INDEX CONCURRENTLY IF NOT EXISTS dur_old_values_gin
                   ON employee_data_update_requests USING GIN (old_values);""",
            reverse_sql="DROP INDEX IF EXISTS dur_old_values_gin;",
        ),
        migrations.RunSQL(
            sql="""CREATE INDEX CONCURRENTLY IF NOT EXISTS dur_new_values_gin
                   ON employee_data_update_requests USING GIN (new_values);""",
            reverse_sql="DROP INDEX IF EXISTS dur_new_values_gin;",
        ),
    ]
