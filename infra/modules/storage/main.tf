# ─────────────────────────────────────────────────────────────────────────────
# Cloud Storage – Media, Exports, Backups Buckets
# ─────────────────────────────────────────────────────────────────────────────

# ── Media Bucket (employee photos, documents, imports) ───────────────────────

resource "google_storage_bucket" "media" {
  name          = "${var.name_prefix}-media"
  location      = var.location
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = var.lifecycle_age
    }
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST"]
    response_header = ["Content-Type", "Content-Disposition"]
    max_age_seconds = 3600
  }

  labels = var.labels
}

# ── Exports Bucket (generated reports, async exports) ────────────────────────

resource "google_storage_bucket" "exports" {
  name          = "${var.name_prefix}-exports"
  location      = var.location
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 7 # Auto-delete exports after 7 days
    }
    action {
      type = "Delete"
    }
  }

  labels = var.labels
}

# ── Backups Bucket (database exports, manual backups) ────────────────────────

resource "google_storage_bucket" "backups" {
  name          = "${var.name_prefix}-backups"
  location      = var.location
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  labels = var.labels
}

# ── IAM Bindings ─────────────────────────────────────────────────────────────

resource "google_storage_bucket_iam_member" "media_api" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.api_sa_email}"
}

resource "google_storage_bucket_iam_member" "media_worker" {
  bucket = google_storage_bucket.media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.worker_sa_email}"
}

resource "google_storage_bucket_iam_member" "exports_api" {
  bucket = google_storage_bucket.exports.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.api_sa_email}"
}

resource "google_storage_bucket_iam_member" "exports_worker" {
  bucket = google_storage_bucket.exports.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.worker_sa_email}"
}

resource "google_storage_bucket_iam_member" "backups_worker" {
  bucket = google_storage_bucket.backups.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${var.worker_sa_email}"
}
