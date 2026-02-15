locals {
  # ── Naming convention: {project}-{environment}-{resource} ──────────────
  name_prefix = var.project_id

  # Common labels applied to all resources
  common_labels = merge(var.labels, {
    project     = var.project_id
    environment = var.environment
    managed_by  = "terraform"
    team        = "engineering"
  })

  # Region shorthand for resource names
  region_short = replace(var.region, "/-/", "")

  # Service account email patterns
  api_sa_email    = module.security.api_service_account_email
  worker_sa_email = module.security.worker_service_account_email

  # Database connection
  db_connection_name = module.database.connection_name
  db_private_ip      = module.database.private_ip

  # Redis connection
  redis_host = module.cache.redis_host
  redis_port = module.cache.redis_port

  # Secret IDs
  secret_ids = module.secrets.secret_ids

  # Container image URIs
  api_image    = "${module.registry.repository_url}/backend:${var.image_tag}"
  worker_image = "${module.registry.repository_url}/celery-worker:${var.image_tag}"
}
