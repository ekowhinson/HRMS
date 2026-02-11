output "api_service_account_email" {
  description = "API service account email"
  value       = google_service_account.api.email
}

output "worker_service_account_email" {
  description = "Worker service account email"
  value       = google_service_account.worker.email
}

output "policy_id" {
  description = "Cloud Armor WAF policy ID"
  value       = google_compute_security_policy.waf.id
}

output "policy_name" {
  description = "Cloud Armor WAF policy name"
  value       = google_compute_security_policy.waf.name
}

output "cicd_service_account_email" {
  description = "CI/CD service account email"
  value       = var.github_repo != "" ? google_service_account.cicd[0].email : ""
}

output "workload_identity_provider" {
  description = "Workload Identity provider name for GitHub Actions"
  value       = var.github_repo != "" ? google_iam_workload_identity_pool_provider.github[0].name : ""
}
