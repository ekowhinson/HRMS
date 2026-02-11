# ─────────────────────────────────────────────────────────────────────────────
# Monitoring – Uptime/Readiness Checks, Tiered Alert Policies,
#              Log-Based Metrics, Notification Channels, Dashboard
# ─────────────────────────────────────────────────────────────────────────────

locals {
  # Warning-level alerts go to email only; critical go to email + Slack
  warning_channels  = [google_monitoring_notification_channel.email.name]
  critical_channels = var.slack_webhook_url != "" ? [
    google_monitoring_notification_channel.email.name,
    google_monitoring_notification_channel.slack[0].name,
  ] : [google_monitoring_notification_channel.email.name]
}

# ── Notification Channels ──────────────────────────────────────────────────

resource "google_monitoring_notification_channel" "email" {
  display_name = "${var.name_prefix} Alerts (Email)"
  type         = "email"
  project      = var.project_id

  labels = {
    email_address = var.notification_email
  }
}

resource "google_monitoring_notification_channel" "slack" {
  count = var.slack_webhook_url != "" ? 1 : 0

  display_name = "${var.name_prefix} Critical Alerts (Slack)"
  type         = "slack"
  project      = var.project_id

  labels = {
    channel_name = "#hrms-alerts"
  }

  sensitive_labels {
    auth_token = var.slack_webhook_url
  }
}

# ── Uptime Check (Liveness) ───────────────────────────────────────────────

resource "google_monitoring_uptime_check_config" "api_liveness" {
  display_name = "${var.name_prefix} API Liveness (/healthz/)"
  timeout      = "10s"
  period       = "60s"
  project      = var.project_id

  http_check {
    path           = var.uptime_check_path
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"

    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.domain
    }
  }
}

# ── Uptime Check (Readiness) ──────────────────────────────────────────────

resource "google_monitoring_uptime_check_config" "api_readiness" {
  display_name = "${var.name_prefix} API Readiness (/readyz/)"
  timeout      = "15s"
  period       = "300s" # Every 5 minutes — heavier check
  project      = var.project_id

  http_check {
    path           = var.readiness_check_path
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"

    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = var.domain
    }
  }
}

# ══════════════════════════════════════════════════════════════════════════════
# ALERT POLICIES — Tiered (Warning → Email, Critical → Email + Slack)
# ══════════════════════════════════════════════════════════════════════════════

# ── Alert: API Liveness Failure (CRITICAL) ─────────────────────────────────

resource "google_monitoring_alert_policy" "uptime_failure" {
  display_name = "${var.name_prefix} API Liveness Failure (CRITICAL)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "CRITICAL"

  conditions {
    display_name = "Liveness check failure"
    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"${google_monitoring_uptime_check_config.api_liveness.uptime_check_id}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "300s"

      aggregations {
        alignment_period     = "60s"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        group_by_fields      = ["resource.label.project_id"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.critical_channels

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# ── Alert: API Readiness Failure (WARNING) ─────────────────────────────────

resource "google_monitoring_alert_policy" "readiness_failure" {
  display_name = "${var.name_prefix} API Readiness Failure (WARNING)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "WARNING"

  conditions {
    display_name = "Readiness check failure"
    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"${google_monitoring_uptime_check_config.api_readiness.uptime_check_id}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "600s"

      aggregations {
        alignment_period     = "60s"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        group_by_fields      = ["resource.label.project_id"]
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.warning_channels

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# ── Alert: API Latency — WARNING >3s, CRITICAL >5s ───────────────────────

resource "google_monitoring_alert_policy" "api_latency_warning" {
  display_name = "${var.name_prefix} API Latency > 3s p95 (WARNING)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "WARNING"

  conditions {
    display_name = "Cloud Run request latency > 3s"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.api_service_name}\" AND metric.type = \"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 3000
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.warning_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

resource "google_monitoring_alert_policy" "api_latency_critical" {
  display_name = "${var.name_prefix} API Latency > 8s p95 (CRITICAL)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "CRITICAL"

  conditions {
    display_name = "Cloud Run request latency > 8s"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.api_service_name}\" AND metric.type = \"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 8000
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.critical_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

# ── Alert: API Error Rate — WARNING >2%, CRITICAL >5% ────────────────────

resource "google_monitoring_alert_policy" "api_error_rate_warning" {
  display_name = "${var.name_prefix} API Error Rate > 2% (WARNING)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "WARNING"

  conditions {
    display_name = "Cloud Run 5xx error rate > 2%"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.api_service_name}\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.02
      duration        = "300s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.warning_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

resource "google_monitoring_alert_policy" "api_error_rate_critical" {
  display_name = "${var.name_prefix} API Error Rate > 5% (CRITICAL)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "CRITICAL"

  conditions {
    display_name = "Cloud Run 5xx error rate > 5%"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.api_service_name}\" AND metric.type = \"run.googleapis.com/request_count\" AND metric.labels.response_code_class = \"5xx\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05
      duration        = "300s"

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = local.critical_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

# ── Alert: Cloud SQL CPU — WARNING >70%, CRITICAL >90% ───────────────────

resource "google_monitoring_alert_policy" "db_cpu_warning" {
  display_name = "${var.name_prefix} Cloud SQL CPU > 70% (WARNING)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "WARNING"

  conditions {
    display_name = "Cloud SQL CPU utilization > 70%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.7
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.warning_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

resource "google_monitoring_alert_policy" "db_cpu_critical" {
  display_name = "${var.name_prefix} Cloud SQL CPU > 90% (CRITICAL)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "CRITICAL"

  conditions {
    display_name = "Cloud SQL CPU utilization > 90%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.9
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.critical_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

# ── Alert: Cloud SQL Memory — WARNING >80%, CRITICAL >92% ────────────────

resource "google_monitoring_alert_policy" "db_memory_warning" {
  display_name = "${var.name_prefix} Cloud SQL Memory > 80% (WARNING)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "WARNING"

  conditions {
    display_name = "Cloud SQL memory utilization > 80%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/memory/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.warning_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

resource "google_monitoring_alert_policy" "db_memory_critical" {
  display_name = "${var.name_prefix} Cloud SQL Memory > 92% (CRITICAL)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "CRITICAL"

  conditions {
    display_name = "Cloud SQL memory utilization > 92%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/memory/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.92
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.critical_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

# ── Alert: Cloud SQL Disk — WARNING >75%, CRITICAL >90% ─────────────────

resource "google_monitoring_alert_policy" "db_disk_warning" {
  display_name = "${var.name_prefix} Cloud SQL Disk > 75% (WARNING)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "WARNING"

  conditions {
    display_name = "Cloud SQL disk utilization > 75%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/disk/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.75
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.warning_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

resource "google_monitoring_alert_policy" "db_disk_critical" {
  display_name = "${var.name_prefix} Cloud SQL Disk > 90% (CRITICAL)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "CRITICAL"

  conditions {
    display_name = "Cloud SQL disk utilization > 90%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/disk/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.9
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.critical_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

# ── Alert: Redis Memory — WARNING >70%, CRITICAL >85% ────────────────────

resource "google_monitoring_alert_policy" "redis_memory_warning" {
  display_name = "${var.name_prefix} Redis Memory > 70% (WARNING)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "WARNING"

  conditions {
    display_name = "Redis memory usage ratio > 70%"
    condition_threshold {
      filter          = "resource.type = \"redis_instance\" AND resource.labels.instance_id = \"${var.redis_instance_id}\" AND metric.type = \"redis.googleapis.com/stats/memory/usage_ratio\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.7
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.warning_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

resource "google_monitoring_alert_policy" "redis_memory_critical" {
  display_name = "${var.name_prefix} Redis Memory > 85% (CRITICAL)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "CRITICAL"

  conditions {
    display_name = "Redis memory usage ratio > 85%"
    condition_threshold {
      filter          = "resource.type = \"redis_instance\" AND resource.labels.instance_id = \"${var.redis_instance_id}\" AND metric.type = \"redis.googleapis.com/stats/memory/usage_ratio\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.critical_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

# ── Alert: Worker at Max Scale (WARNING) ──────────────────────────────────

resource "google_monitoring_alert_policy" "worker_scaling" {
  display_name = "${var.name_prefix} Worker at Max Scale (WARNING)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "WARNING"

  conditions {
    display_name = "Worker instance count at maximum"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.worker_service_name}\" AND metric.type = \"run.googleapis.com/container/instance_count\""
      comparison      = "COMPARISON_GT"
      threshold_value = 4
      duration        = "600s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.warning_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

# ══════════════════════════════════════════════════════════════════════════════
# LOG-BASED METRICS
# ══════════════════════════════════════════════════════════════════════════════

resource "google_logging_metric" "app_errors" {
  count = var.enable_log_based_metrics ? 1 : 0

  name    = "${replace(var.name_prefix, "-", "_")}_app_errors"
  project = var.project_id
  filter  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.api_service_name}\" AND jsonPayload.level=\"ERROR\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "event"
      value_type  = "STRING"
      description = "Error event type"
    }
  }

  label_extractors = {
    "event" = "EXTRACT(jsonPayload.event)"
  }
}

resource "google_logging_metric" "slow_queries" {
  count = var.enable_log_based_metrics ? 1 : 0

  name    = "${replace(var.name_prefix, "-", "_")}_slow_queries"
  project = var.project_id
  filter  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.api_service_name}\" AND jsonPayload.event=\"slow_query\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"
  }

  value_extractor = "EXTRACT(jsonPayload.duration_ms)"

  bucket_options {
    exponential_buckets {
      num_finite_buckets = 10
      growth_factor      = 2
      scale              = 100 # Starts at 100ms
    }
  }
}

resource "google_logging_metric" "task_failures" {
  count = var.enable_log_based_metrics ? 1 : 0

  name    = "${replace(var.name_prefix, "-", "_")}_task_failures"
  project = var.project_id
  filter  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.worker_service_name}\" AND jsonPayload.event=\"task_failure\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
    labels {
      key         = "task_name"
      value_type  = "STRING"
      description = "Celery task name"
    }
  }

  label_extractors = {
    "task_name" = "EXTRACT(jsonPayload.task_name)"
  }
}

resource "google_logging_metric" "http_request_latency" {
  count = var.enable_log_based_metrics ? 1 : 0

  name    = "${replace(var.name_prefix, "-", "_")}_http_request_latency"
  project = var.project_id
  filter  = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${var.api_service_name}\" AND jsonPayload.event=\"http_request\""

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"
  }

  value_extractor = "EXTRACT(jsonPayload.duration_ms)"

  bucket_options {
    exponential_buckets {
      num_finite_buckets = 12
      growth_factor      = 2
      scale              = 10 # Starts at 10ms
    }
  }
}

# ── Alert: Application Errors Spike (from log-based metric) ───────────────

resource "google_monitoring_alert_policy" "app_error_spike" {
  count = var.enable_log_based_metrics ? 1 : 0

  display_name = "${var.name_prefix} Application Error Spike (CRITICAL)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "CRITICAL"

  conditions {
    display_name = "Application errors > 50 in 5 minutes"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND metric.type = \"logging.googleapis.com/user/${google_logging_metric.app_errors[0].name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 50
      duration        = "300s"

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.critical_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

# ── Alert: Celery Task Failures Spike ─────────────────────────────────────

resource "google_monitoring_alert_policy" "task_failure_spike" {
  count = var.enable_log_based_metrics ? 1 : 0

  display_name = "${var.name_prefix} Celery Task Failures > 10 (WARNING)"
  combiner     = "OR"
  project      = var.project_id
  severity     = "WARNING"

  conditions {
    display_name = "Task failures > 10 in 10 minutes"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND metric.type = \"logging.googleapis.com/user/${google_logging_metric.task_failures[0].name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 10
      duration        = "600s"

      aggregations {
        alignment_period     = "600s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger { count = 1 }
    }
  }

  notification_channels = local.warning_channels
  alert_strategy { auto_close = "1800s" }
  user_labels = var.labels
}

# ══════════════════════════════════════════════════════════════════════════════
# CUSTOM DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

resource "google_monitoring_dashboard" "hrms" {
  dashboard_json = jsonencode({
    displayName = "${var.name_prefix} HRMS Dashboard"
    gridLayout = {
      columns = 3
      widgets = [
        # Row 1: API Performance
        {
          title = "API Request Latency (p50/p95/p99)"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.api_service_name}\" AND metric.type = \"run.googleapis.com/request_latencies\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_PERCENTILE_50"
                    }
                  }
                }
                legendTemplate = "p50"
              },
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.api_service_name}\" AND metric.type = \"run.googleapis.com/request_latencies\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_PERCENTILE_95"
                    }
                  }
                }
                legendTemplate = "p95"
              },
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.api_service_name}\" AND metric.type = \"run.googleapis.com/request_latencies\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_PERCENTILE_99"
                    }
                  }
                }
                legendTemplate = "p99"
              }
            ]
          }
        },
        {
          title = "API Request Count by Status"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.api_service_name}\" AND metric.type = \"run.googleapis.com/request_count\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.labels.response_code_class"]
                    }
                  }
                }
              }
            ]
          }
        },
        {
          title = "API Instance Count"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.api_service_name}\" AND metric.type = \"run.googleapis.com/container/instance_count\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MAX"
                    }
                  }
                }
              }
            ]
          }
        },
        # Row 2: Database
        {
          title = "Cloud SQL CPU Utilization"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }
            ]
            thresholds = [
              { value = 0.7, label = "Warning", color = "YELLOW" },
              { value = 0.9, label = "Critical", color = "RED" }
            ]
          }
        },
        {
          title = "Cloud SQL Memory Utilization"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/memory/utilization\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }
            ]
            thresholds = [
              { value = 0.8, label = "Warning", color = "YELLOW" },
              { value = 0.92, label = "Critical", color = "RED" }
            ]
          }
        },
        {
          title = "Cloud SQL Active Connections"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/postgresql/num_backends\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }
            ]
          }
        },
        # Row 3: Redis & Workers
        {
          title = "Redis Memory Usage"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"redis_instance\" AND resource.labels.instance_id = \"${var.redis_instance_id}\" AND metric.type = \"redis.googleapis.com/stats/memory/usage_ratio\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }
            ]
            thresholds = [
              { value = 0.7, label = "Warning", color = "YELLOW" },
              { value = 0.85, label = "Critical", color = "RED" }
            ]
          }
        },
        {
          title = "Redis Cache Hit Ratio"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"redis_instance\" AND resource.labels.instance_id = \"${var.redis_instance_id}\" AND metric.type = \"redis.googleapis.com/stats/cache_hit_ratio\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }
            ]
          }
        },
        {
          title = "Worker Instance Count"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.worker_service_name}\" AND metric.type = \"run.googleapis.com/container/instance_count\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MAX"
                    }
                  }
                }
              }
            ]
          }
        },
        # Row 4: Application Metrics (log-based)
        {
          title = "Application Errors (from logs)"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloud_run_revision\" AND metric.type = \"logging.googleapis.com/user/${replace(var.name_prefix, "-", "_")}_app_errors\""
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
              }
            ]
          }
        },
        {
          title = "Celery Task Failures (from logs)"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloud_run_revision\" AND metric.type = \"logging.googleapis.com/user/${replace(var.name_prefix, "-", "_")}_task_failures\""
                    aggregation = {
                      alignmentPeriod    = "300s"
                      perSeriesAligner   = "ALIGN_SUM"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
              }
            ]
          }
        },
        {
          title = "Cloud SQL Disk Utilization"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/disk/utilization\""
                    aggregation = {
                      alignmentPeriod  = "60s"
                      perSeriesAligner = "ALIGN_MEAN"
                    }
                  }
                }
              }
            ]
            thresholds = [
              { value = 0.75, label = "Warning", color = "YELLOW" },
              { value = 0.9, label = "Critical", color = "RED" }
            ]
          }
        }
      ]
    }
  })

  project = var.project_id
}
