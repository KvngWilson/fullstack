/**
 * Test Utilities & Helpers
 * 
 * Common utilities for authentication, authorization testing, and database setup.
 */

const jwt = require('jsonwebtoken');
const { pool } = require('../../config/db');
const { createDbInfraGuard } = require('./testHelpers');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

/**
 * Generate a JWT token for testing
 */
function createToken(userId, role = 'customer', vendorId = null, permissions = []) {
  return jwt.sign(
    {
      user_id: userId,
      role,
      vendor_id: vendorId,
      permissions,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60
    },
    JWT_SECRET,
    { algorithm: 'HS256' }
  );
}

/**
 * Create a test user with specified role and permissions
 */
async function createTestUser(email, role = 'customer', vendorId = null) {
  const result = await pool.query(
    `INSERT INTO users (email, first_name, last_name, role, vendor_id, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, true, now())
     RETURNING id, email, role, vendor_id`,
    [
      email,
      email.split('@')[0],
      'Test',
      role,
      vendorId
    ]
  );

  return result.rows[0];
}

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

/**
 * Create a test vendor with admin user
 */
async function createTestVendor(vendorName, adminEmail) {
  // Create vendor
  const vendorResult = await pool.query(
    `INSERT INTO vendors (name, slug, is_active, created_at)
     VALUES ($1, $2, true, now())
     RETURNING id, name`,
    [vendorName, vendorName.toLowerCase().replace(/\s+/g, '-')]
  );

  const vendor = vendorResult.rows[0];

  // Create vendor admin user
  const adminUser = await createTestUser(adminEmail, 'admin', vendor.id);

  return {
    vendor,
    admin: adminUser
  };
}

/**
 * Create test products for a vendor
 */
async function createTestProducts(vendorId, count = 5) {
  const products = [];

  for (let i = 0; i < count; i++) {
    const result = await pool.query(
      `INSERT INTO products (
        vendor_id, name, description, sku, price_cents, 
        is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, true, now())
      RETURNING id, name, sku, price_cents`,
      [
        vendorId,
        `Test Product ${i + 1}`,
        `Description for product ${i + 1}`,
        `TEST-SKU-${vendorId}-${i + 1}`,
        (i + 1) * 1000  // $10, $20, $30, etc
      ]
    );

    const product = result.rows[0];

    // Create variants for each product
    const variantResult = await pool.query(
      `INSERT INTO product_variants (
        product_id, sku, price_cents, stock_quantity, 
        attributes, created_at
      ) VALUES ($1, $2, $3, $4, $5, now())
      RETURNING id, sku, price_cents`,
      [
        product.id,
        `${product.sku}-VAR-1`,
        product.price_cents,
        100,
        JSON.stringify({ size: 'M', color: 'Black' })
      ]
    );

    products.push({
      ...product,
      variant: variantResult.rows[0]
    });
  }

  return products;
}

/**
 * Create test exchange rates
 */
async function createTestExchangeRates() {
  const currencyPairs = [
    { from: 'USD', to: 'EUR', rate: 0.92 },
    { from: 'USD', to: 'GBP', rate: 0.79 },
    { from: 'USD', to: 'JPY', rate: 149.50 },
    { from: 'USD', to: 'CAD', rate: 1.36 },
    { from: 'EUR', to: 'USD', rate: 1.09 },
    { from: 'GBP', to: 'USD', rate: 1.27 },
  ];

  for (const pair of currencyPairs) {
    await pool.query(
      `INSERT INTO exchange_rates (
        from_currency, to_currency, rate, provider, 
        effective_date, expires_at, created_at
      ) VALUES ($1, $2, $3, $4, CURRENT_DATE, now() + interval '24 hours', now())
      ON CONFLICT (from_currency, to_currency) DO UPDATE
      SET rate = $3, updated_at = now()`,
      [pair.from, pair.to, pair.rate, 'mock']
    );
  }
}

/**
 * Create test order with items
 */
async function createTestOrder(userId, products, currency = 'USD') {
  // Create order
  const orderResult = await pool.query(
    `INSERT INTO orders (
      user_id, status, currency, 
      total_cents, created_at
    ) VALUES ($1, 'pending', $2, 0, now())
    RETURNING id`,
    [userId, currency]
  );

  const orderId = orderResult.rows[0].id;

  // Add items
  let totalCents = 0;
  for (const product of products) {
    const itemPrice = product.price_cents;
    totalCents += itemPrice;

    await pool.query(
      `INSERT INTO order_items (
        order_id, product_id, product_variant_id, quantity, 
        unit_price, subtotal, created_at
      ) VALUES ($1, $2, $3, 1, $4, $4, now())`,
      [orderId, product.id, product.variant.id, itemPrice]
    );
  }

  // Update order total
  await pool.query(
    `UPDATE orders SET total_cents = $1 WHERE id = $2`,
    [totalCents, orderId]
  );

  return { orderId, totalCents };
}

/**
 * Verify audit log entry exists
 */
async function findAuditLog(query) {
  const result = await pool.query(
    `SELECT * FROM security_audit_log 
     WHERE 1=1 ${Object.keys(query).map((k, i) => `AND ${k} = $${i + 1}`).join('')}
     ORDER BY created_at DESC LIMIT 1`,
    Object.values(query)
  );

  return result.rows[0];
}

/**
 * Clear audit logs (for test isolation)
 */
async function clearAuditLogs() {
  // Note: If audit logs are immutable, this may not work
  // In that case, just query within time windows
  const thirtySecondsAgo = new Date(Date.now() - 30 * 1000);
  
  // Don't delete, just ignore old logs in assertions
  return { before: thirtySecondsAgo };
}

/**
 * Setup test database (create schemas if needed)
 */
async function setupTestDatabase() {
  // Create tables if they don't exist
  // Most tables should exist, but ensure test-specific ones do
  
  try {
    // Check if test data exists
    const check = await pool.query(
      `SELECT 1 FROM users LIMIT 1`
    );
  } catch (error) {
    throw new Error('Test database not initialized. Run migrations first.');
  }
}

/**
 * Cleanup test data
 */
async function cleanupTestData() {
  // Clear in reverse dependency order
  const tables = [
    'security_audit_log',
    'order_items',
    'orders',
    'cart_items',
    'shopping_carts',
    'permission_overrides',
    'product_variants',
    'products',
    'vendors',
    'users'
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

module.exports = {
  createToken,
  createTestUser,
  grantPermissionOverride,
  revokePermissionOverride,
  createTestVendor,
  createTestProducts,
  createTestExchangeRates,
  createTestOrder,
  findAuditLog,
  clearAuditLogs,
  setupTestDatabase,
  cleanupTestData,
  createDbInfraGuard,
};
