# ─────────────────────────────────────────────────────────────────────────────
# Cloud Run – Backend API Service (Django + Gunicorn)
# ─────────────────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "api" {
  name     = "${var.name_prefix}-api"
  location = var.region
  project  = var.project_id

  template {
    service_account = var.service_account

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    vpc_access {
      connector = var.vpc_connector_id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    timeout = "${var.timeout}s"
    max_instance_request_concurrency = var.concurrency

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      ports {
        container_port = 8000
      }

      # ── Environment Variables ────────────────────────────────────────────
      env {
        name  = "DJANGO_ENV"
        value = "production"
      }

      env {
        name  = "ALLOWED_HOSTS"
        value = var.domain
      }

      env {
        name  = "CSRF_TRUSTED_ORIGINS"
        value = "https://${var.domain}"
      }

      env {
        name  = "CORS_ALLOWED_ORIGINS"
        value = "https://${var.domain}"
      }

      env {
        name  = "DB_HOST"
        value = var.db_private_ip
      }

      env {
        name  = "DB_PORT"
        value = "5432"
      }

      env {
        name  = "DB_NAME"
        value = "hrms"
      }

      env {
        name  = "DB_USER"
        value = "hrms_app"
      }

      env {
        name  = "REDIS_HOST"
        value = var.redis_host
      }

      env {
        name  = "REDIS_PORT"
        value = tostring(var.redis_port)
      }

      env {
        name  = "USE_POSTGRES"
        value = "true"
      }

      env {
        name  = "USE_REDIS"
        value = "true"
      }

      env {
        name  = "GCS_MEDIA_BUCKET"
        value = var.media_bucket
      }

      env {
        name  = "CLOUD_SQL_CONNECTION_NAME"
        value = var.db_connection_name
      }

      # ── Secrets from Secret Manager ──────────────────────────────────────
      env {
        name = "SECRET_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["django-secret-key"]
            version = "latest"
          }
        }
      }

      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["db-password"]
            version = "latest"
          }
        }
      }

      env {
        name = "REDIS_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["redis-auth"]
            version = "latest"
          }
        }
      }

      env {
        name = "JWT_SIGNING_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["jwt-signing-key"]
            version = "latest"
          }
        }
      }

      env {
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["anthropic-api-key"]
            version = "latest"
          }
        }
      }

      # ── Health Check ─────────────────────────────────────────────────────
      startup_probe {
        http_get {
          path = "/api/v1/core/health/"
        }
        initial_delay_seconds = 10
        period_seconds        = 5
        failure_threshold     = 10
        timeout_seconds       = 3
      }

      liveness_probe {
        http_get {
          path = "/api/v1/core/health/"
        }
        period_seconds    = 30
        failure_threshold = 3
        timeout_seconds   = 3
      }
    }

    labels = var.labels
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = var.labels
}

# ── Allow unauthenticated access (API handles its own auth) ─────────────────

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# ── Custom Domain Mapping ───────────────────────────────────────────────────

resource "google_cloud_run_domain_mapping" "api" {
  count    = var.domain != "" ? 1 : 0
  location = var.region
  name     = "api.${var.domain}"
  project  = var.project_id

  metadata {
    namespace = var.project_id
    labels    = var.labels
  }

  spec {
    route_name = google_cloud_run_v2_service.api.name
  }
}
