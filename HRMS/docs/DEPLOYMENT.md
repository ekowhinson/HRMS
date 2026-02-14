# NHIA HRMS -- First Deployment Guide (GCP)

> Comprehensive step-by-step guide for deploying the NHIA Human Resource Management System
> to Google Cloud Platform for the first time. Covers both staging and production environments.

**Last updated:** February 2026

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites Checklist](#prerequisites-checklist)
3. [Step-by-Step First Deployment](#step-by-step-first-deployment)
   - [a) Bootstrap GCP Project](#a-bootstrap-gcp-project)
   - [b) Configure GitHub Secrets](#b-configure-github-secrets)
   - [c) Deploy Staging Infrastructure](#c-deploy-staging-infrastructure)
   - [d) Build and Push First Docker Image](#d-build-and-push-first-docker-image)
   - [e) Set Secrets in Secret Manager](#e-set-secrets-in-secret-manager)
   - [f) Run Initial Migrations](#f-run-initial-migrations)
   - [g) Create Django Superuser](#g-create-django-superuser)
   - [h) Load Seed Data](#h-load-seed-data)
   - [i) Build and Upload Frontend](#i-build-and-upload-frontend)
   - [j) Configure DNS](#j-configure-dns)
   - [k) Verify SSL](#k-verify-ssl)
   - [l) Smoke Tests](#l-smoke-tests)
   - [m) Repeat for Production](#m-repeat-for-production)
4. [Rollback Procedures](#rollback-procedures)
5. [Decision Flowchart](#decision-flowchart)
6. [CI/CD Pipeline Reference](#cicd-pipeline-reference)
7. [Infrastructure Reference](#infrastructure-reference)
8. [Monitoring and Alerting](#monitoring-and-alerting)
9. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
                       Internet
                          |
              +-----------+-----------+
              |                       |
        hrms.nhia.gov.gh    api.hrms.nhia.gov.gh
              |                       |
       Cloud CDN / LB          Cloud Run (API)
              |                   |        |
       GCS (Frontend)      Cloud SQL   Memorystore
       Static Assets       PostgreSQL    Redis 7
                               |           |
                          Cloud Run (Celery Worker)
                               |
                          GCS (Media/Exports/Backups)
```

**Core Services:**

| Component        | GCP Service                   | Staging                          | Production                          |
|------------------|-------------------------------|----------------------------------|-------------------------------------|
| Backend API      | Cloud Run                     | 0-5 instances, 1 vCPU, 1 GiB    | 1-10 instances, 2 vCPU, 1 GiB      |
| Celery Workers   | Cloud Run                     | 0-3 instances, 1 vCPU, 1 GiB    | 1-5 instances, 2 vCPU, 2 GiB       |
| Database         | Cloud SQL PostgreSQL 16       | db-custom-1-3840, ZONAL         | db-custom-4-16384, REGIONAL (HA)    |
| Cache            | Memorystore Redis 7           | 1 GB, BASIC                      | 2 GB, STANDARD_HA                   |
| Frontend         | GCS + Cloud CDN + HTTPS LB    | staging.hrms.nhia.gov.gh         | hrms.nhia.gov.gh                    |
| Container Images | Artifact Registry             | nhia-hrms-staging-docker         | nhia-hrms-production-docker         |
| Secrets          | Secret Manager                | 8 secrets                        | 8 secrets                           |
| Networking       | VPC + Serverless Connector    | 10.0.0.0/20 + 10.1.0.0/28       | 10.0.0.0/20 + 10.1.0.0/28          |
| Security         | Cloud Armor WAF               | Basic (SQLi, XSS, rate limit)    | Full OWASP + bot blocking           |
| Monitoring       | Cloud Monitoring + Logging    | Email alerts                     | Email + Slack alerts                |
| IaC              | Terraform >= 1.5              | `infra/environments/staging/`    | `infra/environments/production/`    |
| CI/CD            | GitHub Actions                | 5 workflows                      | 5 workflows                         |

**Terraform Modules (11 in `infra/modules/`):**

```
infra/
  main.tf                           # Root composition
  variables.tf                      # All input variables
  outputs.tf                        # All outputs
  locals.tf                         # Naming conventions, labels
  backend.tf                        # GCS remote state
  versions.tf                       # Provider versions (google ~> 5.30)
  Makefile                          # make init/plan/apply/destroy
  modules/
    networking/                     # VPC, subnets, serverless connector
    security/                       # IAM, service accounts, Cloud Armor, Workload Identity
    secrets/                        # Secret Manager (8 secrets)
    registry/                       # Artifact Registry
    database/                       # Cloud SQL PostgreSQL
    cache/                          # Memorystore Redis
    storage/                        # GCS buckets (media, exports, backups)
    backend-service/                # Cloud Run API + domain mapping
    worker-service/                 # Cloud Run Celery worker
    frontend-cdn/                   # GCS + CDN + HTTPS LB + SSL cert
    monitoring/                     # Uptime checks, alert policies, dashboard, log metrics
  environments/
    staging/
      terraform.tfvars              # Staging variable values
      backend.hcl                   # State bucket: nhia-hrms-terraform-state-staging
    production/
      terraform.tfvars              # Production variable values
      backend.hcl                   # State bucket: nhia-hrms-terraform-state-production
```

---

## Prerequisites Checklist

Before starting the deployment, ensure every item below is satisfied.

### GCP Requirements

- [ ] **GCP Project created** with billing enabled
  - Staging project ID: `nhia-hrms-staging`
  - Production project ID: `nhia-hrms-production`
- [ ] **Organization-level access** (or sufficient project-level IAM) to enable APIs and create service accounts
- [ ] **Billing alert** configured (recommended: notify at 50%, 80%, 100% of budget)

### Local Tooling

- [ ] **gcloud CLI** installed and authenticated (`gcloud auth login`)
  ```bash
  gcloud version  # Requires >= 450.0
  ```
- [ ] **Terraform** >= 1.5.0, < 2.0.0
  ```bash
  terraform version
  ```
- [ ] **Docker** installed (for building initial images)
  ```bash
  docker --version
  ```
- [ ] **Node.js** 20.x and **npm** (for frontend build)
  ```bash
  node --version && npm --version
  ```
- [ ] **Python** 3.12 (for local management commands if needed)
- [ ] **gsutil / gcloud storage** CLI (included in gcloud SDK)
- [ ] **cloud-sql-proxy** binary (for local database access)
  ```bash
  # Install:
  gcloud components install cloud-sql-proxy
  ```

### GitHub Requirements

- [ ] **GitHub repository** with Actions enabled (currently `nhia/hrms`)
- [ ] **Branch protection** configured on `main` (require PR reviews for production deploys)
- [ ] **Environment secrets** capability enabled in repository settings
- [ ] **GitHub Environments** created: `staging` and `production`
  - Production environment should have **required reviewers** configured

### Domain and DNS

- [ ] **Domain access** for `nhia.gov.gh` DNS zone
- [ ] Ability to create A records and CNAME records for:
  - `hrms.nhia.gov.gh` (production frontend)
  - `staging.hrms.nhia.gov.gh` (staging frontend)
  - `api.hrms.nhia.gov.gh` (production API -- Cloud Run domain mapping)
  - `api.staging.hrms.nhia.gov.gh` (staging API -- Cloud Run domain mapping)

### Notification Channels

- [ ] **Email address** for alert notifications: `devops@nhia.gov.gh`
- [ ] **Slack webhook URL** (optional, for critical production alerts to `#hrms-alerts`)

---

## Step-by-Step First Deployment

All commands below assume you are in the repository root unless otherwise specified.

### a) Bootstrap GCP Project

This step enables required GCP APIs, creates the Terraform state bucket, and creates the Terraform service account. You must perform this for **each** GCP project (staging and production).

```bash
# Set variables for the target environment
export PROJECT_ID="nhia-hrms-staging"          # or "nhia-hrms-production"
export REGION="us-central1"
export TF_STATE_BUCKET="nhia-hrms-terraform-state-staging"  # or "...-production"

# Authenticate
gcloud auth login
gcloud config set project $PROJECT_ID
```

**Step 1: Enable required GCP APIs**

```bash
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com \
  servicenetworking.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  cloudbuild.googleapis.com \
  containerscanning.googleapis.com \
  --project=$PROJECT_ID
```

**Step 2: Create Terraform state bucket**

```bash
gcloud storage buckets create gs://$TF_STATE_BUCKET \
  --project=$PROJECT_ID \
  --location=$REGION \
  --uniform-bucket-level-access \
  --public-access-prevention

# Enable versioning for state recovery
gcloud storage buckets update gs://$TF_STATE_BUCKET --versioning
```

**Step 3: Create Terraform service account** (for local Terraform runs)

```bash
# Create service account
gcloud iam service-accounts create terraform \
  --display-name="Terraform" \
  --project=$PROJECT_ID

# Grant required roles
for ROLE in \
  roles/editor \
  roles/iam.securityAdmin \
  roles/secretmanager.admin \
  roles/compute.networkAdmin \
  roles/run.admin \
  roles/cloudsql.admin \
  roles/redis.admin \
  roles/storage.admin \
  roles/monitoring.admin \
  roles/logging.admin \
  roles/artifactregistry.admin \
  roles/iam.workloadIdentityPoolAdmin; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:terraform@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$ROLE" \
    --quiet
done

# Grant state bucket access
gcloud storage buckets add-iam-policy-binding gs://$TF_STATE_BUCKET \
  --member="serviceAccount:terraform@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Create and download key (store securely, never commit)
gcloud iam service-accounts keys create /tmp/terraform-${PROJECT_ID}.json \
  --iam-account=terraform@${PROJECT_ID}.iam.gserviceaccount.com

export GOOGLE_APPLICATION_CREDENTIALS="/tmp/terraform-${PROJECT_ID}.json"
```

> **Security note:** Once Workload Identity Federation is set up (via the Terraform `security` module),
> GitHub Actions will use OIDC tokens instead of service account keys. Delete any local keys after
> initial bootstrapping.

**Repeat the above three steps for the production project** (`nhia-hrms-production`).

---

### b) Configure GitHub Secrets

Navigate to **GitHub > Repository Settings > Secrets and Variables > Actions** and configure the following.

#### Repository-Level Secrets (shared)

| Secret Name                       | Description                                                  | Example Value                                                |
|-----------------------------------|--------------------------------------------------------------|--------------------------------------------------------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER`  | Workload Identity Provider resource name                     | `projects/123456/locations/global/workloadIdentityPools/nhia-hrms-staging-github-pool/providers/nhia-hrms-staging-github-provider` |
| `GCP_SERVICE_ACCOUNT_EMAIL`       | CI/CD service account email                                  | `nhia-hrms-staging-cicd-sa@nhia-hrms-staging.iam.gserviceaccount.com` |

> **Important:** The Workload Identity Provider and CI/CD service account are created by Terraform
> in the `security` module. On the very first deploy you will need to bootstrap manually or use a
> service account key temporarily, then update these secrets after `terraform apply`.

#### Environment-Level Secrets

**Staging environment:**

| Secret Name                  | Value                                  |
|------------------------------|----------------------------------------|
| `GCP_PROJECT_ID_STAGING`     | `nhia-hrms-staging`                    |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | (staging pool -- output from Terraform) |
| `GCP_SERVICE_ACCOUNT_EMAIL`  | (staging CI/CD SA -- output from Terraform) |

**Production environment:**

| Secret Name                    | Value                                    |
|--------------------------------|------------------------------------------|
| `GCP_PROJECT_ID_PRODUCTION`    | `nhia-hrms-production`                   |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | (production pool -- output from Terraform) |
| `GCP_SERVICE_ACCOUNT_EMAIL`    | (production CI/CD SA -- output from Terraform) |

#### Environment-Level Variables

| Variable Name       | Staging Value                              | Production Value                          |
|---------------------|--------------------------------------------|-------------------------------------------|
| `GCP_REGION`        | `us-central1`                              | `us-central1`                             |
| `STAGING_API_URL`   | `https://api.staging.hrms.nhia.gov.gh`     | --                                        |
| `STAGING_BUCKET`    | `nhia-hrms-staging-frontend`               | --                                        |
| `PRODUCTION_API_URL`| --                                         | `https://api.hrms.nhia.gov.gh`            |
| `PRODUCTION_BUCKET` | --                                         | `nhia-hrms-production-frontend`           |
| `SLACK_WEBHOOK_URL` | (optional)                                 | (recommended for `#hrms-alerts`)          |

---

### c) Deploy Staging Infrastructure

All Terraform operations use the Makefile in `infra/`. The Makefile validates that `ENV` is set and
that the corresponding `environments/<ENV>/backend.hcl` file exists.

```bash
cd infra

# Step 1: Initialize Terraform for staging
# This configures the GCS backend using environments/staging/backend.hcl
# (bucket = "nhia-hrms-terraform-state-staging", prefix = "terraform/state")
make init ENV=staging

# Step 2: Review the execution plan
# Uses environments/staging/terraform.tfvars for variable values
make plan ENV=staging

# Step 3: Review the plan output carefully, then apply
make apply ENV=staging
```

**Expected resources created (first run):**

- 1 VPC network + subnet + serverless VPC connector
- 2 service accounts (API + Worker) + 1 CI/CD service account
- 1 Cloud Armor WAF policy (basic rules for staging)
- 1 Workload Identity Pool + Provider (for GitHub Actions)
- 8 Secret Manager secrets (empty -- you populate them in step e)
- 1 Artifact Registry repository
- 1 Cloud SQL PostgreSQL instance (db-custom-1-3840, ZONAL)
- 1 Memorystore Redis instance (1 GB, BASIC)
- 3 GCS buckets (media, exports, backups)
- 1 Cloud Run API service
- 1 Cloud Run Worker service
- 1 GCS frontend bucket + CDN backend bucket + URL map + SSL cert + LB
- Monitoring: uptime checks, 16 alert policies, 4 log-based metrics, 1 dashboard

**Save the outputs -- you will need them:**

```bash
make output ENV=staging
```

Key outputs to record:

```
api_service_url          = "https://nhia-hrms-staging-api-xxxxx-uc.a.run.app"
cdn_ip_address           = "34.xxx.xxx.xxx"         # For DNS A record
repository_url           = "us-central1-docker.pkg.dev/nhia-hrms-staging/nhia-hrms-staging-docker"
db_connection_name       = "nhia-hrms-staging:us-central1:nhia-hrms-staging-pg-xxxxx"
frontend_bucket          = "nhia-hrms-staging-frontend"
api_service_account_email = "nhia-hrms-staging-api-sa@nhia-hrms-staging.iam.gserviceaccount.com"
```

> **First-run chicken-and-egg:** Cloud Run requires a container image to exist. Terraform may
> partially fail if the Artifact Registry is empty. If this happens, proceed to step (d) to push
> an initial image, then re-run `make apply ENV=staging`.

---

### d) Build and Push First Docker Image

Before Cloud Run can start, it needs at least one container image in Artifact Registry.

```bash
# Variables (from Terraform output)
export PROJECT_ID="nhia-hrms-staging"
export REGION="us-central1"
export REGISTRY="${REGION}-docker.pkg.dev"
export REPOSITORY="${PROJECT_ID}/nhia-hrms-staging-docker"

# Authenticate Docker to Artifact Registry
gcloud auth configure-docker ${REGISTRY} --quiet

# Build and push the backend API image
docker build \
  -t ${REGISTRY}/${REPOSITORY}/backend:initial \
  -t ${REGISTRY}/${REPOSITORY}/backend:latest \
  ./HRMS/backend

docker push ${REGISTRY}/${REPOSITORY}/backend:initial
docker push ${REGISTRY}/${REPOSITORY}/backend:latest

# Build and push the Celery worker image
docker build \
  -t ${REGISTRY}/${REPOSITORY}/celery-worker:initial \
  -t ${REGISTRY}/${REPOSITORY}/celery-worker:latest \
  -f ./HRMS/backend/Dockerfile.celery \
  ./HRMS/backend

docker push ${REGISTRY}/${REPOSITORY}/celery-worker:initial
docker push ${REGISTRY}/${REPOSITORY}/celery-worker:latest
```

**Verify the images exist:**

```bash
gcloud artifacts docker images list ${REGISTRY}/${REPOSITORY} \
  --project=$PROJECT_ID
```

> **Tip:** After this initial push, all subsequent image builds are handled by GitHub Actions
> CI/CD (`deploy-staging.yml` and `deploy-production.yml`).

If Terraform partially failed in step (c) due to missing images, re-run:

```bash
cd infra
make apply ENV=staging
```

---

### e) Set Secrets in Secret Manager

Terraform created 8 empty secrets. You must add the initial secret values manually.

The secrets follow the naming convention `{project_id}-{environment}-{secret-name}`:

```bash
export PROJECT_ID="nhia-hrms-staging"
export ENV="staging"
export PREFIX="${PROJECT_ID}-${ENV}"

# 1. Django SECRET_KEY (generate a strong random value)
echo -n "$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')" | \
  gcloud secrets versions add "${PREFIX}-django-secret-key" \
    --data-file=- --project=$PROJECT_ID

# 2. Database password (generate a strong random value)
echo -n "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')" | \
  gcloud secrets versions add "${PREFIX}-db-password" \
    --data-file=- --project=$PROJECT_ID

# 3. Redis AUTH string (generate a strong random value)
echo -n "$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')" | \
  gcloud secrets versions add "${PREFIX}-redis-auth" \
    --data-file=- --project=$PROJECT_ID

# 4. JWT signing key (generate a strong random value)
echo -n "$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')" | \
  gcloud secrets versions add "${PREFIX}-jwt-signing-key" \
    --data-file=- --project=$PROJECT_ID

# 5. Anthropic API key (from your Anthropic account)
echo -n "sk-ant-xxxxxxxxxxxxx" | \
  gcloud secrets versions add "${PREFIX}-anthropic-api-key" \
    --data-file=- --project=$PROJECT_ID

# 6. Email host password (SMTP credentials)
echo -n "your-smtp-password" | \
  gcloud secrets versions add "${PREFIX}-email-host-password" \
    --data-file=- --project=$PROJECT_ID

# 7. LDAP bind password (if using Active Directory integration)
echo -n "your-ldap-password" | \
  gcloud secrets versions add "${PREFIX}-ldap-bind-password" \
    --data-file=- --project=$PROJECT_ID

# 8. Azure AD client secret (if using Azure SSO)
echo -n "your-azure-client-secret" | \
  gcloud secrets versions add "${PREFIX}-azure-client-secret" \
    --data-file=- --project=$PROJECT_ID
```

**Important:** You must also set the database password on the Cloud SQL instance itself:

```bash
# Get the Cloud SQL instance name
INSTANCE=$(gcloud sql instances list \
  --project=$PROJECT_ID \
  --filter="name~nhia-hrms-staging-pg" \
  --format="value(name)" --limit=1)

# Set the password for the hrms_app user
# (Use the SAME password you stored in Secret Manager)
DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret="${PREFIX}-db-password" --project=$PROJECT_ID)

gcloud sql users set-password hrms_app \
  --instance=$INSTANCE \
  --password="$DB_PASSWORD" \
  --project=$PROJECT_ID
```

> **Note:** If the `hrms_app` user does not exist yet, create it:
> ```bash
> gcloud sql users create hrms_app \
>   --instance=$INSTANCE \
>   --password="$DB_PASSWORD" \
>   --project=$PROJECT_ID
> ```
> Then create the database:
> ```bash
> gcloud sql databases create hrms \
>   --instance=$INSTANCE \
>   --project=$PROJECT_ID
> ```

---

### f) Run Initial Migrations

Database migrations must be applied before the API can serve requests. The CI/CD pipeline uses a
Cloud Run Job for this, but for the first deployment you can run it locally via Cloud SQL Auth Proxy.

**Option A: Via Cloud Run Job (preferred)**

If the Cloud Run migration job was created by Terraform:

```bash
gcloud run jobs execute nhia-hrms-staging-api-migrate \
  --region=$REGION \
  --project=$PROJECT_ID \
  --wait
```

**Option B: Via Cloud SQL Auth Proxy (local)**

```bash
# Get the connection name from Terraform output
CONN_NAME=$(cd infra && terraform output -raw db_connection_name)

# Start the proxy in the background
cloud-sql-proxy $CONN_NAME --port=5432 &
PROXY_PID=$!

# Run migrations
cd HRMS/backend
export DJANGO_ENV=production
export USE_POSTGRES=true
export DB_HOST=127.0.0.1
export DB_PORT=5432
export DB_NAME=hrms
export DB_USER=hrms_app
export DB_PASSWORD="<password-from-secret-manager>"
export SECRET_KEY="<django-secret-key-from-secret-manager>"

python manage.py migrate --noinput

# Stop the proxy
kill $PROXY_PID
```

**Verify migrations applied:**

```bash
python manage.py showmigrations | grep "\[X\]" | wc -l
# Should show 63+ applied migrations
```

---

### g) Create Django Superuser

Create the initial admin account using a non-interactive management command.

**Via Cloud SQL Auth Proxy:**

```bash
# (Ensure proxy is running -- see step f, Option B)

cd HRMS/backend

python manage.py shell -c "
from accounts.models import User
if not User.objects.filter(email='admin@nhia.gov.gh').exists():
    user = User.objects.create_superuser(
        email='admin@nhia.gov.gh',
        username='nhia-admin',
        password='CHANGE-ME-ON-FIRST-LOGIN',
        first_name='System',
        last_name='Administrator',
    )
    print(f'Created superuser: {user.email}')
else:
    print('Superuser already exists.')
"
```

> **CRITICAL:** Change the password immediately after first login. Use a strong, unique password
> and enable any available MFA/2FA.

---

### h) Load Seed Data

The seed script loads essential fixture data (roles, permissions, tax brackets, Ghana bank sort
codes, etc.). It is idempotent and safe to run multiple times.

```bash
# From the repository root:
./scripts/deployment/seed-production.sh --env staging --proxy

# If running locally without Cloud SQL Proxy:
# (Ensure proxy is running and env vars are set from step f)
./scripts/deployment/seed-production.sh --env staging
```

The script performs:
1. Verifies database connectivity
2. Checks migration state (refuses to seed production with pending migrations)
3. Loads core fixtures via `python manage.py load_initial_data`
4. Loads Ghana bank sort codes via `python manage.py seed_banks`
5. Creates a staging admin user (staging only): `admin@staging.nhia.gov.gh`
6. Sets up payroll roles (production only): `python manage.py setup_payroll_roles`
7. Warms Redis caches via `python manage.py warm_caches`

**Dry run first:**

```bash
./scripts/deployment/seed-production.sh --env staging --dry-run
```

---

### i) Build and Upload Frontend

The frontend is a React/Vite SPA served from GCS via Cloud CDN.

```bash
cd HRMS/frontend

# Install dependencies
npm ci

# Build with the staging API URL
VITE_API_URL=https://api.staging.hrms.nhia.gov.gh npm run build

# Upload to GCS with appropriate cache headers
BUCKET="nhia-hrms-staging-frontend"

# Static assets (JS, CSS, images): immutable, 1-year cache
gcloud storage cp dist/assets/* "gs://${BUCKET}/assets/" \
  --recursive \
  --cache-control="public, max-age=31536000, immutable"

# HTML: no cache (always fetch latest)
gcloud storage cp dist/index.html "gs://${BUCKET}/" \
  --cache-control="no-cache, no-store, must-revalidate"

# Other root files (favicon, manifest, robots.txt, etc.)
gcloud storage cp dist/* "gs://${BUCKET}/" \
  --cache-control="public, max-age=3600" \
  --no-clobber || true
```

**Invalidate CDN cache for index.html:**

```bash
gcloud compute url-maps invalidate-cdn-cache nhia-hrms-staging-frontend-urlmap \
  --path="/index.html" \
  --project=$PROJECT_ID \
  --async
```

---

### j) Configure DNS

You need to create DNS records pointing to the GCP resources. The exact process depends on your
DNS provider for `nhia.gov.gh`.

**Get the required IP addresses and CNAME targets:**

```bash
# Frontend CDN IP (from Terraform output)
cd infra && terraform output cdn_ip_address
# Example: 34.120.xxx.xxx

# API Cloud Run domain mapping CNAME
# Cloud Run domain mappings require a CNAME to ghs.googlehosted.com
```

**DNS Records to Create:**

| Record Type | Host                             | Value                       | TTL   |
|-------------|----------------------------------|-----------------------------|-------|
| A           | `staging.hrms.nhia.gov.gh`       | `<cdn_ip_address>`          | 300   |
| A           | `hrms.nhia.gov.gh`               | `<cdn_ip_address>`          | 300   |
| CNAME       | `api.staging.hrms.nhia.gov.gh`   | `ghs.googlehosted.com.`    | 300   |
| CNAME       | `api.hrms.nhia.gov.gh`           | `ghs.googlehosted.com.`    | 300   |

> **Note:** The A record for the frontend points to the global static IP created by the
> `frontend-cdn` Terraform module. The CNAME for the API points to Google's hosted service
> endpoint, which is required for Cloud Run custom domain mappings.

**Verify DNS propagation:**

```bash
dig staging.hrms.nhia.gov.gh +short
dig api.staging.hrms.nhia.gov.gh +short
```

---

### k) Verify SSL

Google-managed SSL certificates are provisioned automatically by Terraform (via the `frontend-cdn`
module's `google_compute_managed_ssl_certificate` resource). However, they require:

1. DNS records to be correctly configured (step j)
2. Time for Google to verify domain ownership and issue the certificate

**Certificate provisioning can take up to 24 hours** (typically 15-60 minutes).

**Check certificate status:**

```bash
# List managed certificates
gcloud compute ssl-certificates list \
  --project=$PROJECT_ID \
  --format="table(name, type, managed.status, managed.domainStatus)"
```

Expected status progression:
- `PROVISIONING` -- DNS verification in progress
- `ACTIVE` -- Certificate is ready

**If the certificate is stuck in PROVISIONING:**

1. Verify DNS records resolve correctly
2. Ensure no CAA records block Google's CA (`pki.goog`)
3. Wait up to 24 hours
4. If still failing, delete and recreate via Terraform

```bash
# Check for CAA records that might block issuance
dig nhia.gov.gh CAA +short
# Should return empty or include "0 issue \"pki.goog\""
```

---

### l) Smoke Tests

Verify the deployment is functional end-to-end.

**API Health Check:**

```bash
# Direct Cloud Run URL (works immediately, no DNS needed)
API_URL=$(cd infra && terraform output -raw api_service_url)
curl -s -o /dev/null -w "HTTP %{http_code}\n" "${API_URL}/healthz/"
# Expected: HTTP 200

# Via custom domain (requires DNS + SSL)
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://api.staging.hrms.nhia.gov.gh/healthz/
# Expected: HTTP 200
```

**API Endpoint Check:**

```bash
curl -s https://api.staging.hrms.nhia.gov.gh/api/v1/core/lookups/ | python3 -m json.tool | head -20
# Should return JSON with lookup data (or 401 if auth required)
```

**Frontend Check:**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://staging.hrms.nhia.gov.gh
# Expected: HTTP 200

# Verify the page contains expected content
curl -s https://staging.hrms.nhia.gov.gh | grep -o '<title>.*</title>'
```

**Database Connectivity (via API):**

```bash
# The readiness endpoint checks DB and Redis
curl -s https://api.staging.hrms.nhia.gov.gh/readyz/ | python3 -m json.tool
```

**Redis Connectivity:**

```bash
curl -s https://api.staging.hrms.nhia.gov.gh/api/v1/core/cache/stats/ \
  -H "Authorization: Bearer <admin-token>" | python3 -m json.tool
```

**Celery Worker Check:**

```bash
# Verify the worker service is running
gcloud run services describe nhia-hrms-staging-worker \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(status.conditions[0].status)"
# Expected: True
```

---

### m) Repeat for Production

Follow the same steps (a) through (l) with the production configuration:

| Setting                | Staging                          | Production                         |
|------------------------|----------------------------------|------------------------------------|
| Project ID             | `nhia-hrms-staging`              | `nhia-hrms-production`             |
| TF State Bucket        | `nhia-hrms-terraform-state-staging` | `nhia-hrms-terraform-state-production` |
| ENV parameter          | `staging`                        | `production`                       |
| Domain                 | `staging.hrms.nhia.gov.gh`       | `hrms.nhia.gov.gh`                 |
| API Domain             | `api.staging.hrms.nhia.gov.gh`   | `api.hrms.nhia.gov.gh`             |
| VITE_API_URL           | `https://api.staging.hrms.nhia.gov.gh` | `https://api.hrms.nhia.gov.gh` |
| DB Availability        | ZONAL                            | REGIONAL (HA)                      |
| Redis Tier             | BASIC                            | STANDARD_HA                        |
| Cloud Armor            | Basic (SQLi, XSS, rate limit)    | Full OWASP + bot blocking          |
| Min API Instances      | 0 (scale to zero)                | 1 (always warm)                    |
| Min Worker Instances   | 0 (scale to zero)                | 1 (always warm)                    |
| Deletion Protection    | Disabled                         | Enabled                            |
| Point-in-time Recovery | Disabled                         | Enabled                            |
| Backup Retention       | 7 days                           | 30 days                            |

**Production-specific considerations:**

1. **Require PR review** before merging to `main` (triggers production deploy)
2. **GitHub environment protection rules** should require manual approval for `production`
3. The production deploy workflow performs a **canary deployment**:
   - Deploys new revision with 0% traffic
   - Shifts to 10% traffic, monitors error rate for 5 minutes
   - If error rate < 1%: shifts to 50%, monitors for 5 more minutes
   - If still healthy: shifts to 100%
   - Automatic rollback if error rate exceeds 1% at any stage
4. A **pre-deploy database backup** is created automatically before migrations
5. Post-deploy: automatic **git tag** and **GitHub Release** creation

```bash
cd infra
make init ENV=production
make plan ENV=production
# Review the plan carefully -- this is production!
make apply ENV=production
```

---

## Rollback Procedures

### Cloud Run API Rollback

**Via GitHub Actions (recommended):**

Go to **Actions > Rollback > Run workflow**, select the environment, and specify `previous` or a
specific revision name.

**Via CLI:**

```bash
export SERVICE="nhia-hrms-production-api"   # or nhia-hrms-staging-api
export REGION="us-central1"
export PROJECT_ID="nhia-hrms-production"

# List recent revisions
gcloud run revisions list \
  --service=$SERVICE \
  --region=$REGION \
  --project=$PROJECT_ID \
  --sort-by="~metadata.creationTimestamp" \
  --limit=5 \
  --format="table(metadata.name, status.conditions[0].status, metadata.creationTimestamp)"

# Roll back to a specific revision (100% traffic)
PREV_REVISION="nhia-hrms-production-api-00042-abc"  # Replace with actual revision name
gcloud run services update-traffic $SERVICE \
  --to-revisions="${PREV_REVISION}=100" \
  --region=$REGION \
  --project=$PROJECT_ID
```

**Verify rollback:**

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://api.hrms.nhia.gov.gh/healthz/
```

### Database Rollback

**Option A: Reverse Django migration**

If you know which migration caused the issue:

```bash
# Via Cloud SQL Auth Proxy
python manage.py migrate <app_name> <previous_migration_number>

# Example: revert employees app to migration 0042
python manage.py migrate employees 0042
```

**Option B: Point-in-time recovery (production only)**

Cloud SQL PITR is enabled in production with 30-day retention. Use this for data corruption
or accidental deletes.

```bash
# Get instance name
INSTANCE=$(gcloud sql instances list \
  --project=$PROJECT_ID \
  --filter="name~nhia-hrms-production-pg" \
  --format="value(name)" --limit=1)

# Clone the instance to a specific point in time
gcloud sql instances clone $INSTANCE "${INSTANCE}-recovery" \
  --point-in-time="2026-02-14T10:30:00.000Z" \
  --project=$PROJECT_ID

# After verifying the recovered data, swap connection strings
# WARNING: This requires downtime and careful coordination
```

**Option C: Restore from backup**

```bash
# List available backups
gcloud sql backups list \
  --instance=$INSTANCE \
  --project=$PROJECT_ID \
  --sort-by="~startTime" \
  --limit=10

# Restore a specific backup
BACKUP_ID="1707900000000"  # Replace with actual backup ID
gcloud sql backups restore $BACKUP_ID \
  --restore-instance=$INSTANCE \
  --project=$PROJECT_ID
```

> **Warning:** Restoring a backup replaces ALL data in the instance. Consider cloning instead.

### Frontend Rollback

**Re-upload previous build:**

```bash
# If you have the previous build artifacts:
BUCKET="nhia-hrms-production-frontend"

gcloud storage cp /path/to/previous/dist/assets/* "gs://${BUCKET}/assets/" \
  --recursive \
  --cache-control="public, max-age=31536000, immutable"

gcloud storage cp /path/to/previous/dist/index.html "gs://${BUCKET}/" \
  --cache-control="no-cache, no-store, must-revalidate"
```

**Invalidate CDN cache:**

```bash
gcloud compute url-maps invalidate-cdn-cache nhia-hrms-production-frontend-urlmap \
  --path="/*" \
  --project=$PROJECT_ID \
  --async
```

> **Tip:** CDN cache invalidation for `/*` clears all cached content. For a targeted fix,
> invalidate only `/index.html` (JS/CSS bundles have content-hashed filenames and are immutable).

### Emergency Kill Switch

If the application is causing harm and you need to stop it immediately:

```bash
# Scale API to zero (takes effect within seconds)
gcloud run services update nhia-hrms-production-api \
  --min-instances=0 \
  --max-instances=0 \
  --region=$REGION \
  --project=$PROJECT_ID

# Scale worker to zero
gcloud run services update nhia-hrms-production-worker \
  --min-instances=0 \
  --max-instances=0 \
  --region=$REGION \
  --project=$PROJECT_ID

# Optionally: upload a maintenance page to GCS
cat > /tmp/index.html << 'MAINT'
<!DOCTYPE html>
<html>
<head><title>NHIA HRMS - Scheduled Maintenance</title></head>
<body style="font-family:sans-serif;text-align:center;padding:100px;">
<h1>Scheduled Maintenance</h1>
<p>The NHIA HRMS system is currently undergoing maintenance. Please check back later.</p>
<p>Contact: devops@nhia.gov.gh</p>
</body>
</html>
MAINT

gcloud storage cp /tmp/index.html "gs://nhia-hrms-production-frontend/" \
  --cache-control="no-cache, no-store, must-revalidate"

gcloud compute url-maps invalidate-cdn-cache nhia-hrms-production-frontend-urlmap \
  --path="/index.html" \
  --project=$PROJECT_ID
```

**To restore service:**

```bash
# Restore API (production defaults: min=1, max=10)
gcloud run services update nhia-hrms-production-api \
  --min-instances=1 \
  --max-instances=10 \
  --region=$REGION \
  --project=$PROJECT_ID

# Restore worker (production defaults: min=1, max=5)
gcloud run services update nhia-hrms-production-worker \
  --min-instances=1 \
  --max-instances=5 \
  --region=$REGION \
  --project=$PROJECT_ID

# Re-deploy the actual frontend
cd HRMS/frontend
VITE_API_URL=https://api.hrms.nhia.gov.gh npm run build
gcloud storage cp dist/index.html "gs://nhia-hrms-production-frontend/" \
  --cache-control="no-cache, no-store, must-revalidate"
gcloud compute url-maps invalidate-cdn-cache nhia-hrms-production-frontend-urlmap \
  --path="/index.html" \
  --project=$PROJECT_ID
```

---

## Decision Flowchart

Use this flowchart to determine the appropriate response to production incidents.

```
INCIDENT DETECTED
      |
      v
Is the API returning 5xx errors?
      |
    [YES] --> Is it a code regression?
      |           |
      |         [YES] --> Rollback Cloud Run to previous revision
      |           |        (gcloud run services update-traffic ... --to-revisions=PREV=100)
      |           |
      |         [NO]  --> Is a downstream service failing (DB, Redis)?
      |                       |
      |                     [DB]   --> Check Cloud SQL status in Console
      |                     |         If corruption: Point-in-time recovery
      |                     |         If overloaded: Scale up instance tier
      |                     |
      |                     [Redis] --> Check Memorystore status in Console
      |                               If full: Flush volatile cache
      |                               If down: Restart instance
      |
    [NO]
      |
      v
Is the frontend broken/blank?
      |
    [YES] --> Re-upload previous GCS build
      |        Invalidate CDN cache: --path="/*"
      |
    [NO]
      |
      v
Is there data corruption?
      |
    [YES] --> Scale API to 0 (kill switch)
      |        Upload maintenance page
      |        Restore from backup or use PITR
      |        Verify data integrity
      |        Re-deploy API
      |
    [NO]
      |
      v
Is there a full outage (nothing accessible)?
      |
    [YES] --> Scale API to 0 (kill switch)
      |        Upload maintenance page
      |        Check GCP Status Dashboard: https://status.cloud.google.com
      |        Check DNS resolution: dig hrms.nhia.gov.gh
      |        Check SSL certificate status
      |        Investigate and fix root cause
      |        Re-deploy when resolved
      |
    [NO]
      |
      v
Performance degradation?
      |
    [YES] --> Check monitoring dashboard in Cloud Console
              Review API latency p95/p99 metrics
              Review Cloud SQL CPU/memory/disk metrics
              Review Redis memory usage and hit ratio
              Scale up if resource-constrained
```

---

## CI/CD Pipeline Reference

The project uses 5 GitHub Actions workflows.

### 1. CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:** Pull requests to `develop` and `main`

**Jobs:**
- `backend-lint` -- Ruff lint + format check, Bandit security scan
- `backend-test` -- Django test suite with PostgreSQL 16 + Redis 7 (coverage >= 80%)
- `backend-security` -- pip-audit dependency vulnerability scan
- `frontend-lint` -- ESLint + TypeScript check
- `frontend-build` -- Vite production build verification
- `frontend-security` -- npm audit
- `docker-build` -- Verify both Dockerfiles build successfully

### 2. Deploy Staging (`.github/workflows/deploy-staging.yml`)

**Triggers:** Push to `develop`

**Flow:** CI --> Build & Push Images --> Run Migrations --> Deploy API (canary then 100%) --> Deploy Frontend --> Smoke Tests --> Slack Notification

### 3. Deploy Production (`.github/workflows/deploy-production.yml`)

**Triggers:** Push to `main`

**Flow:** CI --> Build & Push Images --> Pre-deploy DB Snapshot --> Run Migrations --> Canary Deploy (0% --> 10% --> 50% --> 100%, with error rate monitoring and auto-rollback) --> Deploy Frontend --> Smoke Tests --> Git Tag + GitHub Release --> Slack Notification

### 4. Rollback (`.github/workflows/rollback.yml`)

**Triggers:** Manual dispatch (workflow_dispatch)

**Inputs:**
- `environment`: staging or production
- `revision`: Cloud Run revision name or `previous`
- `reason`: Required text explanation

**Actions:** Shifts traffic to specified revision, invalidates CDN, verifies health, notifies Slack

### 5. Scheduled Maintenance (`.github/workflows/scheduled-maintenance.yml`)

**Schedules:**
- **Weekly** (Monday 06:00 UTC): Python + Node.js dependency vulnerability audit
- **Daily** (08:00 UTC): Verify production Cloud SQL backup exists and is < 25 hours old
- **Monthly** (1st at 09:00 UTC): Service account key rotation audit

**Actions:** Creates GitHub issues if vulnerabilities or backup failures are detected.

---

## Infrastructure Reference

### Terraform State

State is stored remotely in GCS with versioning enabled:

| Environment | Bucket                                | Prefix             |
|-------------|---------------------------------------|--------------------|
| Staging     | `nhia-hrms-terraform-state-staging`   | `terraform/state`  |
| Production  | `nhia-hrms-terraform-state-production`| `terraform/state`  |

### Makefile Targets

```bash
cd infra

make init ENV=staging          # Initialize Terraform backend
make plan ENV=staging          # Generate execution plan
make apply ENV=staging         # Apply changes
make output ENV=staging        # Show outputs
make destroy ENV=staging       # Destroy all resources (requires confirmation)
make import ENV=production ADDR=<resource_addr> RESOURCE=<gcp_resource_id>
make state-list ENV=production # List all resources in state
make fmt                       # Format all .tf files
make validate                  # Validate configuration
make lint                      # fmt + validate
make staging-plan              # Shortcut: init + plan for staging
make staging-apply             # Shortcut: init + apply for staging
make production-plan           # Shortcut: init + plan for production
make production-apply          # Shortcut: init + apply for production
```

### Secret Manager Secrets

All 8 secrets per environment:

| Secret ID                    | Description                        | Used By        |
|------------------------------|------------------------------------|----------------|
| `*-django-secret-key`        | Django `SECRET_KEY`                | API, Worker    |
| `*-db-password`              | Cloud SQL database password        | API, Worker    |
| `*-redis-auth`               | Memorystore Redis AUTH string      | API, Worker    |
| `*-jwt-signing-key`          | JWT token signing key              | API, Worker    |
| `*-anthropic-api-key`        | Anthropic API key for AI features  | API, Worker    |
| `*-email-host-password`      | SMTP email password                | API, Worker    |
| `*-ldap-bind-password`       | LDAP bind password                 | API, Worker    |
| `*-azure-client-secret`      | Azure AD client secret             | API, Worker    |

### Cloud Run Service Names

| Service                     | Staging                         | Production                          |
|-----------------------------|---------------------------------|-------------------------------------|
| API                         | `nhia-hrms-staging-api`         | `nhia-hrms-production-api`          |
| Celery Worker               | `nhia-hrms-staging-worker`      | `nhia-hrms-production-worker`       |
| Migration Job               | `nhia-hrms-staging-api-migrate` | `nhia-hrms-production-api-migrate`  |

### Container Images

| Image                | Dockerfile                       | Entrypoint                                |
|----------------------|----------------------------------|-------------------------------------------|
| `backend`            | `HRMS/backend/Dockerfile`        | `./entrypoint.sh` (Gunicorn on port 8080) |
| `celery-worker`      | `HRMS/backend/Dockerfile.celery` | Celery worker: 4 queues (default, imports, reports, payroll), concurrency 4 |

### Network Architecture

```
VPC: 10.0.0.0/20
  Subnet: Primary range
  Secondary ranges (reserved for future GKE):
    Pods:     10.4.0.0/14
    Services: 10.8.0.0/20
  Serverless VPC Connector: 10.1.0.0/28

Cloud SQL:  Private IP (via VPC peering)
Redis:      Private IP (via VPC peering)
Cloud Run:  Connects via Serverless VPC Connector (PRIVATE_RANGES_ONLY egress)
```

---

## Monitoring and Alerting

### Alert Policies (16 total per environment)

**Critical (Email + Slack):**
- API Liveness failure (uptime check down for 5 min)
- API Latency > 8s p95 (sustained 5 min)
- API Error Rate > 5% (sustained 5 min)
- Cloud SQL CPU > 90% (sustained 5 min)
- Cloud SQL Memory > 92% (sustained 5 min)
- Cloud SQL Disk > 90% (sustained 5 min)
- Redis Memory > 85% (sustained 5 min)
- Application Error Spike > 50 in 5 min (log-based)

**Warning (Email only):**
- API Readiness failure (heavy check down for 10 min)
- API Latency > 3s p95 (sustained 5 min)
- API Error Rate > 2% (sustained 5 min)
- Cloud SQL CPU > 70% (sustained 5 min)
- Cloud SQL Memory > 80% (sustained 5 min)
- Cloud SQL Disk > 75% (sustained 5 min)
- Redis Memory > 70% (sustained 5 min)
- Worker at Max Scale (sustained 10 min)
- Celery Task Failures > 10 in 10 min (log-based)

### Custom Dashboard

A Terraform-managed dashboard is created automatically with 12 widgets:
- API Request Latency (p50/p95/p99)
- API Request Count by Status Code
- API Instance Count
- Cloud SQL CPU Utilization
- Cloud SQL Memory Utilization
- Cloud SQL Active Connections
- Cloud SQL Disk Utilization
- Redis Memory Usage
- Redis Cache Hit Ratio
- Worker Instance Count
- Application Errors (log-based)
- Celery Task Failures (log-based)

Access via: **GCP Console > Monitoring > Dashboards > `{name_prefix} HRMS Dashboard`**

### Log-Based Metrics

| Metric                          | Source                          | Type          |
|---------------------------------|---------------------------------|---------------|
| `*_app_errors`                  | `jsonPayload.level="ERROR"`     | DELTA / INT64 |
| `*_slow_queries`                | `jsonPayload.event="slow_query"`| DISTRIBUTION  |
| `*_task_failures`               | `jsonPayload.event="task_failure"` | DELTA / INT64 |
| `*_http_request_latency`        | `jsonPayload.event="http_request"` | DISTRIBUTION  |

---

## Troubleshooting

### Common First-Deployment Issues

**1. Terraform fails: "Error creating instance: 409 Conflict"**

Cloud SQL instance names must be globally unique and cannot be reused for 7 days after deletion.
If you previously created and deleted an instance with the same name, either wait 7 days or
change the `name_prefix` in your tfvars.

**2. Cloud Run fails: "Image not found"**

Terraform tried to create the Cloud Run service before images exist. Push initial images (step d),
then re-run `make apply ENV=staging`.

**3. Cloud Run fails: "Container failed to start"**

Check logs:
```bash
gcloud run services logs read nhia-hrms-staging-api \
  --region=$REGION \
  --project=$PROJECT_ID \
  --limit=50
```

Common causes:
- Missing or incorrect secret values in Secret Manager
- Database not reachable (VPC connector issue)
- Missing database / migration not run

**4. SSL certificate stuck in PROVISIONING**

- Verify DNS records resolve: `dig staging.hrms.nhia.gov.gh +short`
- Check for CAA records: `dig nhia.gov.gh CAA +short`
- Wait up to 24 hours
- Ensure the domain in `ssl_certificate_domains` matches the DNS record exactly

**5. "Permission denied" errors**

Verify service account roles:
```bash
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:*api-sa*" \
  --format="table(bindings.role)"
```

**6. Database connection refused from Cloud Run**

- Verify VPC connector is healthy:
  ```bash
  gcloud compute networks vpc-access connectors describe nhia-hrms-staging-connector \
    --region=$REGION --project=$PROJECT_ID
  ```
- Verify private services access is configured
- Check that the Cloud SQL instance has a private IP

**7. Redis connection timeout**

- Verify Memorystore instance is in the same VPC
- Check that Redis AUTH password matches the secret in Secret Manager
- Verify the VPC connector egress setting is `PRIVATE_RANGES_ONLY`

**8. Frontend returns 403 Forbidden**

- Verify bucket-level public access:
  ```bash
  gcloud storage buckets describe gs://nhia-hrms-staging-frontend \
    --format="value(iamConfiguration.uniformBucketLevelAccess.enabled)"
  ```
- Verify `allUsers` has `roles/storage.objectViewer`
- Ensure `index.html` exists in the bucket root

**9. Celery worker not processing tasks**

- Check worker logs:
  ```bash
  gcloud run services logs read nhia-hrms-staging-worker \
    --region=$REGION --project=$PROJECT_ID --limit=50
  ```
- Verify Redis connectivity (Celery broker)
- Verify the worker is running the correct queues: `default,imports,reports,payroll`

### Useful Commands

```bash
# View Cloud Run service status
gcloud run services describe nhia-hrms-staging-api --region=$REGION --project=$PROJECT_ID

# View recent Cloud Run revisions
gcloud run revisions list --service=nhia-hrms-staging-api --region=$REGION --project=$PROJECT_ID

# View Cloud SQL instance
gcloud sql instances describe $(gcloud sql instances list --project=$PROJECT_ID --format="value(name)" --limit=1) --project=$PROJECT_ID

# View Redis instance
gcloud redis instances describe $(gcloud redis instances list --region=$REGION --project=$PROJECT_ID --format="value(name)" --limit=1) --region=$REGION --project=$PROJECT_ID

# View alert incidents
gcloud alpha monitoring policies list --project=$PROJECT_ID --format="table(displayName,enabled)"

# Stream Cloud Run logs in real time
gcloud run services logs tail nhia-hrms-staging-api --region=$REGION --project=$PROJECT_ID

# Check Terraform state
cd infra && make state-list ENV=staging
```

---

## Post-Deployment Checklist

After completing the first deployment, verify these items:

- [ ] API responds at `/healthz/` with HTTP 200
- [ ] API responds at `/readyz/` with HTTP 200 (database + Redis connected)
- [ ] Frontend loads at the custom domain
- [ ] SSL certificate is `ACTIVE` (not `PROVISIONING`)
- [ ] Admin can log in to the Django admin panel
- [ ] Celery worker is processing tasks (check via admin or Flower)
- [ ] Monitoring dashboard shows data
- [ ] Uptime checks are passing in Cloud Monitoring
- [ ] Alert notification channels are verified (email + Slack)
- [ ] Scheduled maintenance workflow is enabled in GitHub Actions
- [ ] GitHub Actions can authenticate via Workload Identity Federation
- [ ] Seed data is loaded (roles, permissions, tax brackets, bank codes)
- [ ] Database backups are running (check Cloud SQL backup schedule)
- [ ] CDN is serving cached assets (check `x-cache` header in browser dev tools)
- [ ] Cloud Armor WAF is blocking test SQL injection attempts
