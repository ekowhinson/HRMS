# ─────────────────────────────────────────────────────────────────────────────
# Cloud Run – Celery Worker Service
# ─────────────────────────────────────────────────────────────────────────────

resource "google_cloud_run_v2_service" "worker" {
  name     = "${var.name_prefix}-worker"
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

    containers {
      image = var.image

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle = false # Workers need always-on CPU
      }

      # ── Environment Variables ────────────────────────────────────────────
      env {
        name  = "DJANGO_ENV"
        value = "production"
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

      env {
        name  = "OLLAMA_BASE_URL"
        value = var.ollama_base_url
      }

      env {
        name  = "CELERY_WORKER_QUEUES"
        value = "default,imports,reports,payroll,emails"
      }

      env {
        name  = "EMAIL_BACKEND"
        value = "core.email.backend.SendGridBackend"
      }

      env {
        name  = "DEFAULT_FROM_EMAIL"
        value = "noreply@nhia.gov.gh"
      }

      # ── Secrets ──────────────────────────────────────────────────────────
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
        name = "ANTHROPIC_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["anthropic-api-key"]
            version = "latest"
          }
        }
      }

      env {
        name = "SENDGRID_API_KEY"
        value_source {
          secret_key_ref {
            secret  = var.secret_ids["sendgrid-api-key"]
            version = "latest"
          }
        }
      }

      # ── Health Check (Celery inspect) ────────────────────────────────────
      startup_probe {
        tcp_socket {
          port = 8080
        }
        initial_delay_seconds = 15
        period_seconds        = 10
        failure_threshold     = 10
        timeout_seconds       = 3
      }
    }

    labels = var.labels
  }

  # Worker is internal-only — not publicly accessible
  ingress = "INGRESS_TRAFFIC_INTERNAL_ONLY"

  labels = var.labels
}
