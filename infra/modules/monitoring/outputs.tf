output "notification_channel_id" {
  description = "Email notification channel ID"
  value       = google_monitoring_notification_channel.email.name
}

output "slack_channel_id" {
  description = "Slack notification channel ID (empty if not configured)"
  value       = var.slack_webhook_url != "" ? google_monitoring_notification_channel.slack[0].name : ""
}

output "dashboard_id" {
  description = "Monitoring dashboard ID"
  value       = google_monitoring_dashboard.hrms.id
}

output "liveness_check_id" {
  description = "API liveness uptime check ID"
  value       = google_monitoring_uptime_check_config.api_liveness.uptime_check_id
}

output "readiness_check_id" {
  description = "API readiness uptime check ID"
  value       = google_monitoring_uptime_check_config.api_readiness.uptime_check_id
}
