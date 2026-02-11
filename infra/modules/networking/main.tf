# ─────────────────────────────────────────────────────────────────────────────
# Networking – VPC, Subnets, NAT, VPC Connector, Private Service Access
# ─────────────────────────────────────────────────────────────────────────────

# ── VPC ──────────────────────────────────────────────────────────────────────

resource "google_compute_network" "vpc" {
  name                    = "${var.name_prefix}-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
  project                 = var.project_id
}

# ── Primary Subnet ───────────────────────────────────────────────────────────

resource "google_compute_subnetwork" "primary" {
  name          = "${var.name_prefix}-subnet-primary"
  ip_cidr_range = var.vpc_cidr
  region        = var.region
  network       = google_compute_network.vpc.id
  project       = var.project_id

  secondary_ip_range {
    range_name    = "${var.name_prefix}-pods"
    ip_cidr_range = var.secondary_pods_cidr
  }

  secondary_ip_range {
    range_name    = "${var.name_prefix}-services"
    ip_cidr_range = var.secondary_services_cidr
  }

  private_ip_google_access = true

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# ── Cloud NAT (for outbound internet from private resources) ─────────────────

resource "google_compute_router" "router" {
  name    = "${var.name_prefix}-router"
  region  = var.region
  network = google_compute_network.vpc.id
  project = var.project_id
}

resource "google_compute_router_nat" "nat" {
  name                               = "${var.name_prefix}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  project                            = var.project_id
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}

# ── Private Service Access (Cloud SQL, Memorystore) ─────────────────────────

resource "google_compute_global_address" "private_ip_range" {
  name          = "${var.name_prefix}-private-ip"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
  project       = var.project_id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# ── Serverless VPC Connector (Cloud Run → VPC) ──────────────────────────────

resource "google_vpc_access_connector" "connector" {
  name          = "${var.name_prefix}-conn"
  region        = var.region
  project       = var.project_id
  ip_cidr_range = var.serverless_connector_cidr
  network       = google_compute_network.vpc.name

  min_instances = 2
  max_instances = 10

  machine_type = "e2-micro"
}

# ── Firewall Rules ──────────────────────────────────────────────────────────

resource "google_compute_firewall" "allow_internal" {
  name    = "${var.name_prefix}-allow-internal"
  network = google_compute_network.vpc.name
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [var.vpc_cidr, var.serverless_connector_cidr]
  direction     = "INGRESS"
  priority      = 1000
}

resource "google_compute_firewall" "deny_all_ingress" {
  name    = "${var.name_prefix}-deny-all-ingress"
  network = google_compute_network.vpc.name
  project = var.project_id

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
  direction     = "INGRESS"
  priority      = 65534
}
