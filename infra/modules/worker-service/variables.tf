variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "image" {
  description = "Container image URI"
  type        = string
}

variable "service_account" {
  description = "Service account email"
  type        = string
}

variable "vpc_connector_id" {
  description = "VPC connector for private network access"
  type        = string
}

variable "db_connection_name" {
  description = "Cloud SQL connection name"
  type        = string
}

variable "db_private_ip" {
  description = "Cloud SQL private IP"
  type        = string
}

variable "redis_host" {
  description = "Memorystore Redis host"
  type        = string
}

variable "redis_port" {
  description = "Memorystore Redis port"
  type        = number
}

variable "secret_ids" {
  description = "Map of secret names to Secret Manager IDs"
  type        = map(string)
}

variable "cpu" {
  type    = string
  default = "2"
}

variable "memory" {
  type    = string
  default = "2Gi"
}

variable "min_instances" {
  type    = number
  default = 1
}

variable "max_instances" {
  type    = number
  default = 5
}

variable "timeout" {
  type    = number
  default = 3600
}

variable "environment" {
  description = "Deployment environment"
  type        = string
}

variable "media_bucket" {
  description = "GCS media bucket name"
  type        = string
}

variable "ollama_base_url" {
  description = "Ollama LLM API base URL"
  type        = string
  default     = "http://localhost:11434"
}

variable "labels" {
  type    = map(string)
  default = {}
}
