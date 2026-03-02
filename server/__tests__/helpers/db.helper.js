const { Pool } = require('pg');

class DatabaseHelper {
  static pool = null;
  static currentConnection = null;

  static initializePool() {
    if (!this.pool) {
      this.pool = new Pool({
        host: process.env.DB_HOST_TEST || 'localhost',
        port: process.env.DB_PORT_TEST || 5432,
        database: process.env.DB_NAME_TEST || 'fullstack_test',
        user: process.env.DB_USER_TEST || 'postgres',
        password: process.env.DB_PASSWORD_TEST || 'postgres',
        max: 1,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });
    }
    return this.pool;
  }

  static async getConnection() {
    if (!this.pool) {
      this.initializePool();
    }
    if (!this.currentConnection) {
      this.currentConnection = await this.pool.connect();
    }
    return this.currentConnection;
  }

  static async query(sql, params = []) {
    const connection = await this.getConnection();
    return connection.query(sql, params);
  }

  static async beginTransaction() {
    const connection = await this.getConnection();
    await connection.query('BEGIN');
  }

  static async rollbackTransaction() {
    const connection = await this.getConnection();
    try {
      await connection.query('ROLLBACK');
    } catch (error) {
      // Transaction already rolled back or connection closed
    }
  }

  static async commitTransaction() {
    const connection = await this.getConnection();
    await connection.query('COMMIT');
  }

  static async truncateAll() {
    const connection = await this.getConnection();
    const tables = [
      'shipment_tracking',
      'shipments',
      'payment_methods',
      'payments',
      'cart_items',
      'carts',
      'order_items',
      'orders',
      'addresses',
      'products',
      'users',
    ];

    for (const table of tables) {
      try {
        await connection.query(`TRUNCATE TABLE ${table} CASCADE`);
      } catch (error) {
        // Table may not exist yet
      }
    }
  }

  static async closePool() {
    if (this.currentConnection) {
      await this.currentConnection.release();
      this.currentConnection = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  static setupDatabaseHooks() {
    // This method should only be called from setup.js, before tests start
    // Tests should not call this directly
  }
}

module.exports = DatabaseHelper;
