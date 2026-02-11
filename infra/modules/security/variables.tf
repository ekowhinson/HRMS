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

variable "labels" {
  type    = map(string)
  default = {}
}
