# ─────────────────────────────────────────────────────────────────────────────
# Artifact Registry – Docker Container Repository
# ─────────────────────────────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = "${var.name_prefix}-docker"
  description   = "Docker images for NHIA HRMS"
  format        = "DOCKER"
  project       = var.project_id

  cleanup_policies {
    id     = "keep-recent"
    action = "KEEP"

    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"

    condition {
      tag_state  = "UNTAGGED"
      older_than = "604800s" # 7 days
    }
  }

  labels = var.labels
}
