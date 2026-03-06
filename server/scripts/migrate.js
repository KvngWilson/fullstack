#!/usr/bin/env node

require("dotenv").config();

const { runMigrations, rollbackMigration } = require("./migrations/migrationRunner");
const { inspectMigrationFiles } = require("./migrations/migrationRunner");
const { runInitialBaselineMigration } = require("./migrate-initial-baseline");

async function auditMigrations() {
  const { migrationFiles, duplicateNumericPrefixes } = await inspectMigrationFiles();

  console.log(`Discovered ${migrationFiles.length} migration file(s).`);

  if (duplicateNumericPrefixes.length === 0) {
    console.log("Migration numeric prefixes are unique.");
    return;
  }

  console.log("Duplicate numeric prefixes detected:");
  for (const group of duplicateNumericPrefixes) {
    console.log(`  ${group.prefix}: ${group.files.join(", ")}`);
  }

  if (process.env.MIGRATIONS_STRICT_PREFIX_ORDER === "true") {
    process.exitCode = 1;
  }
}

async function main() {
  const mode = process.argv[2] || "pending";

  try {
    if (mode === "pending") {
      await runMigrations();
      return;
    }

    if (mode === "initial") {
      await runInitialBaselineMigration();
      return;
    }

    if (mode === "rollback") {
      await rollbackMigration();
      return;
    }

    if (mode === "audit") {
      await auditMigrations();
      return;
    }

    throw new Error(`Unknown migration mode: ${mode}. Use one of: pending, initial, rollback, audit`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
