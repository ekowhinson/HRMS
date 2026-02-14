# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NHIA HRMS — a multi-tenant Human Resource Management System with ERP capabilities. Django 5.2 REST API backend, React 18 + Vite frontend, Celery async workers, PostgreSQL, and Redis. Deployed to GCP Cloud Run.

## Repository Layout

```
HRMS/
├── HRMS/backend/       # Django REST API (config/ is the Django project module)
├── HRMS/frontend/      # React + Vite + TypeScript SPA
├── HRMS/docs/          # Architecture, deployment, operations docs
├── infra/              # Terraform IaC (11 GCP modules, staging/production)
├── scripts/            # Deployment, migration, E2E test scripts
├── .github/workflows/  # CI, deploy-staging, deploy-production, rollback, maintenance
├── docker-compose.yml  # Production-like compose
└── docker-compose.override.yml  # Dev overrides (hot-reload, runserver)
```

## Development Commands

### Local environment (Docker Compose)

```bash
# Start all services (dev mode with hot-reload)
cp .env.example .env
docker compose up

# Production-like (no dev overrides)
docker compose -f docker-compose.yml up
```

Dev ports: backend → 8000, frontend → 3000, PostgreSQL → 5433, Redis → 6380

### Backend (Django)

```bash
cd HRMS/backend

# Run dev server (outside Docker)
python manage.py runserver

# Migrations
python manage.py makemigrations
python manage.py migrate

# Run all tests
python manage.py test

# Run tests for a single app
python manage.py test payroll
python manage.py test payroll.test_backpay

# Seed all reference data
python manage.py seed_all_data

# Other useful management commands
python manage.py load_initial_data
python manage.py setup_organization
python manage.py setup_approval_workflows
python manage.py create_payroll_periods
python manage.py warm_caches
python manage.py flush_caches
```

Settings are selected via `DJANGO_ENV` env var → `config.settings.{development,staging,production}`.

### Frontend (React + Vite)

```bash
cd HRMS/frontend

npm install
npm run dev       # Vite dev server on port 3000
npm run build     # TypeScript check + production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

Path alias: `@/` maps to `src/`.

### Infrastructure (Terraform)

```bash
cd infra
make init ENV=staging
make plan ENV=staging
make apply ENV=staging
```

## Backend Architecture

**Django project module:** `config/` (not the app name — settings, urls, celery, wsgi all live here).

**Settings:** `config/settings/{base,development,staging,production}.py`. Environment selected by `DJANGO_ENV`.

**Custom user model:** `accounts.User` (UUID PK, email-based auth).

**Base model hierarchy:** All app models inherit from `core.models.BaseModel` which provides UUID PK, soft delete, audit fields (`created_by`, `updated_by`, `created_at`, `updated_at`), and tenant FK for multi-tenancy.

**API pattern:** DRF ViewSets + Routers, all under `/api/v1/`. Each app has its own `urls.py`, `views.py`, `serializers.py`. Standard pagination (25/page), filtering (django-filter), search, ordering. JWT auth via `core.authentication.AuditJWTAuthentication`.

**Key middleware chain** (in order): SecurityMiddleware → CORS → Session → Common → CSRF → Auth → TenantMiddleware → ModuleAccessMiddleware → CurrentUserMiddleware → Messages → XFrame → AuditLogMiddleware → SecurityHeadersMiddleware → CacheControlMiddleware.

**Celery queues:** `default`, `imports`, `reports`, `payroll`. Task routing in `config/celery.py` sends `reports.tasks.*` → reports queue, `payroll.tasks.*` → payroll queue, etc. Beat scheduler runs periodic cleanup, health metrics, HR business logic checks.

**Auth backends:** Local (email/password), LDAP, Azure AD — configured via `AuthProvider` model. 2FA support (TOTP).

**API docs:** Swagger at `/api/docs/`, ReDoc at `/api/redoc/`, schema at `/api/schema/`.

**Health probes:** `/healthz/` (liveness), `/readyz/` (readiness — checks DB + Redis).

### Django Apps (21 total)

`accounts` (auth/users/roles), `employees`, `organization` (divisions/depts/grades/positions), `payroll` (salary structures/components/periods — largest at 84KB models), `recruitment`, `leave`, `benefits` (loans/claims), `performance` (appraisals/goals), `discipline` (cases/grievances), `reports` (analytics/exports/builder), `workflow` (approval engine), `policies`, `exits`, `training`, `finance` (GL/budgets/journals), `procurement` (POs/requisitions), `inventory` (stock/assets/depreciation), `projects` (tasks/timesheets), `assistant` (AI-powered), `manufacturing` (work orders/BOM), `core` (base models/cache/audit/health/notifications).

## Frontend Architecture

**Stack:** React 18 + TypeScript 5.6 (strict) + Vite 5.4 + Tailwind CSS 3.4.

**State management:** Zustand for auth state (`features/auth/store.ts`, persisted to localStorage as `hrms-auth-storage`). TanStack React Query for server state (5-min staleTime). TanStack React Table for data grids.

**API client:** Axios instance in `lib/api.ts` with request interceptor (adds Bearer token + X-Tenant-ID header) and response interceptor (auto token refresh on 401).

**Routing:** React Router v6 in `App.tsx` — 150+ lazy-loaded pages organized as public/auth, core, portal (employee self-service), admin, and reports.

**Key directories:**
- `src/components/ui/` — 22 reusable components (Button, Input, Modal, Table, Card, etc.)
- `src/components/layout/` — MainLayout (sidebar nav), PortalLayout
- `src/components/charts/` — Recharts wrappers (Bar, Line, Pie, Area, Gauge, Sparkline)
- `src/services/` — 40 API service files organized by domain
- `src/pages/` — Page components (top-level, `portal/`, `admin/`, `reports/`, module subdirs)
- `src/hooks/` — Custom hooks (useClientPagination, useExport, useModuleAccess, usePeriodRange)
- `src/lib/` — api.ts, utils.ts (cn, formatCurrency, formatDate), design-tokens.ts, roles.ts
- `src/types/index.ts` — Centralized TypeScript type definitions

**Build:** Vite with manual chunk splitting: vendor-react, vendor-query, vendor-ui, vendor-utils.

**Design tokens:** Emerald/teal primary, violet accent. Defined in `tailwind.config.js` and `lib/design-tokens.ts`.

## CI/CD Pipeline

Branch strategy: `feature/*` → `develop` (auto-deploys to staging) → `main` (deploys to production with canary rollout).

Workflows: `ci.yml` (lint/test/build on PRs), `deploy-staging.yml`, `deploy-production.yml` (canary: 0→10→50→100%), `rollback.yml` (manual), `scheduled-maintenance.yml` (weekly vuln audit, daily backup check).

## Key Conventions

- All models use UUID primary keys, never auto-increment integers
- Soft deletes — records are marked deleted, not removed from DB
- Multi-tenancy enforced via `TenantMiddleware` and `BaseModel.tenant` FK
- Thread-local user/tenant context via `core.middleware.get_current_user()` / `get_current_tenant()`
- Cache keys follow pattern: `hrms:{app}:{model}:{action}:{filters}`
- Celery tasks use `acks_late=True`, 10-min hard time limit, 5-min soft limit
- Production runs Gunicorn (2 workers, gthread, 4 threads) on port 8080
- Frontend proxies `/api/` to backend via Vite dev proxy or Nginx in production
- Currency defaults to GHS (Ghanaian Cedi) — see `lib/utils.ts` formatCurrency
