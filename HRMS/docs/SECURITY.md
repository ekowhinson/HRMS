# NHIA HRMS Security Model

**System:** NHIA Human Resource Management System (HRMS)
**Deployment Target:** Google Cloud Platform (GCP) -- Cloud Run
**Classification:** Enterprise / Internal
**Last Updated:** 2026-02-14

---

## Table of Contents

1. [Application Security](#1-application-security)
2. [Infrastructure Security](#2-infrastructure-security)
3. [Audit & Compliance](#3-audit--compliance)
4. [Authentication Flow](#4-authentication-flow)
5. [Data Protection](#5-data-protection)
6. [Monitoring & Incident Response](#6-monitoring--incident-response)
7. [Reporting Security Issues](#7-reporting-security-issues)

---

## 1. Application Security

### 1.1 Transport Layer Security

All production traffic is served exclusively over HTTPS. The following Django security settings are enforced in `config/settings/production.py`:

| Setting | Value | Purpose |
|---|---|---|
| `SECURE_SSL_REDIRECT` | `True` | Redirect all HTTP requests to HTTPS |
| `SECURE_PROXY_SSL_HEADER` | `('HTTP_X_FORWARDED_PROTO', 'https')` | Trust the Cloud Run load balancer's forwarded proto header |
| `SECURE_HSTS_SECONDS` | `31536000` (1 year) | Instruct browsers to only connect via HTTPS for one year |
| `SECURE_HSTS_INCLUDE_SUBDOMAINS` | `True` | Apply HSTS policy to all subdomains |
| `SECURE_HSTS_PRELOAD` | `True` | Eligible for browser HSTS preload lists |
| `SESSION_COOKIE_SECURE` | `True` | Session cookies transmitted only over HTTPS |
| `CSRF_COOKIE_SECURE` | `True` | CSRF cookies transmitted only over HTTPS |
| `SECURE_BROWSER_XSS_FILTER` | `True` | Enable browser-side XSS filtering (`X-XSS-Protection: 1; mode=block`) |
| `SECURE_CONTENT_TYPE_NOSNIFF` | `True` | Prevent MIME-type sniffing (`X-Content-Type-Options: nosniff`) |
| `X_FRAME_OPTIONS` | `DENY` | Prevent the application from being embedded in iframes |

Google-managed TLS certificates handle termination at the load balancer. HTTP-to-HTTPS redirect is enforced at both the application layer (`SECURE_SSL_REDIRECT`) and the infrastructure layer (Cloud Run ingress configuration).

### 1.2 Content Security Policy (CSP)

The `csp.middleware.CSPMiddleware` (django-csp) is inserted into the production middleware stack to enforce a strict Content Security Policy:

```
CSP_DEFAULT_SRC  = ("'self'",)
CSP_SCRIPT_SRC   = ("'self'",)
CSP_STYLE_SRC    = ("'self'", "'unsafe-inline'")   # Required for Tailwind CSS
CSP_IMG_SRC      = ("'self'", "data:", "blob:")
CSP_FONT_SRC     = ("'self'",)
CSP_CONNECT_SRC  = ("'self'",)
CSP_FRAME_SRC    = ("'none'",)
CSP_OBJECT_SRC   = ("'none'",)
CSP_BASE_URI     = ("'self'",)
CSP_FORM_ACTION  = ("'self'",)
CSP_FRAME_ANCESTORS = ("'none'",)
```

When Sentry is configured, CSP violation reports are sent to a Sentry CSP report endpoint (`CSP_REPORT_URI`), providing visibility into potential injection attempts or misconfigured resources.

### 1.3 Security Response Headers

The `SecurityHeadersMiddleware` (defined in `core/middleware.py`) appends the following headers to every response:

| Header | Value | Purpose |
|---|---|---|
| `X-Frame-Options` | `DENY` | Prevent clickjacking (defense-in-depth alongside CSP `frame-ancestors`) |
| `X-Content-Type-Options` | `nosniff` | Block MIME-type sniffing |
| `X-XSS-Protection` | `1; mode=block` | Browser XSS filter (legacy browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer information leakage to same-origin or origin-only for cross-origin |
| `Permissions-Policy` | `accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` | Restrict access to sensitive browser APIs |

### 1.4 Rate Limiting

Rate limiting is applied at two layers:

**Layer 1 -- django-ratelimit (view-level decorators)**

Applied directly to authentication-sensitive views in `accounts/views.py`:

- **Login** (`LoginView`, `LDAPLoginView`): `5 requests/minute` per IP (`@ratelimit(key='ip', rate='5/m', method='POST', block=True)`)
- **Password Reset** (`PasswordResetRequestView`): `3 requests/hour` per IP (`@ratelimit(key='ip', rate='3/h', method='POST', block=True)`)

**Layer 2 -- DRF Throttling (global)**

Configured in `REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']`:

| Scope | Rate | Description |
|---|---|---|
| `anon` | 100/hour | Unauthenticated requests |
| `user` | 10,000/hour | Authenticated requests |
| `login` | 5/minute | Login attempts |
| `password_reset` | 3/hour | Password reset requests |
| `application_submit` | 10/hour | Recruitment application submissions |
| `portal_login` | 5/minute | Employee portal login |
| `bulk` | 10/minute | Bulk operations (production only) |

### 1.5 CORS Policy

CORS is configured as a strict whitelist with no wildcard origins:

```python
CORS_ALLOWED_ORIGINS = [...]   # Loaded from CORS_ALLOWED_ORIGINS env var
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
CORS_ALLOW_HEADERS = ['accept', 'authorization', 'content-type', 'origin', 'x-csrftoken', 'x-request-id']
```

The `corsheaders.middleware.CorsMiddleware` is positioned immediately after `SecurityMiddleware` in the middleware stack to ensure CORS headers are applied before any other processing.

### 1.6 CSRF Protection

- CSRF trusted origins are loaded from the `CSRF_TRUSTED_ORIGINS` environment variable
- The CSRF cookie is marked `Secure` in production (`CSRF_COOKIE_SECURE = True`)
- The `X-CSRFToken` header is included in the allowed CORS headers for SPA compatibility
- Django's built-in `CsrfViewMiddleware` is active in the middleware stack

### 1.7 JWT Authentication

Authentication uses JSON Web Tokens via `djangorestframework-simplejwt` with the following configuration (from `SIMPLE_JWT` in `config/settings/base.py`):

| Parameter | Value | Notes |
|---|---|---|
| Algorithm | `HS256` | HMAC-SHA256 symmetric signing |
| Signing Key | `SECRET_KEY` | Overridden per environment; sourced from Google Secret Manager in production |
| Access Token Lifetime | 30 minutes | Configurable via `ACCESS_TOKEN_LIFETIME_MINUTES` env var |
| Refresh Token Lifetime | 1 day | Configurable via `REFRESH_TOKEN_LIFETIME_DAYS` env var |
| Rotate Refresh Tokens | `True` | A new refresh token is issued on each refresh |
| Blacklist After Rotation | `True` | Old refresh tokens are immediately blacklisted via `rest_framework_simplejwt.token_blacklist` |
| Update Last Login | `True` | The `last_login` timestamp is updated on every token issuance |
| Auth Header | `Authorization: Bearer <token>` | Standard Bearer token scheme |

Custom authentication classes (`AuditJWTAuthentication`, `AuditSessionAuthentication` in `core/authentication.py`) wrap the standard classes to propagate the authenticated user into thread-local storage for audit logging.

### 1.8 Password Policy

Password validation is enforced by Django's built-in validators (configured in `AUTH_PASSWORD_VALIDATORS`):

1. **UserAttributeSimilarityValidator** -- Prevents passwords too similar to user attributes (email, name)
2. **MinimumLengthValidator** -- Minimum 8 characters (`min_length: 8`)
3. **CommonPasswordValidator** -- Rejects commonly used passwords from a 20,000+ word dictionary
4. **NumericPasswordValidator** -- Prevents entirely numeric passwords

Additional security policies (from `HRMS_SETTINGS` in `config/settings/base.py`):

| Policy | Value | Implementation |
|---|---|---|
| Password Expiry | 90 days | `PASSWORD_EXPIRY_DAYS: 90` -- enforced via `password_needs_change()` on the User model |
| Max Failed Attempts | 5 | `MAX_FAILED_LOGIN_ATTEMPTS: 5` |
| Lockout Duration | 30 minutes | `ACCOUNT_LOCKOUT_DURATION_MINUTES: 30` |
| Session Timeout | 30 minutes | `SESSION_TIMEOUT_MINUTES: 30` |
| Force Password Change | On-demand | `must_change_password` flag on the User model |

The lockout mechanism is implemented directly on the `User` model (`accounts/models.py`):
- `increment_failed_login()` increments the `failed_login_attempts` counter and sets `lockout_until` when the threshold is reached
- `is_locked_out()` checks whether the lockout period has elapsed
- `reset_failed_login()` clears the counter and lockout timestamp on successful authentication
- Timing-attack mitigation: when a user is not found, the password hasher is still executed (`User().set_password(password)`) to prevent email enumeration via response timing

### 1.9 Two-Factor Authentication (2FA)

The system supports configurable two-factor authentication with three methods:

| Method | Implementation | Description |
|---|---|---|
| `TOTP` | `pyotp` library | Time-based One-Time Password via authenticator apps (Google Authenticator, Authy, etc.) |
| `EMAIL` | Django email backend | OTP delivered via email |
| `SMS` | Configurable SMS gateway | OTP delivered via SMS |

2FA-related fields on the `User` model:
- `two_factor_enabled` -- Boolean flag indicating whether 2FA is active for the user
- `two_factor_method` -- Selected 2FA method (TOTP, EMAIL, or SMS)
- `two_factor_secret` -- 32-character TOTP secret key (stored encrypted)
- `backup_codes` -- JSON array of one-time-use recovery codes

Organization-wide 2FA policy is managed via the `TwoFactorPolicyView` admin endpoint (`/api/v1/core/2fa-policy/`):
- `tfa_enforcement`: `optional`, `required`, or `required_admins`
- `tfa_allowed_methods`: List of permitted methods (`['EMAIL', 'SMS', 'TOTP']`)
- `tfa_grace_period_days`: Grace period before enforcement takes effect

The login flow in `LoginView` (`accounts/views.py`) checks for `two_factor_code` in the request payload and validates it against the user's configured 2FA method before issuing JWT tokens.

### 1.10 Multi-Provider Authentication

The system supports three authentication backends, evaluated in order (configured in `AUTHENTICATION_BACKENDS`):

1. **LocalAuthBackend** (`accounts/backends/local.py`) -- Email/password authentication with lockout detection, timing-attack mitigation, and auth event logging
2. **LDAPAuthBackend** (`accounts/backends/ldap.py`) -- LDAP/LDAPS bind authentication against Active Directory. Supports service account bind for user search, TLS certificate validation for LDAPS, user attribute mapping (email, name, objectGUID, groups), and domain restrictions
3. **AzureADBackend** (`accounts/backends/azure_ad.py`) -- OAuth2/OIDC authentication via Microsoft Azure AD. Uses MSAL for token acquisition, Microsoft Graph API for user profile retrieval, CSRF state validation, and domain restrictions
4. **ModelBackend** -- Django's default backend as an admin fallback

All backends inherit from `MultiProviderBackendMixin` (`accounts/backends/base.py`), which provides:
- Provider configuration loaded from the `AuthProvider` database model
- Automatic user provisioning for external auth providers (configurable per provider)
- Email-based auto-linking to existing user accounts
- Auto-linking to employee records by work/personal email
- Comprehensive authentication event logging to `AuthenticationLog`

Each authentication event (success, failure, lockout) is recorded with IP address, user agent, provider details, and failure reason.

### 1.11 File Upload Security

File uploads are constrained by:

- **Maximum file size**: 10 MB (`FILE_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024`)
- **Maximum request body size**: 10 MB (`DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024`)
- **File type validation**: Handled by DRF serializers at the application layer
- **Binary storage**: Attachments are stored as binary data in the database (not on the filesystem), preventing path traversal and direct file access attacks

### 1.12 Input Validation

- All API inputs are validated through Django REST Framework serializers, which enforce max lengths, data types, and field-level constraints
- Django's ORM parameterizes all SQL queries, preventing SQL injection
- Django's template engine auto-escapes HTML output
- The admin URL path is obscured via the `ADMIN_URL_PATH` environment variable (default: `sys-admin/`)

### 1.13 Multi-Tenancy Security

Tenant isolation is enforced through two middleware components:

**TenantMiddleware** (`core/middleware.py`):
- Resolves the tenant from `X-Tenant-ID` header, the authenticated user's organization, or the default organization
- Verifies that the requesting user is a member of the requested organization (via `UserOrganization`)
- Superusers can access any tenant
- Tenant context is stored in thread-local storage and cleared after each request

**ModuleAccessMiddleware** (`core/middleware.py`):
- Enforces license-based module access per tenant
- Auto-discovers module names from URL paths (`/api/v1/<module>/...`)
- Returns HTTP 403 with a descriptive error for disabled modules
- Core modules (`auth`, `core`, `organization`, `accounts`, `assistant`, `policies`) are ungated
- Superusers bypass all module checks

### 1.14 Cache Control

The `CacheControlMiddleware` (`core/middleware.py`) sets appropriate `Cache-Control` headers:

| Resource Type | Cache-Control | Purpose |
|---|---|---|
| Static assets (`/static/`, `/media/`) | `public, max-age=31536000, immutable` | Aggressive caching for versioned assets |
| Public lookup endpoints | `public, max-age=300` + ETag | Short cache with conditional revalidation |
| Authenticated API endpoints | `private, no-cache` | Prevent proxy caching of sensitive data |
| Non-GET requests | `no-store` | No caching for write operations |

---

## 2. Infrastructure Security

### 2.1 Cloud Armor WAF

Google Cloud Armor provides a Web Application Firewall in front of all Cloud Run services:

- **OWASP ModSecurity Core Rule Set**: Pre-configured rules to detect and block common attack vectors:
  - SQL injection (SQLi)
  - Cross-site scripting (XSS)
  - Local file inclusion (LFI)
  - Remote file inclusion (RFI)
  - Remote code execution (RCE)
- **Rate limiting**: 100 requests/minute per IP at the edge, applied before traffic reaches the application
- **Adaptive protection**: Machine-learning-based anomaly detection that identifies and mitigates volumetric and application-layer DDoS attacks
- **IP allowlisting/denylisting**: Configurable per security policy
- **Geo-restriction**: Optional region-based access rules

### 2.2 Identity & Access Management (IAM)

The deployment follows the principle of least privilege:

- **Dedicated service accounts**: Separate GCP service accounts for the API service and the Celery worker service. Neither account has `roles/editor` or `roles/owner` permissions.
- **API service account permissions**: Cloud SQL Client, Secret Manager Secret Accessor, Cloud Logging Writer, Cloud Trace Agent
- **Worker service account permissions**: Cloud SQL Client, Secret Manager Secret Accessor, Cloud Logging Writer, Pub/Sub Publisher (for task queues)
- **Workload Identity Federation**: CI/CD pipelines (GitHub Actions) authenticate to GCP using short-lived tokens via Workload Identity Federation, eliminating long-lived service account keys
- **No service account key files**: All authentication uses metadata server tokens or Workload Identity
- **Admin access**: GCP console and `gcloud` CLI access is restricted to named individuals with MFA enforced via Cloud Identity

### 2.3 Network Security

| Component | Network Configuration | Access |
|---|---|---|
| Cloud Run (API) | Ingress: all (behind Cloud Armor) | Public internet via HTTPS (filtered by WAF) |
| Cloud Run (Worker) | Ingress: internal only | No public access; triggered by internal task queue |
| Cloud SQL (PostgreSQL) | Private IP only | Accessible only via VPC connector from Cloud Run |
| Memorystore (Redis) | Private IP only | Accessible only via VPC connector from Cloud Run |
| VPC Connector | Shared VPC, /28 subnet | Provides Cloud Run egress to private resources |

- Cloud SQL connections use private IP exclusively; no public IP is assigned to the database instance
- Memorystore (Redis) is deployed within the VPC with no external access
- Cloud Run services connect to private resources through a Serverless VPC Access connector
- Firewall rules restrict VPC traffic to only the necessary ports (5432 for PostgreSQL, 6379 for Redis)

### 2.4 Container Security

Both the API and Celery worker containers (`Dockerfile`, `Dockerfile.celery`) follow security best practices:

- **Multi-stage builds**: Build dependencies (compilers, `-dev` libraries) are excluded from the runtime image
- **Non-root user**: A dedicated `appuser` (UID 1000, GID 1000) is created and all application processes run as this user (`USER appuser`)
- **No secrets in images**: All secrets are injected at runtime via environment variables sourced from Google Secret Manager
- **Minimal runtime dependencies**: Only shared libraries required at runtime are installed (`libpq5`, `libldap-2.5-0`, `libsasl2-2`)
- **No shell utilities**: Build tools and package managers are removed in the runtime stage
- **Deterministic base image**: `python:3.12-slim` provides a minimal, regularly patched base
- **Worker recycling**: Gunicorn is configured to restart workers after 1,000 requests (`max_requests = 1000` with jitter of 50) to mitigate memory leak risks

### 2.5 Secrets Management

All sensitive configuration is stored in **Google Secret Manager** and injected into Cloud Run services as environment variables at deployment time:

| Secret | Usage |
|---|---|
| `SECRET_KEY` | Django secret key, JWT signing key |
| `DB_PASSWORD` | PostgreSQL database password |
| `REDIS_PASSWORD` | Redis (Memorystore) authentication password |
| `SENTRY_DSN` | Sentry error tracking DSN |
| `EMAIL_HOST_PASSWORD` | SMTP credentials for transactional email |
| `ANTHROPIC_API_KEY` | AI assistant API key |
| `LDAP_BIND_PASSWORD` | LDAP service account bind password (if LDAP enabled) |
| `AZURE_AD_CLIENT_SECRET` | Azure AD OAuth client secret (if Azure AD enabled) |

Secrets are never:
- Stored in source code, Dockerfiles, or environment files committed to version control
- Logged to stdout/stderr (Sentry is configured with `send_default_pii=False`)
- Included in container images

Production settings fail hard on missing critical secrets:

```python
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    sys.exit("FATAL: SECRET_KEY environment variable is required in production.")
```

### 2.6 SSL/TLS Certificates

- **Certificate management**: Google-managed certificates are provisioned automatically for custom domains
- **Protocol**: TLS 1.2+ enforced at the load balancer
- **HTTP-to-HTTPS redirect**: Enforced at both the load balancer and application layers
- **HSTS preload**: Enabled with a 1-year `max-age`, `includeSubDomains`, and `preload` directives, allowing submission to browser HSTS preload lists
- **LDAPS**: When LDAP authentication is configured, TLS certificate validation is enforced (`OPT_X_TLS_REQUIRE_CERT = OPT_X_TLS_DEMAND`) with optional CA certificate path configuration

---

## 3. Audit & Compliance

### 3.1 Application-Level Audit Logging

**AuditLogMiddleware** (`core/middleware.py`) captures structured audit data for every API request (excluding health checks, static files, and documentation endpoints):

Each audit record includes:
- `request_id` -- UUID from `X-Request-ID` header or auto-generated
- `trace_id` -- Extracted from GCP's `X-Cloud-Trace-Context` header for distributed tracing
- `user_id` -- Authenticated user (if applicable)
- `ip_address` -- Client IP extracted from `X-Forwarded-For` (for proxied requests) or `REMOTE_ADDR`
- `user_agent` -- Browser/client user agent string
- `method` -- HTTP method (GET, POST, PUT, PATCH, DELETE)
- `path` -- Request URL path
- `query_string` -- URL query parameters
- `status_code` -- HTTP response status code
- `duration_ms` -- Request processing time in milliseconds
- `response_size` -- Response body size in bytes
- `content_length` -- Request body size

The `request_id` is injected into the response as an `X-Request-ID` header for client-side correlation.

### 3.2 Data Change Audit Trail

The `AuditLog` model (`core/models.py`) provides an immutable record of all data changes:

| Field | Description |
|---|---|
| `id` | UUID primary key |
| `user` | User who performed the action (FK, SET_NULL on delete) |
| `action` | Action type: `CREATE`, `UPDATE`, `DELETE`, `VIEW`, `EXPORT`, `LOGIN`, `LOGOUT`, `LOGIN_FAILED` |
| `model_name` | Django model name (e.g., `Employee`, `PayrollRun`) |
| `object_id` | Primary key of the affected object |
| `object_repr` | Human-readable representation of the object |
| `changes` | JSON diff of changed fields |
| `old_values` | JSON snapshot of previous field values |
| `new_values` | JSON snapshot of new field values |
| `ip_address` | Client IP address |
| `user_agent` | Client user agent |
| `timestamp` | Auto-set creation timestamp (indexed) |
| `extra_data` | JSON field for additional context |

Database indexes on `(user, timestamp)`, `(model_name, object_id)`, and `(action, timestamp)` support efficient querying of the audit trail.

The audit log is exposed via a read-only API endpoint (`AuditLogViewSet`) restricted to admin users, with filtering by action, model name, user, and timestamp range.

### 3.3 Authentication Event Logging

The `AuthenticationLog` model (`accounts/models.py`) records all authentication events with granular event types:

- `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`
- `PASSWORD_CHANGE`, `PASSWORD_RESET`
- `2FA_SUCCESS`, `2FA_FAILED`
- `ACCOUNT_LOCKED`, `ACCOUNT_UNLOCKED`
- LDAP-specific: `LDAP_SUCCESS`, `LDAP_FAILED`
- Azure AD-specific: `AZURE_SUCCESS`, `AZURE_FAILED`

Each record captures: user, email, event type, authentication provider, IP address, user agent, and additional context data.

### 3.4 Structured JSON Logging

In staging and production environments, all application logs are emitted as structured JSON to stdout using `HRMSJsonFormatter` (`core/logging.py`):

```json
{
  "timestamp": "2026-02-14T10:30:00.000Z",
  "level": "INFO",
  "logger": "hrms",
  "message": "API Request: POST /api/v1/auth/login/ - User: abc123 - Status: 200 - 45.2ms",
  "request_id": "a1b2c3d4e5f6",
  "trace_id": "1234567890abcdef",
  "user_id": "abc123",
  "method": "POST",
  "path": "/api/v1/auth/login/",
  "status_code": 200,
  "duration_ms": 45.2,
  "ip_address": "203.0.113.50"
}
```

Key logging features:
- `CeleryTaskFilter` enriches log records with Celery task context (task ID, task name)
- `SQLQueryLogger` monitors database query performance and emits warnings for slow queries (>500ms in production, >100ms in staging) and errors for very slow queries (>2s in production, >1s in staging)
- Thread-local log context propagation ensures `request_id` and `trace_id` are included in all log entries within a request lifecycle
- Health check endpoints (`/healthz/`, `/readyz/`) are excluded from request logging and Sentry transaction sampling to reduce noise

### 3.5 Sentry Error Tracking

Sentry is integrated with the following configuration (optional, enabled via `SENTRY_DSN` environment variable):

- **Integrations**: Django, Celery (with beat task monitoring), Redis, structured logging (ERROR+ events)
- **Environment tagging**: Logs are tagged with `production` or `staging`
- **Release tracking**: Tagged with `APP_VERSION` for deployment correlation
- **Performance monitoring**: Configurable trace sampling (`SENTRY_TRACES_RATE`, default 10% in production)
- **Profiling**: Configurable profile sampling (`SENTRY_PROFILES_RATE`, default 10% in production)
- **PII protection**: `send_default_pii=False` prevents personal data from being sent to Sentry
- **Health check filtering**: Health check transactions (`/healthz/`, `/readyz/`) are sampled at 0% to avoid noise

### 3.6 GCP Cloud Audit Logs

Google Cloud Platform's built-in audit logging is enabled for all services:

- **Admin Activity logs**: Automatically logged for all GCP resource modifications (always on, cannot be disabled)
- **Data Access logs**: Enabled for Cloud SQL, Secret Manager, and Cloud Storage to track data reads
- **Cloud Trace integration**: The `AuditLogMiddleware` extracts `X-Cloud-Trace-Context` headers and propagates the `trace_id` into all application logs, enabling end-to-end request tracing across GCP services

### 3.7 Audit Log Retention

| Log Type | Retention Period | Storage |
|---|---|---|
| Application audit logs (`AuditLog` model) | 365 days (configurable) | Cloud SQL (PostgreSQL) |
| Authentication logs (`AuthenticationLog`) | 365 days (configurable) | Cloud SQL (PostgreSQL) |
| Structured application logs (JSON) | 30 days (default Cloud Logging) | GCP Cloud Logging |
| GCP Admin Activity logs | 400 days | GCP Cloud Logging (non-configurable) |
| GCP Data Access logs | 30 days (configurable up to 3650 days) | GCP Cloud Logging |
| Sentry events | Per Sentry plan | Sentry SaaS |

---

## 4. Authentication Flow

### 4.1 Local Authentication (Email/Password)

```
Client                          API Server                      Database
  |                                |                               |
  |-- POST /api/v1/auth/login/ -->|                               |
  |   {email, password, 2fa_code} |                               |
  |                                |-- Rate limit check (5/min) -->|
  |                                |-- Lookup user by email ------>|
  |                                |   (timing-safe on not found)  |
  |                                |-- Check account lockout ----->|
  |                                |-- Verify password ----------->|
  |                                |   (bcrypt/PBKDF2)             |
  |                                |-- Check password expiry ----->|
  |                                |-- Validate 2FA code --------->|
  |                                |   (TOTP/EMAIL/SMS)            |
  |                                |-- Reset failed login count -->|
  |                                |-- Log auth event ------------>|
  |                                |-- Issue JWT tokens            |
  |<-- {access, refresh, user} ----|                               |
```

On failure:
- `increment_failed_login()` increments the counter
- After 5 failed attempts, `lockout_until` is set to `now + 30 minutes`
- `ACCOUNT_LOCKED` event is recorded in `AuthenticationLog`
- Client receives `403` with descriptive error message

### 4.2 Token Lifecycle

1. **Access token** (30 min): Included as `Authorization: Bearer <token>` on every API request
2. **Refresh token** (1 day): Used to obtain a new access/refresh token pair
3. **Token rotation**: On refresh, the old refresh token is blacklisted and a new pair is issued
4. **Blacklist enforcement**: The `rest_framework_simplejwt.token_blacklist` app maintains a database table of revoked tokens
5. **Logout**: The current refresh token is blacklisted, preventing further token renewal

### 4.3 2FA Enforcement

The 2FA policy is configurable at the organization level:

| Enforcement Level | Behavior |
|---|---|
| `optional` | Users may enable 2FA voluntarily |
| `required` | All users must configure 2FA. A grace period (configurable days) allows initial setup. |
| `required_admins` | Only admin/staff users are required to use 2FA |

Supported 2FA methods can be restricted per organization (e.g., only allow TOTP, disable SMS).

### 4.4 LDAP/Active Directory Authentication

1. Service account binds to the LDAP server to search for the user by `sAMAccountName` or email
2. User's DN is discovered and a separate LDAP bind is attempted with the user's credentials
3. On success, user attributes (email, name, objectGUID, group memberships) are extracted
4. The user is auto-provisioned or linked to an existing account (configurable per provider)
5. Domain restrictions are enforced if configured on the `AuthProvider`
6. LDAPS connections enforce TLS certificate validation (`OPT_X_TLS_REQUIRE_CERT = OPT_X_TLS_DEMAND`)

### 4.5 Azure AD (OAuth2/OIDC) Authentication

1. Client redirects to Azure AD authorization URL (generated via MSAL with CSRF state parameter)
2. OAuth state is stored in Redis cache with a 10-minute TTL for one-time validation
3. After user consent, Azure AD redirects back with an authorization code
4. The authorization code is exchanged for tokens using the confidential client credentials
5. User profile is retrieved from Microsoft Graph API (`/v1.0/me`)
6. Domain restrictions are enforced, and the user is auto-provisioned or linked
7. All events are logged with provider context to `AuthenticationLog`

### 4.6 Session Timeout

- Access tokens expire after 30 minutes, requiring a token refresh
- The `SESSION_TIMEOUT_MINUTES: 30` setting controls application-level session tracking
- Redis-backed sessions (`SESSION_ENGINE = 'django.contrib.sessions.backends.cache'`) use the `sessions` cache alias with a 24-hour TTL

---

## 5. Data Protection

### 5.1 Database Security

- **Engine**: PostgreSQL (required in staging/production; enforced by `django.db.backends.postgresql`)
- **Connection management**: Persistent connections with `CONN_MAX_AGE=600` (10 minutes) and health checks enabled (`CONN_HEALTH_CHECKS=True`)
- **Connection timeout**: 10 seconds (`connect_timeout: 10`)
- **Private networking**: Cloud SQL instance uses private IP only; no public IP assigned
- **Encryption at rest**: Cloud SQL encrypts data at rest by default using AES-256 (Google-managed keys)
- **Encryption in transit**: Connections from Cloud Run to Cloud SQL are encrypted via Cloud SQL Auth Proxy or VPC connector
- **Automated backups**: Cloud SQL automated backups with point-in-time recovery enabled
- **Performance indexes**: 46+ indexes on the employees table and performance indexes across payroll, leave, bank accounts, and audit log tables

### 5.2 Redis Caching Security

A 5-tier caching architecture using Redis (Memorystore) with key prefix isolation prevents cross-concern cache collisions:

| Cache Alias | Key Prefix | TTL | Purpose |
|---|---|---|---|
| `default` | `hrms` | 5 minutes | General-purpose caching |
| `persistent` | `hrms_persist` | 24 hours | Lookup data (grades, positions, banks) |
| `volatile` | `hrms_volatile` | 1 minute | Dashboard statistics, health metrics |
| `long` | `hrms_long` | 1 hour | Report results, computed aggregations |
| `sessions` | `hrms_sessions` | 24 hours | User sessions (via `SESSION_ENGINE`) |

Security measures:
- Redis (Memorystore) is deployed on a private IP within the VPC; no public access
- Redis AUTH password is stored in Google Secret Manager
- Session data is stored in a dedicated cache alias to prevent eviction by other cache operations
- Cache invalidation is triggered automatically via Django signals on model changes

### 5.3 Backup & Retention

Application-level backup settings (`BACKUP_SETTINGS` in `config/settings/base.py`):

| Setting | Value |
|---|---|
| Storage backend | `local` or `S3` (configurable) |
| Default retention | 90 days |
| Compression | gzip |
| Max inline size | 50 MB |

Infrastructure-level (GCP):
- **Cloud SQL automated backups**: Daily, with configurable retention (7-365 days)
- **Point-in-time recovery**: Enabled in production, allowing recovery to any point within the backup retention window
- **Cross-region replication**: Available for disaster recovery (configurable)

### 5.4 PII Protection

- Sentry is configured with `send_default_pii=False` to prevent personal information from being sent to external error tracking
- Audit logs record user IDs (UUIDs) rather than personal details in log messages
- The `SecurityHeadersMiddleware` sets `Referrer-Policy: strict-origin-when-cross-origin` to limit referrer leakage
- File attachments are stored as binary data in the database, not on publicly accessible storage

---

## 6. Monitoring & Incident Response

### 6.1 Health Check Endpoints

Three tiers of health endpoints are implemented (`core/health.py`):

| Endpoint | Auth | Checks | Purpose |
|---|---|---|---|
| `GET /healthz/` | None | None (always 200) | **Liveness probe** -- Cloud Run uses this to determine if the process is alive. Returns `{"status": "alive"}` with no dependency checks. |
| `GET /readyz/` | None | PostgreSQL, Redis | **Readiness probe** -- Returns 200 only when all critical dependencies are reachable. Returns 503 with failed component details if any dependency is down. Cloud Run uses this to decide whether to route traffic to the instance. |
| `GET /api/status/` | Admin only | PostgreSQL, Redis, Celery, cache tiers, request stats | **Detailed system status** -- Returns Django version, environment, uptime, database connection count, cache health per alias, Celery worker count and active tasks, and request timing percentiles (p50, p95, p99). |

### 6.2 Uptime Monitoring

GCP uptime checks are configured from three regions to monitor:
- HTTPS availability of the application endpoint
- `/healthz/` liveness probe response
- `/readyz/` readiness probe response (alerting on 503)
- SSL certificate expiry (with advance warning)

### 6.3 Alert Thresholds

Alerts are configured for the following conditions:

**Cloud Run:**
- Instance count exceeds maximum threshold
- Request latency p99 exceeds 5 seconds
- 5xx error rate exceeds 1%
- Container startup time exceeds 30 seconds

**Cloud SQL (PostgreSQL):**
- CPU utilization exceeds 80% for 5 minutes
- Memory utilization exceeds 90%
- Storage utilization exceeds 80%
- Active connections approach the configured limit
- Replication lag exceeds 30 seconds (if read replicas are configured)

**Memorystore (Redis):**
- Memory utilization exceeds 80%
- Connected clients approach the limit
- Eviction rate increases (indicating memory pressure)
- Cache hit ratio drops below 80%

**Celery:**
- No active workers detected (via `/api/status/` celery health check)
- Task failure rate exceeds threshold
- Task queue depth exceeds threshold

### 6.4 Sentry Error Management

- Errors are grouped by exception type and stack trace
- Alert rules notify the engineering team for new error types, regression of resolved issues, and error rate spikes
- Release tracking correlates errors with specific deployments (`APP_VERSION`)
- Performance monitoring identifies slow transactions and database queries

### 6.5 Request Performance Tracking

The `AuditLogMiddleware` records request duration for every API request. The `request_stats` module (referenced in `core/logging.py`) maintains an in-memory ring buffer of recent request timings, exposed via the `/api/status/` endpoint as:

- Request count
- p50, p95, p99 latency percentiles
- Mean and max request duration

The `SQLQueryLogger` handler flags slow database queries in real-time:
- **Warning**: Queries exceeding 500ms (production) / 100ms (staging)
- **Error**: Queries exceeding 2,000ms (production) / 1,000ms (staging)

### 6.6 Graceful Shutdown

The application entrypoint (`entrypoint.sh`) implements graceful shutdown handling:

```bash
cleanup() {
    echo "Received SIGTERM, shutting down gracefully..."
    kill -TERM "$PID" 2>/dev/null
    wait "$PID"
    exit 0
}
trap cleanup SIGTERM SIGINT
```

When Cloud Run sends `SIGTERM` (during scale-down or deployment), the handler:
1. Forwards the signal to the Gunicorn master process
2. Gunicorn initiates a graceful shutdown with a 30-second timeout (`graceful_timeout = 30`)
3. In-flight requests are allowed to complete
4. Workers are terminated only after draining

### 6.7 Gunicorn Configuration

The Gunicorn configuration (`gunicorn.conf.py`) includes security-relevant settings:

| Setting | Value | Purpose |
|---|---|---|
| `workers` | 2 | Optimal for Cloud Run's 1 vCPU allocation |
| `worker_class` | `gthread` | Thread-based workers for I/O-bound workloads |
| `threads` | 4 | 4 threads per worker (8 concurrent requests per instance) |
| `max_requests` | 1000 | Worker recycling to prevent memory leaks |
| `max_requests_jitter` | 50 | Randomized recycling to avoid thundering herd |
| `timeout` | 120 | Maximum request processing time |
| `limit_request_line` | 8190 | Maximum request URL length |
| `limit_request_fields` | 100 | Maximum number of request headers |
| `limit_request_field_size` | 8190 | Maximum size of a single header |
| `preload_app` | `True` | Shared memory pages across forked workers |

---

## 7. Reporting Security Issues

If you discover a security vulnerability in the NHIA HRMS system, please report it responsibly:

**Contact:** security@nhia.gov.gh

**Process:**
1. Send a detailed description of the vulnerability, including steps to reproduce, to the email address above
2. Do not publicly disclose the vulnerability until the security team has had reasonable time to address it
3. The security team will acknowledge receipt within 2 business days
4. A fix timeline will be communicated within 5 business days of acknowledgement
5. Credit will be given to the reporter in the security advisory (unless anonymity is requested)

**Scope:**
- Authentication and authorization bypasses
- Data exposure or leakage
- Injection vulnerabilities (SQL, XSS, CSRF, command injection)
- Privilege escalation
- Denial of service (application-level)
- Cryptographic weaknesses

**Out of scope:**
- Social engineering attacks
- Physical security
- Vulnerabilities in third-party services not under NHIA control
- Rate limiting bypasses that do not lead to data exposure

---

*This document describes the security architecture as implemented in the NHIA HRMS codebase. For deployment-specific configuration details, refer to the GCP project's infrastructure documentation and Terraform configurations.*
