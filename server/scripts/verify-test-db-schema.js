#!/usr/bin/env node

const path = require("path");

require("dotenv").config({
  path: path.resolve(__dirname, "../.env.test"),
  quiet: true,
});

const { Client } = require("pg");

const REQUIRED_SCHEMA = {
  users: [
    "username",
    "role",
    "email_verified",
    "is_verified",
    "deleted_at",
  ],
  tenants: ["slug"],
  vendors: ["tenant_id", "store_name", "slug", "status"],
  categories: ["tenant_id", "slug"],
  products: ["vendor_id", "tenant_id", "slug", "brand", "base_price"],
  product_variants: ["price_cents", "stock", "attributes"],
  carts: ["tenant_id", "status"],
  cart_items: ["product_variant_id", "unit_price_cents", "tenant_id"],
  addresses: ["tenant_id", "type", "street", "is_primary"],
  orders: ["tenant_id", "payment_status", "total_cents", "shipping_street_address"],
  payments: ["processor", "transaction_id", "amount_cents", "currency"],
  refunds: ["payment_id", "amount", "reason", "metadata", "status"],
  review_moderation_audit: ["review_id", "moderator_id", "action"],
  vendor_commission_settings: ["vendor_id", "commission_rate", "effective_from"],
  vendor_payouts: ["vendor_id", "amount", "status", "requested_at"],
  analytics_metrics: ["metric_type", "metric_name", "value", "timestamp"],
  analytics_snapshots: ["snapshot_type", "period_start", "period_end", "data"],
  websocket_sessions: ["id", "user_id", "socket_id", "is_active"],
  roles: ["vendor_id", "code", "hierarchy_level"],
  permissions: ["code"],
  employees: ["role_id", "employment_status"],
  employee_permission_overrides: ["employee_id", "permission_id", "grant_type"],
  vendor_onboarding: ["vendor_id", "steps_completed", "step_payloads", "current_step"],
  email_verifications: ["user_id", "token_hash", "expires_at"],
  password_reset_tokens: ["user_id", "token_hash", "expires_at", "used_at"],
  refresh_tokens: ["user_id", "token_hash", "expires_at", "revoked_at", "last_used_at"],
  exchange_rates: ["from_currency", "to_currency", "rate", "effective_date", "expires_at", "is_active"],
  order_exchange_rates: ["order_id", "from_currency", "to_currency", "rate", "original_amount"],
  order_currency_snapshots: ["order_id", "customer_currency", "base_currency", "exchange_rate", "customer_total_cents", "base_total_cents"],
  exchange_rate_sync_log: ["sync_time", "status", "provider"],
  security_audit_log: ["event_type", "actor_id", "metadata"],
  schema_migrations: ["version", "name"],
};

const REQUIRED_MIGRATIONS = [
  "001_initial_schema",
  "025_consolidated_schema_baseline",
  "027_security_hardening",
  "028_optimistic_locking_and_idempotency",
  "029_financial_support_tables",
  "030_new_features_support",
  "031_vendor_onboarding_step_payloads",
  "033_auth_support_tables",
];

function alignDatabaseEnv() {
  const defaults = {
    HOST: "localhost",
    PORT: "5432",
    NAME: "fullstack_test",
    USER: "postgres",
    PASSWORD: "postgres",
  };

  for (const key of Object.keys(defaults)) {
    const testKey = `DB_${key}_TEST`;
    const baseKey = `DB_${key}`;
    const value = process.env[testKey] || process.env[baseKey] || defaults[key];

    process.env[testKey] = value;
    process.env[baseKey] = value;
  }
}

function createSchemaGuidance(details) {
  return [
    "Test DB is not using the current canonical schema.",
    details,
    "Run [setup-test-db.sh](/home/wilson/Desktop/fullstack/server/scripts/setup-test-db.sh).",
    "If this DB was created from the legacy test bootstrap, recreate the test database/volume first.",
  ].join(" ");
}

async function verifyCurrentTestSchema(db) {
  const tableNames = Object.keys(REQUIRED_SCHEMA);
  const columnsResult = await db.query(
    `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
    `,
    [tableNames],
  );

  const columnsByTable = new Map();
  for (const row of columnsResult.rows) {
    if (!columnsByTable.has(row.table_name)) {
      columnsByTable.set(row.table_name, new Set());
    }
    columnsByTable.get(row.table_name).add(row.column_name);
  }

  const missingDetails = [];

  for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
    if (!columnsByTable.has(tableName)) {
      missingDetails.push(`missing table "${tableName}"`);
      continue;
    }

    const existingColumns = columnsByTable.get(tableName);
    const missingColumns = requiredColumns.filter((columnName) => !existingColumns.has(columnName));

    if (missingColumns.length > 0) {
      missingDetails.push(
        `table "${tableName}" is missing column(s): ${missingColumns.join(", ")}`,
      );
    }
  }

  const migrationsResult = await db.query(
    "SELECT version FROM schema_migrations WHERE version = ANY($1::text[])",
    [REQUIRED_MIGRATIONS],
  );
  const executedMigrations = new Set(migrationsResult.rows.map((row) => row.version));
  const missingMigrations = REQUIRED_MIGRATIONS.filter((version) => !executedMigrations.has(version));

  if (missingMigrations.length > 0) {
    missingDetails.push(`missing migration record(s): ${missingMigrations.join(", ")}`);
  }

  if (missingDetails.length > 0) {
    throw new Error(createSchemaGuidance(missingDetails.join("; ")));
  }
}

async function main() {
  alignDatabaseEnv();

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    await client.connect();
    await verifyCurrentTestSchema(client);
    process.stdout.write("Test DB schema verification passed.\n");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  REQUIRED_MIGRATIONS,
  REQUIRED_SCHEMA,
  alignDatabaseEnv,
  verifyCurrentTestSchema,
};
