# ─────────────────────────────────────────────────────────────────────────────
# Root Outputs
# ─────────────────────────────────────────────────────────────────────────────

# ── Networking ───────────────────────────────────────────────────────────────

output "network_id" {
  description = "VPC network ID"
  value       = module.networking.network_id
}

output "vpc_connector_id" {
  description = "Serverless VPC connector ID"
  value       = module.networking.vpc_connector_id
}

# ── Database ─────────────────────────────────────────────────────────────────

output "db_connection_name" {
  description = "Cloud SQL connection name for proxy"
  value       = module.database.connection_name
}

output "db_private_ip" {
  description = "Cloud SQL private IP address"
  value       = module.database.private_ip
  sensitive   = true
}

output "db_instance_id" {
  description = "Cloud SQL instance ID"
  value       = module.database.instance_id
}

# ── Cache ────────────────────────────────────────────────────────────────────

output "redis_host" {
  description = "Memorystore Redis host"
  value       = module.cache.redis_host
  sensitive   = true
}

output "redis_port" {
  description = "Memorystore Redis port"
  value       = module.cache.redis_port
}

# ── Storage ──────────────────────────────────────────────────────────────────

output "media_bucket" {
  description = "GCS media bucket name"
  value       = module.storage.media_bucket_name
}

output "exports_bucket" {
  description = "GCS exports bucket name"
  value       = module.storage.exports_bucket_name
}

output "backups_bucket" {
  description = "GCS backups bucket name"
  value       = module.storage.backups_bucket_name
}

# ── Registry ─────────────────────────────────────────────────────────────────

output "repository_url" {
  description = "Artifact Registry repository URL"
  value       = module.registry.repository_url
}

# ── Backend Service ──────────────────────────────────────────────────────────

output "api_service_url" {
  description = "Cloud Run API service URL"
  value       = module.backend_service.service_url
}

output "api_service_name" {
  description = "Cloud Run API service name"
  value       = module.backend_service.service_name
}

# ── Worker Service ───────────────────────────────────────────────────────────

output "worker_service_name" {
  description = "Cloud Run Celery worker service name"
  value       = module.worker_service.service_name
}

# ── Frontend CDN ─────────────────────────────────────────────────────────────

output "frontend_bucket" {
  description = "Frontend GCS bucket name"
  value       = module.frontend_cdn.bucket_name
}

output "cdn_ip_address" {
  description = "Global static IP for the CDN load balancer"
  value       = module.frontend_cdn.ip_address
}

output "cdn_url" {
  description = "CDN URL for frontend"
  value       = module.frontend_cdn.cdn_url
}

# ── Ollama GPU ─────────────────────────────────────────────────────────────

output "ollama_private_ip" {
  description = "Ollama GCE instance private IP"
  value       = module.ollama_gpu.private_ip
}

output "ollama_base_url" {
  description = "Ollama API base URL for internal services"
  value       = module.ollama_gpu.ollama_base_url
}

# ── Security ─────────────────────────────────────────────────────────────────

output "api_service_account_email" {
  description = "API service account email"
  value       = module.security.api_service_account_email
}

output "worker_service_account_email" {
  description = "Worker service account email"
  value       = module.security.worker_service_account_email
}

# ── Monitoring ───────────────────────────────────────────────────────────────

output "notification_channel_id" {
  description = "Monitoring notification channel ID"
  value       = module.monitoring.notification_channel_id
}
