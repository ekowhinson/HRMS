variable "project_id" {
  description = "GCP project ID"
  type        = string
  default     = "erp-hr-pay-staging"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "GCP zone (must have T4 GPU availability)"
  type        = string
  default     = "us-central1-a"
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
  description = "Number of GPUs"
  type        = number
  default     = 1
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 50
}

variable "ollama_models" {
  description = "Models to pull on startup"
  type        = list(string)
  default     = ["llama3.1", "llava"]
}

variable "vpc_connector_cidr" {
  description = "CIDR of the existing VPC connector (for firewall rule)"
  type        = string
  default     = "10.8.0.0/28"
}

variable "labels" {
  description = "Resource labels"
  type        = map(string)
  default = {
    environment  = "staging"
    managed_by   = "terraform"
    purpose      = "ai-assistant"
  }
}
