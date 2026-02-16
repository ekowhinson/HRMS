# ─────────────────────────────────────────────────────────────────────────────
# Secret Manager – Application Secrets
# ─────────────────────────────────────────────────────────────────────────────

locals {
  secrets = {
    "django-secret-key"  = "Django SECRET_KEY"
    "db-password"        = "Cloud SQL database password"
    "redis-auth"         = "Memorystore Redis AUTH string"
    "jwt-signing-key"    = "JWT token signing key"
    "anthropic-api-key"  = "Anthropic API key for AI features"
    "email-host-password" = "SMTP email password"
    "ldap-bind-password" = "LDAP bind password"
    "azure-client-secret" = "Azure AD client secret"
    "sendgrid-api-key"    = "SendGrid API key for transactional email"
  }

  # Both service accounts need read access (static keys for for_each)
  accessor_sa_keys = ["api", "worker"]
  accessor_sa_map = {
    "api"    = "serviceAccount:${var.api_sa_email}"
    "worker" = "serviceAccount:${var.worker_sa_email}"
  }
}

# ── Create Secrets ───────────────────────────────────────────────────────────

resource "google_secret_manager_secret" "secrets" {
  for_each  = local.secrets
  secret_id = "${var.name_prefix}-${each.key}"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = merge(var.labels, {
    description = replace(lower(each.value), " ", "-")
  })
}

# ── Grant Accessor Role ─────────────────────────────────────────────────────

resource "google_secret_manager_secret_iam_member" "accessor" {
  for_each = {
    for pair in setproduct(keys(local.secrets), local.accessor_sa_keys) :
    "${pair[0]}-${pair[1]}" => {
      secret_id = pair[0]
      member    = local.accessor_sa_map[pair[1]]
    }
  }

  secret_id = google_secret_manager_secret.secrets[each.value.secret_id].id
  role      = "roles/secretmanager.secretAccessor"
  member    = each.value.member
}
