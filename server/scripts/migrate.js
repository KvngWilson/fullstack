#!/usr/bin/env node

require("dotenv").config();

const { runMigrations, rollbackMigration } = require("./migrations/migrationRunner");
const { runInitialBaselineMigration } = require("./migrate-initial-baseline");

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

    throw new Error(`Unknown migration mode: ${mode}. Use one of: pending, initial, rollback`);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

main();
