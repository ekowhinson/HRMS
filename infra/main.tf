# ─────────────────────────────────────────────────────────────────────────────
# NHIA HRMS – Root Module Composition
# ─────────────────────────────────────────────────────────────────────────────

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ── 1. Networking ────────────────────────────────────────────────────────────

module "networking" {
  source = "./modules/networking"

  project_id                = var.project_id
  region                    = var.region
  name_prefix               = local.name_prefix
  vpc_cidr                  = var.vpc_cidr
  secondary_pods_cidr       = var.secondary_pods_cidr
  secondary_services_cidr   = var.secondary_services_cidr
  serverless_connector_cidr = var.serverless_connector_cidr
  labels                    = local.common_labels
}

# ── 2. Security (IAM & Service Accounts) ─────────────────────────────────────

module "security" {
  source = "./modules/security"

  project_id      = var.project_id
  name_prefix     = local.name_prefix
  github_repo     = var.github_repo
  waf_rules_level = var.waf_rules_level
  labels          = local.common_labels
}

# ── 3. Secret Manager ───────────────────────────────────────────────────────

module "secrets" {
  source = "./modules/secrets"

  project_id     = var.project_id
  name_prefix    = local.name_prefix
  api_sa_email   = local.api_sa_email
  worker_sa_email = local.worker_sa_email
  labels         = local.common_labels
}

# ── 4. Artifact Registry ────────────────────────────────────────────────────

module "registry" {
  source = "./modules/registry"

  project_id  = var.project_id
  region      = var.region
  name_prefix = local.name_prefix
  labels      = local.common_labels
}

# ── 5. Cloud SQL (PostgreSQL) ────────────────────────────────────────────────

module "database" {
  source = "./modules/database"

  project_id               = var.project_id
  region                   = var.region
  name_prefix              = local.name_prefix
  network_id               = module.networking.network_id
  private_ip_range_name    = module.networking.private_ip_range_name
  tier                     = var.db_tier
  disk_size                = var.db_disk_size
  disk_autoresize_limit    = var.db_disk_autoresize_limit
  database_name            = var.db_name
  availability_type        = var.db_availability_type
  backup_enabled           = var.db_backup_enabled
  point_in_time_recovery   = var.db_point_in_time_recovery
  maintenance_window_day   = var.db_maintenance_window_day
  maintenance_window_hour  = var.db_maintenance_window_hour
  backup_retention_count   = var.db_backup_retention_count
  deletion_protection      = var.db_deletion_protection
  labels                   = local.common_labels

  depends_on = [module.networking]
}

# ── 6. Memorystore (Redis) ──────────────────────────────────────────────────

module "cache" {
  source = "./modules/cache"

  project_id      = var.project_id
  region          = var.region
  name_prefix     = local.name_prefix
  network_id      = module.networking.network_id
  memory_size_gb  = var.redis_memory_size_gb
  redis_version   = var.redis_version
  tier            = var.redis_tier
  labels          = local.common_labels

  depends_on = [module.networking]
}

# ── 7. Cloud Storage ────────────────────────────────────────────────────────

module "storage" {
  source = "./modules/storage"

  project_id         = var.project_id
  name_prefix        = local.name_prefix
  location           = var.storage_location
  lifecycle_age      = var.storage_lifecycle_age
  api_sa_email       = local.api_sa_email
  worker_sa_email    = local.worker_sa_email
  labels             = local.common_labels
}

# ── 8. Backend API (Cloud Run) ──────────────────────────────────────────────

module "backend_service" {
  source = "./modules/backend-service"

  project_id         = var.project_id
  region             = var.region
  name_prefix        = local.name_prefix
  image              = local.api_image
  service_account    = local.api_sa_email
  vpc_connector_id   = module.networking.vpc_connector_id
  db_connection_name = local.db_connection_name
  db_private_ip      = local.db_private_ip
  redis_host         = local.redis_host
  redis_port         = local.redis_port
  secret_ids         = local.secret_ids
  cpu                = var.api_cpu
  memory             = var.api_memory
  min_instances      = var.api_min_instances
  max_instances      = var.api_max_instances
  concurrency        = var.api_concurrency
  timeout            = var.api_timeout
  environment        = var.environment
  domain             = var.domain
  media_bucket       = module.storage.media_bucket_name
  labels             = local.common_labels

  depends_on = [module.database, module.cache, module.secrets, module.registry]
}

# ── 9. Celery Worker (Cloud Run) ────────────────────────────────────────────

module "worker_service" {
  source = "./modules/worker-service"

  project_id         = var.project_id
  region             = var.region
  name_prefix        = local.name_prefix
  image              = local.worker_image
  service_account    = local.worker_sa_email
  vpc_connector_id   = module.networking.vpc_connector_id
  db_connection_name = local.db_connection_name
  db_private_ip      = local.db_private_ip
  redis_host         = local.redis_host
  redis_port         = local.redis_port
  secret_ids         = local.secret_ids
  cpu                = var.worker_cpu
  memory             = var.worker_memory
  min_instances      = var.worker_min_instances
  max_instances      = var.worker_max_instances
  timeout            = var.worker_timeout
  environment        = var.environment
  media_bucket       = module.storage.media_bucket_name
  labels             = local.common_labels

  depends_on = [module.database, module.cache, module.secrets, module.registry]
}

# ── 10. Frontend CDN ────────────────────────────────────────────────────────

module "frontend_cdn" {
  source = "./modules/frontend-cdn"

  project_id               = var.project_id
  name_prefix              = local.name_prefix
  location                 = var.frontend_bucket_location
  domain                   = var.domain
  ssl_certificate_domains  = var.ssl_certificate_domains
  security_policy          = module.security.policy_id
  labels                   = local.common_labels
}

# ── 11. Monitoring & Alerting ────────────────────────────────────────────────

module "monitoring" {
  source = "./modules/monitoring"

  project_id         = var.project_id
  name_prefix        = local.name_prefix
  notification_email = var.notification_email
  domain             = var.domain
  uptime_check_path  = var.uptime_check_path
  api_service_name   = module.backend_service.service_name
  worker_service_name = module.worker_service.service_name
  db_instance_id     = module.database.instance_id
  redis_instance_id  = module.cache.instance_id
  labels             = local.common_labels
}
