# NHIA HRMS — Deployment & Database Operations Guide

## Table of Contents

- [Migration Safety](#migration-safety)
- [Migration Execution](#migration-execution)
- [Rollback Procedures](#rollback-procedures)
- [Large Table Operations Playbook](#large-table-operations-playbook)
- [Data Backfill Framework](#data-backfill-framework)
- [Seed Data](#seed-data)

---

## Migration Safety

### Automated Safety Check

Every migration is analyzed before execution by `scripts/migration/check-migration-safety.py`.

```bash
# Run locally
python scripts/migration/check-migration-safety.py

# Strict mode (fail on warnings too)
python scripts/migration/check-migration-safety.py --strict

# Single app
python scripts/migration/check-migration-safety.py --app employees
```

The analyzer flags:

| Operation | Severity | Why It's Dangerous |
|-----------|----------|-------------------|
| `AddField` NOT NULL without default on large table | DANGER | Full table rewrite, locks table |
| `RemoveField` | DANGER | Irreversible data loss |
| `RenameField` | DANGER | Breaks running code during deploy |
| `DeleteModel` | DANGER | Drops entire table |
| `RenameModel` | DANGER | Renames table + all FK references |
| `AddIndex` on large table | WARNING | Standard CREATE INDEX locks writes |
| `AlterField` on large table | WARNING | May lock depending on alteration type |
| `RunSQL` with non-concurrent CREATE INDEX | DANGER | Table lock on large tables |
| `RunSQL` with DROP TABLE/TRUNCATE | DANGER | Data loss |

### CI Integration

The migration safety check runs automatically in the CI pipeline during `backend-test`. It also runs as the first step in `scripts/migration/run-migrations.sh`.

---

## Migration Execution

### Running Migrations

```bash
# Standard execution (CI/CD — auto mode)
./scripts/migration/run-migrations.sh

# Interactive mode (manual confirmation)
./scripts/migration/run-migrations.sh --interactive

# Dry run (plan only)
./scripts/migration/run-migrations.sh --dry-run

# Single app
./scripts/migration/run-migrations.sh --app employees

# With Cloud SQL Auth Proxy
./scripts/migration/run-migrations.sh --proxy
```

The script automatically:
1. Runs migration safety analysis
2. Shows the migration plan
3. Sets `statement_timeout=30s` and `lock_timeout=10s`
4. Applies migrations with verbose output
5. Verifies clean state afterward
6. Runs Django system checks

### Safety Timeouts

- **`statement_timeout=30s`**: Any single DDL statement taking >30s is killed. This prevents migrations from holding table locks for extended periods.
- **`lock_timeout=10s`**: If a migration can't acquire a lock within 10s, it fails fast instead of waiting indefinitely.

Adjust with `--timeout` if you have a known long migration.

---

## Rollback Procedures

### Decision Tree

```
Issue detected after deploy
│
├─ Application errors only (DB is fine)?
│  └─ Rollback APPLICATION only
│     → Use rollback.yml workflow or gcloud CLI
│     → Previous Cloud Run revision still works with current DB
│
├─ Migration caused data corruption?
│  ├─ Migration is reversible?
│  │  └─ Reverse the MIGRATION
│  │     → python manage.py migrate <app> <previous_migration>
│  │     → Then rollback application
│  │
│  └─ Migration is NOT reversible (data deleted, columns dropped)?
│     └─ POINT-IN-TIME RECOVERY
│        → Restore Cloud SQL to timestamp before migration
│        → Rollback application to matching version
│
└─ Total system failure?
   └─ RESTORE FROM BACKUP
      → Restore full Cloud SQL backup
      → Rollback application to matching version
      → Replay any lost transactions if possible
```

### Option 1: Application Rollback Only

When the database is fine but the application has issues.

```bash
# Via GitHub Actions (recommended)
gh workflow run rollback.yml \
  -f environment=production \
  -f revision=previous \
  -f reason="Error spike in new deployment"

# Via gcloud CLI (emergency)
# Get previous revision
gcloud run revisions list \
  --service=nhia-hrms-production-api \
  --region=us-central1 \
  --sort-by="~metadata.creationTimestamp" \
  --limit=3

# Shift traffic
gcloud run services update-traffic nhia-hrms-production-api \
  --region=us-central1 \
  --to-revisions=REVISION_NAME=100
```

### Option 2: Reverse a Migration

When a specific migration caused issues and is reversible.

```bash
# See current migration state
python manage.py showmigrations <app_name>

# Reverse to a specific migration
python manage.py migrate <app_name> <migration_before_problematic_one>

# Example: reverse employees app to migration 0015
python manage.py migrate employees 0015

# Then rollback the application
```

**Important**: Not all migrations are reversible. Check if the migration has `reverse_code` or if `RunSQL` has a `reverse_sql`.

### Option 3: Point-in-Time Recovery (PITR)

When data corruption occurred and the migration is not reversible.

```bash
# 1. Find the exact timestamp before the problematic migration ran
#    (check CI/CD logs for migration start time)

# 2. Create a PITR clone of the database
gcloud sql instances clone nhia-hrms-production-pg-XXXX \
  nhia-hrms-production-pg-recovery \
  --point-in-time="2024-01-15T14:30:00Z"

# 3. Verify data in the clone
#    Connect to the clone and verify the data is correct

# 4. If verified, promote the clone:
#    a. Update application to point to the clone
#    b. Or export/import specific tables from the clone

# 5. Rollback application to the matching version
```

### Option 4: Full Backup Restore

Last resort when PITR is not available or the issue predates PITR window.

```bash
# 1. List available backups
gcloud sql backups list \
  --instance=nhia-hrms-production-pg-XXXX \
  --sort-by="~startTime"

# 2. Restore from a specific backup
gcloud sql backups restore BACKUP_ID \
  --restore-instance=nhia-hrms-production-pg-XXXX \
  --backup-instance=nhia-hrms-production-pg-XXXX

# WARNING: This replaces ALL data with the backup.
# Any transactions after the backup will be lost.

# 3. Rollback application to match the backup point
```

### Post-Rollback Checklist

- [ ] Verify application health checks pass
- [ ] Verify database connectivity
- [ ] Check for data consistency (run reconciliation reports)
- [ ] Notify stakeholders
- [ ] Create incident report
- [ ] Fix the root cause before re-deploying

---

## Large Table Operations Playbook

### Table Size Reference

| Table | Expected Rows | Operations to Watch |
|-------|--------------|-------------------|
| `payroll_payslipline` | 5M+ | Index, column add/alter |
| `payroll_payslip` | 1M+ | Index, column add/alter |
| `core_auditlog` | 1M+ | Index, archival |
| `imports_importrecord` | 500K+ | Index, cleanup |
| `payroll_payrollrecord` | 500K+ | Index, column add |
| `leave_leaverequest` | 200K+ | Index |
| `employees_employee` | 100K+ | Column add/alter |

### Pattern 1: Adding Indexes to Large Tables

**Never use** Django's `AddIndex` on tables with 100K+ rows. It uses `CREATE INDEX` which locks the table.

```python
# migrations/0025_add_payslip_index.py
from django.db import migrations


class Migration(migrations.Migration):
    # REQUIRED: CREATE INDEX CONCURRENTLY cannot run inside a transaction
    atomic = False

    dependencies = [
        ('payroll', '0024_previous'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddIndex(
                    model_name='payslip',
                    index=migrations.models.Index(
                        fields=['employee', 'pay_period'],
                        name='idx_payslip_emp_period',
                    ),
                ),
            ],
            database_operations=[
                migrations.RunSQL(
                    sql='CREATE INDEX CONCURRENTLY IF NOT EXISTS '
                        'idx_payslip_emp_period ON payroll_payslip '
                        '(employee_id, pay_period_id);',
                    reverse_sql='DROP INDEX CONCURRENTLY IF EXISTS '
                                'idx_payslip_emp_period;',
                ),
            ],
        ),
    ]
```

**Key points:**
- `atomic = False` is **required** for `CONCURRENTLY`
- `IF NOT EXISTS` / `IF EXISTS` makes it idempotent
- `SeparateDatabaseAndState` keeps Django's state in sync

### Pattern 2: Adding Columns to Large Tables

**Safe (instant in PostgreSQL):**
```python
# Adding a nullable column with no default — instant, no lock
migrations.AddField(
    model_name='employee',
    name='new_field',
    field=models.CharField(max_length=100, null=True, blank=True),
)
```

**Unsafe (requires table rewrite):**
```python
# Adding NOT NULL column with default — rewrites entire table
migrations.AddField(
    model_name='employee',
    name='status',
    field=models.CharField(max_length=20, default='ACTIVE'),
)
```

**Safe alternative for NOT NULL columns (3-step migration):**

```python
# Migration 1: Add nullable column
migrations.AddField(
    model_name='employee',
    name='status',
    field=models.CharField(max_length=20, null=True),
)

# Migration 2: Backfill in batches (separate migration file)
def backfill_status(apps, schema_editor):
    Employee = apps.get_model('employees', 'Employee')
    batch_size = 1000
    while True:
        batch = list(
            Employee.objects.filter(status__isnull=True)
            .values_list('pk', flat=True)[:batch_size]
        )
        if not batch:
            break
        Employee.objects.filter(pk__in=batch).update(status='ACTIVE')

migrations.RunPython(backfill_status, migrations.RunPython.noop)

# Migration 3: Add NOT NULL constraint
migrations.AlterField(
    model_name='employee',
    name='status',
    field=models.CharField(max_length=20, default='ACTIVE'),
)
```

Or use the backfill management command:
```bash
python manage.py backfill_data \
  --model employees.Employee \
  --field status \
  --value ACTIVE \
  --filter "status__isnull=True" \
  --batch-size 1000
```

### Pattern 3: Backfilling Data in Large Tables

**Never do this:**
```python
# BAD: Updates all rows in a single transaction — locks table
Employee.objects.all().update(status='ACTIVE')
```

**Do this instead:**
```python
# GOOD: Batch update with throttling
def backfill_in_batches(apps, schema_editor):
    import time
    Employee = apps.get_model('employees', 'Employee')
    batch_size = 1000
    last_pk = 0

    while True:
        batch = list(
            Employee.objects.filter(pk__gt=last_pk, status__isnull=True)
            .order_by('pk')
            .values_list('pk', flat=True)[:batch_size]
        )
        if not batch:
            break

        Employee.objects.filter(pk__in=batch).update(status='ACTIVE')
        last_pk = batch[-1]
        time.sleep(0.1)  # Let other queries breathe
```

Or use the management command:
```bash
python manage.py backfill_data \
  --model employees.Employee \
  --field status \
  --value ACTIVE \
  --filter "status__isnull=True" \
  --batch-size 1000 \
  --sleep 0.1 \
  --resume  # Resume from last checkpoint if interrupted
```

### Pattern 4: Renaming Columns (Zero Downtime)

**Never use `RenameField` directly** on production tables. Instead:

```python
# Step 1: Add new column
migrations.AddField('employee', 'full_name', CharField(null=True))

# Step 2: Deploy code that writes to BOTH old and new columns
# In model save(): self.full_name = self.name

# Step 3: Backfill new column
# python manage.py backfill_data --model employees.Employee ...

# Step 4: Deploy code that reads from new column only

# Step 5: Remove old column (after all old revisions have drained)
migrations.RemoveField('employee', 'name')
```

### Pattern 5: Table Partitioning (Time-Series Data)

For tables like `core_auditlog` and `payroll_payslipline` that grow unbounded:

```sql
-- Convert audit_log to range partitioning by month
-- Run OUTSIDE Django migrations (manual operation)

-- 1. Create partitioned table
CREATE TABLE core_auditlog_partitioned (
    LIKE core_auditlog INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- 2. Create partitions
CREATE TABLE core_auditlog_y2024m01 PARTITION OF core_auditlog_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
-- ... repeat for each month

-- 3. Copy data in batches
INSERT INTO core_auditlog_partitioned
SELECT * FROM core_auditlog
WHERE created_at >= '2024-01-01' AND created_at < '2024-02-01';

-- 4. Rename tables (brief lock)
BEGIN;
ALTER TABLE core_auditlog RENAME TO core_auditlog_old;
ALTER TABLE core_auditlog_partitioned RENAME TO core_auditlog;
COMMIT;

-- 5. Create future partitions automatically (pg_partman or cron)
```

**When to partition:**
- Table exceeds 10M rows
- Queries almost always filter by date range
- Old data can be archived/dropped by partition
- Benefits: faster queries, instant partition drops vs DELETE

---

## Data Backfill Framework

### Management Command

```bash
# List available backfills
python manage.py backfill_data --list

# Run a registered backfill (dry run first)
python manage.py backfill_data --backfill set_employee_status --dry-run
python manage.py backfill_data --backfill set_employee_status

# Generic field backfill
python manage.py backfill_data \
  --model employees.Employee \
  --field department_code \
  --value "UNKNOWN" \
  --filter "department_code__isnull=True" \
  --batch-size 500 \
  --sleep 0.2

# Resume interrupted backfill
python manage.py backfill_data \
  --model employees.Employee \
  --field department_code \
  --value "UNKNOWN" \
  --resume
```

### Creating Custom Backfills

Create `<app>/backfills.py`:

```python
from core.management.commands.backfill_data import backfill_registry

@backfill_registry.register(
    "compute_employee_tenure",
    description="Calculate tenure_years from hire_date for all employees"
)
def compute_tenure(dry_run=False):
    from employees.models import Employee
    from django.utils import timezone
    from datetime import date

    qs = Employee.objects.filter(tenure_years__isnull=True, hire_date__isnull=False)
    count = qs.count()

    if not dry_run:
        today = date.today()
        batch_size = 1000
        processed = 0

        for emp in qs.iterator(chunk_size=batch_size):
            emp.tenure_years = (today - emp.hire_date).days / 365.25
            emp.save(update_fields=['tenure_years'])
            processed += 1

    return count
```

---

## Seed Data

### Loading Fixtures

```bash
# Production (core data only)
./scripts/deployment/seed-production.sh --env production

# Staging (core data + test admin user)
./scripts/deployment/seed-production.sh --env staging

# Dry run
./scripts/deployment/seed-production.sh --dry-run

# With Cloud SQL Auth Proxy
./scripts/deployment/seed-production.sh --env production --proxy
```

### What Gets Loaded

| Fixture | All Envs | Staging | Production |
|---------|----------|---------|------------|
| Roles (11) | Yes | Yes | Yes |
| Permissions (20) | Yes | Yes | Yes |
| Job Grades (10) | Yes | Yes | Yes |
| Job Categories (8) | Yes | Yes | Yes |
| Leave Types (9) | Yes | Yes | Yes |
| Tax Brackets (7) | Yes | Yes | Yes |
| Tax Reliefs (5) | Yes | Yes | Yes |
| SSNIT Rates (3) | Yes | Yes | Yes |
| Pay Components (14) | Yes | Yes | Yes |
| Misconduct Categories (12) | Yes | Yes | Yes |
| Grievance Categories (10) | Yes | Yes | Yes |
| Bank Sort Codes | Yes | Yes | Yes |
| Test Admin User | No | Yes | No |
| Payroll Roles | No | No | Yes |
