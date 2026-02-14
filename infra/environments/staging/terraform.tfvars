# ─────────────────────────────────────────────────────────────────────────────
# NHIA HRMS – Staging Environment
# Reduced sizing for cost optimization while maintaining functional parity.
# ─────────────────────────────────────────────────────────────────────────────

project_id         = "erp-hr-pay-staging"
environment        = "staging"
domain             = "faaberp.com"
notification_email = "ekowhinson@gmail.com"
region             = "us-central1"
image_tag          = "latest"

# ── Database (reduced) ───────────────────────────────────────────────────────
db_tier                   = "db-custom-1-3840" # 1 vCPU, 3.75 GB
db_disk_size              = 20
db_disk_autoresize_limit  = 50
db_availability_type      = "ZONAL"            # No HA
db_backup_enabled         = true
db_point_in_time_recovery = false              # Save cost
db_backup_retention_count = 7                  # 7-day retention
db_deletion_protection    = false              # Allow teardown

# ── Cache (reduced) ─────────────────────────────────────────────────────────
redis_memory_size_gb = 1
redis_tier           = "BASIC"                 # No HA

# ── Cloud Run API (reduced) ─────────────────────────────────────────────────
api_cpu           = "1"
api_memory        = "1Gi"
api_min_instances  = 0                         # Scale to zero
api_max_instances  = 5
api_concurrency   = 80
api_timeout       = 300

# ── Cloud Run Worker (reduced) ──────────────────────────────────────────────
worker_cpu           = "1"
worker_memory        = "1Gi"
worker_min_instances  = 0                      # Scale to zero
worker_max_instances  = 3
worker_timeout       = 1800

# ── Security (basic rules to save cost) ─────────────────────────────────────
waf_rules_level = "basic"                      # SQLi + XSS + rate limit only

# ── SSL Certificate ─────────────────────────────────────────────────────────
ssl_certificate_domains = ["faaberp.com"]

# ── CI/CD ────────────────────────────────────────────────────────────────────
github_repo = "ekowhinson/HRMS"

# ── Labels ───────────────────────────────────────────────────────────────────
labels = {
  organization = "nhia"
  department   = "it"
  cost_center  = "engineering"
  environment  = "staging"
}
