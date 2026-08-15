const request = require('supertest');
const { pool } = require('../../../config/db');
const argon2 = require('argon2');

// Use main app instance
const { createApp } = require('../../../src/app');
const app = createApp();
const {
  createDbInfraGuard,
  createTestProduct,
  createTestVariant,
  createTestAddress,
  getCookieValue,
} = require('../../helpers/testHelpers');

describe('Complete Order Lifecycle (E2E)', () => {
  let userId;
  let productId;
  let variantId;
  let cartId;
  let orderId;
  let shippingAddressId;
  let billingAddressId;
  let authToken;
  let userEmail;
  const { disable, isReady, dbTest } = createDbInfraGuard();

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    userEmail = `order-lifecycle-${Date.now()}@test.com`;
    const testPassword = 'TestPassword123!';

    try {
      const hashedPassword = await argon2.hash(testPassword);
      const userResult = await pool.query(
        `INSERT INTO users (email, password_hash, role, is_active, created_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [userEmail, hashedPassword, 'customer', true, new Date()]
      );
      userId = userResult.rows[0].id;

      const shippingAddress = await createTestAddress(userId, {
        type: 'shipping',
        is_primary: true,
      });
      shippingAddressId = shippingAddress.id;

      const billingAddress = await createTestAddress(userId, {
        type: 'billing',
      });
      billingAddressId = billingAddress.id;

      const product = await createTestProduct({
        name: 'Order Lifecycle Test Product',
        brand: 'Test Brand',
        base_price: 99.99,
        description: 'Product for order lifecycle testing',
      });
      productId = product.id;

      const variant = await createTestVariant(productId, {
        sku: `OLC-SKU-${Date.now()}`,
        price: 99.99,
        stock: 100,
        size: 'M',
        color: 'Blue',
      });
      variantId = variant.id;

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: userEmail, password: testPassword });

      authToken = getCookieValue(loginResponse.headers['set-cookie'], 'token');
      if (!authToken) {
        throw new Error('Failed to obtain auth token for order lifecycle test');
      }
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;

    if (orderId) {
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [orderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
    }
    if (cartId) {
      await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
      await pool.query('DELETE FROM carts WHERE id = $1', [cartId]);
    }
    if (shippingAddressId) {
      await pool.query('DELETE FROM addresses WHERE id = $1', [shippingAddressId]);
    }
    if (billingAddressId && billingAddressId !== shippingAddressId) {
      await pool.query('DELETE FROM addresses WHERE id = $1', [billingAddressId]);
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

  describe('Order Creation and Cart Operations', () => {
    dbTest('should retrieve an empty cart before adding items', async () => {
      const cartResponse = await request(app)
        .get('/api/v1/ordering/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cartResponse.body.success).toBe(true);
      expect(cartResponse.body.data.item_count).toBe(0);
      cartId = cartResponse.body.data.cart_id;
    });

    dbTest('should add items to cart', async () => {
      if (!cartId) {
        const cartResponse = await request(app)
          .get('/api/v1/ordering/cart')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        cartId = cartResponse.body.data.cart_id;
      }

      const addResponse = await request(app)
        .post('/api/v1/ordering/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_variant_id: variantId,
          quantity: 2,
        })
        .expect(201);

      expect(addResponse.body.success).toBe(true);
      expect(addResponse.body.data.product_variant_id).toBe(variantId);
      expect(addResponse.body.data.quantity).toBe(2);
    });

    dbTest('should retrieve cart items', async () => {
      const getResponse = await request(app)
        .get('/api/v1/ordering/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.cart_id).toBe(cartId);
      expect(Array.isArray(getResponse.body.data.items)).toBe(true);
      expect(
        getResponse.body.data.items.some(
          (item) => item.product_variant_id === variantId && item.quantity === 2
        )
      ).toBe(true);
    });

    dbTest('should create order from cart', async () => {
      const orderResponse = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shipping_address_id: shippingAddressId,
          billing_address_id: billingAddressId,
        })
        .expect(201);

      expect(orderResponse.body.success).toBe(true);
      orderId = orderResponse.body.data.id;
      expect(orderId).toBeDefined();
    });

    dbTest('should retrieve orders for user', async () => {
      const ordersResponse = await request(app)
        .get('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(ordersResponse.body)).toBe(true);
      expect(ordersResponse.body.some((order) => order.id === orderId)).toBe(true);
    });
  });

  describe('Order Status and Retrieval', () => {
    dbTest('should retrieve a specific order by id', async () => {
      const getResponse = await request(app)
        .get(`/api/v1/ordering/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.id).toBe(orderId);
    });

    dbTest('should reject customer order status updates', async () => {
      const updateResponse = await request(app)
        .patch(`/api/v1/ordering/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'paid',
        })
        .expect(403);

      expect(updateResponse.body.success).toBe(false);
    });

    dbTest('should list orders with pagination support', async () => {
      const listResponse = await request(app)
        .get('/api/v1/ordering/orders?page=1&pageSize=10')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(listResponse.body)).toBe(true);
    });

    dbTest('should handle order not found gracefully', async () => {
      const notFoundResponse = await request(app)
        .get('/api/v1/ordering/orders/999999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(notFoundResponse.body.success).toBe(false);
    });

    dbTest('should enforce authorization - anonymous request rejected', async () => {
      const unauthorizedResponse = await request(app)
        .get('/api/v1/ordering/orders')
        .expect(401);

      expect(unauthorizedResponse.body.success).toBe(false);
    });
  });
});
