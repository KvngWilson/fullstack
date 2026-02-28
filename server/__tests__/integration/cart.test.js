const request = require('supertest');
const express = require('express');
const cartRoutes = require('../../routes/cart');
const { pool } = require('../../config/db');
const jwt = require('jsonwebtoken');
const { authenticateJWT } = require('../../config/auth');

// Create test app
const app = express();
app.use(express.json());
app.use(authenticateJWT);
app.use('/api/v1/cart', cartRoutes);

describe('Cart API - Integration Tests', () => {
  let authToken;
  let testUserId;
  let testProductId;
  let testVariantId;
  let testCartId;

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
      [`carttest${Date.now()}@test.com`, 'hashedpassword']
    );
    testUserId = userResult.rows[0].id;

    // Generate auth token
    authToken = jwt.sign(
      { id: testUserId, email: 'carttest@test.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Create test product
    const productResult = await pool.query(
      'INSERT INTO products (name, brand, base_price) VALUES ($1, $2, $3) RETURNING id',
      ['Test Product', 'Test Brand', 99.99]
    );
    testProductId = productResult.rows[0].id;

    // Create test variant
    const variantResult = await pool.query(
      'INSERT INTO variants (product_id, sku, size, color, stock_quantity) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [testProductId, 'TEST-SKU-001', 'M', 'Blue', 10]
    );
    testVariantId = variantResult.rows[0].id;

    // Create cart for user
    const cartResult = await pool.query(
      'INSERT INTO carts (user_id) VALUES ($1) RETURNING id',
      [testUserId]
    );
    testCartId = cartResult.rows[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [testCartId]);
    await pool.query('DELETE FROM carts WHERE user_id = $1', [testUserId]);
    await pool.query('DELETE FROM variants WHERE id = $1', [testVariantId]);
    await pool.query('DELETE FROM products WHERE id = $1', [testProductId]);
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('GET /api/v1/cart', () => {
    it('should get empty cart for authenticated user', async () => {
      const response = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart_id');
      expect(response.body.data.items).toBeInstanceOf(Array);
    });

    it('should reject request without auth token', async () => {
      await request(app)
        .get('/api/v1/cart')
        .expect(401);
    });
  });

  describe('POST /api/v1/cart/items', () => {
    it('should add item to cart', async () => {
      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variant_id: testVariantId,
          quantity: 2,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart_item_id');
      expect(response.body.data.variant_id).toBe(testVariantId);
      expect(response.body.data.quantity).toBe(2);
    });

    it('should reject invalid quantity', async () => {
      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variant_id: testVariantId,
          quantity: 0,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject missing variant_id', async () => {
      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quantity: 1,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
    it('should reject when requested quantity exceeds stock', async () => {
      // Set low stock
      await pool.query('UPDATE variants SET stock_quantity = $1 WHERE id = $2', [1, testVariantId]);

      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variant_id: testVariantId,
          quantity: 5,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Insufficient stock');

      // Reset stock for other tests
      await pool.query('UPDATE variants SET stock_quantity = $1 WHERE id = $2', [10, testVariantId]);
    });
  });

  describe('GET /api/v1/cart/count', () => {
    it('should get cart item count', async () => {
      const response = await request(app)
        .get('/api/v1/cart/count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('count');
      expect(typeof response.body.data.count).toBe('number');
      expect(response.body.data.count).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for empty cart', async () => {
      // Clean cart
      await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [testCartId]);

      const response = await request(app)
        .get('/api/v1/cart/count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.count).toBe(0);
    });
  });

  describe('PATCH /api/v1/cart/items/:itemId', () => {
    let cartItemId;

    beforeEach(async () => {
      // Add item to cart
      const result = await pool.query(
        'INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, $3) RETURNING id',
        [testCartId, testVariantId, 1]
      );
      cartItemId = result.rows[0].id;
    });

    it('should update cart item quantity', async () => {
      const response = await request(app)
        .patch(`/api/v1/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 5 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(5);
    });

    it('should reject invalid item id', async () => {
      await request(app)
        .patch('/api/v1/cart/items/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 3 })
        .expect(404);
    });
  });

  describe('DELETE /api/v1/cart/items/:itemId', () => {
    let cartItemId;

    beforeEach(async () => {
      const result = await pool.query(
        'INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES ($1, $2, $3) RETURNING id',
        [testCartId, testVariantId, 1]
      );
      cartItemId = result.rows[0].id;
    });

    it('should delete cart item', async () => {
      const response = await request(app)
        .delete(`/api/v1/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed');
    });

    it('should return 404 for non-existent item', async () => {
      await request(app)
        .delete('/api/v1/cart/items/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
