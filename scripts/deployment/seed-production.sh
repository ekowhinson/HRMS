#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NHIA HRMS – Seed Production/Staging Data
#
# Loads essential fixture data (roles, permissions, tax brackets, etc.)
# Idempotent: safe to run multiple times — uses get_or_create internally.
#
# Usage:
#   ./scripts/deployment/seed-production.sh                  # Default: production
#   ./scripts/deployment/seed-production.sh --env staging
#   ./scripts/deployment/seed-production.sh --env production --proxy
#   ./scripts/deployment/seed-production.sh --dry-run
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/HRMS/backend"
MANAGE_PY="$BACKEND_DIR/manage.py"

ENV="production"
DRY_RUN=false
USE_PROXY=false
PROXY_PID=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --env|-e)      ENV="$2"; shift 2 ;;
    --dry-run|-n)  DRY_RUN=true; shift ;;
    --proxy|-p)    USE_PROXY=true; shift ;;
    -h|--help)
      echo "Usage: $0 [--env staging|production] [--dry-run] [--proxy]"
      exit 0
      ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

cleanup() {
  if [[ -n "$PROXY_PID" ]]; then
    kill "$PROXY_PID" 2>/dev/null || true
    wait "$PROXY_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  NHIA HRMS — Seed Data Loader (${ENV})${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
echo ""

cd "$BACKEND_DIR"

# Start proxy if requested
if $USE_PROXY; then
  CONNECTION="${CLOUD_SQL_CONNECTION_NAME:-}"
  if [[ -z "$CONNECTION" ]]; then
    error "CLOUD_SQL_CONNECTION_NAME not set."
    exit 1
  fi
  info "Starting Cloud SQL Auth Proxy..."
  cloud-sql-proxy "$CONNECTION" --port=5432 --quiet &
  PROXY_PID=$!
  sleep 5
fi

# ── Step 1: Verify database connectivity ─────────────────────────────────
info "Verifying database connectivity..."
if ! python "$MANAGE_PY" check --database default 2>/dev/null; then
  error "Cannot connect to database. Check your configuration."
  exit 1
fi
success "Database connection verified."

# ── Step 2: Verify migrations are current ────────────────────────────────
info "Checking migration state..."
PENDING=$(python "$MANAGE_PY" showmigrations --plan 2>/dev/null | grep -c "^\[ \]" || echo "0")
if [[ "$PENDING" -gt 0 ]]; then
  warn "$PENDING pending migration(s). Run migrations before seeding."
  if [[ "$ENV" == "production" ]]; then
    error "Cannot seed production with pending migrations."
    exit 1
  fi
fi

if $DRY_RUN; then
  info "DRY RUN — showing what would be loaded."
  echo ""
fi

# ── Step 3: Load core fixtures (all environments) ────────────────────────
info "Loading core fixture data (roles, permissions, tax brackets, etc.)..."

if $DRY_RUN; then
  echo "  Would run: python manage.py load_initial_data"
else
  python "$MANAGE_PY" load_initial_data
fi
success "Core fixtures loaded."

# ── Step 4: Load bank data ───────────────────────────────────────────────
info "Loading Ghana bank sort codes..."

if $DRY_RUN; then
  echo "  Would run: python manage.py seed_banks"
else
  python "$MANAGE_PY" seed_banks 2>/dev/null || warn "seed_banks command not available — skipping."
fi

# ── Step 5: Environment-specific fixtures ────────────────────────────────
case "$ENV" in
  staging)
    info "Loading staging-specific data..."

    if ! $DRY_RUN; then
      # Create a test admin user for staging
      python "$MANAGE_PY" shell -c "
from accounts.models import User
if not User.objects.filter(email='admin@staging.nhia.gov.gh').exists():
    user = User.objects.create_superuser(
        email='admin@staging.nhia.gov.gh',
        username='staging-admin',
        password='staging-temp-password-change-me',
        first_name='Staging',
        last_name='Admin',
    )
    print(f'  Created staging admin: {user.email}')
else:
    print('  Staging admin already exists.')
" 2>/dev/null || warn "Could not create staging admin user."
    else
      echo "  Would create staging admin user: admin@staging.nhia.gov.gh"
    fi

    success "Staging fixtures loaded."
    ;;

  production)
    info "Production environment — no test data will be loaded."

    if ! $DRY_RUN; then
      # Ensure payroll roles exist
      python "$MANAGE_PY" setup_payroll_roles 2>/dev/null || warn "setup_payroll_roles not available — skipping."
    fi

    success "Production fixtures loaded."
    ;;

  *)
    warn "Unknown environment: $ENV — loading core fixtures only."
    ;;
esac

# ── Step 6: Warm caches ─────────────────────────────────────────────────
info "Warming caches with lookup data..."

if ! $DRY_RUN; then
  python "$MANAGE_PY" warm_caches 2>/dev/null || warn "Cache warming skipped (Redis may not be available)."
fi

# ── Summary ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Seed data loading complete! (${ENV})${NC}"
echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
echo ""

if $DRY_RUN; then
  warn "This was a dry run. No data was actually loaded."
fi
