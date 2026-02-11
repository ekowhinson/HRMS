#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# NHIA HRMS – Safe Migration Runner
#
# Connects via Cloud SQL Auth Proxy (if on GCP), sets safety timeouts,
# runs migration plan, and verifies clean state afterward.
#
# Usage:
#   ./scripts/migration/run-migrations.sh                    # Auto mode (CI)
#   ./scripts/migration/run-migrations.sh --interactive      # Manual confirmation
#   ./scripts/migration/run-migrations.sh --app employees    # Single app
#   ./scripts/migration/run-migrations.sh --dry-run          # Plan only
#   ./scripts/migration/run-migrations.sh --proxy            # Start Cloud SQL Proxy
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Color helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[OK]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR]${NC}  $*" >&2; }

# ── Configuration ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKEND_DIR="$PROJECT_ROOT/HRMS/backend"
MANAGE_PY="$BACKEND_DIR/manage.py"

INTERACTIVE=false
DRY_RUN=false
USE_PROXY=false
APP_LABEL=""
STATEMENT_TIMEOUT="30s"  # Prevent long-running DDL locks
LOCK_TIMEOUT="10s"       # Fail fast if can't acquire lock
PROXY_PID=""

# ── Parse arguments ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --interactive|-i) INTERACTIVE=true; shift ;;
    --dry-run|-n)     DRY_RUN=true; shift ;;
    --proxy|-p)       USE_PROXY=true; shift ;;
    --app)            APP_LABEL="$2"; shift 2 ;;
    --timeout)        STATEMENT_TIMEOUT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--interactive] [--dry-run] [--proxy] [--app APP] [--timeout TIMEOUT]"
      exit 0
      ;;
    *) error "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Cleanup function ─────────────────────────────────────────────────────────
cleanup() {
  if [[ -n "$PROXY_PID" ]]; then
    info "Stopping Cloud SQL Auth Proxy (PID: $PROXY_PID)..."
    kill "$PROXY_PID" 2>/dev/null || true
    wait "$PROXY_PID" 2>/dev/null || true
    success "Proxy stopped."
  fi
}
trap cleanup EXIT

# ── Start Cloud SQL Auth Proxy if requested ──────────────────────────────────
start_proxy() {
  local connection_name="${CLOUD_SQL_CONNECTION_NAME:-}"
  if [[ -z "$connection_name" ]]; then
    error "CLOUD_SQL_CONNECTION_NAME not set. Cannot start proxy."
    exit 1
  fi

  info "Starting Cloud SQL Auth Proxy for: $connection_name"

  if ! command -v cloud-sql-proxy &>/dev/null; then
    error "cloud-sql-proxy not found. Install: https://cloud.google.com/sql/docs/postgres/connect-auth-proxy"
    exit 1
  fi

  cloud-sql-proxy "$connection_name" \
    --port=5432 \
    --quiet &
  PROXY_PID=$!

  # Wait for proxy to be ready
  for i in $(seq 1 30); do
    if pg_isready -h localhost -p 5432 &>/dev/null; then
      success "Cloud SQL Auth Proxy ready."
      return
    fi
    sleep 1
  done

  error "Cloud SQL Auth Proxy failed to start within 30 seconds."
  exit 1
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  NHIA HRMS — Migration Runner${NC}"
  echo -e "${BLUE}══════════════════════════════════════════════════════════════${NC}"
  echo ""

  cd "$BACKEND_DIR"

  # Start proxy if needed
  if $USE_PROXY; then
    start_proxy
  fi

  # ── Step 1: Run migration safety check ────────────────────────────────
  info "Running migration safety analysis..."
  if ! python "$SCRIPT_DIR/check-migration-safety.py" ${APP_LABEL:+--app "$APP_LABEL"}; then
    error "Migration safety check failed. Resolve issues before proceeding."
    exit 1
  fi

  # ── Step 2: Show migration plan ───────────────────────────────────────
  info "Generating migration plan..."
  echo ""

  PLAN_ARGS=""
  if [[ -n "$APP_LABEL" ]]; then
    PLAN_ARGS="$APP_LABEL"
  fi

  python "$MANAGE_PY" showmigrations --plan | grep -E "^\[ \]" || {
    success "No pending migrations."
    exit 0
  }

  echo ""
  info "Detailed migration plan:"
  python "$MANAGE_PY" migrate --plan $PLAN_ARGS 2>&1 | tee /tmp/migration-plan.txt
  echo ""

  if $DRY_RUN; then
    info "Dry run complete. No changes applied."
    exit 0
  fi

  # ── Step 3: Confirmation (interactive mode) ───────────────────────────
  if $INTERACTIVE; then
    echo -e "${YELLOW}"
    read -rp "Apply these migrations? (yes/no): " confirm
    echo -e "${NC}"
    if [[ "$confirm" != "yes" ]]; then
      warn "Aborted by user."
      exit 0
    fi
  fi

  # ── Step 4: Set safety timeouts ───────────────────────────────────────
  info "Setting safety timeouts: statement_timeout=$STATEMENT_TIMEOUT, lock_timeout=$LOCK_TIMEOUT"

  export PGOPTIONS="-c statement_timeout=${STATEMENT_TIMEOUT} -c lock_timeout=${LOCK_TIMEOUT}"

  # ── Step 5: Run migrations ────────────────────────────────────────────
  info "Applying migrations..."
  echo ""

  MIGRATE_START=$(date +%s)

  if python "$MANAGE_PY" migrate $PLAN_ARGS --verbosity 2 2>&1 | tee /tmp/migration-output.txt; then
    MIGRATE_END=$(date +%s)
    DURATION=$((MIGRATE_END - MIGRATE_START))
    echo ""
    success "Migrations applied successfully in ${DURATION}s."
  else
    MIGRATE_END=$(date +%s)
    DURATION=$((MIGRATE_END - MIGRATE_START))
    echo ""
    error "Migration FAILED after ${DURATION}s. Check output above."

    # Show last few lines for context
    echo ""
    echo "Last 20 lines of migration output:"
    tail -20 /tmp/migration-output.txt
    exit 1
  fi

  # ── Step 6: Verify clean state ────────────────────────────────────────
  info "Verifying migration state..."

  PENDING=$(python "$MANAGE_PY" showmigrations --plan 2>/dev/null | grep -c "^\[ \]" || echo "0")

  if [[ "$PENDING" -gt 0 ]]; then
    warn "$PENDING migration(s) still pending after running migrate."
    python "$MANAGE_PY" showmigrations --plan | grep "^\[ \]"
    exit 1
  fi

  success "Migration state is clean — no pending migrations."

  # ── Step 7: Django system check ───────────────────────────────────────
  info "Running Django system checks..."
  if python "$MANAGE_PY" check --deploy 2>&1 | grep -qi "system check identified"; then
    warn "Django system check raised issues. Review above output."
  else
    success "Django system checks passed."
  fi

  echo ""
  echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  Migration complete!${NC}"
  echo -e "${GREEN}══════════════════════════════════════════════════════════════${NC}"
  echo ""
}

main "$@"
