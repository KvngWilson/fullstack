#!/usr/bin/env node

const path = require("path");
const fs = require("fs").promises;
require("dotenv").config();

const { pool } = require("../config/db");

const BASELINE_FILE = "025_initial_schema.sql";
const PREVIOUS_VERSIONS = [
  "001_initial_schema",
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
      console.log("[INFO] Database already initialized with " + existingCount + " migration records.");
      console.log("[INFO] Use `npm run migrate` to apply pending migrations, or skip this step.");
      process.exitCode = 0;
      return;
    }

    const baselinePath = path.join(__dirname, "../infrastructure/database/migrations", BASELINE_FILE);
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
