#!/bin/bash
set -e

# Graceful shutdown handler for Cloud Run SIGTERM
cleanup() {
    echo "Received SIGTERM, shutting down gracefully..."
    kill -TERM "$PID" 2>/dev/null
    wait "$PID"
    exit 0
}
trap cleanup SIGTERM SIGINT

# Collect static files (idempotent, safe to re-run)
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Optionally run migrations
if [ "${RUN_MIGRATIONS}" = "true" ]; then
    echo "Running database migrations..."
    python manage.py migrate --noinput
    echo "Migrations complete."
fi

# Start gunicorn in background so trap can catch signals
echo "Starting gunicorn on port ${PORT:-8080}..."
gunicorn config.wsgi:application -c gunicorn.conf.py &
PID=$!
wait "$PID"
