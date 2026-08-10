const fs = require("fs").promises;
const path = require("path");
const { pool } = require("../../config/db");
const logger = require("../../shared/utils/logger");

const MIGRATIONS_DIR = path.join(__dirname, "../../infrastructure/database/migrations");

function parseMigrationParts(fileName) {
  const baseName = fileName.replace(/\.sql$/i, "");
  const match = baseName.match(/^(\d+)[-_](.+)$/);

  if (!match) {
    return {
      fileName,
      baseName,
      numericPrefix: null,
      suffix: baseName,
    };
  }

  return {
    fileName,
    baseName,
    numericPrefix: Number.parseInt(match[1], 10),
    suffix: match[2],
  };
}

function sortMigrations(files) {
  return [...files].sort((left, right) => {
    const a = parseMigrationParts(left);
    const b = parseMigrationParts(right);

    if (a.numericPrefix !== null && b.numericPrefix !== null && a.numericPrefix !== b.numericPrefix) {
      return a.numericPrefix - b.numericPrefix;
    }

    return left.localeCompare(right);
  });
}

function findDuplicateNumericPrefixes(files) {
  const groups = new Map();

  for (const file of files) {
    const parsed = parseMigrationParts(file);
    if (parsed.numericPrefix === null) {
      continue;
    }

    const key = String(parsed.numericPrefix).padStart(3, "0");
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(file);
  }

  return Array.from(groups.entries())
    .filter(([, groupedFiles]) => groupedFiles.length > 1)
    .map(([prefix, groupedFiles]) => ({ prefix, files: groupedFiles.sort() }));
}

async function inspectMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR);
  const migrationFiles = files.filter((f) => f.endsWith(".sql"));
  const sortedMigrationFiles = sortMigrations(migrationFiles);
  const duplicateNumericPrefixes = findDuplicateNumericPrefixes(sortedMigrationFiles);

  return {
    migrationFiles: sortedMigrationFiles,
    duplicateNumericPrefixes,
  };
}

function migrationDefinesOwnTransaction(sql) {
  const hasBegin = /(^|\n)\s*BEGIN\s*;/i.test(sql);
  const hasCommit = /(^|\n)\s*COMMIT\s*;/i.test(sql);
  return hasBegin && hasCommit;
}


// Run all pending migrations
async function runMigrations() {
  logger.info("Running database migrations");

  try {
    // Ensure migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const { migrationFiles, duplicateNumericPrefixes } = await inspectMigrationFiles();

    if (duplicateNumericPrefixes.length > 0) {
      const duplicateSummary = duplicateNumericPrefixes
        .map((group) => `${group.prefix}: [${group.files.join(", ")}]`)
        .join("; ");

      const strictMode = process.env.MIGRATIONS_STRICT_PREFIX_ORDER === "true";
      if (strictMode) {
        throw new Error(
          `Duplicate migration numeric prefixes detected (strict mode): ${duplicateSummary}`,
        );
      }

      logger.warn(
        `Duplicate migration numeric prefixes detected: ${duplicateSummary}. `
        + "Execution will continue in deterministic filename order.",
      );
    }

    // Get already executed migrations
    const result = await pool.query(
      "SELECT version FROM schema_migrations ORDER BY executed_at"
    );
    const executedVersions = new Set(result.rows.map((r) => r.version));

    let migrationCount = 0;

    // Execute pending migrations
    for (const file of migrationFiles) {
      const version = file.replace(".sql", "");

      if (executedVersions.has(version)) {
        logger.info(`Skipping migration: ${file} (already executed)`);
        continue;
      }

      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = await fs.readFile(filePath, "utf-8");

      logger.info(`Executing migration: ${file}`);

      try {
        const selfManagedTransaction = migrationDefinesOwnTransaction(sql);

        if (selfManagedTransaction) {
          await pool.query(sql);
          await pool.query(
            "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
            [version, file]
          );
        } else {
          await pool.query("BEGIN");
          await pool.query(sql);
          await pool.query(
            "INSERT INTO schema_migrations (version, name) VALUES ($1, $2)",
            [version, file]
          );
          await pool.query("COMMIT");
        }

        migrationCount++;
        logger.info(`[OK] Migration executed: ${file}`);
      } catch (error) {
        if (!migrationDefinesOwnTransaction(sql)) {
          await pool.query("ROLLBACK");
        }
        logger.error(`[FAILED] Migration failed: ${file}`, { error });
        throw error;
      }
    }

    logger.info(`Completed: ${migrationCount} migration(s) executed`);
    return migrationCount;
  } catch (error) {
    logger.error("Migration error", { error });
    throw error;
  }
}

// Rollback the last migration
async function rollbackMigration() {
  logger.info("Rolling back last migration");

  try {
    // Get the last executed migration
    const result = await pool.query(
      "SELECT version FROM schema_migrations ORDER BY executed_at DESC LIMIT 1"
    );

    if (result.rows.length === 0) {
      logger.warn("No migrations to rollback");
      return 0;
    }

    const { version } = result.rows[0];
    const rollbackFile = `${version}.rollback.sql`;
    const rollbackPath = path.join(MIGRATIONS_DIR, rollbackFile);

    // Check if rollback file exists
    try {
      await fs.access(rollbackPath);
    } catch {
      logger.warn(`Rollback file not found: ${rollbackFile}`);
      return 0;
    }

    const sql = await fs.readFile(rollbackPath, "utf-8");

    logger.info(`Executing rollback: ${rollbackFile}`);

    try {
      await pool.query("BEGIN");
      await pool.query(sql);
      await pool.query(
        "DELETE FROM schema_migrations WHERE version = $1",
        [version]
      );
      await pool.query("COMMIT");
      logger.info(`[OK] Rollback executed: ${rollbackFile}`);
      return 1;
    } catch (error) {
      await pool.query("ROLLBACK");
      logger.error(`[FAILED] Rollback failed: ${rollbackFile}`, { error });
      throw error;
    }
  } catch (error) {
    logger.error("Rollback error", { error });
    throw error;
  }
}

module.exports = {
  pool,
  runMigrations,
  rollbackMigration,
  inspectMigrationFiles,
};
