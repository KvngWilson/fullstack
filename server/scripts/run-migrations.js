#!/usr/bin/env node
/**
 * Database Migration Runner
 * Applies SQL migrations in sequence for schema improvements
 * 
 * Usage: node scripts/run-migrations.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'ecommerce_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const MIGRATIONS_DIR = path.join(__dirname, '../infrastructure/database/migrations');

function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort((a, b) => a.localeCompare(b));
}


// Check if migration has been applied
async function isMigrationApplied(client, migrationName) {
  const result = await client.query(
    'SELECT 1 FROM schema_migrations WHERE migration_name = $1',
    [migrationName]
  );
  return result.rows.length > 0;
}

// Record migration as applied
async function recordMigration(client, migrationName) {
  await client.query(
    'INSERT INTO schema_migrations (migration_name, applied_at) VALUES ($1, NOW())',
    [migrationName]
  );
}


// Run a single migration file
async function runMigration(client, migrationFile) {
  const migrationPath = path.join(MIGRATIONS_DIR, migrationFile);
  
  console.log(`\nReading migration: ${migrationFile}`);
  
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found: ${migrationPath}`);
  }
  
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  console.log(`Applying migration: ${migrationFile}...`);
  
  try {
    await client.query(sql);
    console.log(`[OK] Successfully applied: ${migrationFile}`);
  } catch (error) {
    console.error(`[ERROR] Error applying ${migrationFile}:`, error.message);
    throw error;
  }
}

// Main migration runner
async function runMigrations() {
  const client = await pool.connect();
  
  try {
    console.log('[STARTING] database migrations...\n');
    console.log('Database:', process.env.DB_NAME || 'ecommerce_db');
    console.log('Host:', process.env.DB_HOST || 'localhost');
    console.log('=====================================');
    
    // Ensure migrations table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    
    let appliedCount = 0;
    let skippedCount = 0;
    
    const migrations = getMigrationFiles();

    if (migrations.length === 0) {
      console.log('No migration files found.');
      return;
    }

    // Run each migration in sequence
    for (const migrationFile of migrations) {
      const alreadyApplied = await isMigrationApplied(client, migrationFile);
      
      if (alreadyApplied) {
        console.log(`  Skipping (already applied): ${migrationFile}`);
        skippedCount++;
        continue;
      }
      
      await runMigration(client, migrationFile);
      await recordMigration(client, migrationFile);
      appliedCount++;
    }
    
    console.log('\n=====================================');
    console.log(`Migration completed successfully!`);
    console.log(`Applied: ${appliedCount} | Skipped: ${skippedCount}`);
    
    // Show migration status
    const result = await client.query(
      'SELECT migration_name, applied_at FROM schema_migrations ORDER BY applied_at DESC LIMIT 10'
    );
    
    console.log('\nRecent migrations:');
    result.rows.forEach(row => {
      const date = new Date(row.applied_at).toLocaleString();
      console.log(`   - ${row.migration_name} (${date})`);
    });
    
  } catch (error) {
    console.error('\n[ERROR] Migration failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Rollback helper (for development)
async function showMigrationStatus() {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT migration_name, applied_at FROM schema_migrations ORDER BY applied_at'
    );
    
    console.log('\nAll applied migrations:');
    if (result.rows.length === 0) {
      console.log('   (none)');
    } else {
      result.rows.forEach((row, index) => {
        const date = new Date(row.applied_at).toLocaleString();
        console.log(`   ${index + 1}. ${row.migration_name} (${date})`);
      });
    }
    console.log('');
  } catch (error) {
    console.error('Error checking migration status:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Parse command line arguments
const command = process.argv[2];

if (command === 'status') {
  showMigrationStatus();
} else {
  runMigrations();
}
