const request = require('supertest');
const { pool } = require('../../../config/db');
const argon2 = require('argon2');
const {
  createDbInfraGuard,
  createTestProduct,
  createTestVariant,
  getCookieValue,
} = require('../../helpers/testHelpers');

// Use main app instance
const { createApp } = require('../../../src/app');
const app = createApp();

describe('E2E Tests - Complete User Journey', () => {
  const { disable, isReady, dbTest } = createDbInfraGuard();
  let userEmail;
  let authToken;
  let userId;
  let productId;
  let variantId;
  let cartId;
  let orderId;

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    userEmail = `e2e${Date.now()}@test.com`;

    try {
      const product = await createTestProduct({
        name: 'E2E Test Product',
        brand: 'Test Brand',
        base_price: 149.99,
        description: 'Product for E2E testing',
      });
      productId = product.id;

      const variant = await createTestVariant(productId, {
        sku: 'E2E-SKU-001',
        price: 149.99,
        stock: 100,
        size: 'L',
        color: 'Red',
      });
      variantId = variant.id;
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;

    // Cleanup
    if (orderId) {
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
    }
    if (cartId) {
      await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
      await pool.query('DELETE FROM carts WHERE id = $1', [cartId]);
    }
    if (variantId) {
      await pool.query('DELETE FROM product_variants WHERE id = $1', [variantId]);
    }
    if (productId) {
      await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    }
    if (userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  describe('Complete Shopping Flow', () => {
    dbTest('Step 1: User Registration', async () => {

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: userEmail,
          password: 'SecurePass123!',
          confirm_password: 'SecurePass123!',
          first_name: 'E2E',
          last_name: 'User',
          accept_terms: true,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user?.email).toBe(userEmail);

      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1 LIMIT 1',
        [userEmail],
      );
      userId = userResult.rows[0]?.id;

      console.log('[OK] User registered successfully');
    });

    dbTest('Step 2: User Login', async () => {

      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: userEmail,
          password: 'SecurePass123!',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user?.email).toBe(userEmail);
      
      // Update auth token from login
      authToken = getCookieValue(response.headers['set-cookie'], 'token');
      expect(authToken).toBeDefined();

      console.log('[OK] User logged in successfully');
    });

    dbTest('Step 3: Browse Products', async () => {

      const response = await request(app)
        .get('/api/v1/catalog/products')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      const testProduct = response.body.data.find(p => p.id === productId);
      expect(testProduct).toBeDefined();
      expect(testProduct.name).toBe('E2E Test Product');

      console.log('[OK] Products browsed successfully');
    });

    dbTest('Step 4: View Product Details', async () => {

      const response = await request(app)
        .get(`/api/v1/catalog/products/${productId}`)
        .expect(200);

      expect(response.body.id).toBe(productId);
      expect(response.body.name).toBe('E2E Test Product');
      expect(response.body.base_price).toBe(149.99);

      console.log('[OK] Product details viewed');
    });

    dbTest('Step 5: Add Item to Cart', async () => {

      const response = await request(app)
        .post('/api/v1/ordering/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_variant_id: variantId,
          quantity: 2,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.product_variant_id).toBe(variantId);
      expect(response.body.data.quantity).toBe(2);

      console.log('[OK] Item added to cart');
    });

    dbTest('Step 6: View Cart', async () => {

      const response = await request(app)
        .get('/api/v1/ordering/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cart_id');
      expect(response.body.data.items).toBeInstanceOf(Array);
      expect(response.body.data.items.length).toBeGreaterThan(0);
      
      cartId = response.body.data.cart_id;
      
      const cartItem = response.body.data.items.find(item => item.product_variant_id === variantId);
      expect(cartItem).toBeDefined();
      expect(cartItem.quantity).toBe(2);

      console.log('[OK] Cart viewed with items');
    });

    dbTest('Step 7: Update Cart Item Quantity', async () => {

      // Get cart item id
      const cartResponse = await request(app)
        .get('/api/v1/ordering/cart')
        .set('Authorization', `Bearer ${authToken}`);
      
      const cartItemId = cartResponse.body.data.items[0].cart_item_id;

      const response = await request(app)
        .patch(`/api/v1/ordering/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 3 })
        .expect(200);

      expect(response.body.data.quantity).toBe(3);

      console.log('[OK] Cart quantity updated');
    });

    dbTest('Step 8: Check Cart Count', async () => {

      const response = await request(app)
        .get('/api/v1/ordering/cart/count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.count).toBeGreaterThan(0);

      console.log('[OK] Cart count retrieved');
    });

    dbTest('Step 9: View All Orders (should be empty initially)', async () => {

      const response = await request(app)
        .get('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      console.log('[OK] Orders list retrieved');
    });

    dbTest('Step 10: Verify Authentication Required', async () => {

      // Try to access cart without token
      await request(app)
        .get('/api/v1/ordering/cart')
        .expect(401);

      // Try to add to cart without token
      await request(app)
        .post('/api/v1/ordering/cart/items')
        .send({ product_variant_id: variantId, quantity: 1 })
        .expect(401);

      console.log('[OK] Authentication protection verified');
    });
  });

  describe('Error Handling Flow', () => {
    dbTest('should handle invalid product ID gracefully', async () => {

      await request(app)
        .get('/api/v1/catalog/products/99999')
        .expect(404);
    });

    dbTest('should handle invalid cart item operations', async () => {

      await request(app)
        .patch('/api/v1/ordering/cart/items/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 1 })
        .expect(404);
    });

    dbTest('should reject invalid quantity values', async () => {

      await request(app)
        .post('/api/v1/ordering/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_variant_id: variantId,
          quantity: -1,
        })
        .expect(400);
    });

    dbTest('should handle malformed JWT token', async () => {

      await request(app)
        .get('/api/v1/ordering/cart')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
