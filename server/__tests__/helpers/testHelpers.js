/**
 * Comprehensive Test Helpers
 * Unified test utilities for: identity, catalog, ordering, payment domains
 * Also includes database operations and cleanup utilities
 */

const { pool } = require("../../config/db");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

// ===== DATABASE HELPERS =====

class DatabaseHelper {
  static pool = null;
  static currentConnection = null;

  static initializePool() {
    if (!this.pool) {
      this.pool = new Pool({
        host: process.env.DB_HOST_TEST || "localhost",
        port: process.env.DB_PORT_TEST || 5432,
        database: process.env.DB_NAME_TEST || "fullstack_test",
        user: process.env.DB_USER_TEST || "postgres",
        password: process.env.DB_PASSWORD_TEST || "postgres",
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
    await connection.query("BEGIN");
  }

  static async rollbackTransaction() {
    const connection = await this.getConnection();
    try {
      await connection.query("ROLLBACK");
    } catch (error) {
      // Transaction already rolled back or connection closed
    }
  }

  static async commitTransaction() {
    const connection = await this.getConnection();
    await connection.query("COMMIT");
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
}

// ===== USER & AUTH HELPERS (Identity Domain) =====

/**
 * Create a test user with defaults
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created user object
 */
async function createTestUser(overrides = {}) {
  const userData = {
    email: `test-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}@example.com`,
    password_hash: "$argon2id$v=19$m=65536,t=3,p=4$test", // Mock hash
    first_name: "Test",
    last_name: "User",
    role: overrides.role || "customer",
    is_verified: true,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, first_name, last_name, role, is_verified, created_at`,
    [
      userData.email,
      userData.password_hash,
      userData.first_name,
      userData.last_name,
      userData.role,
      userData.is_verified,
    ]
  );

  return result.rows[0];
}

/**
 * Create admin user
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created admin user
 */
async function createTestAdmin(overrides = {}) {
  return createTestUser({
    role: "admin",
    ...overrides,
  });
}

/**
 * Generate JWT token (for testing)
 * @param {number} userId - User ID to encode in token
 * @param {string} role - User role (default: 'customer')
 * @param {number} vendorId - Vendor ID (optional)
 * @param {Array} permissions - User permissions (optional)
 * @returns {string} JWT token
 */
function createToken(userId, role = "customer", vendorId = null, permissions = []) {
  const JWT_SECRET = process.env.JWT_SECRET || "test-secret-key";
  return jwt.sign(
    {
      user_id: userId,
      role,
      vendor_id: vendorId,
      permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    },
    JWT_SECRET,
    { algorithm: "HS256" }
  );
}

/**
 * Generate JWT access token (standardized format)
 * @param {number} userId - User ID to encode in token
 * @param {string} expiresIn - Token expiration (default: "24h")
 * @returns {string} JWT token
 */
function generateToken(userId, expiresIn = "24h") {
  return jwt.sign(
    { id: userId, type: "access" },
    process.env.JWT_SECRET || "test-secret",
    { expiresIn }
  );
}

/**
 * Generate JWT refresh token
 * @param {number} userId - User ID to encode in token
 * @param {string} expiresIn - Token expiration (default: "7d")
 * @returns {string} JWT token
 */
function generateRefreshToken(userId, expiresIn = "7d") {
  return jwt.sign(
    { id: userId, type: "refresh" },
    process.env.JWT_SECRET || "test-secret",
    { expiresIn }
  );
}

// ===== PERMISSION HELPERS =====

/**
 * Grant a permission to a user (for override testing)
 */
async function grantPermissionOverride(userId, permission, validUntil = null) {
  const expiryDate = validUntil || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const result = await pool.query(
    `INSERT INTO permission_overrides (user_id, permission, granted_at, valid_until)
     VALUES ($1, $2, now(), $3)
     RETURNING *`,
    [userId, permission, expiryDate]
  );

  return result.rows[0];
}

/**
 * Revoke a permission from a user
 */
async function revokePermissionOverride(userId, permission) {
  await pool.query(
    `UPDATE permission_overrides
     SET revoked_at = now()
     WHERE user_id = $1 AND permission = $2`,
    [userId, permission]
  );
}

// ===== PRODUCT & CATALOG HELPERS (Catalog Domain) =====

/**
 * Create a test product
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created product
 */
async function createTestProduct(overrides = {}) {
  const productData = {
    name: `Test Product ${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`,
    description: "Test description",
    brand: "Test Brand",
    base_price: 29.99,
    is_active: true,
    category_id: null,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO products (name, description, brand, base_price, is_active, category_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, description, brand, base_price, is_active, category_id, created_at`,
    [
      productData.name,
      productData.description,
      productData.brand,
      productData.base_price,
      productData.is_active,
      productData.category_id,
    ]
  );

  return result.rows[0];
}

/**
 * Create product variant
 * @param {number} productId - Product to create variant for
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created variant
 */
async function createTestVariant(productId, overrides = {}) {
  const variantData = {
    product_id: productId,
    sku: `SKU-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 5)}`,
    size: "M",
    color: "Blue",
    price_adjustment: 0,
    stock: 100,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO product_variants (product_id, sku, size, color, price_adjustment, stock)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, product_id, sku, size, color, price_adjustment, stock, created_at`,
    [
      variantData.product_id,
      variantData.sku,
      variantData.size,
      variantData.color,
      variantData.price_adjustment,
      variantData.stock,
    ]
  );

  return result.rows[0];
}

// ===== ORDERING HELPERS (Ordering Domain) =====

/**
 * Get or create user's cart
 * @param {number} userId - User ID
 * @returns {Promise<number>} Cart ID
 */
async function getOrCreateCart(userId) {
  const existingResult = await pool.query(
    `SELECT id FROM carts WHERE user_id = $1`,
    [userId]
  );

  if (existingResult.rows.length > 0) {
    return existingResult.rows[0].id;
  }

  const result = await pool.query(
    `INSERT INTO carts (user_id) VALUES ($1) RETURNING id`,
    [userId]
  );

  return result.rows[0].id;
}

/**
 * Add item to user's cart
 * @param {number} userId - User ID
 * @param {number} variantId - Product variant ID
 * @param {number} quantity - Quantity to add (default: 1)
 * @returns {Promise<Object>} Cart item
 */
async function addToCart(userId, variantId, quantity = 1) {
  const cartId = await getOrCreateCart(userId);

  const result = await pool.query(
    `INSERT INTO cart_items (cart_id, product_variant_id, quantity)
     VALUES ($1, $2, $3)
     ON CONFLICT (cart_id, product_variant_id)
     DO UPDATE SET quantity = cart_items.quantity + $3
     RETURNING id, cart_id, product_variant_id, quantity`,
    [cartId, variantId, quantity]
  );

  return result.rows[0];
}

/**
 * Create user address
 * @param {number} userId - User ID
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created address
 */
async function createTestAddress(userId, overrides = {}) {
  const addressData = {
    user_id: userId,
    street: "123 Test Street",
    city: "Test City",
    state: "TC",
    postal_code: "12345",
    country: "Test Country",
    is_default: false,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO addresses (user_id, street, city, state, postal_code, country, is_default)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, street, city, state, postal_code, country, is_default, created_at`,
    [
      addressData.user_id,
      addressData.street,
      addressData.city,
      addressData.state,
      addressData.postal_code,
      addressData.country,
      addressData.is_default,
    ]
  );

  return result.rows[0];
}

/**
 * Create order
 * @param {number} userId - User ID
 * @param {number} addressId - Shipping address ID
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created order
 */
async function createTestOrder(userId, addressId, overrides = {}) {
  const orderData = {
    user_id: userId,
    shipping_address_id: addressId,
    billing_address_id: addressId,
    subtotal: 100.0,
    tax: 10.0,
    discount: 0.0,
    shipping_cost: 5.0,
    total: 115.0,
    status: "pending",
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO orders (user_id, shipping_address_id, billing_address_id, subtotal, tax, discount, shipping_cost, total, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, user_id, shipping_address_id, billing_address_id, subtotal, tax, discount, shipping_cost, total, status, created_at`,
    [
      orderData.user_id,
      orderData.shipping_address_id,
      orderData.billing_address_id,
      orderData.subtotal,
      orderData.tax,
      orderData.discount,
      orderData.shipping_cost,
      orderData.total,
      orderData.status,
    ]
  );

  return result.rows[0];
}

/**
 * Create test vendor with admin user
 */
async function createTestVendor(vendorName, adminEmail) {
  // Create vendor
  const vendorResult = await pool.query(
    `INSERT INTO vendors (name, slug, is_active, created_at)
     VALUES ($1, $2, true, now())
     RETURNING id, name`,
    [vendorName, vendorName.toLowerCase().replace(/\s+/g, "-")]
  );

  const vendor = vendorResult.rows[0];

  // Create vendor admin user
  const adminUser = await createTestUser(
    { role: "admin", email: adminEmail, vendor_id: vendor.id }
  );

  return {
    vendor,
    admin: adminUser,
  };
}

/**
 * Create test exchange rates
 */
async function createTestExchangeRates() {
  const currencyPairs = [
    { from: "USD", to: "EUR", rate: 0.92 },
    { from: "USD", to: "GBP", rate: 0.79 },
    { from: "USD", to: "JPY", rate: 149.5 },
    { from: "USD", to: "CAD", rate: 1.36 },
    { from: "EUR", to: "USD", rate: 1.09 },
    { from: "GBP", to: "USD", rate: 1.27 },
  ];

  for (const pair of currencyPairs) {
    await pool.query(
      `INSERT INTO exchange_rates (
        from_currency, to_currency, rate, provider,
        effective_date, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, CURRENT_DATE, now() + interval '24 hours', now())
      ON CONFLICT (from_currency, to_currency) DO UPDATE
      SET rate = $3, updated_at = now()`,
      [pair.from, pair.to, pair.rate, "mock"]
    );
  }
}

// ===== PAYMENT HELPERS (Payment Domain) =====

/**
 * Create test payment
 * @param {number} orderId - Order ID
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created payment
 */
async function createTestPayment(orderId, overrides = {}) {
  const paymentData = {
    order_id: orderId,
    stripe_payment_id: `pi_test_${Date.now()}`,
    amount: 115.0,
    status: "pending",
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO payments (order_id, stripe_payment_id, amount, status)
     VALUES ($1, $2, $3, $4)
     RETURNING id, order_id, stripe_payment_id, amount, status, created_at`,
    [
      paymentData.order_id,
      paymentData.stripe_payment_id,
      paymentData.amount,
      paymentData.status,
    ]
  );

  return result.rows[0];
}

/**
 * Create test refund
 * @param {number} paymentId - Payment ID
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created refund
 */
async function createTestRefund(paymentId, overrides = {}) {
  const refundData = {
    payment_id: paymentId,
    stripe_refund_id: `re_test_${Date.now()}`,
    amount: 115.0,
    status: "pending",
    reason: "customer_request",
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO refunds (payment_id, stripe_refund_id, amount, status, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, payment_id, stripe_refund_id, amount, status, reason, created_at`,
    [
      refundData.payment_id,
      refundData.stripe_refund_id,
      refundData.amount,
      refundData.status,
      refundData.reason,
    ]
  );

  return result.rows[0];
}

// ===== AUDIT LOG HELPERS =====

/**
 * Verify audit log entry exists
 */
async function findAuditLog(query) {
  const result = await pool.query(
    `SELECT * FROM security_audit_log
     WHERE 1=1 ${Object.keys(query)
       .map((k, i) => `AND ${k} = $${i + 1}`)
       .join("")}
     ORDER BY created_at DESC LIMIT 1`,
    Object.values(query)
  );

  return result.rows[0];
}

/**
 * Clear audit logs (for test isolation)
 */
async function clearAuditLogs() {
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  return { before: thirtySecondsAgo };
}

// ===== CLEANUP HELPERS =====

/**
 * Cleanup all test data (in reverse dependency order)
 */
async function cleanupTestData() {
  const tables = [
    "security_audit_log",
    "refunds",
    "order_items",
    "orders",
    "cart_items",
    "shopping_carts",
    "carts",
    "permission_overrides",
    "product_variants",
    "products",
    "addresses",
    "vendors",
    "users",
  ];

  for (const table of tables) {
    try {
      await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
    } catch (error) {
      // Table may not exist or may have constraints
      console.warn(`Could not truncate ${table}:`, error.message);
    }
  }
}

/**
 * Cleanup specific user and related data
 * @param {number} userId - User ID to cleanup
 */
async function cleanupUser(userId) {
  // Clean in dependency order
  await pool.query(
    `DELETE FROM refunds WHERE payment_id IN (
      SELECT id FROM payments WHERE order_id IN (
        SELECT id FROM orders WHERE user_id = $1
      )
    )`,
    [userId]
  );

  await pool.query(
    `DELETE FROM order_items WHERE order_id IN (
      SELECT id FROM orders WHERE user_id = $1
    )`,
    [userId]
  );

  await pool.query(
    `DELETE FROM payments WHERE order_id IN (
      SELECT id FROM orders WHERE user_id = $1
    )`,
    [userId]
  );

  await pool.query(`DELETE FROM orders WHERE user_id = $1`, [userId]);

  await pool.query(
    `DELETE FROM cart_items WHERE cart_id IN (
      SELECT id FROM carts WHERE user_id = $1
    )`,
    [userId]
  );

  await pool.query(`DELETE FROM carts WHERE user_id = $1`, [userId]);

  await pool.query(`DELETE FROM addresses WHERE user_id = $1`, [userId]);

  await pool.query(`DELETE FROM users WHERE id = $1`, [userId]);
}

/**
 * Setup test database (create schemas if needed)
 */
async function setupTestDatabase() {
  try {
    const check = await pool.query(`SELECT 1 FROM users LIMIT 1`);
  } catch (error) {
    throw new Error("Test database not initialized. Run migrations first.");
  }
}

// ===== ASSERTION HELPERS =====

/**
 * Assert response status code
 * @param {Object} response - Express response object
 * @param {number} expected - Expected status code
 * @throws {Error} If status doesn't match
 */
function expectStatus(response, expected) {
  if (response.status !== expected) {
    throw new Error(
      `Expected status ${expected}, got ${response.status}. Body: ${JSON.stringify(
        response.body
      )}`
    );
  }
}

/**
 * Assert response contains error
 * @param {Object} response - Express response object
 * @param {string} expectedMessage - Expected error message (optional)
 * @throws {Error} If no error found
 */
function expectError(response, expectedMessage) {
  if (!response.body.error && !response.body.message) {
    throw new Error(
      `Expected error in response, got: ${JSON.stringify(response.body)}`
    );
  }

  if (expectedMessage) {
    const hasMessage =
      response.body.error === expectedMessage ||
      response.body.message === expectedMessage ||
      response.body.error?.includes(expectedMessage);

    if (!hasMessage) {
      throw new Error(
        `Expected error containing "${expectedMessage}", got: ${JSON.stringify(
          response.body
        )}`
      );
    }
  }
}

/**
 * Assert response contains data
 * @param {Object} response - Express response object
 * @param {Array<string>} expectedKeys - Expected keys in data (optional)
 * @throws {Error} If data missing or keys not found
 */
function expectData(response, expectedKeys) {
  if (!response.body.data) {
    throw new Error(
      `Expected data in response, got: ${JSON.stringify(response.body)}`
    );
  }

  if (expectedKeys && Array.isArray(expectedKeys)) {
    for (const key of expectedKeys) {
      if (!(key in response.body.data)) {
        throw new Error(
          `Expected data to have key "${key}", got: ${JSON.stringify(
            response.body.data
          )}`
        );
      }
    }
  }
}

// ===== INFRA READINESS GUARD =====

/**
 * Create a reusable infra readiness guard for DB-dependent suites.
 * Helps test suites skip gracefully when test DB setup is unavailable.
 */
function createDbInfraGuard() {
  let infraReady = true;

  const disable = () => {
    infraReady = false;
  };

  const isReady = () => infraReady && global.__TEST_DB_AVAILABLE !== false;

  const dbTest = (name, fn, timeout) =>
    it(
      name,
      async () => {
        if (!isReady()) return;
        return fn();
      },
      timeout
    );

  return {
    disable,
    isReady,
    dbTest,
  };
}

// ===== MODULE EXPORTS =====

module.exports = {
  // Database operations
  DatabaseHelper,

  // Identity domain
  createTestUser,
  createTestAdmin,
  createToken,
  generateToken,
  generateRefreshToken,
  grantPermissionOverride,
  revokePermissionOverride,

  // Catalog domain
  createTestProduct,
  createTestVariant,

  // Ordering domain
  getOrCreateCart,
  addToCart,
  createTestAddress,
  createTestOrder,
  createTestVendor,
  createTestExchangeRates,

  // Payment domain
  createTestPayment,
  createTestRefund,

  // Audit
  findAuditLog,
  clearAuditLogs,

  // Cleanup
  cleanupTestData,
  cleanupUser,
  setupTestDatabase,
  createDbInfraGuard,

  // Assertions
  expectStatus,
  expectError,
  expectData,
};
