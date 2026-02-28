const fs = require("fs").promises;
const path = require("path");
const { pool } = require("../config/db");
const logger = require("./logger");

const MIGRATIONS_DIR = path.join(__dirname, "../data/migrations");

/**
 * Run all pending migrations
 */
async function runMigrations() {
  logger.info("Running database migrations");

  try {
    // Ensure migrations table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        execution_time_ms INTEGER
      )
    `);

    // Get list of executed migrations
    const { rows: executed } = await pool.query(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    const executedVersions = new Set(executed.map((r) => r.version));

    // Get list of migration files
    const files = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

    let migrationsRun = 0;

    for (const file of sqlFiles) {
      const version = file.replace(".sql", "");

      if (executedVersions.has(version)) {
        logger.info("Skipping migration (already executed)", { file });
        continue;
      }

      logger.info("Running migration", { file });

      const sqlPath = path.join(MIGRATIONS_DIR, file);
      const sql = await fs.readFile(sqlPath, "utf8");

      const startTime = Date.now();

      try {
        await pool.query(sql);
        const executionTime = Date.now() - startTime;

        await pool.query(
          "INSERT INTO schema_migrations (version, name, execution_time_ms) VALUES ($1, $2, $3)",
          [version, file, executionTime],
        );

        logger.info("Migration completed", { file, executionTime });
        migrationsRun++;
      } catch (error) {
        logger.error("Failed to run migration", {
          file,
          error: error.message,
        });
        throw error;
      }
    }

    if (migrationsRun === 0) {
      logger.info("No new migrations to run");
    } else {
      logger.info("Migrations completed successfully", {
        count: migrationsRun,
      });
    }
  } catch (error) {
    logger.error("Migration failed", { error });
    throw error;
  }
}

/**
 * Rollback last migration (careful!)
 */
async function rollbackMigration() {
  logger.warn("Rolling back last migration");

  const { rows } = await pool.query(
    "SELECT version, name FROM schema_migrations ORDER BY executed_at DESC LIMIT 1",
  );

  if (rows.length === 0) {
    logger.info("No migrations to rollback");
    return;
  }

  const { version, name } = rows[0];
  logger.info("Rolling back migration", { name });

  // Note: Rollback logic should be in separate rollback files
  // For now, just remove from tracking table
  await pool.query("DELETE FROM schema_migrations WHERE version = $1", [
    version,
  ]);

  logger.info(
    "Migration tracking removed. Manual rollback of schema changes required",
    { name },
  );
}

module.exports = {
  runMigrations,
  rollbackMigration,
};
