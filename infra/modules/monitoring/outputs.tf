output "notification_channel_id" {
  description = "Monitoring notification channel ID"
  value       = google_monitoring_notification_channel.email.name
}

output "dashboard_id" {
  description = "Monitoring dashboard ID"
  value       = google_monitoring_dashboard.hrms.id
}

output "uptime_check_id" {
  description = "API uptime check ID"
  value       = google_monitoring_uptime_check_config.api_health.uptime_check_id
}
