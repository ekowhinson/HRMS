output "service_name" {
  description = "Cloud Run Celery worker service name"
  value       = google_cloud_run_v2_service.worker.name
}

output "service_id" {
  description = "Cloud Run Celery worker service ID"
  value       = google_cloud_run_v2_service.worker.id
}
