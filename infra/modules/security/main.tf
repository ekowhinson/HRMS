# ─────────────────────────────────────────────────────────────────────────────
# Security – IAM, Service Accounts, Cloud Armor WAF, Workload Identity
# ─────────────────────────────────────────────────────────────────────────────

# ── API Service Account ──────────────────────────────────────────────────────

resource "google_service_account" "api" {
  account_id   = "${var.name_prefix}-api-sa"
  display_name = "${var.name_prefix} API Service Account"
  project      = var.project_id
}

# ── Worker Service Account ───────────────────────────────────────────────────

resource "google_service_account" "worker" {
  account_id   = "${var.name_prefix}-worker-sa"
  display_name = "${var.name_prefix} Worker Service Account"
  project      = var.project_id
}

# ── API SA Roles ─────────────────────────────────────────────────────────────

locals {
  api_roles = [
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/storage.objectAdmin",
  ]

  worker_roles = [
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/storage.objectAdmin",
  ]
}

resource "google_project_iam_member" "api_roles" {
  for_each = toset(local.api_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.api.email}"
}

resource "google_project_iam_member" "worker_roles" {
  for_each = toset(local.worker_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.worker.email}"
}

# ── Cloud Armor WAF Policy ──────────────────────────────────────────────────

resource "google_compute_security_policy" "waf" {
  name    = "${var.name_prefix}-waf"
  project = var.project_id

  # Default rule: allow
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }

  # ── Basic rules (always enabled) ─────────────────────────────────────────

  # OWASP – SQL injection
  rule {
    action   = "deny(403)"
    priority = "1000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL injection attacks"
  }

  # OWASP – XSS
  rule {
    action   = "deny(403)"
    priority = "1001"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block XSS attacks"
  }

  # Rate limiting
  rule {
    action   = "rate_based_ban"
    priority = "2000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
      ban_duration_sec = 300
    }
    description = "Rate limit: 100 requests/minute per IP"
  }
}

# ── Full OWASP rules (production only) ──────────────────────────────────────

resource "google_compute_security_policy_rule" "lfi" {
  count           = var.waf_rules_level == "full" ? 1 : 0
  security_policy = google_compute_security_policy.waf.name
  project         = var.project_id
  action          = "deny(403)"
  priority        = 1002
  description     = "Block local file inclusion attacks"

  match {
    expr {
      expression = "evaluatePreconfiguredExpr('lfi-v33-stable')"
    }
  }
}

resource "google_compute_security_policy_rule" "rfi" {
  count           = var.waf_rules_level == "full" ? 1 : 0
  security_policy = google_compute_security_policy.waf.name
  project         = var.project_id
  action          = "deny(403)"
  priority        = 1003
  description     = "Block remote file inclusion attacks"

  match {
    expr {
      expression = "evaluatePreconfiguredExpr('rfi-v33-stable')"
    }
  }
}

resource "google_compute_security_policy_rule" "rce" {
  count           = var.waf_rules_level == "full" ? 1 : 0
  security_policy = google_compute_security_policy.waf.name
  project         = var.project_id
  action          = "deny(403)"
  priority        = 1004
  description     = "Block remote code execution attacks"

  match {
    expr {
      expression = "evaluatePreconfiguredExpr('rce-v33-stable')"
    }
  }
}

resource "google_compute_security_policy_rule" "bad_bots" {
  count           = var.waf_rules_level == "full" ? 1 : 0
  security_policy = google_compute_security_policy.waf.name
  project         = var.project_id
  action          = "deny(403)"
  priority        = 3000
  description     = "Block known malicious scanners"

  match {
    expr {
      expression = "has(request.headers['user-agent']) && request.headers['user-agent'].matches('(?i)(sqlmap|nikto|nmap|masscan|dirbuster)')"
    }
  }
}

# ── Workload Identity Federation (GitHub Actions) ───────────────────────────

resource "google_iam_workload_identity_pool" "github" {
  count                     = var.github_repo != "" ? 1 : 0
  workload_identity_pool_id = "${var.name_prefix}-github-pool"
  display_name              = "GitHub Actions Pool"
  project                   = var.project_id
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count                              = var.github_repo != "" ? 1 : 0
  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "${var.name_prefix}-github-provider"
  display_name                       = "GitHub Actions Provider"
  project                            = var.project_id

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  attribute_condition = "assertion.repository == '${var.github_repo}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

# ── CI/CD Service Account ───────────────────────────────────────────────────

resource "google_service_account" "cicd" {
  count        = var.github_repo != "" ? 1 : 0
  account_id   = "${var.name_prefix}-cicd-sa"
  display_name = "${var.name_prefix} CI/CD Service Account"
  project      = var.project_id
}

resource "google_project_iam_member" "cicd_roles" {
  for_each = var.github_repo != "" ? toset([
    "roles/run.developer",
    "roles/artifactregistry.writer",
    "roles/iam.serviceAccountUser",
  ]) : toset([])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cicd[0].email}"
}

resource "google_service_account_iam_member" "cicd_workload_identity" {
  count              = var.github_repo != "" ? 1 : 0
  service_account_id = google_service_account.cicd[0].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repo}"
}
