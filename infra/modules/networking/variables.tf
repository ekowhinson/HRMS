variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "name_prefix" {
  type = string
}

variable "vpc_cidr" {
  type = string
}

variable "secondary_pods_cidr" {
  type = string
}

variable "secondary_services_cidr" {
  type = string
}

variable "serverless_connector_cidr" {
  type = string
}

variable "labels" {
  type    = map(string)
  default = {}
}
