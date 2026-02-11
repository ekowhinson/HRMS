output "media_bucket_name" {
  description = "Media bucket name"
  value       = google_storage_bucket.media.name
}

output "media_bucket_url" {
  description = "Media bucket URL"
  value       = google_storage_bucket.media.url
}

output "exports_bucket_name" {
  description = "Exports bucket name"
  value       = google_storage_bucket.exports.name
}

output "backups_bucket_name" {
  description = "Backups bucket name"
  value       = google_storage_bucket.backups.name
}
