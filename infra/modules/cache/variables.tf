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
  description = "VPC network ID"
  type        = string
}

variable "memory_size_gb" {
  description = "Redis memory in GB"
  type        = number
  default     = 2
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "REDIS_7_0"
}

variable "tier" {
  description = "BASIC or STANDARD_HA"
  type        = string
  default     = "STANDARD_HA"
}

variable "labels" {
  type    = map(string)
  default = {}
}
