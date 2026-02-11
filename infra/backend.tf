terraform {
  backend "gcs" {
    bucket = "nhia-hrms-terraform-state"
    prefix = "terraform/state"
    # State locking is automatic with GCS backend
  }
}
