"""
Gunicorn configuration for HRMS — tuned for Cloud Run (1 vCPU per instance).
"""

import multiprocessing

# Server socket
bind = "0.0.0.0:8080"

# Worker processes
# Cloud Run gives 1 vCPU per instance; 2 workers is optimal
workers = 2
worker_class = "gthread"
threads = 4

# Worker recycling — restart workers after N requests to prevent memory leaks
max_requests = 1000
max_requests_jitter = 50

# Timeouts
timeout = 120
graceful_timeout = 30
keepalive = 5

# Preload app — saves memory with forked workers (shared code pages)
preload_app = True

# Logging
accesslog = "-"  # stdout
errorlog = "-"   # stderr
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190
