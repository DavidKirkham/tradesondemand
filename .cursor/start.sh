#!/usr/bin/env bash
# Per-boot reconciliation: bring up PostgreSQL, ensure the app role/db exist,
# apply migrations, and seed demo data. Must be idempotent and must return.
set -euo pipefail

cd "$(dirname "$0")/.."

PG_VER="$(ls /usr/lib/postgresql/ | sort -n | tail -1)"
export DATABASE_URL="${DATABASE_URL:-postgresql://tod:tod@127.0.0.1:5432/tradesondemand}"
export DATABASE_URL_UNPOOLED="${DATABASE_URL_UNPOOLED:-$DATABASE_URL}"

echo "==> Starting PostgreSQL cluster ${PG_VER}/main (if not already online)"
if ! sudo pg_ctlcluster "$PG_VER" main status >/dev/null 2>&1; then
  sudo pg_ctlcluster "$PG_VER" main start
fi

echo "==> Waiting for PostgreSQL to accept connections"
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

echo "==> Ensuring role 'tod' and database 'tradesondemand' exist"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='tod'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE ROLE tod LOGIN PASSWORD 'tod';"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='tradesondemand'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE tradesondemand OWNER tod;"

echo "==> Applying Prisma migrations"
npm run db:migrate

echo "==> Seeding demo data (idempotent upserts)"
npm run db:seed

echo "==> start.sh complete"
