#!/usr/bin/env bash
# Idempotent local setup + start script for IT Bank Banking Simulator.
# Mirrors README.md steps 1-5, skipping any step already satisfied.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

log()  { printf '\n\033[1;34m==>\033[0m %s\n' "$1"; }
skip() { printf '    \033[2m(already done, skipping)\033[0m %s\n' "$1"; }

# ---------------------------------------------------------------------------
# 1. Database container
# ---------------------------------------------------------------------------
log "Checking PostgreSQL container"
if [ -n "$(docker compose ps --status running -q postgres)" ]; then
  skip "postgres container is running"
else
  echo "Starting postgres container..."
  docker compose up -d
fi

echo "Waiting for postgres to accept connections..."
until docker compose exec -T postgres pg_isready -U banking >/dev/null 2>&1; do
  sleep 1
done
echo "Postgres is ready."

# ---------------------------------------------------------------------------
# 2. Dependencies
# ---------------------------------------------------------------------------
log "Checking npm dependencies"
if [ -f node_modules/.package-lock.json ] && [ node_modules/.package-lock.json -nt package-lock.json ]; then
  skip "node_modules is up to date with package-lock.json"
else
  echo "Installing dependencies..."
  npm install
fi

# ---------------------------------------------------------------------------
# 3. Environment configuration
# ---------------------------------------------------------------------------
log "Checking environment files"
if [ -f backend/.env ]; then
  skip "backend/.env"
else
  echo "Creating backend/.env from backend/.env.example..."
  cp backend/.env.example backend/.env
fi

if [ -f frontend/.env ]; then
  skip "frontend/.env"
else
  echo "Creating frontend/.env from frontend/.env.example..."
  cp frontend/.env.example frontend/.env
fi

# ---------------------------------------------------------------------------
# 4. Prisma client, migrations, seed data
# ---------------------------------------------------------------------------
log "Checking Prisma client generation"
if [ -f node_modules/.prisma/client/index.js ]; then
  skip "Prisma client already generated"
else
  echo "Generating Prisma client..."
  npm run db:generate
fi

log "Checking database migrations"
if (cd backend && npx prisma migrate status 2>/dev/null | grep -q "Database schema is up to date"); then
  skip "migrations already applied"
else
  echo "Running migrations..."
  npm run db:migrate
fi

log "Checking seed data"
user_count="$(docker compose exec -T postgres psql -U banking -d banking_simulator -tAc "SELECT count(*) FROM users;" 2>/dev/null || echo 0)"
if [ "${user_count:-0}" -gt 0 ] 2>/dev/null; then
  skip "database already contains seeded users ($user_count found)"
else
  echo "Seeding database..."
  npm run db:seed
fi

# ---------------------------------------------------------------------------
# 5. Start the app
# ---------------------------------------------------------------------------
log "Starting backend and frontend"

cleanup() {
  echo
  echo "Stopping backend and frontend..."
  kill "$backend_pid" "$frontend_pid" 2>/dev/null || true
  wait "$backend_pid" "$frontend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

npm run dev:backend &
backend_pid=$!

npm run dev:frontend &
frontend_pid=$!

echo "Backend:  http://localhost:3000"
echo "Frontend: http://localhost:5173"
echo "Press Ctrl+C to stop both."

wait "$backend_pid" "$frontend_pid"
