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

variable "domain" {
  description = "Application domain for uptime checks"
  type        = string
}

variable "uptime_check_path" {
  description = "Health check path"
  type        = string
  default     = "/api/v1/core/health/"
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

variable "labels" {
  type    = map(string)
  default = {}
}
