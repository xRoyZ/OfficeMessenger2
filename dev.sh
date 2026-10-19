#!/usr/bin/env bash
# Starts PostgreSQL, the API (with migrations) and the frontend for development.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

PYTHON_BIN="${PYTHON:-python3}"

export DATABASE_URL="${DATABASE_URL:-postgresql://app@localhost:5432/app}"
export CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:5173}"
export SECRET_KEY="${SECRET_KEY:-$("$PYTHON_BIN" -c 'import secrets; print(secrets.token_hex(32))')}"
export UPLOAD_DIR="${UPLOAD_DIR:-./uploads}"
export MAX_UPLOAD_BYTES="${MAX_UPLOAD_BYTES:-5242880}"
export TOKEN_TTL_HOURS="${TOKEN_TTL_HOURS:-720}"
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-http://localhost:8000}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required: docker compose starts PostgreSQL." >&2
  exit 1
fi

echo "Starting PostgreSQL ..."
docker compose up -d db

echo "Waiting for PostgreSQL ..."
ready=0
for _ in $(seq 1 60); do
  if docker compose exec -T db pg_isready -U app -d app >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  echo "PostgreSQL did not become ready in time." >&2
  exit 1
fi

if [ ! -d .venv ]; then
  "$PYTHON_BIN" -m venv .venv
fi
if [ -f .venv/bin/activate ]; then
  . .venv/bin/activate
else
  . .venv/Scripts/activate
fi
python -m pip install -q --upgrade pip
python -m pip install -q -r backend/requirements.txt

echo "Applying database migrations ..."
(cd backend && python -m alembic upgrade head)

cleanup() {
  for pid in $(jobs -pr); do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

(cd backend && exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000) &
API_PID=$!

if [ -f frontend/package.json ]; then
  (cd frontend && npm install --no-audit --no-fund && exec npm run dev -- --host 0.0.0.0 --port 5173) &
  echo "Frontend: http://localhost:5173"
else
  echo "frontend/ is not present in this checkout; only the API is started." >&2
fi

echo "API: http://localhost:8000/api/health"
wait "$API_PID"
