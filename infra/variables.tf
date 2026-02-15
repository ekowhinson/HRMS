# ─────────────────────────────────────────────────────────────────────────────
# Root Variables
# ─────────────────────────────────────────────────────────────────────────────

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "Primary GCP region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Deployment environment (dev, staging, production)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "production"], var.environment)
    error_message = "Environment must be dev, staging, or production."
  }
}

variable "domain" {
  description = "Primary domain for the application (e.g. hrms.nhia.gov.gh)"
  type        = string
}

variable "image_tag" {
  description = "Container image tag to deploy"
  type        = string
  default     = "latest"
}

# ── Networking ────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "Primary CIDR range for the VPC subnet"
  type        = string
  default     = "10.0.0.0/20"
}

variable "secondary_pods_cidr" {
  description = "Secondary CIDR for pods (future GKE)"
  type        = string
  default     = "10.4.0.0/14"
}

variable "secondary_services_cidr" {
  description = "Secondary CIDR for services (future GKE)"
  type        = string
  default     = "10.8.0.0/20"
}

variable "serverless_connector_cidr" {
  description = "CIDR for VPC Serverless Connector"
  type        = string
  default     = "10.1.0.0/28"
}

# ── Database ──────────────────────────────────────────────────────────────────

variable "db_tier" {
  description = "Cloud SQL machine type"
  type        = string
  default     = "db-custom-4-16384" # 4 vCPU, 16 GB
}

variable "db_disk_size" {
  description = "Cloud SQL disk size in GB"
  type        = number
  default     = 100
}

variable "db_disk_autoresize_limit" {
  description = "Maximum disk size for auto-resize in GB"
  type        = number
  default     = 500
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "hrms"
}

variable "db_availability_type" {
  description = "Cloud SQL availability: REGIONAL (HA) or ZONAL"
  type        = string
  default     = "REGIONAL"
}

variable "db_backup_enabled" {
  description = "Enable automated backups"
  type        = bool
  default     = true
}

variable "db_point_in_time_recovery" {
  description = "Enable point-in-time recovery"
  type        = bool
  default     = true
}

variable "db_maintenance_window_day" {
  description = "Day of week for maintenance (1=Monday, 7=Sunday)"
  type        = number
  default     = 7
}

variable "db_maintenance_window_hour" {
  description = "Hour of day for maintenance (UTC)"
  type        = number
  default     = 3
}

variable "db_backup_retention_count" {
  description = "Number of backups to retain"
  type        = number
  default     = 30
}

variable "db_deletion_protection" {
  description = "Prevent accidental deletion of Cloud SQL instance"
  type        = bool
  default     = true
}

# ── Cache (Memorystore Redis) ────────────────────────────────────────────────

variable "redis_memory_size_gb" {
  description = "Memorystore Redis memory in GB"
  type        = number
  default     = 2
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "REDIS_7_0"
}

variable "redis_tier" {
  description = "Redis tier: BASIC or STANDARD_HA"
  type        = string
  default     = "STANDARD_HA"
}

# ── Cloud Run (Backend API) ──────────────────────────────────────────────────

variable "api_cpu" {
  description = "CPU allocation for API service"
  type        = string
  default     = "2"
}

variable "api_memory" {
  description = "Memory allocation for API service"
  type        = string
  default     = "1Gi"
}

variable "api_min_instances" {
  description = "Minimum instances for API service"
  type        = number
  default     = 1
}

variable "api_max_instances" {
  description = "Maximum instances for API service"
  type        = number
  default     = 10
}

variable "api_concurrency" {
  description = "Max concurrent requests per API instance"
  type        = number
  default     = 100
}

variable "api_timeout" {
  description = "Request timeout in seconds for API service"
  type        = number
  default     = 300
}

# ── Cloud Run (Celery Worker) ────────────────────────────────────────────────

variable "worker_cpu" {
  description = "CPU allocation for Celery worker"
  type        = string
  default     = "2"
}

variable "worker_memory" {
  description = "Memory allocation for Celery worker"
  type        = string
  default     = "2Gi"
}

variable "worker_min_instances" {
  description = "Minimum instances for Celery worker"
  type        = number
  default     = 1
}

variable "worker_max_instances" {
  description = "Maximum instances for Celery worker"
  type        = number
  default     = 5
}

variable "worker_timeout" {
  description = "Request timeout in seconds for worker service"
  type        = number
  default     = 3600
}

# ── Cloud Storage ────────────────────────────────────────────────────────────

variable "storage_location" {
  description = "GCS bucket location"
  type        = string
  default     = "US"
}

variable "storage_lifecycle_age" {
  description = "Days before transitioning objects to Nearline"
  type        = number
  default     = 90
}

# ── Frontend CDN ─────────────────────────────────────────────────────────────

variable "frontend_bucket_location" {
  description = "GCS bucket location for frontend assets"
  type        = string
  default     = "US"
}

variable "ssl_certificate_domains" {
  description = "Domains for the managed SSL certificate"
  type        = list(string)
  default     = []
}

# ── Security (Cloud Armor) ───────────────────────────────────────────────────

variable "allowed_countries" {
  description = "Allowed country codes for geo-restriction"
  type        = list(string)
  default     = ["GH", "US", "GB"]
}

variable "rate_limit_threshold" {
  description = "Requests per interval before rate limiting"
  type        = number
  default     = 100
}

variable "rate_limit_interval_sec" {
  description = "Rate limit interval in seconds"
  type        = number
  default     = 60
}

variable "waf_rules_level" {
  description = "Cloud Armor WAF rules level: basic (rate limit + SQLi/XSS only) or full (all OWASP rules)"
  type        = string
  default     = "full"
  validation {
    condition     = contains(["basic", "full"], var.waf_rules_level)
    error_message = "waf_rules_level must be basic or full."
  }
}

# ── Monitoring ───────────────────────────────────────────────────────────────

variable "notification_email" {
  description = "Email for alert notifications"
  type        = string
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for critical alerts (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "uptime_check_path" {
  description = "Health check path for uptime monitoring"
  type        = string
  default     = "/healthz/"
}

variable "enable_log_based_metrics" {
  description = "Enable log-based metrics for application errors and slow queries"
  type        = bool
  default     = true
}

# ── Ollama GPU (AI LLM) ──────────────────────────────────────────────────

variable "ollama_zone" {
  description = "GCE zone for Ollama GPU instance (must have GPU availability)"
  type        = string
  default     = "us-central1-a"
}

variable "ollama_machine_type" {
  description = "GCE machine type for Ollama instance"
  type        = string
  default     = "n1-standard-4"
}

variable "ollama_gpu_type" {
  description = "GPU accelerator type"
  type        = string
  default     = "nvidia-tesla-t4"
}

variable "ollama_gpu_count" {
  description = "Number of GPUs to attach"
  type        = number
  default     = 1
}

variable "ollama_disk_size_gb" {
  description = "Boot disk size in GB for Ollama instance"
  type        = number
  default     = 50
}

variable "ollama_models" {
  description = "Ollama models to pre-pull on startup"
  type        = list(string)
  default     = ["llama3.1", "llava"]
}

# ── Labels ───────────────────────────────────────────────────────────────────

variable "labels" {
  description = "Additional labels to apply to all resources"
  type        = map(string)
  default     = {}
}

# ── CI/CD (Workload Identity Federation) ─────────────────────────────────────

variable "github_repo" {
  description = "GitHub repository in format 'owner/repo'"
  type        = string
  default     = ""
}
