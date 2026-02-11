# ─────────────────────────────────────────────────────────────────────────────
# NHIA HRMS – Production Environment
# Full enterprise sizing for 1M+ records, HA across all tiers.
# ─────────────────────────────────────────────────────────────────────────────

project_id         = "nhia-hrms-production"
environment        = "production"
domain             = "hrms.nhia.gov.gh"
notification_email = "devops@nhia.gov.gh"
region             = "us-central1"
image_tag          = "latest"

# ── Database (enterprise) ────────────────────────────────────────────────────
db_tier                   = "db-custom-4-16384" # 4 vCPU, 16 GB
db_disk_size              = 100
db_disk_autoresize_limit  = 500
db_availability_type      = "REGIONAL"           # HA with automatic failover
db_backup_enabled         = true
db_point_in_time_recovery = true
db_backup_retention_count = 30                   # 30-day retention
db_deletion_protection    = true                 # Prevent accidental deletion

# ── Cache (enterprise) ──────────────────────────────────────────────────────
redis_memory_size_gb = 2
redis_tier           = "STANDARD_HA"             # HA with automatic failover

# ── Cloud Run API (enterprise) ──────────────────────────────────────────────
api_cpu           = "2"
api_memory        = "1Gi"
api_min_instances  = 1                           # Always warm
api_max_instances  = 10
api_concurrency   = 100
api_timeout       = 300

# ── Cloud Run Worker (enterprise) ───────────────────────────────────────────
worker_cpu           = "2"
worker_memory        = "2Gi"
worker_min_instances  = 1                        # Always warm
worker_max_instances  = 5
worker_timeout       = 3600

# ── Security (full OWASP rules) ─────────────────────────────────────────────
waf_rules_level = "full"                         # All OWASP + bot blocking

# ── SSL Certificate ─────────────────────────────────────────────────────────
ssl_certificate_domains = ["hrms.nhia.gov.gh"]

# ── CI/CD ────────────────────────────────────────────────────────────────────
github_repo = "nhia/hrms"

# ── Labels ───────────────────────────────────────────────────────────────────
labels = {
  organization = "nhia"
  department   = "it"
  cost_center  = "engineering"
  environment  = "production"
}
