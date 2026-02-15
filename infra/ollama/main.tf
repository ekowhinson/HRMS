# ─────────────────────────────────────────────────────────────────────────────
# Ollama GPU VM – Standalone deployment for AI Assistant LLM
# Uses existing default VPC/subnet in erp-hr-pay-staging
# ─────────────────────────────────────────────────────────────────────────────

terraform {
  required_version = ">= 1.5"

  backend "gcs" {}

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.30"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# ── Data sources: look up existing infrastructure ────────────────────────────

data "google_compute_network" "default" {
  name    = "default"
  project = var.project_id
}

data "google_compute_subnetwork" "default" {
  name    = "default"
  region  = var.region
  project = var.project_id
}

data "google_project" "current" {
  project_id = var.project_id
}

# ── GCE Instance with T4 GPU ────────────────────────────────────────────────

resource "google_compute_instance" "ollama" {
  name         = "${var.project_id}-ollama"
  machine_type = var.machine_type
  zone         = var.zone
  project      = var.project_id

  tags   = ["ollama"]
  labels = var.labels

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = var.disk_size_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = data.google_compute_subnetwork.default.self_link

    # Ephemeral external IP for downloading drivers/models
    # (no Cloud NAT on default VPC)
    access_config {}
  }

  guest_accelerator {
    type  = var.gpu_type
    count = var.gpu_count
  }

  scheduling {
    on_host_maintenance = "TERMINATE"
    automatic_restart   = false
    preemptible         = true
  }

  # Use default compute service account
  service_account {
    email  = "${data.google_project.current.number}-compute@developer.gserviceaccount.com"
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = <<-SCRIPT
    #!/bin/bash
    set -euo pipefail
    exec > /var/log/ollama-setup.log 2>&1

    echo "=== Starting Ollama GPU setup ==="

    # Install NVIDIA GPU drivers using Google's recommended method
    apt-get update -y
    apt-get install -y python3-pip linux-headers-$(uname -r)
    curl -fsSL https://raw.githubusercontent.com/GoogleCloudPlatform/compute-gpu-installation/main/linux/install_gpu_driver.py \
      -o /tmp/install_gpu_driver.py
    python3 /tmp/install_gpu_driver.py

    echo "=== NVIDIA drivers installed ==="
    nvidia-smi || true

    # Install Ollama
    curl -fsSL https://ollama.com/install.sh | sh

    # Configure Ollama to listen on all interfaces (for VPC access)
    mkdir -p /etc/systemd/system/ollama.service.d
    cat > /etc/systemd/system/ollama.service.d/override.conf <<EOF
    [Service]
    Environment="OLLAMA_HOST=0.0.0.0"
    EOF

    systemctl daemon-reload
    systemctl enable ollama
    systemctl restart ollama

    # Wait for Ollama to be ready
    echo "=== Waiting for Ollama to start ==="
    for i in $(seq 1 30); do
      if curl -sf http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "Ollama is ready"
        break
      fi
      sleep 5
    done

    # Pull models (HOME required by ollama CLI)
    export HOME=/root
    %{for model in var.ollama_models~}
    echo "=== Pulling model: ${model} ==="
    ollama pull ${model}
    %{endfor~}

    echo "=== Ollama setup complete ==="
  SCRIPT

  lifecycle {
    ignore_changes = [metadata_startup_script]
  }
}

# ── Firewall: allow VPC connector → Ollama port 11434 ───────────────────────
# The default-allow-internal rule covers 10.128.0.0/9 but the VPC connector
# uses 10.8.0.0/28, which is outside that range.

resource "google_compute_firewall" "allow_cloudrun_to_ollama" {
  name    = "allow-cloudrun-to-ollama"
  network = data.google_compute_network.default.self_link
  project = var.project_id

  allow {
    protocol = "tcp"
    ports    = ["11434"]
  }

  source_ranges = [var.vpc_connector_cidr]
  target_tags   = ["ollama"]

  description = "Allow Cloud Run (via VPC connector) to reach Ollama on port 11434"
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "instance_name" {
  value = google_compute_instance.ollama.name
}

output "private_ip" {
  value = google_compute_instance.ollama.network_interface[0].network_ip
}

output "ollama_base_url" {
  value = "http://${google_compute_instance.ollama.network_interface[0].network_ip}:11434"
}
