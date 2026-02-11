output "connection_name" {
  description = "Cloud SQL connection name (project:region:instance)"
  value       = google_sql_database_instance.primary.connection_name
}

output "private_ip" {
  description = "Private IP address of the Cloud SQL instance"
  value       = google_sql_database_instance.primary.private_ip_address
  sensitive   = true
}

output "instance_id" {
  description = "Cloud SQL instance ID"
  value       = google_sql_database_instance.primary.name
}

output "database_name" {
  description = "Database name"
  value       = google_sql_database.hrms.name
}

output "db_user" {
  description = "Database application user"
  value       = google_sql_user.app.name
}

output "db_password" {
  description = "Database application password"
  value       = random_password.db_password.result
  sensitive   = true
}
