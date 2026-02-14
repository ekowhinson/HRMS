# NHIA HRMS -- System Architecture Document

> **Version:** 1.0
> **Last Updated:** 2026-02-14
> **System:** National Health Insurance Authority Human Resource Management System
> **Status:** Production

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Application Architecture](#2-application-architecture)
3. [Data Flow Diagrams](#3-data-flow-diagrams)
4. [Service Dependency Map](#4-service-dependency-map)
5. [Infrastructure Layout](#5-infrastructure-layout)
6. [Capacity Planning](#6-capacity-planning)

---

## 1. System Overview

The NHIA HRMS is a multi-tenant, modular enterprise system built on Django 6.0.1 (backend) and React 18 (frontend), deployed on Google Cloud Platform using Cloud Run for serverless container hosting. The system supports 21 domain modules gated by per-tenant licensing, asynchronous job processing via Celery, and a 5-tier Redis caching strategy.

### 1.1 High-Level System Diagram

```mermaid
graph TB
    subgraph Users
        Browser["Browser / SPA Client"]
        Mobile["Mobile Browser"]
    end

    subgraph "Google Cloud Platform"
        subgraph "Edge Layer"
            CloudArmor["Cloud Armor<br/>(WAF / DDoS)"]
            HTTPS_LB["Global HTTPS<br/>Load Balancer"]
            CDN["Cloud CDN"]
        end

        subgraph "Frontend Hosting"
            GCS["GCS Bucket<br/>(React SPA Static Assets)"]
        end

        subgraph "Compute Layer"
            CloudRun_API["Cloud Run<br/>API Service<br/>(Django 6.0.1 + Gunicorn)"]
            CloudRun_Worker["Cloud Run<br/>Worker Service<br/>(Celery Workers)"]
            CloudRun_Beat["Cloud Run Job<br/>(Celery Beat Scheduler)"]
        end

        subgraph "Data Layer"
            CloudSQL["Cloud SQL<br/>PostgreSQL 15<br/>(HA / REGIONAL)"]
            Redis["Memorystore<br/>Redis 7.0"]
            CloudStorage["Cloud Storage<br/>(Media / Uploads / Backups)"]
        end

        subgraph "Platform Services"
            SecretMgr["Secret Manager"]
            ArtifactReg["Artifact Registry"]
            CloudTrace["Cloud Trace"]
            CloudLogging["Cloud Logging"]
            CloudMonitoring["Cloud Monitoring"]
            Sentry["Sentry<br/>(Error Tracking)"]
        end
    end

    Browser --> CloudArmor
    Mobile --> CloudArmor
    CloudArmor --> HTTPS_LB
    HTTPS_LB -->|"Static assets<br/>*.js, *.css, *.html"| CDN
    CDN --> GCS
    HTTPS_LB -->|"/api/v1/*<br/>/healthz, /readyz"| CloudRun_API

    CloudRun_API -->|"CONN_MAX_AGE=600"| CloudSQL
    CloudRun_API -->|"Cache DB 1"| Redis
    CloudRun_API -->|"Enqueue tasks<br/>Broker DB 0"| Redis
    CloudRun_API --> CloudStorage
    CloudRun_API --> SecretMgr

    CloudRun_Worker -->|"Consume tasks<br/>Broker DB 0"| Redis
    CloudRun_Worker --> CloudSQL
    CloudRun_Worker --> CloudStorage
    CloudRun_Worker --> SecretMgr

    CloudRun_Beat -->|"Publish periodic tasks"| Redis

    CloudRun_API --> CloudTrace
    CloudRun_API --> CloudLogging
    CloudRun_API --> Sentry
    CloudRun_Worker --> CloudLogging
    CloudRun_Worker --> Sentry

    CloudMonitoring --> CloudRun_API
    CloudMonitoring --> CloudRun_Worker
    CloudMonitoring --> CloudSQL
    CloudMonitoring --> Redis
```

### 1.2 Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React, TypeScript, Vite | 18.3, 5.6, 5.4 |
| **UI Framework** | TailwindCSS, Headless UI | 3.4, 2.1 |
| **State Management** | Zustand, React Query | 4.4, 5.0 |
| **Routing** | React Router DOM | 6.21 |
| **Forms** | React Hook Form + Zod | 7.49, 3.22 |
| **Charts** | Recharts | 2.10 |
| **Backend** | Django, DRF | 6.0.1, 3.16.1 |
| **Auth** | SimpleJWT (HS256) + 2FA | - |
| **Auth Backends** | Local, LDAP, Azure AD | - |
| **Database** | PostgreSQL | 15 |
| **Cache / Broker** | Redis (Memorystore) | 7.0 |
| **Task Queue** | Celery + Beat | - |
| **API Docs** | drf-spectacular (OpenAPI 3) | - |
| **Container Runtime** | Cloud Run (GCP) | - |
| **IaC** | Terraform (12 modules) | - |
| **CI/CD** | GitHub Actions (5 workflows) | - |
| **Monitoring** | Cloud Monitoring, Sentry, Cloud Trace | - |

---

## 2. Application Architecture

### 2.1 Django Module Map

The 21 Django apps are organized into four functional domains. Module access is enforced at runtime by `ModuleAccessMiddleware`, which auto-discovers the module name from the URL path (`/api/v1/<module>/...`) and checks the tenant's license. Ungated modules (core, accounts, organization, assistant, policies) are always accessible.

```mermaid
graph LR
    subgraph "Core Platform (Always Accessible)"
        core["core<br/>─────────<br/>Middleware<br/>Caching<br/>Health Probes<br/>Audit Logging<br/>Backup/Restore"]
        accounts["accounts<br/>─────────<br/>Users<br/>JWT Auth / 2FA<br/>Roles & Permissions<br/>Multi-Org"]
        organization["organization<br/>─────────<br/>Tenants<br/>Divisions<br/>Directorates<br/>Departments<br/>Job Grades<br/>Positions<br/>Work Locations"]
        workflow["workflow<br/>─────────<br/>Approval Engine<br/>Step Definitions<br/>Routing Rules"]
    end

    subgraph "HR Modules (License-Gated)"
        employees["employees<br/>─────────<br/>Staff Records<br/>Documents<br/>Bank Accounts"]
        recruitment["recruitment<br/>─────────<br/>Vacancies<br/>Applicants<br/>Interview Scoring"]
        leave["leave<br/>─────────<br/>Leave Types<br/>Requests<br/>Balances<br/>Calendar"]
        benefits["benefits<br/>─────────<br/>Loan Types<br/>Loan Accounts<br/>Deductions"]
        performance["performance<br/>─────────<br/>Appraisal Cycles<br/>Goals<br/>Competencies<br/>Rating Scales"]
        discipline["discipline<br/>─────────<br/>Disciplinary Cases<br/>Grievances<br/>Escalation"]
        exits["exits<br/>─────────<br/>Exit Interviews<br/>Clearance<br/>Offboarding"]
        training["training<br/>─────────<br/>Programs<br/>Enrollments<br/>Certifications"]
        policies["policies<br/>─────────<br/>Company Policies<br/>SOPs<br/>Acknowledgements"]
    end

    subgraph "Finance Modules (License-Gated)"
        payroll["payroll<br/>─────────<br/>Pay Periods<br/>Payslips<br/>Components<br/>Bank Files<br/>Tax / SSNIT"]
        finance["finance<br/>─────────<br/>Chart of Accounts<br/>Journal Entries<br/>GL Reports<br/>Budgets"]
        procurement["procurement<br/>─────────<br/>Requisitions<br/>Purchase Orders<br/>Vendor Mgmt<br/>AP"]
        inventory["inventory<br/>─────────<br/>Stock Items<br/>Warehouses<br/>Fixed Assets<br/>Stocktakes"]
        projects["projects<br/>─────────<br/>Project Tracking<br/>Timesheets<br/>Cost Allocation"]
    end

    subgraph "Support Modules"
        reports["reports<br/>─────────<br/>Scheduled Reports<br/>PDF / Excel Export<br/>Report Builder"]
        assistant["assistant<br/>─────────<br/>AI Chat (Ollama)<br/>Data Queries<br/>Document Analysis"]
        manufacturing["manufacturing<br/>─────────<br/>BOM<br/>Work Orders<br/>Production"]
    end
```

### 2.2 Middleware Pipeline

Requests pass through middleware in the order defined in `config/settings/base.py`. The tenant and module-access layers sit between Django's authentication middleware and the view layer.

```mermaid
graph TD
    Request["Incoming HTTP Request"]
    MW1["SecurityMiddleware<br/>(HSTS, SSL redirect)"]
    MW1a["CSPMiddleware<br/>(Content Security Policy)<br/><i>production only</i>"]
    MW1b["WhiteNoiseMiddleware<br/>(Static files)<br/><i>production only</i>"]
    MW2["CorsMiddleware<br/>(CORS headers)"]
    MW3["SessionMiddleware"]
    MW4["CommonMiddleware"]
    MW5["CsrfViewMiddleware"]
    MW6["AuthenticationMiddleware<br/>(Django session auth)"]
    MW7["TenantMiddleware<br/>(Resolve tenant from<br/>X-Tenant-ID / user org)"]
    MW8["ModuleAccessMiddleware<br/>(License gating per module)"]
    MW9["CurrentUserMiddleware<br/>(Thread-local user for signals)"]
    MW10["MessageMiddleware"]
    MW11["XFrameOptionsMiddleware"]
    MW12["AuditLogMiddleware<br/>(Request/response logging<br/>X-Request-ID, Cloud Trace)"]
    MW13["SecurityHeadersMiddleware<br/>(X-Content-Type-Options,<br/>Referrer-Policy, etc.)"]
    MW14["CacheControlMiddleware<br/>(Cache-Control, ETags)"]
    View["DRF View<br/>(JWT auth resolved here)"]

    Request --> MW1 --> MW1a --> MW1b --> MW2 --> MW3 --> MW4 --> MW5 --> MW6
    MW6 --> MW7 --> MW8 --> MW9 --> MW10 --> MW11 --> MW12 --> MW13 --> MW14 --> View
```

### 2.3 Authentication Architecture

The system supports three authentication backends configured in `AUTHENTICATION_BACKENDS`:

| Priority | Backend | Use Case |
|----------|---------|----------|
| 1 | `LocalAuthBackend` | Username/password with HRMS user model |
| 2 | `LDAPAuthBackend` | Corporate directory integration |
| 3 | `AzureADBackend` | Microsoft 365 / Entra ID SSO |
| 4 | `ModelBackend` | Django admin fallback |

JWT tokens use HS256 signing with configurable lifetimes (default: 30-minute access, 1-day refresh). Refresh token rotation is enabled with automatic blacklisting of old tokens.

---

## 3. Data Flow Diagrams

### 3.1 Authentication Flow

```mermaid
sequenceDiagram
    actor User
    participant SPA as React SPA
    participant LB as Load Balancer
    participant API as Cloud Run API
    participant Auth as Auth Backends<br/>(Local / LDAP / Azure AD)
    participant DB as PostgreSQL
    participant Redis as Redis

    User->>SPA: Enter credentials
    SPA->>LB: POST /api/v1/auth/login/
    LB->>API: Forward request

    API->>Auth: Authenticate (try backends in order)
    Auth->>DB: Verify credentials
    DB-->>Auth: User record

    alt 2FA Enabled
        Auth-->>API: 2FA required
        API-->>SPA: 200 {requires_2fa: true, temp_token}
        User->>SPA: Enter OTP
        SPA->>API: POST /api/v1/auth/verify-2fa/
        API->>DB: Verify OTP
    end

    API->>DB: Update last_login
    API-->>SPA: 200 {access_token, refresh_token, user, permissions}
    SPA->>SPA: Store tokens (Zustand)

    Note over SPA,API: Subsequent API Requests

    SPA->>API: GET /api/v1/employees/<br/>Authorization: Bearer <access_token>
    API->>API: JWTAuthentication validates token
    API->>API: TenantMiddleware resolves org
    API->>API: ModuleAccessMiddleware checks license
    API-->>SPA: 200 {data}

    Note over SPA,API: Token Refresh

    SPA->>API: POST /api/v1/auth/token/refresh/<br/>{refresh_token}
    API->>DB: Verify refresh token not blacklisted
    API->>DB: Blacklist old refresh token
    API-->>SPA: 200 {access_token, refresh_token}

    Note over SPA,API: Logout

    SPA->>API: POST /api/v1/auth/logout/<br/>{refresh_token}
    API->>DB: Blacklist refresh token
    API-->>SPA: 200 {detail: "Logged out"}
    SPA->>SPA: Clear stored tokens
```

### 3.2 Payroll Processing Flow

```mermaid
sequenceDiagram
    actor HR as HR / Payroll Officer
    participant SPA as React SPA
    participant API as Cloud Run API
    participant Worker as Celery Worker
    participant Redis as Redis (Broker)
    participant DB as PostgreSQL

    HR->>SPA: Open Pay Period
    SPA->>API: POST /api/v1/payroll/periods/<br/>{month, year, status: "open"}
    API->>DB: Create PayPeriod (status=open)
    API-->>SPA: 201 Created

    HR->>SPA: Compute Payroll
    SPA->>API: POST /api/v1/payroll/periods/{id}/compute/
    API->>Redis: Enqueue payroll computation task (queue: payroll)
    API-->>SPA: 202 {task_id, status: "computing"}

    Redis-->>Worker: Deliver task
    Worker->>DB: Fetch active employees + pay components
    Worker->>DB: Calculate gross, deductions, net per employee
    Worker->>DB: Create/update Payslip + PayslipLine records
    Worker->>Redis: Store task result

    SPA->>API: GET /api/v1/payroll/periods/{id}/status/
    API->>Redis: Check task status
    API-->>SPA: 200 {status: "completed", summary}

    HR->>SPA: Review Payroll Summary
    SPA->>API: GET /api/v1/payroll/payslips/?period={id}
    API->>DB: Fetch payslips with lines
    API-->>SPA: 200 {payslips[]}

    HR->>SPA: Approve Payroll
    SPA->>API: POST /api/v1/payroll/periods/{id}/approve/
    API->>DB: Update period status=approved
    API->>DB: Lock payslips (is_approved=true)
    API-->>SPA: 200 {status: "approved"}

    HR->>SPA: Generate Payslips (PDF)
    SPA->>API: POST /api/v1/payroll/periods/{id}/generate-payslips/
    API->>Redis: Enqueue PDF generation task (queue: payroll)
    API-->>SPA: 202 {task_id}

    Redis-->>Worker: Deliver task
    Worker->>DB: Fetch approved payslips
    Worker->>Worker: Generate PDF payslips
    Worker->>DB: Store file references
    Worker->>Redis: Store result

    HR->>SPA: Close Period
    SPA->>API: POST /api/v1/payroll/periods/{id}/close/
    API->>DB: Update period status=closed
    API->>DB: Create audit trail entry
    API-->>SPA: 200 {status: "closed"}
```

### 3.3 Report Generation Flow

```mermaid
sequenceDiagram
    actor User
    participant SPA as React SPA
    participant API as Cloud Run API
    participant Redis as Redis<br/>(Cache DB 1 / Broker DB 0)
    participant Worker as Celery Worker
    participant DB as PostgreSQL
    participant GCS as Cloud Storage

    User->>SPA: Request Report (e.g., Employee Listing)
    SPA->>API: POST /api/v1/reports/generate/<br/>{type, format: "pdf", filters}

    API->>Redis: Check cache for report<br/>Key: rpt:{type}:{filters_hash}

    alt Cache Hit
        Redis-->>API: Cached report URL
        API-->>SPA: 200 {url, cached: true}
        SPA->>GCS: Download report
    else Cache Miss
        API->>Redis: Enqueue report generation<br/>(queue: reports)
        API-->>SPA: 202 {task_id, status: "generating"}

        Redis-->>Worker: Deliver task
        Worker->>DB: Execute report query<br/>(with filters, joins, aggregations)
        DB-->>Worker: Result set

        alt PDF Format
            Worker->>Worker: Render ReportLab PDF
        else Excel Format
            Worker->>Worker: Generate openpyxl workbook
        end

        Worker->>GCS: Upload generated file
        Worker->>Redis: Cache result URL<br/>TTL: 1 hour (long cache)
        Worker->>Redis: Store task result
    end

    SPA->>API: GET /api/v1/reports/status/{task_id}/
    API->>Redis: Check task result
    API-->>SPA: 200 {status: "completed", download_url}

    User->>SPA: Click Download
    SPA->>GCS: Download file via signed URL

    Note over Redis: Scheduled Reports (Celery Beat)

    Redis->>Worker: check-scheduled-reports (every 15 min)
    Worker->>DB: Fetch due ReportSchedule records
    Worker->>Worker: Generate report(s)
    Worker->>GCS: Upload
    Worker->>Worker: Send email notification
```

### 3.4 Multi-Tenant Request Flow

```mermaid
sequenceDiagram
    participant Client as API Client
    participant TM as TenantMiddleware
    participant MAM as ModuleAccessMiddleware
    participant View as DRF View
    participant DB as PostgreSQL

    Client->>TM: Request with X-Tenant-ID header

    TM->>TM: Resolution order:<br/>1. X-Tenant-ID header<br/>2. User's organization<br/>3. Default org (fallback)

    alt X-Tenant-ID provided
        TM->>DB: Organization.objects.get(id=tenant_id, is_active=True)
        TM->>DB: Verify user is member of org<br/>(UserOrganization lookup)
        alt User is member OR superuser
            TM->>TM: Set request.tenant = org
        else Not a member
            TM->>TM: Fall through to user's own org
        end
    else No header
        TM->>TM: Use request.user.organization
    end

    TM->>TM: Store tenant in thread-local<br/>(set_current_tenant)

    TM->>MAM: Pass to next middleware

    MAM->>MAM: Extract module from URL path<br/>/api/v1/<module>/...

    alt Module is ungated (core, accounts, organization, assistant, policies)
        MAM->>View: Allow through
    else Module is gated
        MAM->>DB: tenant.is_module_enabled(module_name)
        alt Module enabled in license
            MAM->>View: Allow through
        else Module not in license
            MAM-->>Client: 403 {error: "module_disabled"}
        end
    end
```

---

## 4. Service Dependency Map

### 4.1 Runtime Dependencies

```mermaid
graph TB
    subgraph "Cloud Run Services"
        API["API Service<br/>(Django + Gunicorn)"]
        Worker["Worker Service<br/>(Celery)"]
        Beat["Beat Scheduler<br/>(Celery Beat)"]
    end

    subgraph "Data Stores"
        CloudSQL["Cloud SQL<br/>PostgreSQL 15<br/>────────────<br/>HA (REGIONAL)<br/>4 vCPU / 16 GB<br/>100 GB SSD"]
        Redis["Memorystore Redis 7.0<br/>────────────<br/>DB 0: Celery Broker +<br/>Result Backend<br/>DB 1: Application Cache<br/>(5 tiers)"]
    end

    subgraph "Storage & Secrets"
        GCS_Media["Cloud Storage<br/>(Media / Uploads)"]
        GCS_Backups["Cloud Storage<br/>(Backups)"]
        SecretMgr["Secret Manager<br/>────────────<br/>SECRET_KEY<br/>DB_PASSWORD<br/>SENTRY_DSN<br/>EMAIL_HOST_PASSWORD"]
    end

    subgraph "Frontend"
        GCS_Static["GCS Bucket<br/>(SPA Static Assets)"]
        CDN_LB["Cloud CDN +<br/>HTTPS Load Balancer"]
        CloudArmor_FE["Cloud Armor<br/>(WAF Rules)"]
    end

    subgraph "Observability"
        Sentry["Sentry<br/>(Django + Celery +<br/>Redis integrations)"]
        CloudTrace_Obs["Cloud Trace<br/>(X-Cloud-Trace-Context)"]
        CloudLogging_Obs["Cloud Logging<br/>(JSON structured logs)"]
        CloudMonitoring_Obs["Cloud Monitoring<br/>(Health checks)"]
    end

    API -->|"Read/Write<br/>CONN_MAX_AGE=600"| CloudSQL
    API -->|"Cache (DB 1)<br/>5 tiers: default, persistent,<br/>volatile, long, sessions"| Redis
    API -->|"Enqueue tasks (DB 0)"| Redis
    API --> GCS_Media
    API --> SecretMgr
    API --> Sentry
    API --> CloudTrace_Obs
    API --> CloudLogging_Obs

    Worker -->|"Read/Write"| CloudSQL
    Worker -->|"Consume tasks (DB 0)"| Redis
    Worker --> GCS_Media
    Worker --> GCS_Backups
    Worker --> SecretMgr
    Worker --> Sentry
    Worker --> CloudLogging_Obs

    Beat -->|"Publish periodic tasks (DB 0)"| Redis

    CloudArmor_FE --> CDN_LB
    CDN_LB --> GCS_Static

    CloudMonitoring_Obs -.->|"Health probes<br/>/healthz /readyz"| API
```

### 4.2 Celery Task Queues and Periodic Tasks

```mermaid
graph LR
    subgraph "Task Queues"
        Q_Default["default<br/>────────<br/>Cache warming<br/>Health metrics<br/>HR checks<br/>Cleanup jobs"]
        Q_Reports["reports<br/>────────<br/>Report generation<br/>Scheduled reports"]
        Q_Payroll["payroll<br/>────────<br/>Payroll computation<br/>Payslip generation"]
        Q_Finance["finance<br/>────────<br/>GL posting<br/>Financial reports"]
        Q_Procurement["procurement<br/>────────<br/>PO processing<br/>Vendor notifications"]
    end

    subgraph "Periodic Tasks (Beat Schedule)"
        direction TB
        PT1["cleanup-old-audit-logs<br/>Daily 2:00 AM"]
        PT2["cleanup-expired-sessions<br/>Daily 3:00 AM"]
        PT3["cleanup-expired-tokens<br/>Daily 3:30 AM"]
        PT4["warm-cache<br/>Every 6 hours"]
        PT5["collect-health-metrics<br/>Every 5 minutes"]
        PT6["check-probation-due<br/>Daily 7:00 AM"]
        PT7["check-grievance-escalation<br/>Daily 8:00 AM"]
        PT8["check-appraisal-deadlines<br/>Daily 00:30"]
        PT9["cleanup-expired-backups<br/>Daily 3:00 AM"]
        PT10["check-backup-schedules<br/>Every 30 minutes"]
        PT11["check-scheduled-reports<br/>Every 15 minutes"]
    end

    PT1 & PT2 & PT3 & PT4 & PT5 & PT6 & PT7 & PT8 --> Q_Default
    PT9 & PT10 --> Q_Default
    PT11 --> Q_Reports
```

### 4.3 Cache Tiers

| Tier | Alias | TTL | Key Prefix | Purpose |
|------|-------|-----|------------|---------|
| **Default** | `default` | 5 min | `hrms` | General API response caching |
| **Persistent** | `persistent` | 24 hrs | `hrms_persist` | Lookup data (grades, positions, banks, leave types) |
| **Volatile** | `volatile` | 1 min | `hrms_volatile` | Dashboard stats, employee counts |
| **Long** | `long` | 1 hr | `hrms_long` | Generated reports, computed aggregations |
| **Sessions** | `sessions` | 24 hrs | `hrms_sessions` | Django session store |

Cache invalidation is automatic via Django signals connected in `core/caching.py`. When a model instance is saved or deleted, the corresponding cache pattern is purged using Redis SCAN.

---

## 5. Infrastructure Layout

### 5.1 Network Architecture

```mermaid
graph TB
    subgraph "Internet"
        Users["Users / Clients"]
    end

    subgraph "GCP Project"
        subgraph "Edge"
            CloudArmor["Cloud Armor<br/>(WAF Policy)<br/>────────────<br/>Rate limiting<br/>Geo-blocking<br/>OWASP rules"]
            GLB["Global HTTPS<br/>Load Balancer<br/>────────────<br/>SSL termination<br/>Path-based routing"]
        end

        subgraph "VPC Network"
            subgraph "Public Subnet"
                direction TB
                CloudRun_FE["Cloud Run /<br/>GCS Frontend"]
            end

            subgraph "Serverless VPC Connector"
                VPC_Connector["VPC Connector<br/>────────────<br/>Allows Cloud Run<br/>to reach private IPs"]
            end

            subgraph "Private Subnet (Database)"
                CloudSQL_VPC["Cloud SQL<br/>PostgreSQL 15<br/>────────────<br/>Private IP only<br/>HA (REGIONAL)<br/>Automated backups"]
            end

            subgraph "Private Subnet (Cache)"
                Redis_VPC["Memorystore<br/>Redis 7.0<br/>────────────<br/>Private IP only<br/>2 GB (production)"]
            end

            subgraph "Serverless Compute"
                CR_API["Cloud Run<br/>API Service<br/>────────────<br/>Min: 1 / Max: 10<br/>1 vCPU, 1 GiB<br/>100 concurrency"]
                CR_Worker["Cloud Run<br/>Worker Service<br/>────────────<br/>Min: 1 / Max: 5<br/>2 vCPU, 2 GiB<br/>Internal only"]
            end
        end

        subgraph "Storage"
            GCS_SPA["GCS Bucket<br/>(SPA Assets)<br/>────────────<br/>Public read<br/>Versioned"]
            GCS_Media2["GCS Bucket<br/>(Media / Backups)<br/>────────────<br/>Private<br/>Lifecycle rules"]
        end

        subgraph "Secrets & IAM"
            SM["Secret Manager"]
            WI["Workload Identity<br/>(No service account keys)"]
        end
    end

    Users --> CloudArmor --> GLB
    GLB -->|"/api/v1/*"| CR_API
    GLB -->|"/*"| GCS_SPA

    CR_API --> VPC_Connector
    CR_Worker --> VPC_Connector

    VPC_Connector --> CloudSQL_VPC
    VPC_Connector --> Redis_VPC

    CR_API --> GCS_Media2
    CR_Worker --> GCS_Media2
    CR_API --> SM
    CR_Worker --> SM

    WI -.->|"Binds to"| CR_API
    WI -.->|"Binds to"| CR_Worker
```

### 5.2 Terraform Module Structure

The infrastructure is defined across 12 Terraform modules, each responsible for a single concern:

```mermaid
graph TB
    subgraph "Terraform Modules"
        TF_Net["networking<br/>────────────<br/>VPC, subnets,<br/>firewall rules,<br/>VPC connector"]
        TF_Sec["security<br/>────────────<br/>Cloud Armor policy,<br/>IAM roles,<br/>Workload Identity"]
        TF_Secrets["secrets<br/>────────────<br/>Secret Manager<br/>resources + versions"]
        TF_Registry["registry<br/>────────────<br/>Artifact Registry<br/>Docker repository"]
        TF_DB["database<br/>────────────<br/>Cloud SQL instance,<br/>databases, users,<br/>backup config"]
        TF_Cache["cache<br/>────────────<br/>Memorystore Redis<br/>instance, auth"]
        TF_Storage["storage<br/>────────────<br/>GCS buckets,<br/>lifecycle rules,<br/>CORS config"]
        TF_Backend["backend-service<br/>────────────<br/>Cloud Run API service,<br/>env vars, scaling,<br/>VPC connector"]
        TF_Worker["worker-service<br/>────────────<br/>Cloud Run worker,<br/>env vars, scaling,<br/>no ingress"]
        TF_CDN["frontend-cdn<br/>────────────<br/>GCS bucket,<br/>Cloud CDN,<br/>HTTPS LB, SSL cert"]
        TF_Mon["monitoring<br/>────────────<br/>Uptime checks,<br/>alert policies,<br/>dashboards,<br/>log sinks"]
    end

    TF_Net --> TF_DB
    TF_Net --> TF_Cache
    TF_Net --> TF_Backend
    TF_Net --> TF_Worker
    TF_Sec --> TF_Backend
    TF_Sec --> TF_Worker
    TF_Sec --> TF_CDN
    TF_Secrets --> TF_Backend
    TF_Secrets --> TF_Worker
    TF_Registry --> TF_Backend
    TF_Registry --> TF_Worker
    TF_DB --> TF_Backend
    TF_DB --> TF_Worker
    TF_Cache --> TF_Backend
    TF_Cache --> TF_Worker
    TF_Storage --> TF_Backend
    TF_Storage --> TF_Worker
    TF_Storage --> TF_CDN
    TF_Mon --> TF_Backend
    TF_Mon --> TF_Worker
```

### 5.3 CI/CD Pipeline

Five GitHub Actions workflows govern the delivery pipeline:

```mermaid
graph TD
    subgraph "CI Workflow (ci.yml)"
        CI_Trigger["Push / PR to main"]
        CI_Lint["Lint<br/>(ruff, eslint)"]
        CI_Test["Test<br/>(pytest, vitest)"]
        CI_Build["Build Docker Image<br/>(multi-stage)"]
        CI_Scan["Security Scan<br/>(trivy / snyk)"]

        CI_Trigger --> CI_Lint --> CI_Test --> CI_Build --> CI_Scan
    end

    subgraph "Deploy Staging (deploy-staging.yml)"
        DS_Trigger["Merge to main"]
        DS_Build["Build & Push to<br/>Artifact Registry"]
        DS_Deploy["Deploy to Cloud Run<br/>(staging)"]
        DS_Migrate["Run migrations"]
        DS_Smoke["Smoke tests"]

        DS_Trigger --> DS_Build --> DS_Deploy --> DS_Migrate --> DS_Smoke
    end

    subgraph "Deploy Production (deploy-production.yml)"
        DP_Trigger["Manual approval /<br/>Release tag"]
        DP_Canary0["Deploy canary<br/>traffic: 0%"]
        DP_Canary10["Route 10% traffic"]
        DP_Monitor1["Monitor errors<br/>(5 min)"]
        DP_Canary50["Route 50% traffic"]
        DP_Monitor2["Monitor errors<br/>(10 min)"]
        DP_Full["Route 100% traffic"]
        DP_Cleanup["Remove old revision"]

        DP_Trigger --> DP_Canary0 --> DP_Canary10 --> DP_Monitor1
        DP_Monitor1 -->|"Error rate OK"| DP_Canary50 --> DP_Monitor2
        DP_Monitor2 -->|"Error rate OK"| DP_Full --> DP_Cleanup
        DP_Monitor1 -->|"Error rate HIGH"| DP_Rollback
        DP_Monitor2 -->|"Error rate HIGH"| DP_Rollback
    end

    subgraph "Rollback (rollback.yml)"
        DP_Rollback["Auto-Rollback<br/>────────────<br/>Revert to previous<br/>Cloud Run revision<br/>Route 100% traffic back"]
    end

    subgraph "Maintenance (scheduled-maintenance.yml)"
        SM_Trigger["Cron / Manual"]
        SM_Tasks["DB vacuum<br/>Cache flush<br/>Log rotation<br/>Backup verification"]

        SM_Trigger --> SM_Tasks
    end

    CI_Scan -->|"All green"| DS_Trigger
    DS_Smoke -->|"Staging OK"| DP_Trigger
```

### 5.4 Canary Deployment Detail

The production deployment uses a progressive canary strategy with automatic rollback:

| Stage | Traffic Split | Duration | Rollback Trigger |
|-------|--------------|----------|-----------------|
| 1. Deploy | 0% (new revision exists) | Immediate | Build failure |
| 2. Canary | 10% to new revision | 5 minutes | Error rate > 1% |
| 3. Partial | 50% to new revision | 10 minutes | Error rate > 0.5% |
| 4. Full | 100% to new revision | Permanent | Manual trigger only |

---

## 6. Capacity Planning

### 6.1 Current Production Sizing

The system is designed to handle 1M+ records across all modules. Current resource allocation:

| Resource | Configuration | Notes |
|----------|--------------|-------|
| **Cloud SQL** | 4 vCPU, 16 GB RAM, 100 GB SSD | HA (REGIONAL), auto-resize up to 500 GB |
| **Redis** | 2 GB (Memorystore) | Shared: broker (DB 0) + cache (DB 1) |
| **API Service** | 1--10 instances, 1 vCPU, 1 GiB each | 100 concurrent requests per instance |
| **Worker Service** | 1--5 instances, 2 vCPU, 2 GiB each | Prefetch multiplier = 1, concurrency = 4 |
| **Connection Pool** | CONN_MAX_AGE = 600 | Persistent connections within Cloud Run instance lifecycle |
| **Database Indexes** | 60+ indexes | 46 on employees table alone; covering indexes for common queries |
| **Migrations** | 63 applied | Across all 21 apps |

### 6.2 Performance Characteristics

| Metric | Target | Mechanism |
|--------|--------|-----------|
| API response (cached) | < 50 ms | Redis 5-tier caching |
| API response (uncached) | < 500 ms | PostgreSQL with covering indexes |
| Payroll computation (1,000 employees) | < 60 s | Async Celery task on payroll queue |
| Report generation (PDF) | < 30 s | Async Celery task on reports queue |
| Cache hit ratio (lookups) | > 95% | 24-hour TTL on persistent cache, signal-based invalidation |
| Health check latency | < 100 ms | /healthz (liveness) and /readyz (DB + Redis check) |

### 6.3 Scaling Beyond 10M Records

When the system approaches 10M total records (particularly in payroll, audit logs, and leave transactions), the following scaling measures should be applied:

```
Phase 1: Vertical Scaling
--------------------------
- Cloud SQL: Upgrade to 8 vCPU / 32 GB RAM
- Redis: Increase to 5 GB
- API instances: Increase max to 20
- Worker instances: Increase max to 10

Phase 2: Read Scaling
--------------------------
- Add Cloud SQL read replica for reporting queries
- Route report generation tasks to read replica
- Configure Django DATABASE_ROUTERS for read/write splitting
- Add CDN caching for report downloads (signed URLs with short TTL)

Phase 3: Data Partitioning
--------------------------
- Partition payroll_payslipline by pay_period (range partitioning)
- Partition core_auditlog by created_at (monthly range)
- Partition leave_leavebalance by leave_year
- Archive records older than 7 years to cold storage (GCS)

Phase 4: Infrastructure Evolution
--------------------------
- Evaluate migration from Cloud Run to GKE for:
  - More granular resource control
  - Pod autoscaling based on queue depth
  - Dedicated node pools for worker tasks
- Consider PgBouncer for connection pooling at scale
- Add Flower for Celery monitoring dashboard
- Implement database connection pooling via AlloyDB (if PostgreSQL compatibility needed)
```

### 6.4 Disaster Recovery

| Scenario | RTO | RPO | Mechanism |
|----------|-----|-----|-----------|
| API instance failure | < 30 s | 0 | Cloud Run auto-restart + health checks |
| Database failure | < 5 min | 0 | Cloud SQL HA (REGIONAL) automatic failover |
| Redis failure | < 2 min | Volatile data loss | Memorystore auto-recovery; app falls back to DB |
| Region outage | < 1 hr | < 5 min | Cross-region Cloud SQL backup restore; DNS failover |
| Data corruption | < 30 min | < 24 hr | Automated daily backups + Celery backup schedule checks |
| Bad deployment | < 2 min | 0 | Canary rollback to previous Cloud Run revision |

---

*This document describes the NHIA HRMS architecture as of 2026-02-14. It should be updated whenever significant infrastructure or architectural changes are made.*
