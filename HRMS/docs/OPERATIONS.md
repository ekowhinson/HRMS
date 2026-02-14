# NHIA HRMS Operations Manual

Day-to-day operations guide for the NHIA Human Resource Management System running on Google Cloud Platform.

**Domain:** hrms.nhia.gov.gh
**Stack:** Django REST API (Cloud Run) + React Frontend (GCS/Cloud CDN) + PostgreSQL 15 (Cloud SQL) + Redis 7.0 (Memorystore) + Celery (Cloud Run Workers)

---

## Table of Contents

1. [Scaling](#1-scaling)
2. [Database Operations](#2-database-operations)
3. [Debugging](#3-debugging)
4. [Cost Optimization](#4-cost-optimization)
5. [Incident Response](#5-incident-response)
6. [Routine Maintenance](#6-routine-maintenance)

---

## 1. Scaling

### Cloud Run API

The NHIA HRMS API runs on Cloud Run with auto-scaling. Adjust scaling parameters based on traffic patterns and performance requirements.

**Adjust instance counts:**

```bash
# Set minimum and maximum instances
gcloud run services update nhia-hrms-api \
  --min-instances=N \
  --max-instances=M \
  --region=us-central1

# Example: production baseline (2 min, 20 max)
gcloud run services update nhia-hrms-api \
  --min-instances=2 \
  --max-instances=20 \
  --region=us-central1

# Example: scale up for payroll processing week
gcloud run services update nhia-hrms-api \
  --min-instances=4 \
  --max-instances=40 \
  --region=us-central1
```

**Adjust concurrency (requests per instance):**

```bash
# Default is 80; lower if request processing is CPU-heavy
gcloud run services update nhia-hrms-api \
  --concurrency=N \
  --region=us-central1

# Recommendation: 40-80 for API, lower (10-20) for report-heavy workloads
```

**Adjust CPU and memory resources:**

```bash
# Scale vertically per instance
gcloud run services update nhia-hrms-api \
  --cpu=N \
  --memory=XGi \
  --region=us-central1

# Example: increase to 2 vCPU, 4Gi memory for peak payroll
gcloud run services update nhia-hrms-api \
  --cpu=2 \
  --memory=4Gi \
  --region=us-central1
```

**When to scale:**
- P95 latency exceeds 500ms consistently: increase min-instances or CPU
- Request queue depth growing: increase max-instances
- Memory usage above 80%: increase memory per instance
- During payroll runs (typically 25th-28th of each month): pre-scale

### Cloud SQL (PostgreSQL 15)

**Production specs:** 4 vCPU, 16GB RAM, 100GB SSD

**Vertical scaling:**

```bash
# Scale to a larger machine type
gcloud sql instances patch nhia-hrms-db \
  --tier=db-custom-CPU-MEMORY \
  --region=us-central1

# Example: scale from 4 vCPU/16GB to 8 vCPU/32GB
gcloud sql instances patch nhia-hrms-db \
  --tier=db-custom-8-32768

# Increase storage (can only go up, never down)
gcloud sql instances patch nhia-hrms-db \
  --storage-size=200GB
```

**Add a read replica (for reporting workloads):**

```bash
# Create a read replica in the same region
gcloud sql instances create nhia-hrms-db-replica \
  --master-instance-name=nhia-hrms-db \
  --region=us-central1 \
  --tier=db-custom-4-16384 \
  --availability-type=ZONAL

# Point Django read-only operations to the replica by
# configuring DATABASE_ROUTERS and a 'replica' database entry
# in config/settings.py
```

**When to consider table partitioning (>10M rows):**

Tables most likely to exceed 10M rows first:
- `core_auditlog` -- partitioned by `created_at` (monthly range partitioning)
- `payroll_payrollitemdetail` -- partitioned by payroll run or period
- `leave_leaverequest` -- partitioned by `created_at` yearly

Partition strategy:

```sql
-- Example: range partition audit_log by month
CREATE TABLE core_auditlog_partitioned (
    LIKE core_auditlog INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE core_auditlog_y2026m01 PARTITION OF core_auditlog_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE core_auditlog_y2026m02 PARTITION OF core_auditlog_partitioned
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
-- ... continue for each month
```

Monitor table sizes with:

```sql
SELECT relname, pg_size_pretty(pg_total_relation_size(oid))
FROM pg_class
WHERE relkind = 'r'
ORDER BY pg_total_relation_size(oid) DESC
LIMIT 20;
```

### Redis (Memorystore)

**Production specs:** 2GB, STANDARD_HA (high availability with failover)

**Scale memory:**

Update the Terraform `redis_memory_size_gb` variable and apply:

```bash
# In your Terraform configuration (terraform/variables.tf or tfvars)
# Update: redis_memory_size_gb = 4

terraform plan -var="redis_memory_size_gb=4"
terraform apply -var="redis_memory_size_gb=4"
```

**Monitor Redis health:**

```bash
# Check memory usage via Cloud Console or:
gcloud redis instances describe nhia-hrms-redis \
  --region=us-central1 \
  --format='table(memorySizeGb, host, port, redisVersion)'

# From within the application, use the cache stats endpoint:
# GET /api/v1/core/cache/stats/
```

**Key metrics to watch:**
- **Memory usage:** Alert at 75%, investigate at 85%, scale at 90%
- **Evictions:** Any non-zero eviction count means Redis is dropping cached data; scale up memory
- **Connection count:** Monitor for connection leaks from Celery workers
- **Cache hit ratio:** Target >90% for lookup/persistent caches; below 70% indicates cache warming issues

**Cache architecture (5 tiers):**

| Cache Alias | Redis DB | TTL | Purpose |
|-------------|----------|-----|---------|
| `default` | 1 | 5 minutes | General caching, view responses |
| `persistent` | 1 | 24 hours | Lookup data (grades, positions, banks) |
| `volatile` | 1 | 1 minute | Dashboard stats, health metrics |
| `long` | 1 | 1 hour | Model detail caching |
| `sessions` | 1 | Session length | Django sessions |

Celery broker and result backend use Redis DB 0 (separate from cache).

**Cache management endpoints:**

```bash
# Check cache status
curl -H "Authorization: Bearer $TOKEN" https://hrms.nhia.gov.gh/api/v1/core/cache/stats/

# Pre-populate all caches (org structure, lookups, dashboard)
curl -X POST -H "Authorization: Bearer $TOKEN" https://hrms.nhia.gov.gh/api/v1/core/cache/warm/

# Clear all caches (use after major data migrations)
curl -X POST -H "Authorization: Bearer $TOKEN" https://hrms.nhia.gov.gh/api/v1/core/cache/clear/
```

### Celery Workers

**Queue architecture:**

| Queue | Cloud Run Service | Purpose | Time Limits |
|-------|-------------------|---------|-------------|
| `default` | nhia-hrms-worker | Notifications, cleanup, health checks, cache warming | 5 min soft / 10 min hard |
| `reports` | nhia-hrms-worker | Report exports (PDF, Excel, CSV) | 5 min soft / 10 min hard |
| `payroll` | nhia-hrms-worker-payroll | Payroll computation, backpay processing | 50 min soft / 60 min hard |
| `finance` | nhia-hrms-worker-finance | GL postings, depreciation, recurring journals | Default |
| `procurement` | nhia-hrms-worker | Contract renewals, overdue delivery checks | Default |

**Scale worker instances:**

```bash
# Scale default worker
gcloud run services update nhia-hrms-worker \
  --min-instances=1 \
  --max-instances=8 \
  --region=us-central1

# Scale payroll worker during payroll processing
gcloud run services update nhia-hrms-worker-payroll \
  --min-instances=2 \
  --max-instances=10 \
  --region=us-central1
```

**Add new queues:**

1. Add the route in `config/celery.py`:

```python
# In task_routes:
'new_module.tasks.*': {'queue': 'new_queue'},
```

2. Update the Cloud Run worker service to consume the new queue
3. Deploy via CI/CD

**Periodic tasks (12 scheduled via Celery Beat):**

| Task | Schedule | Queue |
|------|----------|-------|
| `cleanup_old_audit_logs` | Daily 2:00 AM | default |
| `cleanup_expired_sessions` | Daily 3:00 AM | default |
| `cleanup_expired_tokens` | Daily 3:30 AM | default |
| `warm_cache_task` | Every 6 hours | default |
| `collect_health_metrics` | Every 5 minutes | default |
| `check_probation_due` | Daily 7:00 AM | default |
| `check_grievance_escalation` | Daily 8:00 AM | default |
| `check_appraisal_deadlines` | Daily 00:30 | default |
| `cleanup_expired_backups` | Daily 3:00 AM | default |
| `check_backup_schedules` | Every 30 minutes | default |
| `check_scheduled_reports` | Every 15 minutes | reports |
| (Ad-hoc) `compute_payroll_task` | On demand | payroll |

---

## 2. Database Operations

### Connect to Production

```bash
# Via Cloud SQL Auth Proxy (recommended)
cloud-sql-proxy nhia-project:us-central1:nhia-hrms-db &

# Connect with psql
psql -h 127.0.0.1 -U hrms_app -d hrms

# Or connect directly if IAM DB auth is configured
cloud-sql-proxy nhia-project:us-central1:nhia-hrms-db \
  --auto-iam-authn &
psql -h 127.0.0.1 -U hrms_app -d hrms
```

**Safety rules for production database access:**
- Always use a read-only user (`hrms_readonly`) for ad-hoc queries
- Never run `UPDATE`/`DELETE` without a `WHERE` clause and a preceding `SELECT` to verify rows
- Always wrap data modifications in a transaction: `BEGIN; ... ROLLBACK;` (verify), then `BEGIN; ... COMMIT;`
- Log the reason for any direct database modification

### Backup

**Automated backups:**
- Cloud SQL automated daily backups with 30-day retention (production)
- Cloud SQL automated daily backups with 7-day retention (staging)
- Point-in-time recovery (PITR) enabled via binary logging

**Manual backup (before deployments, migrations, or risky operations):**

```bash
# Create on-demand backup
gcloud sql backups create \
  --instance=nhia-hrms-db \
  --description="Pre-deployment backup $(date +%Y-%m-%d_%H%M)"

# Verify backup was created
gcloud sql backups list --instance=nhia-hrms-db --limit=5

# Export to GCS for long-term archival
gcloud sql export sql nhia-hrms-db \
  gs://nhia-hrms-backups/manual/hrms-$(date +%Y%m%d).sql.gz \
  --database=hrms \
  --offload
```

### Restore

**From automated/manual backup:**

```bash
# List available backups
gcloud sql backups list --instance=nhia-hrms-db

# Restore from a specific backup ID
gcloud sql backups restore BACKUP_ID \
  --restore-instance=nhia-hrms-db

# WARNING: This overwrites the current database. Consider restoring
# to a separate instance first for validation:
gcloud sql backups restore BACKUP_ID \
  --restore-instance=nhia-hrms-db-restore-test
```

**Point-in-time recovery:**

```bash
# Clone the instance to a specific point in time (ISO 8601 format)
gcloud sql instances clone nhia-hrms-db nhia-hrms-db-pitr \
  --point-in-time="2026-02-14T10:30:00.000Z"

# After verifying data in the cloned instance, you can:
# 1. Swap DNS/connection strings to use the cloned instance, OR
# 2. Export/import specific tables back to the primary
```

**From GCS export:**

```bash
gcloud sql import sql nhia-hrms-db \
  gs://nhia-hrms-backups/manual/hrms-20260214.sql.gz \
  --database=hrms
```

### Run Management Commands

**Via Cloud Run Job (preferred for production):**

```bash
# Run database migrations
gcloud run jobs execute nhia-hrms-api-migrate \
  --region=us-central1 \
  --wait

# Create a one-off job for a specific management command
gcloud run jobs create nhia-hrms-cmd \
  --image=REGISTRY/nhia-hrms-api:TAG \
  --region=us-central1 \
  --set-cloudsql-instances=nhia-project:us-central1:nhia-hrms-db \
  --command="python" \
  --args="manage.py,COMMAND_NAME,--arg1=value" \
  --execute-now
```

**Via local Cloud SQL Proxy (for interactive commands):**

```bash
# Start the proxy
cloud-sql-proxy nhia-project:us-central1:nhia-hrms-db &

# Set environment and run command
export DJANGO_ENV=production
export DATABASE_URL="postgresql://hrms_app:PASSWORD@127.0.0.1:5432/hrms"

python manage.py COMMAND
```

**Available custom management commands:**

| Command | Purpose |
|---------|---------|
| `create_payroll_periods 2026 2027` | Create payroll calendar and periods for specified years |
| `seed_banks` | Load Ghana bank data |
| `seed_erp_roles` / `seed_role_modules` | Initialize RBAC roles and module permissions |
| `setup_organization` | Initialize organization structure |
| `setup_approval_workflows` | Configure approval chains |
| `setup_payroll_roles` | Create payroll-specific role assignments |
| `assign_salary_components` | Bulk-assign pay components to employees |
| `assign_salary_grades` | Bulk-assign salary grades |
| `sync_payroll_data` | Synchronize payroll master data |
| `seed_all_data` / `seed_erp_data` | Seed all reference/lookup data |
| `seed_performance_data` / `seed_core_values` | Seed performance module data |
| `seed_interview_templates` | Load default interview templates |
| `seed_loan_types` | Create standard loan types |
| `seed_regions_districts` | Load Ghana regions and districts |
| `seed_2fa_policy` | Configure two-factor authentication policy |
| `seed_recruitment_cycle` | Set up recruitment cycle data |
| `seed_exits` | Initialize exit/offboarding data |
| `seed_policies` | Load policy documents and templates |
| `warm_caches` | Pre-populate all Redis caches |
| `flush_caches` | Clear all Redis caches |
| `benchmark_queries --explain` | Benchmark database query performance |
| `backfill_data` | Backfill missing data across modules |
| `load_initial_data` | Load initial reference data set |
| `fill_missing_data` | Fill gaps in payroll data |
| `cleanup_transaction_types` | Clean up payroll transaction types |
| `setup_overtime_components` | Configure overtime pay components |

### Query Optimization

**Identify slow queries:**

```sql
-- Enable pg_stat_statements extension (if not already)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 20 slowest queries by total execution time
SELECT
    substring(query, 1, 100) AS short_query,
    calls,
    round(total_exec_time::numeric, 2) AS total_time_ms,
    round(mean_exec_time::numeric, 2) AS avg_time_ms,
    round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS percent_total
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Top queries by number of calls
SELECT
    substring(query, 1, 100) AS short_query,
    calls,
    round(mean_exec_time::numeric, 2) AS avg_time_ms
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;
```

**EXPLAIN ANALYZE workflow for a slow query:**

```sql
-- Step 1: Identify the slow query from pg_stat_statements or Cloud Logging

-- Step 2: Run EXPLAIN ANALYZE (read-only, executes the query)
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT e.*, d.name AS department_name
FROM employees_employee e
JOIN organization_department d ON e.department_id = d.id
WHERE e.is_deleted = false AND e.status = 'active'
ORDER BY e.last_name;

-- Step 3: Look for:
--   - Sequential scans on large tables (add an index)
--   - Nested loop joins on large result sets (consider hash join)
--   - Sort operations without an index (add a composite index)
--   - High buffer reads (consider query restructuring)
```

**Benchmark with Django management command:**

```bash
python manage.py benchmark_queries --explain
```

**Index maintenance:**

```sql
-- Check for unused indexes (waste of write performance)
SELECT
    schemaname, relname, indexrelname,
    idx_scan, idx_tup_read, idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- Check for missing indexes (sequential scans on large tables)
SELECT
    relname,
    seq_scan, seq_tup_read,
    idx_scan, idx_tup_fetch,
    pg_size_pretty(pg_relation_size(relid)) AS table_size
FROM pg_stat_user_tables
WHERE seq_scan > 1000 AND pg_relation_size(relid) > 10485760
ORDER BY seq_tup_read DESC
LIMIT 20;

-- Reindex if bloat is suspected (run during low traffic)
REINDEX TABLE CONCURRENTLY employees_employee;
```

---

## 3. Debugging

### Cloud Logging

**Filter API errors:**

```bash
# All errors from the HRMS API service
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="nhia-hrms-api"
   AND severity>=ERROR' \
  --limit=50 \
  --format='table(timestamp, jsonPayload.message, jsonPayload.status_code)'

# Specific HTTP 500 errors
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="nhia-hrms-api"
   AND jsonPayload.status_code=500' \
  --limit=20

# Filter by specific user (UUID)
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND jsonPayload.user_id="UUID_HERE"' \
  --limit=50

# Filter by employee number
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND jsonPayload.employee_number="EMP001"' \
  --limit=20
```

**Slow queries in application logs:**

```bash
# Queries logged as slow by Django middleware
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND jsonPayload.event="slow_query"' \
  --limit=20 \
  --format='table(timestamp, jsonPayload.duration_ms, jsonPayload.sql)'
```

**Celery task logs:**

```bash
# Task failures
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND jsonPayload.event="task_failure"' \
  --limit=20 \
  --format='table(timestamp, jsonPayload.task_name, jsonPayload.exception, jsonPayload.duration_ms)'

# Task retries
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND jsonPayload.event="task_retry"' \
  --limit=20

# Specific task execution
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND jsonPayload.task_name="payroll.tasks.compute_payroll_task"' \
  --limit=10

# Long-running tasks (> 30 seconds)
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND jsonPayload.event="task_completed"
   AND jsonPayload.duration_ms>30000' \
  --limit=20
```

**Authentication and security events:**

```bash
# Failed login attempts
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND jsonPayload.event="login_failed"' \
  --limit=50 \
  --format='table(timestamp, jsonPayload.username, jsonPayload.ip_address)'

# Permission denied errors
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND jsonPayload.event="permission_denied"' \
  --limit=20
```

### Cloud Run

**View service revisions and traffic split:**

```bash
# List all revisions
gcloud run revisions list \
  --service=nhia-hrms-api \
  --region=us-central1 \
  --format='table(REVISION, ACTIVE, SERVICE, LAST_DEPLOYED_AT)'

# View current service details (traffic split, URLs, scaling)
gcloud run services describe nhia-hrms-api \
  --region=us-central1

# View instance metrics
gcloud run services describe nhia-hrms-api \
  --region=us-central1 \
  --format='table(status.traffic)'
```

**Rollback to a previous revision:**

```bash
# Route 100% traffic to a known-good revision
gcloud run services update-traffic nhia-hrms-api \
  --to-revisions=nhia-hrms-api-REVISION_ID=100 \
  --region=us-central1
```

**View instance logs via gcloud:**

```bash
# Tail live logs from the API service
gcloud logging tail \
  'resource.type="cloud_run_revision"
   AND resource.labels.service_name="nhia-hrms-api"' \
  --format='default'
```

### Celery

**Check task status via Flower dashboard:**

Flower (Celery monitoring) runs on port 5555. Access via:
- URL: Internal access only (Cloud Run service with IAP or VPN)
- Features: Active/reserved/scheduled tasks, worker status, task history, rate limiting

**Check task status via Django admin:**

The `django_celery_beat` scheduler stores periodic task metadata in the database. Access via:
- URL: `https://hrms.nhia.gov.gh/admin/django_celery_beat/`
- View/edit periodic tasks, crontab schedules, interval schedules

**Check task status via API:**

```bash
# Poll payroll computation progress
curl -H "Authorization: Bearer $TOKEN" \
  https://hrms.nhia.gov.gh/api/v1/payroll/runs/{run_id}/progress/

# Poll report export progress
curl -H "Authorization: Bearer $TOKEN" \
  https://hrms.nhia.gov.gh/api/v1/reports/tasks/{task_id}/status/
```

**Requeue / manually trigger tasks:**

```bash
# Trigger a specific task from CLI (via Cloud Run job or local proxy)
celery -A config call core.tasks.warm_cache_task
celery -A config call core.tasks.cleanup_old_audit_logs
celery -A config call core.tasks.check_probation_due
celery -A config call core.tasks.collect_health_metrics

# Trigger with arguments
celery -A config call core.tasks.invalidate_cache_task --args='["payroll"]'
celery -A config call core.tasks.send_notification_task \
  --args='["USER_UUID", "INFO", {"title": "Test", "message": "Test notification"}]'

# Trigger finance tasks
celery -A config call finance.tasks.post_payroll_to_gl --args='["PAYROLL_RUN_UUID"]'
celery -A config call finance.tasks.calculate_depreciation --args='["FISCAL_PERIOD_UUID"]'
celery -A config call finance.tasks.generate_recurring_journals
```

**Inspect worker state:**

```bash
# List active tasks across all workers
celery -A config inspect active

# List reserved (prefetched) tasks
celery -A config inspect reserved

# List scheduled (ETA/countdown) tasks
celery -A config inspect scheduled

# List registered task names
celery -A config inspect registered

# Check worker stats (prefetch count, pool processes)
celery -A config inspect stats

# Purge all messages from a specific queue (CAUTION: data loss)
celery -A config purge -Q reports
```

**Common Celery issues and fixes:**

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Tasks stuck in PENDING | Workers not consuming the queue | Verify worker service is running, check queue names match |
| Tasks failing with timeout | Operation exceeds soft/hard time limit | Increase time limits in task decorator or optimize the operation |
| Memory growing on workers | Memory leak in long-running worker | Set `worker_max_tasks_per_child=100` to recycle processes |
| Beat not scheduling tasks | Beat service not running or DB scheduler issue | Restart beat, check `django_celery_beat` tables |
| Duplicate task executions | `task_acks_late=True` with worker crash | Ensure idempotent tasks; this is expected behavior for reliability |

### Sentry

**Access:** Sentry project for NHIA HRMS (configured via `SENTRY_DSN` environment variable)

**Common operations:**
- View unresolved issues: Sentry dashboard > Issues > Unresolved
- Filter by environment: `production` or `staging`
- Filter by release/version tag for deployment-specific issues
- Set up alert rules for new issue types, regression, and spike in error rates
- Assign issues to team members for triage

---

## 4. Cost Optimization

### Staging Environment

**Scale to zero at night/weekends (saves 40-60% on Cloud Run):**

```bash
# Set min instances to 0 for staging services
gcloud run services update nhia-hrms-api-staging \
  --min-instances=0 \
  --max-instances=4 \
  --region=us-central1

gcloud run services update nhia-hrms-worker-staging \
  --min-instances=0 \
  --max-instances=2 \
  --region=us-central1
```

**Use basic WAF rules (saves ~$5/month vs. managed WAF):**
- Cloud Armor basic rules only (IP allowlisting, rate limiting)
- No managed WAF rulesets in staging

**Use ZONAL database (no HA) for staging:**

```bash
# Staging database: single zone, smaller tier
gcloud sql instances patch nhia-hrms-db-staging \
  --availability-type=ZONAL \
  --tier=db-custom-1-3840
```

**Staging Redis: BASIC tier (no HA):**
- 1GB memory, BASIC tier (no failover replica)
- Sufficient for development and QA testing

### Production Environment

**Cloud SQL committed use discounts (CUDs):**

- 1-year commitment: ~30% savings
- 3-year commitment: ~50% savings
- Purchase via GCP Console > SQL > Committed Use Discounts
- Evaluate after 3 months of stable production usage to right-size

**Cloud CDN cache hit ratio target: >90%:**

```bash
# Check CDN cache hit ratio
gcloud compute backend-buckets describe nhia-hrms-frontend-bucket \
  --format='table(cdnPolicy.cacheMode, cdnPolicy.defaultTtl)'

# Monitor via Cloud Monitoring:
# Metric: loadbalancing.googleapis.com/https/backend_request_count
# Group by: cache_result (HIT, MISS, STALE)
```

Optimize cache hit ratio:
- Set appropriate `Cache-Control` headers on static assets (e.g., `max-age=31536000` for hashed filenames)
- Use versioned filenames (Vite/webpack chunk hashing)
- Set `default_ttl=3600` for non-hashed resources

**GCS lifecycle rules (archive old media after 90 days):**

```json
{
  "lifecycle": {
    "rule": [
      {
        "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" },
        "condition": { "age": 90, "matchesPrefix": ["media/uploads/"] }
      },
      {
        "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" },
        "condition": { "age": 365, "matchesPrefix": ["media/uploads/"] }
      },
      {
        "action": { "type": "Delete" },
        "condition": { "age": 730, "matchesPrefix": ["media/uploads/temp/"] }
      }
    ]
  }
}
```

Apply via:

```bash
gsutil lifecycle set lifecycle.json gs://nhia-hrms-media
```

**Set billing alerts:**

```bash
# Create billing budget with alerts at 50%, 80%, and 100%
gcloud billing budgets create \
  --billing-account=BILLING_ACCOUNT_ID \
  --display-name="NHIA HRMS Monthly Budget" \
  --budget-amount=800 \
  --threshold-rule=percent=0.5 \
  --threshold-rule=percent=0.8 \
  --threshold-rule=percent=1.0 \
  --notifications-rule-pubsub-topic=projects/nhia-project/topics/billing-alerts \
  --notifications-rule-monitoring-notification-channels=CHANNEL_ID
```

### Expected Monthly Costs

| Service | Staging | Production |
|---------|---------|------------|
| Cloud Run (API + Workers) | $5-20/mo | $50-200/mo |
| Cloud SQL (PostgreSQL 15) | $10-25/mo | $150-350/mo |
| Memorystore Redis | $35/mo | $75-150/mo |
| Cloud Storage + CDN | $2-8/mo | $15-70/mo |
| Cloud Armor (WAF) | $5/mo | $12/mo |
| Secret Manager | $1/mo | $1/mo |
| Cloud Logging/Monitoring | $5-10/mo | $10-30/mo |
| DNS + SSL | $1/mo | $1/mo |
| Networking (egress) | $2-5/mo | $5-15/mo |
| Sentry | $13/mo | $1-12/mo |
| **Total** | **~$80-125/mo** | **~$320-840/mo** |

Notes:
- Cloud Run costs scale directly with traffic and compute time
- Cloud SQL is the largest fixed cost; CUDs reduce this significantly
- Redis HA (STANDARD_HA) is ~2x the cost of BASIC tier
- Actual costs depend heavily on employee count, payroll frequency, and report usage

### Monthly Cost Review Checklist

- [ ] Review Cloud Billing report by service and SKU
- [ ] Check Cloud Run instance utilization (are min-instances too high?)
- [ ] Review Cloud SQL CPU/memory utilization (right-sized?)
- [ ] Check Redis memory utilization (over-provisioned?)
- [ ] Review CDN cache hit ratio (>90% target)
- [ ] Check for orphaned resources (unused disks, snapshots, IPs)
- [ ] Compare staging costs to budget (target <$125/mo)
- [ ] Compare production costs to budget (target <$840/mo)
- [ ] Evaluate CUD eligibility for stable workloads

---

## 5. Incident Response

### Severity Levels

| Severity | Definition | Response Time | Examples |
|----------|-----------|---------------|----------|
| **P1 (Critical)** | System completely down, data loss or corruption, security breach | 15 minutes | API returning 5xx for all users, database corruption, unauthorized access detected |
| **P2 (High)** | Major feature broken, significant performance degradation | 1 hour | Payroll computation failing, login broken for subset of users, report exports timing out |
| **P3 (Medium)** | Minor feature broken, workaround available | 4 hours | Single report type not generating, leave approval notifications delayed, non-critical UI bug |
| **P4 (Low)** | Cosmetic issue, minor inconvenience | Next business day | UI alignment issues, incorrect label, slow but functional operation |

### Communication Channels

| Channel | Purpose |
|---------|---------|
| PagerDuty / On-call phone | P1/P2 alerts |
| Slack #nhia-hrms-ops | Real-time incident coordination |
| Email: hrms-ops@nhia.gov.gh | Status updates to stakeholders |
| Status page (internal) | User-facing status updates |

### Incident Response Procedure

**1. Detection and Alert:**
- Automated alerts from Cloud Monitoring (latency, error rate, CPU)
- Sentry alerts for new/regressed issues
- User reports via helpdesk

**2. Triage (first 5 minutes):**

```bash
# Quick health check
curl -s https://hrms.nhia.gov.gh/api/v1/core/health/ | python -m json.tool

# Check Cloud Run service status
gcloud run services describe nhia-hrms-api \
  --region=us-central1 \
  --format='table(status.conditions)'

# Check recent errors
gcloud logging read \
  'resource.type="cloud_run_revision"
   AND severity>=ERROR
   AND resource.labels.service_name="nhia-hrms-api"' \
  --limit=10 \
  --freshness=15m

# Check Cloud SQL status
gcloud sql instances describe nhia-hrms-db \
  --format='table(state, settings.availabilityType)'

# Check Redis status
gcloud redis instances describe nhia-hrms-redis \
  --region=us-central1 \
  --format='table(state, host, memorySizeGb)'
```

**3. Escalation Path:**

1. On-call engineer reviews alerts and determines severity
2. If P1/P2: immediately notify team lead via phone/PagerDuty
3. If P1 unresolved in 30 minutes: escalate to engineering manager
4. If P1 unresolved in 1 hour: escalate to IT director
5. If P2 unresolved in 2 hours: escalate to engineering manager

**4. Common Incident Playbooks:**

**API returning 5xx errors:**

```bash
# Check if it's a deployment issue
gcloud run revisions list --service=nhia-hrms-api --region=us-central1 --limit=5

# Rollback to previous revision if recent deployment
gcloud run services update-traffic nhia-hrms-api \
  --to-revisions=PREVIOUS_REVISION=100 \
  --region=us-central1

# Check database connectivity
gcloud sql instances describe nhia-hrms-db --format='value(state)'

# Check if database connections are exhausted
psql -h 127.0.0.1 -U hrms_app -d hrms -c \
  "SELECT count(*) AS total, state FROM pg_stat_activity GROUP BY state;"
```

**Database connection pool exhausted:**

```bash
# Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Kill idle-in-transaction connections (older than 10 minutes)
psql -c "
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle in transaction'
  AND state_change < now() - interval '10 minutes';
"

# Restart Cloud Run service to reset connection pools
gcloud run services update nhia-hrms-api \
  --region=us-central1 \
  --update-env-vars="FORCE_RESTART=$(date +%s)"
```

**Redis connection issues:**

```bash
# Check Redis instance status
gcloud redis instances describe nhia-hrms-redis --region=us-central1

# If Redis is down, the application should degrade gracefully
# (cache misses result in DB queries, not errors)

# Clear caches after Redis recovery
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://hrms.nhia.gov.gh/api/v1/core/cache/warm/
```

**Payroll computation stuck/failed:**

```bash
# Check task status in logs
gcloud logging read \
  'jsonPayload.task_name="reports.tasks.compute_payroll_task"
   OR jsonPayload.task_name="payroll.tasks.compute_payroll_task"' \
  --limit=10

# Check the payroll run status in the database
psql -c "
SELECT id, run_number, status, created_at, updated_at
FROM payroll_payrollrun
ORDER BY created_at DESC
LIMIT 5;
"

# Reset a failed payroll run to DRAFT status
psql -c "
UPDATE payroll_payrollrun
SET status = 'DRAFT'
WHERE id = 'PAYROLL_RUN_UUID' AND status = 'PROCESSING';
"
```

### Post-Incident Review (PIR) Template

Conduct a PIR within 48 hours of any P1 or P2 incident.

```
## Post-Incident Review

**Incident Title:**
**Date/Time:**
**Duration:**
**Severity:** P1 / P2
**Author:**

### What happened?
[Brief summary of the incident]

### Timeline of events
| Time (UTC) | Event |
|------------|-------|
| HH:MM | Alert triggered |
| HH:MM | Engineer acknowledged |
| HH:MM | Root cause identified |
| HH:MM | Fix deployed |
| HH:MM | Service fully restored |

### Root cause
[Technical root cause analysis]

### Impact
- Users affected: [number/percentage]
- Duration of impact: [minutes/hours]
- Data affected: [none / describe]
- Financial impact: [if applicable]

### What went well?
- [List items]

### What could be improved?
- [List items]

### Action items
| Action | Owner | Due Date | Status |
|--------|-------|----------|--------|
| [Action item] | [Name] | [Date] | Open |
```

---

## 6. Routine Maintenance

### Daily (Automated)

These tasks run automatically via Celery Beat and require no manual intervention unless alerts fire:

- **02:00** - Clean up audit logs older than 90 days (`cleanup_old_audit_logs`)
- **03:00** - Clean up expired sessions (`cleanup_expired_sessions`)
- **03:00** - Clean up expired backup records (`cleanup_expired_backups`)
- **03:30** - Flush expired JWT tokens (`cleanup_expired_tokens`)
- **07:00** - Check probation assessments due within 30 days (`check_probation_due`)
- **08:00** - Auto-escalate unacknowledged grievances >5 days (`check_grievance_escalation`)
- **00:30** - Auto-lock expired appraisal schedules (`check_appraisal_deadlines`)
- **Every 5 min** - Collect health metrics (`collect_health_metrics`)
- **Every 6 hours** - Warm caches with lookup/org data (`warm_cache_task`)
- **Every 15 min** - Check and run scheduled reports (`check_scheduled_reports`)
- **Every 30 min** - Check backup schedules (`check_backup_schedules`)

### Weekly

Perform these checks every Monday:

- [ ] **Review error rates in Sentry**
  - Check for new unresolved issues
  - Review issue frequency trends
  - Assign and triage any P3+ issues

- [ ] **Check Cloud SQL storage growth**
  ```bash
  gcloud sql instances describe nhia-hrms-db \
    --format='table(settings.dataDiskSizeGb, settings.dataDiskType)'

  # Check actual database size
  psql -c "SELECT pg_size_pretty(pg_database_size('hrms'));"

  # Check table sizes
  psql -c "
  SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) AS total_size
  FROM pg_class WHERE relkind = 'r'
  ORDER BY pg_total_relation_size(oid) DESC LIMIT 15;
  "
  ```

- [ ] **Review slow query logs**
  ```bash
  gcloud logging read \
    'resource.type="cloud_run_revision"
     AND jsonPayload.event="slow_query"' \
    --limit=50 \
    --freshness=7d \
    --format='table(timestamp, jsonPayload.duration_ms, jsonPayload.sql)'
  ```

- [ ] **Check Celery task failure rates**
  ```bash
  gcloud logging read \
    'resource.type="cloud_run_revision"
     AND jsonPayload.event="task_failure"' \
    --freshness=7d \
    --format='table(timestamp, jsonPayload.task_name, jsonPayload.exception)'
  ```

- [ ] **Verify automated backups are running**
  ```bash
  gcloud sql backups list --instance=nhia-hrms-db --limit=7
  ```

### Monthly

Perform these on the first Monday of each month:

- [ ] **Cost review**
  - Review Cloud Billing reports for the previous month
  - Compare against budget targets (staging <$125, production <$840)
  - Identify cost anomalies or unexpected spikes
  - Document findings and optimization actions

- [ ] **Security audit**
  ```bash
  # Python dependency audit
  cd HRMS/backend
  pip-audit

  # Node.js dependency audit
  cd HRMS/frontend
  npm audit

  # Check for known CVEs in Docker base image
  gcloud artifacts docker images scan \
    REGISTRY/nhia-hrms-api:latest \
    --format='table(vulnerability.effectiveSeverity, vulnerability.shortDescription)'
  ```

- [ ] **Review and rotate service account keys**
  - If using Workload Identity Federation (WIF): no key rotation needed
  - If using service account keys: rotate keys older than 90 days
  ```bash
  # List service account keys and their creation dates
  gcloud iam service-accounts keys list \
    --iam-account=hrms-api@nhia-project.iam.gserviceaccount.com \
    --format='table(KEY_ID, CREATED_AT, EXPIRES_AT)'
  ```

- [ ] **Update dependencies**
  ```bash
  # Backend: review and update Python packages
  cd HRMS/backend
  pip list --outdated
  # Update requirements.txt/pyproject.toml with tested versions

  # Frontend: review and update Node packages
  cd HRMS/frontend
  npm outdated
  # Update package.json with tested versions
  ```
  Always test dependency updates in staging before promoting to production.

- [ ] **Review Cloud SQL performance insights**
  - Check Query Insights in Cloud Console
  - Review index usage statistics
  - Run `ANALYZE` on heavily-modified tables
  ```sql
  ANALYZE employees_employee;
  ANALYZE payroll_payrollitem;
  ANALYZE payroll_payrollitemdetail;
  ANALYZE core_auditlog;
  ANALYZE leave_leaverequest;
  ```

- [ ] **Clean up old Cloud Run revisions**
  ```bash
  # List old revisions (keep last 5)
  gcloud run revisions list \
    --service=nhia-hrms-api \
    --region=us-central1 \
    --sort-by=~CREATED \
    --format='value(REVISION)' | tail -n +6 | while read rev; do
      echo "Consider deleting: $rev"
  done
  ```

### Quarterly

Perform these at the start of each quarter (January, April, July, October):

- [ ] **Load testing**
  - Run load tests simulating peak concurrent users
  - Test payroll computation with full employee roster
  - Test report generation under load
  - Document results and compare with previous quarter
  - Adjust scaling parameters based on findings

- [ ] **Disaster recovery drill**
  1. Verify backup integrity:
     ```bash
     # Restore latest backup to a test instance
     gcloud sql backups list --instance=nhia-hrms-db --limit=1
     gcloud sql instances clone nhia-hrms-db nhia-hrms-db-dr-test \
       --point-in-time="$(date -u +%Y-%m-%dT%H:%M:%S.000Z -d '1 hour ago')"
     ```
  2. Verify the restored instance has current data
  3. Test application connectivity to the restored instance
  4. Test Redis failover (STANDARD_HA): `gcloud redis instances failover nhia-hrms-redis --region=us-central1`
  5. Document recovery time (RTO) and data loss (RPO)
  6. Clean up test instances:
     ```bash
     gcloud sql instances delete nhia-hrms-db-dr-test --quiet
     ```

- [ ] **Review capacity planning**
  - Project database storage growth for next quarter
  - Review Cloud Run scaling metrics (did max-instances get hit?)
  - Review Redis memory trends
  - Plan for any upcoming large-scale operations (annual payroll reviews, mass hiring)

- [ ] **SSL certificate review**
  - Verify SSL certificates are auto-renewing (Cloud Run managed or Google-managed certificates)
  - Check certificate expiration dates for any custom certificates
  ```bash
  gcloud compute ssl-certificates list \
    --format='table(name, type, expireTime, managed.status)'
  ```

- [ ] **Review IAM and access controls**
  - Audit who has access to production GCP project
  - Review service account permissions (principle of least privilege)
  - Check for any over-privileged users
  - Review Django RBAC roles and permissions

### Annual

- [ ] **Create payroll periods for the upcoming year**
  ```bash
  python manage.py create_payroll_periods NEXT_YEAR
  ```

- [ ] **Review and update the disaster recovery plan**
- [ ] **Review SLAs and update targets based on actual performance**
- [ ] **Infrastructure cost optimization review with GCP account team**
- [ ] **Review and update this operations manual**

---

## Appendix A: Environment Variables

Key environment variables configured in Cloud Run services:

| Variable | Description |
|----------|-------------|
| `DJANGO_ENV` | `production` or `staging` |
| `SECRET_KEY` | Django secret key (from Secret Manager) |
| `DATABASE_URL` | PostgreSQL connection string (from Secret Manager) |
| `REDIS_URL` | Redis connection string |
| `USE_POSTGRES` | `true` (always in cloud environments) |
| `USE_REDIS` | `true` (always in cloud environments) |
| `SENTRY_DSN` | Sentry error tracking DSN |
| `GCS_BUCKET_NAME` | Google Cloud Storage bucket for media |
| `ALLOWED_HOSTS` | `hrms.nhia.gov.gh` |
| `CORS_ALLOWED_ORIGINS` | Frontend URL |
| `DEFAULT_FROM_EMAIL` | `noreply@hrms.nhia.gov.gh` |

## Appendix B: Service Architecture

```
                                    Internet
                                       |
                              Cloud Load Balancer
                              (Cloud Armor WAF)
                                   |       |
                          Cloud CDN         Cloud Run
                         (Frontend)      (nhia-hrms-api)
                             |                 |
                          GCS Bucket     +-----+-----+
                       (React SPA)       |           |
                                    Cloud SQL    Memorystore
                                  (PostgreSQL)    (Redis)
                                         |           |
                                    Cloud Run Workers
                                   (Celery: default,
                                    reports, payroll,
                                    finance, procurement)
```

## Appendix C: Useful SQL Queries

```sql
-- Active employee count by department
SELECT d.name, COUNT(e.id) AS employee_count
FROM employees_employee e
JOIN organization_department d ON e.department_id = d.id
WHERE e.is_deleted = false AND e.status = 'active'
GROUP BY d.name ORDER BY employee_count DESC;

-- Payroll run summary
SELECT run_number, status, payroll_period_id,
       created_at, updated_at
FROM payroll_payrollrun
ORDER BY created_at DESC LIMIT 10;

-- Pending leave requests by type
SELECT lt.name, COUNT(lr.id) AS pending_count
FROM leave_leaverequest lr
JOIN leave_leavetype lt ON lr.leave_type_id = lt.id
WHERE lr.status = 'pending'
GROUP BY lt.name ORDER BY pending_count DESC;

-- Database connection status
SELECT state, count(*) FROM pg_stat_activity
GROUP BY state ORDER BY count DESC;

-- Table bloat check
SELECT
    schemaname, relname,
    n_dead_tup, n_live_tup,
    round(n_dead_tup * 100.0 / GREATEST(n_live_tup, 1), 1) AS dead_pct
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC LIMIT 15;
```

## Appendix D: Emergency Contacts

| Role | Name | Contact |
|------|------|---------|
| On-call Engineer | (rotation) | PagerDuty |
| Team Lead | TBD | TBD |
| Engineering Manager | TBD | TBD |
| IT Director | TBD | TBD |
| GCP Support | Google Cloud | Cloud Console > Support |
