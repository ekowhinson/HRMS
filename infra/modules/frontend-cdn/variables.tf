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

variable "domain" {
  description = "Application domain"
  type        = string
}

variable "ssl_certificate_domains" {
  description = "Domains for managed SSL certificate"
  type        = list(string)
  default     = []
}

variable "security_policy" {
  description = "Cloud Armor security policy ID"
  type        = string
  default     = ""
}

variable "labels" {
  type    = map(string)
  default = {}
}
