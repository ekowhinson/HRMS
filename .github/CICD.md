# CI/CD Pipeline Configuration

## Overview

The NHIA HRMS uses GitHub Actions for continuous integration and deployment to GCP Cloud Run.

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | PR to develop/main | Lint, test, security scan, build verification |
| `deploy-staging.yml` | Push to develop | Build, migrate, deploy to staging, smoke test |
| `deploy-production.yml` | Push to main | Build, snapshot, migrate, canary deploy, release |
| `rollback.yml` | Manual dispatch | Revert to a previous Cloud Run revision |
| `scheduled-maintenance.yml` | Cron schedule | Dependency audits, backup checks, key rotation |

## GitHub Configuration

### Secrets (Settings > Secrets and variables > Actions)

| Secret | Description |
|--------|-------------|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | WIF provider resource name (from `bootstrap.sh` output) |
| `GCP_SERVICE_ACCOUNT_EMAIL` | Terraform SA email (from `bootstrap.sh` output) |
| `GCP_PROJECT_ID_STAGING` | Staging GCP project ID (e.g., `nhia-hrms-staging`) |
| `GCP_PROJECT_ID_PRODUCTION` | Production GCP project ID (e.g., `nhia-hrms-production`) |

### Variables (Settings > Secrets and variables > Actions > Variables)

| Variable | Example | Description |
|----------|---------|-------------|
| `GCP_REGION` | `us-central1` | GCP region for all resources |
| `STAGING_API_URL` | `https://api.staging.hrms.nhia.gov.gh` | Staging API base URL |
| `PRODUCTION_API_URL` | `https://api.hrms.nhia.gov.gh` | Production API base URL |
| `STAGING_BUCKET` | `nhia-hrms-staging-frontend` | Staging frontend GCS bucket |
| `PRODUCTION_BUCKET` | `nhia-hrms-production-frontend` | Production frontend GCS bucket |
| `SLACK_WEBHOOK_URL` | `https://hooks.slack.com/...` | (Optional) Slack notifications |

### Environments (Settings > Environments)

**staging**
- No protection rules
- Secrets/variables scoped to staging

**production**
- Required reviewers: 1 (minimum)
- Deployment branch: `main` only
- Secrets/variables scoped to production

## Pipeline Details

### CI Pipeline (`ci.yml`)

Runs on every pull request:

```
backend-lint ─────┐
backend-test ─────┤
backend-security ─┤── All must pass
frontend-lint ────┤
frontend-build ───┤
frontend-security─┤
docker-build ─────┘
```

- **Backend**: ruff lint/format, bandit security scan, pip-audit, Django checks, migration check, pytest with PostgreSQL (80% coverage threshold)
- **Frontend**: ESLint, TypeScript check, build verification, npm audit
- **Docker**: Build verification for both backend and celery-worker images

### Staging Deploy (`deploy-staging.yml`)

```
ci ──> build-and-push ──> migrate-database ──> deploy-backend ──> smoke-tests
                     └──> deploy-frontend ─────────────────────┘
```

1. Runs full CI suite
2. Builds and pushes Docker images to Artifact Registry
3. Runs database migrations via Cloud Run Job
4. Deploys API with 0% traffic, health checks, then shifts to 100%
5. Deploys Celery worker with same image
6. Builds and uploads frontend to GCS with proper cache headers
7. Runs smoke tests against staging endpoints

### Production Deploy (`deploy-production.yml`)

```
ci ──> build-and-push ──> pre-deploy-snapshot ──> migrate-database ──> canary-deploy ──> smoke-tests ──> post-deploy
                     └──> deploy-frontend ────────────────────────────────────────────┘
```

Adds on top of staging:
- **Environment protection**: Requires 1 approval before deploy
- **Pre-deploy snapshot**: Triggers Cloud SQL backup before migration
- **Canary deployment**:
  - Deploy at 0% traffic
  - Shift to 10%, monitor 5 minutes
  - If error rate < 1%: shift to 50%, monitor 5 more minutes
  - If still healthy: shift to 100%
  - If errors at any stage: automatic rollback to previous revision
- **Post-deploy**: Git tag, GitHub Release with changelog, Slack notification

### Rollback (`rollback.yml`)

Manual trigger with inputs:
- `environment`: staging or production
- `revision`: specific revision name or "previous"
- `reason`: documented reason for audit trail

Actions:
1. Resolves target revision
2. Shifts 100% traffic to target revision
3. Invalidates CDN cache
4. Verifies health check
5. Notifies via Slack

### Scheduled Maintenance

| Schedule | Task | Action |
|----------|------|--------|
| Weekly (Mon 6 UTC) | Dependency audit | pip-audit + npm audit, creates GitHub issue if vulnerabilities found |
| Daily (8 UTC) | Backup verification | Checks production Cloud SQL has a successful backup < 25 hours old |
| Monthly (1st 9 UTC) | Key rotation check | Audits service account keys, flags any > 90 days old |

## Branching Strategy

```
feature/* ──> develop ──> main
              (staging)   (production)
```

1. Create feature branch from `develop`
2. Open PR to `develop` — triggers CI
3. Merge to `develop` — triggers staging deploy
4. Open PR from `develop` to `main` — triggers CI
5. Merge to `main` — triggers production deploy (with approval gate)

## Quick Reference

```bash
# Manual rollback
gh workflow run rollback.yml -f environment=production -f revision=previous -f reason="Error spike"

# Manual maintenance
gh workflow run scheduled-maintenance.yml -f task=dependency-audit

# Check workflow status
gh run list --workflow=deploy-production.yml
```
