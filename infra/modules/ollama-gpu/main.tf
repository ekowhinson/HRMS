# ─────────────────────────────────────────────────────────────────────────────
# GCE VM – Ollama LLM with GPU
# ─────────────────────────────────────────────────────────────────────────────

resource "google_compute_instance" "ollama" {
  name         = "${var.name_prefix}-ollama"
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
    subnetwork = var.subnet_id
    # No access_config — no external IP; outbound via Cloud NAT
  }

  guest_accelerator {
    type  = var.gpu_type
    count = var.gpu_count
  }

  scheduling {
    on_host_maintenance = "TERMINATE"
    automatic_restart   = true
  }

  service_account {
    email  = var.service_account_email
    scopes = ["cloud-platform"]
  }

  metadata_startup_script = <<-SCRIPT
    #!/bin/bash
    set -e

    # Install NVIDIA drivers
    apt-get update
    apt-get install -y linux-headers-$(uname -r)
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    apt-get install -y nvidia-driver-535

    # Install Ollama
    curl -fsSL https://ollama.com/install.sh | sh

    # Configure Ollama to listen on all interfaces
    mkdir -p /etc/systemd/system/ollama.service.d
    cat > /etc/systemd/system/ollama.service.d/override.conf <<EOF
    [Service]
    Environment="OLLAMA_HOST=0.0.0.0"
    EOF

    systemctl daemon-reload
    systemctl enable ollama
    systemctl start ollama

    # Wait for Ollama to be ready, then pull models
    sleep 10
    %{for model in var.ollama_models~}
    ollama pull ${model}
    %{endfor~}
  SCRIPT

  lifecycle {
    ignore_changes = [metadata_startup_script]
  }
}
