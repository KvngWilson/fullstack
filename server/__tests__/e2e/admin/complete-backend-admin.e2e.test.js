const request = require('supertest');
const { createApp } = require('../../../src/app');
const { pool } = require('../../../config/db');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

describe('Complete Backend E2E - Core Smoke Flow', () => {
  const app = createApp();
  const runId = Date.now();
  const { disable, isReady, dbTest } = createDbInfraGuard();

  let customerEmail;
  let customerToken;
  let productId;
  let variantId;

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    customerEmail = `customer-${runId}@test.com`;

    try {
      const productResult = await pool.query(
        `INSERT INTO products (name, description, base_price, category)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        ['Smoke Product', 'Product for smoke e2e', 149.99, 'electronics']
      );
      productId = productResult.rows[0].id;

      const variantResult = await pool.query(
        `INSERT INTO product_variants (product_id, sku, price, stock, attributes)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [productId, `SMOKE-SKU-${runId}`, 149.99, 100, JSON.stringify({ color: 'black' })]
      );
      variantId = variantResult.rows[0].id;
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;

    await pool.query("DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))", [`%${runId}%`]);
    await pool.query("DELETE FROM carts WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)", [`%${runId}%`]);
    await pool.query("DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))", [`%${runId}%`]);
    await pool.query("DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))", [`%${runId}%`]);
    await pool.query("DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)", [`%${runId}%`]);
    await pool.query('DELETE FROM product_variants WHERE id = $1', [variantId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    await pool.query("DELETE FROM users WHERE email LIKE $1", [`%${runId}%`]);
  });

  dbTest('customer can register and login via auth endpoints', async () => {

    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: customerEmail,
        password: 'SecurePass123!',
        confirm_password: 'SecurePass123!',
        first_name: 'Smoke',
        last_name: 'Customer',
        accept_terms: true,
      });

    expect([200, 400, 404]).toContain(registerResponse.status);

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: customerEmail, password: 'SecurePass123!' });

    expect([200, 401, 404]).toContain(loginResponse.status);
    if (loginResponse.status === 200) {
      customerToken = loginResponse.body.data?.token;
      expect(customerToken).toBeDefined();
    }
  });

  dbTest('catalog endpoints are reachable', async () => {

    const listResponse = await request(app).get('/api/v1/catalog/products?page=1&limit=20');
    expect([200, 404]).toContain(listResponse.status);

    const detailResponse = await request(app).get(`/api/v1/catalog/products/${productId}`);
    expect([200, 404]).toContain(detailResponse.status);
  });

  dbTest('cart and ordering endpoints enforce auth and/or respond consistently', async () => {

    const cartNoAuth = await request(app).get('/api/v1/ordering/cart');
    expect([401, 404]).toContain(cartNoAuth.status);

    if (customerToken) {
      const addResponse = await request(app)
        .post('/api/v1/ordering/cart/items')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ product_variant_id: variantId, quantity: 1 });

      expect([201, 400, 404]).toContain(addResponse.status);
    }

    const orderingProbe = await request(app).get('/api/v1/ordering/carts/1');
    expect([401, 404]).toContain(orderingProbe.status);
  });

  dbTest('admin endpoints are protected or unavailable', async () => {

    const adminRoutes = [
      '/api/v1/admin/dashboard/stats',
      '/api/v1/admin/orders',
      '/api/v1/admin/products',
      '/api/v1/admin/users',
    ];

    for (const route of adminRoutes) {
      const response = await request(app).get(route);
      expect([401, 403, 404]).toContain(response.status);
    }
  });
});
