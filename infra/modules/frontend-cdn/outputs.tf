output "bucket_name" {
  description = "Frontend GCS bucket name"
  value       = google_storage_bucket.frontend.name
}

output "ip_address" {
  description = "Global static IP address for the CDN load balancer"
  value       = google_compute_global_address.frontend.address
}

output "cdn_url" {
  description = "CDN URL"
  value       = length(var.ssl_certificate_domains) > 0 ? "https://${var.domain}" : "http://${google_compute_global_address.frontend.address}"
}
