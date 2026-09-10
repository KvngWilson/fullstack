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

const USER_ROLE_VALUES = new Set(["customer", "vendor", "admin", "support"]);

function uniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toCents(amount) {
  return Math.round(Number(amount || 0) * 100);
}

function fromCents(amountInCents) {
  return Number(amountInCents || 0) / 100;
}

function getCookieValue(setCookieHeader, cookieName) {
  if (!Array.isArray(setCookieHeader)) {
    return null;
  }

  const cookie = setCookieHeader.find((entry) => entry.startsWith(`${cookieName}=`));
  if (!cookie) {
    return null;
  }

  return cookie.split(";")[0].slice(cookieName.length + 1);
}

function normalizeUserArgs(overridesOrEmail = {}, role, vendorSlug) {
  if (typeof overridesOrEmail === "string") {
    return {
      email: overridesOrEmail,
      role,
      vendor_slug: vendorSlug,
    };
  }

  return { ...overridesOrEmail };
}

async function getDefaultTenantId() {
  const result = await pool.query(
    "SELECT id FROM tenants WHERE slug = 'default' LIMIT 1",
  );

  if (result.rows.length === 0) {
    throw new Error("Default tenant is missing from the current test schema.");
  }

  return result.rows[0].id;
}

async function ensureTestVendor(overrides = {}) {
  if (overrides.vendor_id) {
    return overrides.vendor_id;
  }

  const tenantId = overrides.tenant_id || (await getDefaultTenantId());
  const storeName = overrides.store_name || overrides.name || `Test Vendor ${uniqueSuffix()}`;
  const slug = overrides.slug || slugify(storeName);

  const result = await pool.query(
    `INSERT INTO vendors (tenant_id, user_id, store_name, slug, description, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, tenant_id, user_id, store_name, slug, status`,
    [
      tenantId,
      overrides.user_id || null,
      storeName,
      slug,
      overrides.description || null,
      overrides.status || "active",
    ],
  );

  return result.rows[0];
}

async function ensureTestCategory(overrides = {}) {
  if (overrides.category_id) {
    return overrides.category_id;
  }

  const categoryName = overrides.category || overrides.category_name;
  if (!categoryName) {
    return null;
  }

  const tenantId = overrides.tenant_id || (await getDefaultTenantId());
  const slug = overrides.category_slug || `${slugify(categoryName)}-${uniqueSuffix()}`;
  const result = await pool.query(
    `INSERT INTO categories (tenant_id, name, slug)
     VALUES ($1, $2, $3)
     RETURNING id, tenant_id, name, slug`,
    [tenantId, categoryName, slug],
  );

  return result.rows[0].id;
}

async function ensureEmployeeForUser(userId) {
  const existing = await pool.query(
    "SELECT id FROM employees WHERE user_id = $1 LIMIT 1",
    [userId],
  );

  if (existing.rows.length > 0) {
    return existing.rows[0].id;
  }

  const roleResult = await pool.query(
    `INSERT INTO roles (vendor_id, code, name, description, hierarchy_level, is_system, is_active)
     VALUES (NULL, $1, $2, $3, 0, false, true)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [`test-role-${userId}`, `Test Role ${userId}`, "Generated by test helper"],
  );

  let roleId = roleResult.rows[0]?.id;
  if (!roleId) {
    const existingRole = await pool.query(
      "SELECT id FROM roles WHERE code = $1 LIMIT 1",
      [`test-role-${userId}`],
    );
    roleId = existingRole.rows[0]?.id;
  }

  const employeeResult = await pool.query(
    `INSERT INTO employees (user_id, role_id)
     VALUES ($1, $2)
     RETURNING id`,
    [userId, roleId],
  );

  return employeeResult.rows[0].id;
}

// ===== USER & AUTH HELPERS (Identity Domain) =====

/**
 * Create a test user with defaults
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created user object
 */
async function createTestUser(overridesOrEmail = {}, role, vendorSlug) {
  const overrides = normalizeUserArgs(overridesOrEmail, role, vendorSlug);
  const normalizedRole = USER_ROLE_VALUES.has(overrides.role) ? overrides.role : "customer";
  const userData = {
    email: overrides.email || `test-${uniqueSuffix()}@example.com`,
    username: overrides.username || `user-${uniqueSuffix()}`,
    password_hash: "$argon2id$v=19$m=65536,t=3,p=4$test", // Mock hash
    first_name: "Test",
    last_name: "User",
    role: normalizedRole,
    is_verified: true,
    email_verified: true,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash, first_name, last_name, role, is_verified, email_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, username, email, first_name, last_name, role, is_verified, email_verified, created_at`,
    [
      userData.username,
      userData.email,
      userData.password_hash,
      userData.first_name,
      userData.last_name,
      userData.role,
      userData.is_verified,
      userData.email_verified,
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
  const employeeId = await ensureEmployeeForUser(userId);
  let permissionResult = await pool.query(
    "SELECT id, code FROM permissions WHERE code = $1 LIMIT 1",
    [permission],
  );

  if (permissionResult.rows.length === 0) {
    permissionResult = await pool.query(
      `INSERT INTO permissions (code, name, category, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING id, code`,
      [permission, permission, "test"],
    );
  }

  const result = await pool.query(
    `INSERT INTO employee_permission_overrides (
       employee_id, permission_id, grant_type, scope, reason, granted_by_id, valid_until
     )
     VALUES ($1, $2, 'grant', NULL, 'test override', $3, $4)
     ON CONFLICT (employee_id, permission_id, scope)
     DO UPDATE SET grant_type = 'grant', valid_until = EXCLUDED.valid_until
     RETURNING *`,
    [employeeId, permissionResult.rows[0].id, userId, validUntil],
  );

  return result.rows[0];
}

/**
 * Revoke a permission from a user
 */
async function revokePermissionOverride(userId, permission) {
  const employeeId = await ensureEmployeeForUser(userId);
  const permissionResult = await pool.query(
    "SELECT id FROM permissions WHERE code = $1 LIMIT 1",
    [permission],
  );

  if (permissionResult.rows.length === 0) {
    return;
  }

  await pool.query(
    `UPDATE employee_permission_overrides
     SET grant_type = 'revoke'
     WHERE employee_id = $1 AND permission_id = $2`,
    [employeeId, permissionResult.rows[0].id],
  );
}

// ===== PRODUCT & CATALOG HELPERS (Catalog Domain) =====

/**
 * Create a test product
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created product
 */
async function createTestProduct(overrides = {}) {
  const vendor = await ensureTestVendor({
    vendor_id: overrides.vendor_id,
    tenant_id: overrides.tenant_id,
    user_id: overrides.user_id,
    store_name: overrides.store_name,
    slug: overrides.vendor_slug,
    description: overrides.vendor_description,
    status: overrides.vendor_status,
  });
  const tenantId = overrides.tenant_id || vendor.tenant_id || (await getDefaultTenantId());
  const categoryId = await ensureTestCategory({
    ...overrides,
    tenant_id: tenantId,
  });
  const productData = {
    name: `Test Product ${uniqueSuffix()}`,
    slug: overrides.slug || `product-${uniqueSuffix()}`,
    description: "Test description",
    brand: "Test Brand",
    base_price: 29.99,
    is_active: true,
    category_id: categoryId,
    vendor_id: vendor.id,
    tenant_id: tenantId,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO products (vendor_id, tenant_id, category_id, name, slug, description, brand, base_price, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, vendor_id, tenant_id, category_id, name, slug, description, brand, base_price, is_active, created_at`,
    [
      productData.vendor_id,
      productData.tenant_id,
      productData.category_id,
      productData.name,
      productData.slug,
      productData.description,
      productData.brand,
      productData.base_price,
      productData.is_active,
    ],
  );

  return {
    ...result.rows[0],
    category: overrides.category || null,
  };
}

/**
 * Create product variant
 * @param {number} productId - Product to create variant for
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created variant
 */
async function createTestVariant(productId, overrides = {}) {
  const productResult = await pool.query(
    "SELECT base_price FROM products WHERE id = $1",
    [productId],
  );

  if (productResult.rows.length === 0) {
    throw new Error(`Product ${productId} not found`);
  }

  const basePrice = Number(productResult.rows[0].base_price || 0);
  const price = overrides.price ?? basePrice + Number(overrides.price_adjustment || 0);
  const attributes = {
    ...(overrides.attributes || {}),
    ...(overrides.size ? { size: overrides.size } : {}),
    ...(overrides.color ? { color: overrides.color } : {}),
  };
  const variantData = {
    product_id: productId,
    sku: overrides.sku || `SKU-${uniqueSuffix()}`,
    size: "M",
    color: "Blue",
    price_adjustment: overrides.price_adjustment || 0,
    price_cents:
      overrides.price_cents !== undefined ? overrides.price_cents : toCents(price),
    stock: 100,
    attributes,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO product_variants (product_id, sku, price_cents, stock, attributes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, product_id, sku, price_cents, stock, attributes, created_at, version`,
    [
      variantData.product_id,
      variantData.sku,
      variantData.price_cents,
      variantData.stock,
      JSON.stringify(variantData.attributes),
    ],
  );

  return {
    ...result.rows[0],
    price: fromCents(result.rows[0].price_cents),
    price_adjustment: variantData.price_adjustment,
    size: variantData.attributes.size || null,
    color: variantData.attributes.color || null,
  };
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
  const variantResult = await pool.query(
    `SELECT product_id, price_cents
     FROM product_variants
     WHERE id = $1`,
    [variantId],
  );

  if (variantResult.rows.length === 0) {
    throw new Error(`Variant ${variantId} not found`);
  }

  const result = await pool.query(
    `INSERT INTO cart_items (cart_id, product_id, product_variant_id, quantity, unit_price_cents)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (cart_id, product_variant_id)
     DO UPDATE SET quantity = cart_items.quantity + $3
     RETURNING id, cart_id, product_id, product_variant_id, quantity, unit_price_cents`,
    [
      cartId,
      variantResult.rows[0].product_id,
      variantId,
      quantity,
      variantResult.rows[0].price_cents,
    ],
  );

  return {
    ...result.rows[0],
    price: fromCents(result.rows[0].unit_price_cents),
  };
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
    type: overrides.type || "shipping",
    street: "123 Test Street",
    city: "Test City",
    state: "TC",
    postal_code: "12345",
    country: "Test Country",
    is_primary: overrides.is_primary ?? overrides.is_default ?? false,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO addresses (user_id, type, street, city, state, postal_code, country, is_primary)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id, user_id, type, street, city, state, postal_code, country, is_primary, created_at`,
    [
      addressData.user_id,
      addressData.type,
      addressData.street,
      addressData.city,
      addressData.state,
      addressData.postal_code,
      addressData.country,
      addressData.is_primary,
    ],
  );

  return {
    ...result.rows[0],
    is_default: result.rows[0].is_primary,
  };
}

/**
 * Create order
 * @param {number} userId - User ID
 * @param {number} addressId - Shipping address ID
 * @param {Object} overrides - Properties to override defaults
 * @returns {Promise<Object>} Created order
 */
async function createTestOrder(userId, addressId, overrides = {}) {
  const addressResult = await pool.query(
    "SELECT * FROM addresses WHERE id = $1 LIMIT 1",
    [addressId],
  );

  if (addressResult.rows.length === 0) {
    throw new Error(`Address ${addressId} not found`);
  }

  const address = addressResult.rows[0];
  const statusMap = {
    completed: "delivered",
    shipping: "shipped",
  };
  const orderData = {
    user_id: userId,
    billing_address_id: addressId,
    subtotal: overrides.subtotal ?? 100.0,
    tax: overrides.tax ?? 10.0,
    discount: overrides.discount ?? 0.0,
    shipping_cost: overrides.shipping_cost ?? 5.0,
    total: overrides.total ?? 115.0,
    status: statusMap[overrides.status] || overrides.status || "pending",
    shipping_first_name: overrides.shipping_first_name || address.first_name || "Test",
    shipping_last_name: overrides.shipping_last_name || address.last_name || "User",
    shipping_email: overrides.shipping_email || null,
    shipping_phone: overrides.shipping_phone || address.phone || null,
    shipping_street_address: overrides.shipping_street_address || address.street,
    shipping_city: overrides.shipping_city || address.city,
    shipping_state: overrides.shipping_state || address.state,
    shipping_postal_code: overrides.shipping_postal_code || address.postal_code,
    shipping_country: overrides.shipping_country || address.country,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO orders (
       user_id, billing_address_id, status, subtotal_cents, tax_cents, discount_cents, shipping_cents, total_cents,
       shipping_first_name, shipping_last_name, shipping_email, shipping_phone, shipping_street_address,
       shipping_city, shipping_state, shipping_postal_code, shipping_country
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     RETURNING id, user_id, order_number, billing_address_id, status, subtotal_cents, tax_cents, discount_cents, shipping_cents, total_cents, created_at`,
    [
      orderData.user_id,
      orderData.billing_address_id,
      orderData.status,
      toCents(orderData.subtotal),
      toCents(orderData.tax),
      toCents(orderData.discount),
      toCents(orderData.shipping_cost),
      toCents(orderData.total),
      orderData.shipping_first_name,
      orderData.shipping_last_name,
      orderData.shipping_email,
      orderData.shipping_phone,
      orderData.shipping_street_address,
      orderData.shipping_city,
      orderData.shipping_state,
      orderData.shipping_postal_code,
      orderData.shipping_country,
    ],
  );

  return {
    ...result.rows[0],
    shipping_address_id: addressId,
    subtotal: fromCents(result.rows[0].subtotal_cents),
    tax: fromCents(result.rows[0].tax_cents),
    discount: fromCents(result.rows[0].discount_cents),
    shipping_cost: fromCents(result.rows[0].shipping_cents),
    total: fromCents(result.rows[0].total_cents),
  };
}

/**
 * Create test vendor with admin user
 */
async function createTestVendor(vendorName, adminEmail) {
  const vendor = await ensureTestVendor({
    name: vendorName,
    slug: slugify(vendorName),
  });

  const adminUser = await createTestUser(
    { role: "vendor", email: adminEmail }
  );

  await pool.query(
    "UPDATE vendors SET user_id = $1 WHERE id = $2",
    [adminUser.id, vendor.id],
  );

  return {
    vendor: {
      ...vendor,
      name: vendor.store_name,
    },
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
        effective_date, expires_at, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, CURRENT_DATE, now() + interval '24 hours', true, now(), now())
      ON CONFLICT (from_currency, to_currency, effective_date) DO UPDATE
      SET rate = $3, expires_at = now() + interval '24 hours', is_active = true, updated_at = now()`,
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
    amount: overrides.amount ?? 115.0,
    status: "pending",
    processor: overrides.processor || "stripe",
    currency: overrides.currency || "USD",
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO payments (order_id, stripe_payment_id, processor, amount_cents, currency, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, order_id, stripe_payment_id, processor, amount_cents, currency, status, created_at`,
    [
      paymentData.order_id,
      paymentData.stripe_payment_id,
      paymentData.processor,
      paymentData.amount_cents ?? toCents(paymentData.amount),
      paymentData.currency,
      paymentData.status,
    ],
  );

  return {
    ...result.rows[0],
    amount: fromCents(result.rows[0].amount_cents),
  };
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
    amount: overrides.amount ?? 115.0,
    reason: overrides.reason || "customer_request",
    status: overrides.status || "pending",
    metadata: overrides.metadata || {},
  };

  const result = await pool.query(
    `INSERT INTO refunds (payment_id, amount, reason, metadata, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, payment_id, amount, reason, metadata, status, created_at, updated_at`,
    [
      refundData.payment_id,
      refundData.amount,
      refundData.reason,
      JSON.stringify(refundData.metadata),
      refundData.status,
    ],
  );

  return result.rows[0];
}

// ===== AUDIT LOG HELPERS =====

/**
 * Verify audit log entry exists
 */
async function findAuditLog(query) {
  const clauses = [];
  const params = [];

  for (const [key, value] of Object.entries(query)) {
    params.push(value);
    const index = params.length;

    if (key === "action") {
      clauses.push(`event_type = $${index}`);
      continue;
    }

    if (key === "resource_id" || key === "resource_type" || key === "severity") {
      clauses.push(`metadata ->> '${key}' = $${index}`);
      continue;
    }

    clauses.push(`${key} = $${index}`);
  }

  const result = await pool.query(
    `SELECT * FROM security_audit_log
     WHERE 1=1 ${clauses.map((clause) => `AND ${clause}`).join(" ")}
     ORDER BY created_at DESC LIMIT 1`,
    params,
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
    "employee_permission_overrides",
    "employee_invitations",
    "employees",
    "role_permissions",
    "permissions",
    "roles",
    "order_items",
    "orders",
    "cart_items",
    "carts",
    "product_variants",
    "products",
    "categories",
    "vendors",
    "addresses",
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
    const { verifyCurrentTestSchema } = require("../../scripts/verify-test-db-schema");
    await verifyCurrentTestSchema(pool);
  } catch (error) {
    throw new Error(`Test database is not initialized with the current schema. ${error.message}`);
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
  const buildInfraError = () => {
    const message =
      global.__TEST_DB_SETUP_ERROR?.message
      || "DB-backed suite setup did not complete successfully.";
    return new Error(`DB-backed test could not run: ${message}`);
  };

  const dbTest = (name, fn, timeout) =>
    it(
      name,
      async () => {
        if (!isReady()) {
          throw buildInfraError();
        }
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
  getCookieValue,
};
