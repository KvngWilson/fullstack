const request = require('supertest');
const { createApp } = require('../../../src/app');
const { pool } = require('../../../config/db');
const jwt = require('jsonwebtoken');
const {
  createDbInfraGuard,
  createTestProduct,
  createTestVariant,
} = require('../../helpers/testHelpers');

describe('E2E: Checkout to Payment Flow', () => {
  const app = createApp();
  const runId = Date.now();
  const { disable, isReady, dbTest } = createDbInfraGuard();

  let userId;
  let authToken;
  let productId;
  let variantId;

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    try {
      const userResult = await pool.query(
        `INSERT INTO users (username, email, password_hash, role)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`e2e-user-${runId}`, `e2e-${runId}@test.com`, '$argon2id$test', 'customer']
      );
      userId = userResult.rows[0].id;

      authToken = jwt.sign(
        { id: userId, email: `e2e-${runId}@test.com`, role: 'customer' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const product = await createTestProduct({
        name: 'E2E Product',
        description: 'Product for payment e2e tests',
        base_price: 99.99,
        category: 'electronics',
      });
      productId = product.id;

      const variant = await createTestVariant(productId, {
        sku: `E2E-SKU-${runId}`,
        price: 99.99,
        stock: 50,
        size: 'M',
      });
      variantId = variant.id;
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;

    await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)', [userId]);
    await pool.query('DELETE FROM carts WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [userId]);
    await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [userId]);
    await pool.query('DELETE FROM orders WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM product_variants WHERE id = $1', [variantId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  dbTest('adds item to cart and retrieves cart snapshot', async () => {

    const addResponse = await request(app)
      .post('/api/v1/ordering/cart/items')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ product_variant_id: variantId, quantity: 2 });

    expect(addResponse.status).toBe(201);
    expect(addResponse.body.success).toBe(true);

    const cartResponse = await request(app)
      .get('/api/v1/ordering/cart')
      .set('Authorization', `Bearer ${authToken}`);

    expect(cartResponse.status).toBe(200);
    expect(cartResponse.body.success).toBe(true);
    expect(Array.isArray(cartResponse.body.data.items)).toBe(true);
    expect(cartResponse.body.data.item_count).toBeGreaterThanOrEqual(2);
  });

  dbTest('payment endpoints require authentication', async () => {

    const createResponse = await request(app)
      .post('/api/v1/payments')
      .send({ order_id: 1, amount: 100, currency: 'USD' });

    expect(createResponse.status).toBe(401);

    const listResponse = await request(app).get('/api/v1/payments');
    expect(listResponse.status).toBe(401);

    const verifyResponse = await request(app).get('/api/v1/payments/verify/REF-TEST');
    expect(verifyResponse.status).toBe(401);
  });

  dbTest('payment callback endpoint is reachable', async () => {

    const response = await request(app)
      .get('/api/v1/payments/callback')
      .query({ reference: `PAY-${runId}` });

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain('/checkout?status=error');
  });
});
