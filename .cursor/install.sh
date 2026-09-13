#!/usr/bin/env bash
# Idempotent, durable setup run after the repository is checked out.
# System packages + Node dependencies + a local dev .env.local.
# Do NOT run migrations, seeds, or long-lived servers here (see start.sh).
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Ensuring PostgreSQL is installed"
if ! command -v pg_ctlcluster >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib
fi

echo "==> Installing Node dependencies (npm ci)"
npm ci

echo "==> Writing local dev .env.local (gitignored) if missing"
if [ ! -f .env.local ]; then
  cat > .env.local <<'ENV'
# Local Cloud Agent dev config (gitignored). Real secrets belong in Cloud Agent Secrets.
DATABASE_URL="postgresql://tod:tod@127.0.0.1:5432/tradesondemand"
DATABASE_URL_UNPOOLED="postgresql://tod:tod@127.0.0.1:5432/tradesondemand"
ADMIN_PASSWORD="tod-admin-dev"
ENV
fi

echo "==> install.sh complete"
