#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

export DB_HOST="${DB_HOST_TEST:-${DB_HOST:-localhost}}"
export DB_PORT="${DB_PORT_TEST:-${DB_PORT:-5445}}"
export DB_NAME="${DB_NAME_TEST:-${DB_NAME:-fullstack_test}}"
export DB_USER="${DB_USER_TEST:-${DB_USER:-postgres}}"
export DB_PASSWORD="${DB_PASSWORD_TEST:-${DB_PASSWORD:-postgres}}"
export NODE_ENV="${NODE_ENV:-test}"

cd "${SERVER_DIR}"

echo "[INFO] Applying canonical test schema to ${DB_NAME} on ${DB_HOST}:${DB_PORT}"
node scripts/migrate.js initial
node scripts/migrate.js pending
node -e "require('./infrastructure/jobs/tasks/exchangeRateRefreshJob').refreshExchangeRates({ provider: 'MOCK' }).then(() => process.exit(0)).catch((error) => { console.error(error.message); process.exit(1); });"
node scripts/verify-test-db-schema.js
echo "[DONE] Test database schema is current."
