const { pool } = require("../../config/db");

/**
 * Test database helpers
 */

async function createTestUser(overrides = {}) {
  const userData = {
    email: `test-${Date.now()}@example.com`,
    password_hash: "$argon2id$v=19$m=65536,t=3,p=4$test", // Mock hash
    first_name: "Test",
    last_name: "User",
    role: "customer",
    is_verified: true,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      userData.email,
      userData.password_hash,
      userData.first_name,
      userData.last_name,
      userData.role,
      userData.is_verified,
    ],
  );

  return result.rows[0];
}

async function createTestProduct(overrides = {}) {
  const productData = {
    name: `Test Product ${Date.now()}`,
    description: "Test description",
    base_price: 29.99,
    is_active: true,
    ...overrides,
  };

  const result = await pool.query(
    `INSERT INTO products (name, description, base_price, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      productData.name,
      productData.description,
      productData.base_price,
      productData.is_active,
    ],
  );

  return result.rows[0];
}

async function cleanupTestData() {
  // Clean in order due to foreign keys
  await pool.query(
    "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-%@example.com'))",
  );
  await pool.query(
    "DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-%@example.com')",
  );
  await pool.query(
    "DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-%@example.com'))",
  );
  await pool.query(
    "DELETE FROM carts WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'test-%@example.com')",
  );
  await pool.query("DELETE FROM users WHERE email LIKE 'test-%@example.com'");
  await pool.query("DELETE FROM products WHERE name LIKE 'Test Product%'");
}

module.exports = {
  createTestUser,
  createTestProduct,
  cleanupTestData,
};
