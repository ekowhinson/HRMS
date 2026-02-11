output "network_id" {
  description = "VPC network self-link"
  value       = google_compute_network.vpc.id
}

output "network_name" {
  description = "VPC network name"
  value       = google_compute_network.vpc.name
}

output "subnet_id" {
  description = "Primary subnet self-link"
  value       = google_compute_subnetwork.primary.id
}

output "vpc_connector_id" {
  description = "Serverless VPC connector ID"
  value       = google_vpc_access_connector.connector.id
}

output "private_ip_range_name" {
  description = "Private IP range name for service networking"
  value       = google_compute_global_address.private_ip_range.name
}
