# ─────────────────────────────────────────────────────────────────────────────
# Memorystore Redis – HA, Private Network, Auth Enabled
# ─────────────────────────────────────────────────────────────────────────────

resource "google_redis_instance" "primary" {
  name               = "${var.name_prefix}-redis"
  tier               = var.tier
  memory_size_gb     = var.memory_size_gb
  region             = var.region
  project            = var.project_id
  authorized_network = var.network_id
  redis_version      = var.redis_version
  auth_enabled       = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  display_name = "${var.name_prefix} Redis"

  redis_configs = {
    maxmemory-policy  = "allkeys-lru"
    notify-keyspace-events = ""
  }

  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 3
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  labels = var.labels
}
