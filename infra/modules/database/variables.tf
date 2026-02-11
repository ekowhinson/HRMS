variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "network_id" {
  description = "VPC network ID for private IP"
  type        = string
}

variable "private_ip_range_name" {
  description = "Private IP range name for peering"
  type        = string
}

variable "tier" {
  description = "Cloud SQL machine type"
  type        = string
  default     = "db-custom-4-16384"
}

variable "disk_size" {
  description = "Disk size in GB"
  type        = number
  default     = 100
}

variable "disk_autoresize_limit" {
  description = "Maximum disk auto-resize in GB"
  type        = number
  default     = 500
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "hrms"
}

variable "availability_type" {
  description = "REGIONAL for HA, ZONAL for single-zone"
  type        = string
  default     = "REGIONAL"
}

variable "backup_enabled" {
  type    = bool
  default = true
}

variable "point_in_time_recovery" {
  type    = bool
  default = true
}

variable "maintenance_window_day" {
  type    = number
  default = 7
}

variable "maintenance_window_hour" {
  type    = number
  default = 3
}

variable "deletion_protection" {
  type    = bool
  default = true
}

variable "labels" {
  type    = map(string)
  default = {}
}
