variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "zone" {
  description = "GCE zone (must have GPU availability)"
  type        = string
  default     = "us-central1-a"
}

variable "name_prefix" {
  description = "Resource name prefix"
  type        = string
}

variable "network_id" {
  description = "VPC network ID"
  type        = string
}

variable "subnet_id" {
  description = "VPC subnet ID"
  type        = string
}

variable "service_account_email" {
  description = "Service account email for the GCE instance"
  type        = string
}

variable "machine_type" {
  description = "GCE machine type"
  type        = string
  default     = "n1-standard-4"
}

variable "gpu_type" {
  description = "GPU accelerator type"
  type        = string
  default     = "nvidia-tesla-t4"
}

variable "gpu_count" {
  description = "Number of GPUs to attach"
  type        = number
  default     = 1
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 50
}

variable "ollama_models" {
  description = "Ollama models to pre-pull on startup"
  type        = list(string)
  default     = ["llama3.1", "llava"]
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default     = {}
}
