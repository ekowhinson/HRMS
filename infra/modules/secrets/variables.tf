variable "project_id" {
  type = string
}

variable "name_prefix" {
  type = string
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
