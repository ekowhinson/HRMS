#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NHIA HRMS – GCP Bootstrap Script
# Idempotent: safe to run multiple times.
#
# Prerequisites:
#   - gcloud CLI installed and authenticated
#   - Billing account linked to organization
#
# Usage:
#   ./bootstrap.sh                         # Interactive (prompts for values)
#   ./bootstrap.sh --org-id 123456789 \
#     --billing-account 012345-6789AB-CDEF01 \
#     --github-repo nhia/hrms \
#     --region us-central1
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Color helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; }

# ── Configuration ────────────────────────────────────────────────────────────

PROJECT_PREFIX="nhia-hrms"
ENVIRONMENTS=("staging" "production")
REGION="us-central1"
ORG_ID=""
BILLING_ACCOUNT=""
GITHUB_REPO=""
TF_SA_NAME="terraform"

# ── Parse arguments ──────────────────────────────────────────────────────────

while [[ $# -gt 0 ]]; do
  case $1 in
    --org-id)         ORG_ID="$2"; shift 2 ;;
    --billing-account) BILLING_ACCOUNT="$2"; shift 2 ;;
    --github-repo)    GITHUB_REPO="$2"; shift 2 ;;
    --region)         REGION="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--org-id ID] [--billing-account ID] [--github-repo owner/repo] [--region REGION]"
      exit 0
      ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Interactive prompts for missing values ───────────────────────────────────

if [[ -z "$ORG_ID" ]]; then
  read -rp "GCP Organization ID (or leave blank for no org): " ORG_ID
fi

if [[ -z "$BILLING_ACCOUNT" ]]; then
  read -rp "GCP Billing Account ID (e.g., 012345-6789AB-CDEF01): " BILLING_ACCOUNT
fi

if [[ -z "$GITHUB_REPO" ]]; then
  read -rp "GitHub repository (e.g., nhia/hrms, or blank to skip WIF): " GITHUB_REPO
fi

# ── Required APIs ────────────────────────────────────────────────────────────

REQUIRED_APIS=(
  "compute.googleapis.com"
  "run.googleapis.com"
  "sqladmin.googleapis.com"
  "redis.googleapis.com"
  "secretmanager.googleapis.com"
  "artifactregistry.googleapis.com"
  "vpcaccess.googleapis.com"
  "servicenetworking.googleapis.com"
  "cloudresourcemanager.googleapis.com"
  "iam.googleapis.com"
  "iamcredentials.googleapis.com"
  "monitoring.googleapis.com"
  "logging.googleapis.com"
  "storage.googleapis.com"
  "certificatemanager.googleapis.com"
)

# ── Functions ────────────────────────────────────────────────────────────────

create_project() {
  local project_id="$1"

  if gcloud projects describe "$project_id" &>/dev/null; then
    success "Project $project_id already exists"
  else
    info "Creating project: $project_id"
    local create_args=(projects create "$project_id" --name "$project_id")
    if [[ -n "$ORG_ID" ]]; then
      create_args+=(--organization "$ORG_ID")
    fi
    gcloud "${create_args[@]}"
    success "Created project: $project_id"
  fi

  # Link billing account
  if [[ -n "$BILLING_ACCOUNT" ]]; then
    local current_billing
    current_billing=$(gcloud billing projects describe "$project_id" --format="value(billingAccountName)" 2>/dev/null || echo "")
    if [[ -z "$current_billing" || "$current_billing" == "billingAccounts/" ]]; then
      info "Linking billing account to $project_id"
      gcloud billing projects link "$project_id" --billing-account="$BILLING_ACCOUNT"
      success "Billing account linked to $project_id"
    else
      success "Billing account already linked to $project_id"
    fi
  fi
}

enable_apis() {
  local project_id="$1"

  info "Enabling required APIs for $project_id (this may take a few minutes)..."
  local enabled_apis
  enabled_apis=$(gcloud services list --project="$project_id" --format="value(config.name)" 2>/dev/null || echo "")

  local apis_to_enable=()
  for api in "${REQUIRED_APIS[@]}"; do
    if echo "$enabled_apis" | grep -q "^${api}$"; then
      : # Already enabled
    else
      apis_to_enable+=("$api")
    fi
  done

  if [[ ${#apis_to_enable[@]} -eq 0 ]]; then
    success "All APIs already enabled for $project_id"
  else
    info "Enabling ${#apis_to_enable[@]} APIs: ${apis_to_enable[*]}"
    gcloud services enable "${apis_to_enable[@]}" --project="$project_id"
    success "APIs enabled for $project_id"
  fi
}

create_state_bucket() {
  local project_id="$1"
  local env="$2"
  local bucket_name="${PROJECT_PREFIX}-terraform-state-${env}"

  if gcloud storage buckets describe "gs://${bucket_name}" --project="$project_id" &>/dev/null; then
    success "State bucket gs://${bucket_name} already exists"
  else
    info "Creating state bucket: gs://${bucket_name}"
    gcloud storage buckets create "gs://${bucket_name}" \
      --project="$project_id" \
      --location="$REGION" \
      --uniform-bucket-level-access \
      --public-access-prevention
    success "Created state bucket: gs://${bucket_name}"
  fi

  # Enable versioning (idempotent)
  gcloud storage buckets update "gs://${bucket_name}" --versioning 2>/dev/null || true
  success "Versioning enabled on gs://${bucket_name}"
}

create_terraform_sa() {
  local project_id="$1"
  local sa_email="${TF_SA_NAME}@${project_id}.iam.gserviceaccount.com"

  if gcloud iam service-accounts describe "$sa_email" --project="$project_id" &>/dev/null; then
    success "Terraform SA already exists: $sa_email"
  else
    info "Creating Terraform service account: $sa_email"
    gcloud iam service-accounts create "$TF_SA_NAME" \
      --project="$project_id" \
      --display-name="Terraform Service Account" \
      --description="Used by Terraform to manage infrastructure"
    success "Created Terraform SA: $sa_email"
  fi

  # Grant required roles (idempotent)
  local tf_roles=(
    "roles/editor"
    "roles/iam.securityAdmin"
    "roles/secretmanager.admin"
    "roles/compute.networkAdmin"
    "roles/servicenetworking.networksAdmin"
    "roles/run.admin"
    "roles/cloudsql.admin"
    "roles/redis.admin"
    "roles/storage.admin"
    "roles/artifactregistry.admin"
    "roles/monitoring.admin"
    "roles/iam.workloadIdentityPoolAdmin"
    "roles/resourcemanager.projectIamAdmin"
  )

  info "Granting IAM roles to Terraform SA..."
  for role in "${tf_roles[@]}"; do
    gcloud projects add-iam-policy-binding "$project_id" \
      --member="serviceAccount:$sa_email" \
      --role="$role" \
      --condition=None \
      --quiet 2>/dev/null
  done
  success "IAM roles granted to Terraform SA for $project_id"
}

setup_workload_identity() {
  local project_id="$1"
  local pool_id="${PROJECT_PREFIX}-github-wif-pool"
  local provider_id="${PROJECT_PREFIX}-github-wif-provider"
  local sa_email="${TF_SA_NAME}@${project_id}.iam.gserviceaccount.com"

  if [[ -z "$GITHUB_REPO" ]]; then
    warn "Skipping Workload Identity Federation (no GitHub repo specified)"
    return
  fi

  # Create Workload Identity Pool
  if gcloud iam workload-identity-pools describe "$pool_id" \
      --project="$project_id" \
      --location="global" &>/dev/null; then
    success "WIF pool already exists: $pool_id"
  else
    info "Creating Workload Identity Pool: $pool_id"
    gcloud iam workload-identity-pools create "$pool_id" \
      --project="$project_id" \
      --location="global" \
      --display-name="GitHub Actions Pool" \
      --description="Workload Identity Pool for GitHub Actions CI/CD"
    success "Created WIF pool: $pool_id"
  fi

  # Create OIDC Provider
  if gcloud iam workload-identity-pools providers describe "$provider_id" \
      --project="$project_id" \
      --location="global" \
      --workload-identity-pool="$pool_id" &>/dev/null; then
    success "WIF provider already exists: $provider_id"
  else
    info "Creating Workload Identity Provider: $provider_id"
    gcloud iam workload-identity-pools providers create-oidc "$provider_id" \
      --project="$project_id" \
      --location="global" \
      --workload-identity-pool="$pool_id" \
      --display-name="GitHub Actions Provider" \
      --issuer-uri="https://token.actions.githubusercontent.com" \
      --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
      --attribute-condition="assertion.repository == '${GITHUB_REPO}'"
    success "Created WIF provider: $provider_id"
  fi

  # Allow GitHub Actions to impersonate the Terraform SA
  local pool_name
  pool_name=$(gcloud iam workload-identity-pools describe "$pool_id" \
    --project="$project_id" \
    --location="global" \
    --format="value(name)")

  info "Binding WIF to Terraform SA..."
  gcloud iam service-accounts add-iam-policy-binding "$sa_email" \
    --project="$project_id" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${pool_name}/attribute.repository/${GITHUB_REPO}" \
    --condition=None \
    --quiet 2>/dev/null
  success "WIF bound to Terraform SA"
}

print_github_secrets() {
  local project_id="$1"
  local env="$2"
  local sa_email="${TF_SA_NAME}@${project_id}.iam.gserviceaccount.com"
  local pool_id="${PROJECT_PREFIX}-github-wif-pool"
  local provider_id="${PROJECT_PREFIX}-github-wif-provider"

  local provider_name=""
  if [[ -n "$GITHUB_REPO" ]]; then
    provider_name=$(gcloud iam workload-identity-pools providers describe "$provider_id" \
      --project="$project_id" \
      --location="global" \
      --workload-identity-pool="$pool_id" \
      --format="value(name)" 2>/dev/null || echo "")
  fi

  echo ""
  echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  GitHub Secrets for: ${env^^}${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
  echo ""
  echo "  GCP_PROJECT_ID_${env^^}=$project_id"
  echo "  GCP_REGION=$REGION"
  echo "  TF_STATE_BUCKET_${env^^}=${PROJECT_PREFIX}-terraform-state-${env}"
  echo "  GCP_SA_EMAIL_${env^^}=$sa_email"
  if [[ -n "$provider_name" ]]; then
    echo "  GCP_WORKLOAD_IDENTITY_PROVIDER_${env^^}=$provider_name"
  fi
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║          NHIA HRMS – GCP Infrastructure Bootstrap          ║${NC}"
  echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # Verify gcloud is available and authenticated
  if ! command -v gcloud &>/dev/null; then
    error "gcloud CLI not found. Install: https://cloud.google.com/sdk/docs/install"
    exit 1
  fi

  local account
  account=$(gcloud config get account 2>/dev/null || echo "")
  if [[ -z "$account" ]]; then
    error "Not authenticated. Run: gcloud auth login"
    exit 1
  fi
  info "Authenticated as: $account"

  for env in "${ENVIRONMENTS[@]}"; do
    local project_id="${PROJECT_PREFIX}-${env}"

    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Setting up: ${env^^} (${project_id})${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # 1. Create or validate GCP project
    create_project "$project_id"

    # 2. Enable required APIs
    enable_apis "$project_id"

    # 3. Create Terraform state bucket
    create_state_bucket "$project_id" "$env"

    # 4. Create Terraform service account
    create_terraform_sa "$project_id"

    # 5. Setup Workload Identity Federation
    setup_workload_identity "$project_id"
  done

  # ── Print GitHub Secrets ─────────────────────────────────────────────────

  echo ""
  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║              Bootstrap Complete! Next Steps:                ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"

  for env in "${ENVIRONMENTS[@]}"; do
    local project_id="${PROJECT_PREFIX}-${env}"
    print_github_secrets "$project_id" "$env"
  done

  echo -e "${BLUE}──────────────────────────────────────────────────────────────${NC}"
  echo ""
  echo "  Add the above secrets to your GitHub repository:"
  echo "  Settings → Secrets and variables → Actions → New repository secret"
  echo ""
  echo "  Then initialize Terraform:"
  echo ""
  echo "    cd infra"
  echo "    make init ENV=staging"
  echo "    make plan ENV=staging"
  echo ""
}

main "$@"
