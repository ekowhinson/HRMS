output "redis_host" {
  description = "Redis instance host IP"
  value       = google_redis_instance.primary.host
  sensitive   = true
}

output "redis_port" {
  description = "Redis instance port"
  value       = google_redis_instance.primary.port
}

output "instance_id" {
  description = "Redis instance ID"
  value       = google_redis_instance.primary.name
}

output "auth_string" {
  description = "Redis AUTH string"
  value       = google_redis_instance.primary.auth_string
  sensitive   = true
}
