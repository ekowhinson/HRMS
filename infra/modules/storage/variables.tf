variable "project_id" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "location" {
  description = "GCS bucket location"
  type        = string
  default     = "US"
}

variable "lifecycle_age" {
  description = "Days before transitioning to Nearline"
  type        = number
  default     = 90
}

variable "api_sa_email" {
  description = "API service account email"
  type        = string
}

variable "worker_sa_email" {
  description = "Worker service account email"
  type        = string
}

variable "labels" {
  type    = map(string)
  default = {}
}
