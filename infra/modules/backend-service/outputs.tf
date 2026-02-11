output "service_url" {
  description = "Cloud Run API service URL"
  value       = google_cloud_run_v2_service.api.uri
}

output "service_name" {
  description = "Cloud Run API service name"
  value       = google_cloud_run_v2_service.api.name
}

output "service_id" {
  description = "Cloud Run API service ID"
  value       = google_cloud_run_v2_service.api.id
}
