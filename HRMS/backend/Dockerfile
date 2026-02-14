# ============================================================
# Stage 1: Builder — install system deps + Python packages
# ============================================================
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# System dependencies required to compile Python packages:
#   libpq-dev       → psycopg2
#   libldap2-dev    → python-ldap
#   libsasl2-dev    → python-ldap (SASL support)
#   build-essential → C compiler for native extensions
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        libldap2-dev \
        libsasl2-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtualenv and install Python deps (layer-cached)
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir gunicorn

# Copy application source
COPY . .

# Create logs directory (excluded by .dockerignore)
RUN mkdir -p /app/logs

# Collect static files at build time using development settings
# (no fail-hard checks, no Redis/Postgres required)
ENV DJANGO_SETTINGS_MODULE=config.settings
RUN DJANGO_ENV=development \
    SECRET_KEY=build-placeholder \
    python manage.py collectstatic --noinput


# ============================================================
# Stage 2: Runtime — minimal image for production
# ============================================================
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings \
    DJANGO_ENV=production \
    PORT=8080

WORKDIR /app

# Runtime-only shared libraries (no -dev headers)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq5 \
        libldap2 \
        libsasl2-2 \
    && rm -rf /var/lib/apt/lists/*

# Copy virtualenv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application source and collected static files
COPY --from=builder /app /app

# Create non-root user
RUN groupadd -g 1000 appuser && \
    useradd -u 1000 -g appuser -s /bin/bash -m appuser && \
    chown -R appuser:appuser /app

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

USER appuser

EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
