/**
 * Comprehensive Test Helpers - Phase 7
 * Provides utilities for creating test data, mocking, and assertions
 * Supports all four domains: identity, catalog, ordering, payment
 */

const { pool } = require("../../config/db");
const jwt = require("jsonwebtoken");

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
 * Generate JWT access token
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

// ===== CLEANUP HELPERS =====

/**
 * Cleanup all test data
 * Removes test users, products, orders, payments, etc.
 */
async function cleanupTestData() {
  // Clean in proper order due to foreign keys
  // Remove refunds
  await pool.query(
    `DELETE FROM refunds WHERE payment_id IN (
      SELECT id FROM payments WHERE order_id IN (
        SELECT id FROM orders WHERE user_id IN (
          SELECT id FROM users WHERE email LIKE 'test-%@example.com'
        )
      )
    )`
  );

  // Remove order items
  await pool.query(
    `DELETE FROM order_items WHERE order_id IN (
      SELECT id FROM orders WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE 'test-%@example.com'
      )
    )`
  );

  // Remove payments
  await pool.query(
    `DELETE FROM payments WHERE order_id IN (
      SELECT id FROM orders WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE 'test-%@example.com'
      )
    )`
  );

  // Remove orders
  await pool.query(
    `DELETE FROM orders WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE 'test-%@example.com'
    )`
  );

  // Remove cart items
  await pool.query(
    `DELETE FROM cart_items WHERE cart_id IN (
      SELECT id FROM carts WHERE user_id IN (
        SELECT id FROM users WHERE email LIKE 'test-%@example.com'
      )
    )`
  );

  // Remove carts
  await pool.query(
    `DELETE FROM carts WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE 'test-%@example.com'
    )`
  );

  // Remove addresses
  await pool.query(
    `DELETE FROM addresses WHERE user_id IN (
      SELECT id FROM users WHERE email LIKE 'test-%@example.com'
    )`
  );

  // Remove test users
  await pool.query(`DELETE FROM users WHERE email LIKE 'test-%@example.com'`);

  // Remove product variants
  await pool.query(
    `DELETE FROM product_variants WHERE product_id IN (
      SELECT id FROM products WHERE name LIKE 'Test Product%'
    )`
  );

  // Remove test products
  await pool.query(`DELETE FROM products WHERE name LIKE 'Test Product%'`);
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
    throw new Error(`Expected error in response, got: ${JSON.stringify(response.body)}`);
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
    throw new Error(`Expected data in response, got: ${JSON.stringify(response.body)}`);
  }

  if (expectedKeys && Array.isArray(expectedKeys)) {
    for (const key of expectedKeys) {
      if (!(key in response.body.data)) {
        throw new Error(
          `Expected data to have key "${key}", got: ${JSON.stringify(response.body.data)}`
        );
      }
    }
  }
}

module.exports = {
  // Identity domain
  createTestUser,
  createTestAdmin,
  generateToken,
  generateRefreshToken,

  // Catalog domain
  createTestProduct,
  createTestVariant,

  // Ordering domain
  getOrCreateCart,
  addToCart,
  createTestAddress,
  createTestOrder,

  // Payment domain
  createTestPayment,
  createTestRefund,

  // Cleanup
  cleanupTestData,
  cleanupUser,

  // Assertions
  expectStatus,
  expectError,
  expectData,
};
