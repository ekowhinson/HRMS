# ─────────────────────────────────────────────────────────────────────────────
# Frontend CDN – GCS + Cloud CDN + HTTPS Load Balancer
# ─────────────────────────────────────────────────────────────────────────────

# ── Frontend Bucket ──────────────────────────────────────────────────────────

resource "google_storage_bucket" "frontend" {
  name          = "${var.name_prefix}-frontend"
  location      = var.location
  project       = var.project_id
  force_destroy = false

  uniform_bucket_level_access = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html" # SPA fallback
  }

  cors {
    origin          = ["https://${var.domain}"]
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Cache-Control"]
    max_age_seconds = 3600
  }

  labels = var.labels
}

# ── Public read access for frontend assets ───────────────────────────────────

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.frontend.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# ── Backend Bucket for CDN ───────────────────────────────────────────────────

resource "google_compute_backend_bucket" "frontend" {
  name        = "${var.name_prefix}-frontend-backend"
  bucket_name = google_storage_bucket.frontend.name
  project     = var.project_id
  enable_cdn  = true

  cdn_policy {
    cache_mode                   = "CACHE_ALL_STATIC"
    default_ttl                  = 3600
    max_ttl                      = 86400
    client_ttl                   = 3600
    serve_while_stale            = 86400
    signed_url_cache_max_age_sec = 0

    cache_key_policy {
      include_http_headers = []
    }
  }
}

# ── Global Static IP ────────────────────────────────────────────────────────

resource "google_compute_global_address" "frontend" {
  name    = "${var.name_prefix}-frontend-ip"
  project = var.project_id
}

# ── Managed SSL Certificate ─────────────────────────────────────────────────

resource "google_compute_managed_ssl_certificate" "frontend" {
  count   = length(var.ssl_certificate_domains) > 0 ? 1 : 0
  name    = "${var.name_prefix}-frontend-cert"
  project = var.project_id

  managed {
    domains = var.ssl_certificate_domains
  }
}

# ── URL Map ──────────────────────────────────────────────────────────────────

resource "google_compute_url_map" "frontend" {
  name            = "${var.name_prefix}-frontend-urlmap"
  project         = var.project_id
  default_service = google_compute_backend_bucket.frontend.id
}

# ── HTTPS Redirect URL Map ──────────────────────────────────────────────────

resource "google_compute_url_map" "https_redirect" {
  name    = "${var.name_prefix}-https-redirect"
  project = var.project_id

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

# ── HTTPS Target Proxy ──────────────────────────────────────────────────────

resource "google_compute_target_https_proxy" "frontend" {
  count   = length(var.ssl_certificate_domains) > 0 ? 1 : 0
  name    = "${var.name_prefix}-frontend-https"
  project = var.project_id
  url_map = google_compute_url_map.frontend.id

  ssl_certificates = [google_compute_managed_ssl_certificate.frontend[0].id]
}

# ── HTTP Target Proxy (redirect to HTTPS) ────────────────────────────────────

resource "google_compute_target_http_proxy" "redirect" {
  name    = "${var.name_prefix}-http-redirect"
  project = var.project_id
  url_map = google_compute_url_map.https_redirect.id
}

# ── HTTPS Forwarding Rule ───────────────────────────────────────────────────

resource "google_compute_global_forwarding_rule" "https" {
  count      = length(var.ssl_certificate_domains) > 0 ? 1 : 0
  name       = "${var.name_prefix}-frontend-https-rule"
  project    = var.project_id
  target     = google_compute_target_https_proxy.frontend[0].id
  port_range = "443"
  ip_address = google_compute_global_address.frontend.address
}

# ── HTTP Forwarding Rule (redirect) ─────────────────────────────────────────

resource "google_compute_global_forwarding_rule" "http_redirect" {
  name       = "${var.name_prefix}-frontend-http-redirect"
  project    = var.project_id
  target     = google_compute_target_http_proxy.redirect.id
  port_range = "80"
  ip_address = google_compute_global_address.frontend.address
}
