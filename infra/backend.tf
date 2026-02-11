terraform {
  backend "gcs" {
    # Configured dynamically via -backend-config=environments/<env>/backend.hcl
    # Usage: terraform init -backend-config=environments/staging/backend.hcl
  }
}
