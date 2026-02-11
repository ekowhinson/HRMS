variable "project_id" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "github_repo" {
  description = "GitHub repository for Workload Identity Federation (owner/repo)"
  type        = string
  default     = ""
}

variable "waf_rules_level" {
  description = "WAF rules level: basic (SQLi + XSS + rate limit) or full (all OWASP rules)"
  type        = string
  default     = "full"
}

variable "labels" {
  type    = map(string)
  default = {}
}
