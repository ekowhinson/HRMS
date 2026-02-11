# ─────────────────────────────────────────────────────────────────────────────
# Monitoring – Uptime Checks, Alert Policies, Notification Channels
# ─────────────────────────────────────────────────────────────────────────────

# ── Notification Channel (Email) ─────────────────────────────────────────────

resource "google_monitoring_notification_channel" "email" {
  display_name = "${var.name_prefix} Alerts"
  type         = "email"
  project      = var.project_id

  labels = {
    email_address = var.notification_email
  }
}

# ── Uptime Check (API Health) ────────────────────────────────────────────────

resource "google_monitoring_uptime_check_config" "api_health" {
  display_name = "${var.name_prefix} API Health"
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

# ── Alert: API Uptime Failure ────────────────────────────────────────────────

resource "google_monitoring_alert_policy" "uptime_failure" {
  display_name = "${var.name_prefix} API Uptime Failure"
  combiner     = "OR"
  project      = var.project_id

  conditions {
    display_name = "Uptime check failure"
    condition_threshold {
      filter          = "resource.type = \"uptime_url\" AND metric.type = \"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.labels.check_id = \"${google_monitoring_uptime_check_config.api_health.uptime_check_id}\""
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

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# ── Alert: Cloud Run High Latency (API > 5s p95) ────────────────────────────

resource "google_monitoring_alert_policy" "api_high_latency" {
  display_name = "${var.name_prefix} API High Latency (>5s p95)"
  combiner     = "OR"
  project      = var.project_id

  conditions {
    display_name = "Cloud Run request latency > 5s"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.api_service_name}\" AND metric.type = \"run.googleapis.com/request_latencies\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5000 # 5 seconds in ms
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

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# ── Alert: Cloud Run High Error Rate (API > 5% 5xx) ─────────────────────────

resource "google_monitoring_alert_policy" "api_error_rate" {
  display_name = "${var.name_prefix} API Error Rate > 5%"
  combiner     = "OR"
  project      = var.project_id

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

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# ── Alert: Cloud SQL High CPU (> 80%) ────────────────────────────────────────

resource "google_monitoring_alert_policy" "db_high_cpu" {
  display_name = "${var.name_prefix} Cloud SQL CPU > 80%"
  combiner     = "OR"
  project      = var.project_id

  conditions {
    display_name = "Cloud SQL CPU utilization > 80%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/cpu/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# ── Alert: Cloud SQL High Memory (> 90%) ─────────────────────────────────────

resource "google_monitoring_alert_policy" "db_high_memory" {
  display_name = "${var.name_prefix} Cloud SQL Memory > 90%"
  combiner     = "OR"
  project      = var.project_id

  conditions {
    display_name = "Cloud SQL memory utilization > 90%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/memory/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.9
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# ── Alert: Cloud SQL Disk > 85% ─────────────────────────────────────────────

resource "google_monitoring_alert_policy" "db_disk_usage" {
  display_name = "${var.name_prefix} Cloud SQL Disk > 85%"
  combiner     = "OR"
  project      = var.project_id

  conditions {
    display_name = "Cloud SQL disk utilization > 85%"
    condition_threshold {
      filter          = "resource.type = \"cloudsql_database\" AND resource.labels.database_id = \"${var.project_id}:${var.db_instance_id}\" AND metric.type = \"cloudsql.googleapis.com/database/disk/utilization\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.85
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# ── Alert: Redis High Memory (> 80%) ────────────────────────────────────────

resource "google_monitoring_alert_policy" "redis_high_memory" {
  display_name = "${var.name_prefix} Redis Memory > 80%"
  combiner     = "OR"
  project      = var.project_id

  conditions {
    display_name = "Redis memory usage ratio > 80%"
    condition_threshold {
      filter          = "resource.type = \"redis_instance\" AND resource.labels.instance_id = \"${var.redis_instance_id}\" AND metric.type = \"redis.googleapis.com/stats/memory/usage_ratio\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8
      duration        = "300s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# ── Alert: Worker Instance Count at Max ──────────────────────────────────────

resource "google_monitoring_alert_policy" "worker_scaling" {
  display_name = "${var.name_prefix} Worker at Max Scale"
  combiner     = "OR"
  project      = var.project_id

  conditions {
    display_name = "Worker instance count at maximum"
    condition_threshold {
      filter          = "resource.type = \"cloud_run_revision\" AND resource.labels.service_name = \"${var.worker_service_name}\" AND metric.type = \"run.googleapis.com/container/instance_count\""
      comparison      = "COMPARISON_GT"
      threshold_value = 4 # Alert before hitting max of 5
      duration        = "600s"

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MAX"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.name]

  alert_strategy {
    auto_close = "1800s"
  }

  user_labels = var.labels
}

# ── Custom Dashboard ─────────────────────────────────────────────────────────

resource "google_monitoring_dashboard" "hrms" {
  dashboard_json = jsonencode({
    displayName = "${var.name_prefix} HRMS Dashboard"
    gridLayout = {
      columns = 3
      widgets = [
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
        }
      ]
    }
  })

  project = var.project_id
}
