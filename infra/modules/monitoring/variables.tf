variable "project_id" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "notification_email" {
  description = "Email for alert notifications"
  type        = string
}

variable "slack_webhook_url" {
  description = "Slack webhook URL for critical alerts (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "domain" {
  description = "Application domain for uptime checks"
  type        = string
}

variable "uptime_check_path" {
  description = "Health check path"
  type        = string
  default     = "/healthz/"
}

variable "readiness_check_path" {
  description = "Readiness check path"
  type        = string
  default     = "/readyz/"
}

variable "api_service_name" {
  description = "Cloud Run API service name"
  type        = string
}

variable "worker_service_name" {
  description = "Cloud Run worker service name"
  type        = string
}

variable "db_instance_id" {
  description = "Cloud SQL instance ID"
  type        = string
}

variable "redis_instance_id" {
  description = "Memorystore Redis instance ID"
  type        = string
}

variable "enable_log_based_metrics" {
  description = "Create log-based metrics for application errors and slow queries"
  type        = bool
  default     = true
}

variable "labels" {
  type    = map(string)
  default = {}
}
