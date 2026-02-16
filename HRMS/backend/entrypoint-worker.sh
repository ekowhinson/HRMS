#!/bin/bash
set -e

# Graceful shutdown handler
cleanup() {
    echo "Received SIGTERM, shutting down..."
    kill -TERM "$CELERY_PID" 2>/dev/null
    kill -TERM "$HEALTH_PID" 2>/dev/null
    wait "$CELERY_PID" "$HEALTH_PID" 2>/dev/null
    exit 0
}
trap cleanup SIGTERM SIGINT

# Start a minimal HTTP health check server on PORT (default 8080)
python -c "
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading, os

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')
    def log_message(self, *args):
        pass

port = int(os.environ.get('PORT', 8080))
server = HTTPServer(('0.0.0.0', port), Handler)
server.serve_forever()
" &
HEALTH_PID=$!

echo "Starting Celery worker..."
celery -A config worker --loglevel=info \
    -Q default,imports,reports,payroll,emails \
    --concurrency=4 &
CELERY_PID=$!

wait "$CELERY_PID"
