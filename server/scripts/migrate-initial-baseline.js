#!/usr/bin/env node

const path = require("path");
const fs = require("fs").promises;
require("dotenv").config();

const { pool } = require("../config/db");

const BASELINE_FILE = "008_initial_schema_consolidated.sql";
const PREVIOUS_VERSIONS = [
  "000_create_migrations_table",
  "001_initial_schema",
  "002_improve_orders_schema",
  "003_add_performance_indexes",
  "004_add_constraint_enforcement",
  "005_multi_tenant_foundation",
  "006_multi_tenant_phase_2_backfill",
  "007_multi_tenant_phase_3_rls_policies",
  "008_initial_schema_consolidated",
];

async function ensureMigrationsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      version VARCHAR(255) NOT NULL UNIQUE,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INTEGER
    )
  `);
}

async function run() {
  try {
    await ensureMigrationsTable();

    const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM schema_migrations");
    const existingCount = rows[0]?.count || 0;

    if (existingCount > 0) {
      throw new Error(
        "schema_migrations is not empty. Use `npm run migrate` for existing databases.",
      );
    }

    const baselinePath = path.join(__dirname, "../data/migrations", BASELINE_FILE);
    const sql = await fs.readFile(baselinePath, "utf8");

    const startedAt = Date.now();
    await pool.query(sql);
    const executionTime = Date.now() - startedAt;

    for (const version of PREVIOUS_VERSIONS) {
      await pool.query(
        `INSERT INTO schema_migrations (version, name, execution_time_ms)
         VALUES ($1, $2, $3)
         ON CONFLICT (version) DO NOTHING`,
        [version, `${version}.sql`, version.endsWith("_consolidated") ? executionTime : 0],
      );
    }

    console.log("[DONE] Baseline migration applied:", BASELINE_FILE);
    console.log("[DONE] Migration history seeded through:", PREVIOUS_VERSIONS[PREVIOUS_VERSIONS.length - 1]);
  } catch (error) {
    console.error("[ERROR] Failed to apply initial baseline migration:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  runInitialBaselineMigration: run,
};
