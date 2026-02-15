output "instance_name" {
  description = "Ollama GCE instance name"
  value       = google_compute_instance.ollama.name
}

output "private_ip" {
  description = "Ollama GCE instance private IP"
  value       = google_compute_instance.ollama.network_interface[0].network_ip
}

output "ollama_base_url" {
  description = "Ollama API base URL for internal services"
  value       = "http://${google_compute_instance.ollama.network_interface[0].network_ip}:11434"
}
