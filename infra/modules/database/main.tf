# ─────────────────────────────────────────────────────────────────────────────
# Cloud SQL PostgreSQL – HA, Private IP, Automated Backups
# ─────────────────────────────────────────────────────────────────────────────

resource "random_id" "db_suffix" {
  byte_length = 4
}

resource "google_sql_database_instance" "primary" {
  name                = "${var.name_prefix}-pg-${random_id.db_suffix.hex}"
  database_version    = "POSTGRES_16"
  region              = var.region
  project             = var.project_id
  deletion_protection = var.deletion_protection

  settings {
    tier              = var.tier
    availability_type = var.availability_type
    disk_size         = var.disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true
    disk_autoresize_limit = var.disk_autoresize_limit

    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
    }

    backup_configuration {
      enabled                        = var.backup_enabled
      point_in_time_recovery_enabled = var.point_in_time_recovery
      start_time                     = "02:00"
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    maintenance_window {
      day          = var.maintenance_window_day
      hour         = var.maintenance_window_hour
      update_track = "stable"
    }

    database_flags {
      name  = "max_connections"
      value = "200"
    }

    database_flags {
      name  = "shared_buffers"
      value = "4096" # 4GB (1/4 of 16GB RAM) in 8KB pages
    }

    database_flags {
      name  = "effective_cache_size"
      value = "1572864" # 12GB in 8KB pages
    }

    database_flags {
      name  = "work_mem"
      value = "16384" # 16MB in KB
    }

    database_flags {
      name  = "maintenance_work_mem"
      value = "524288" # 512MB in KB
    }

    database_flags {
      name  = "log_min_duration_statement"
      value = "1000" # Log queries > 1s
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    database_flags {
      name  = "log_temp_files"
      value = "0" # Log all temp files
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 4096
      record_application_tags = true
      record_client_address   = true
    }

    user_labels = var.labels
  }
}

# ── Database ─────────────────────────────────────────────────────────────────

resource "google_sql_database" "hrms" {
  name     = var.database_name
  instance = google_sql_database_instance.primary.name
  project  = var.project_id
}

# ── Database User ────────────────────────────────────────────────────────────

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "google_sql_user" "app" {
  name     = "hrms_app"
  instance = google_sql_database_instance.primary.name
  password = random_password.db_password.result
  project  = var.project_id
}
