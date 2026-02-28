const request = require('supertest');
const { pool } = require('../../config/db');
const argon2 = require('argon2');

// Import app (we'll need to modify index.js to export app)
// For now, we'll create a separate test app
const express = require('express');
const passport = require('../../config/passport');
const userRoutes = require('../../routes/user');
const productRoutes = require('../../routes/product');
const cartRoutes = require('../../routes/cart');
const orderRoutes = require('../../routes/orders');
const { authenticateJWT } = require('../../config/auth');

const app = express();
app.use(express.json());
app.use(passport.initialize());
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/cart', authenticateJWT, cartRoutes);
app.use('/api/v1/orders', authenticateJWT, orderRoutes);

describe('E2E Tests - Complete User Journey', () => {
  let userEmail;
  let authToken;
  let userId;
  let productId;
  let variantId;
  let cartId;
  let orderId;

  beforeAll(async () => {
    userEmail = `e2e${Date.now()}@test.com`;
    
    // Create test product
    const productResult = await pool.query(
      'INSERT INTO products (name, brand, base_price, description) VALUES ($1, $2, $3, $4) RETURNING id',
      ['E2E Test Product', 'Test Brand', 149.99, 'Product for E2E testing']
    );
    productId = productResult.rows[0].id;

    // Create product variant
    const variantResult = await pool.query(
      'INSERT INTO variants (product_id, sku, size, color, stock_quantity, price_adjustment) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [productId, 'E2E-SKU-001', 'L', 'Red', 100, 0]
    );
    variantId = variantResult.rows[0].id;
  });

  afterAll(async () => {
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
      await pool.query('DELETE FROM variants WHERE id = $1', [variantId]);
    }
    if (productId) {
      await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    }
    if (userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
  });

  describe('Complete Shopping Flow', () => {
    it('Step 1: User Registration', async () => {
      const response = await request(app)
        .post('/api/v1/users/register')
        .send({
          email: userEmail,
          password: 'SecurePass123!',
        })
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(userEmail);
      
      authToken = response.body.token;
      userId = response.body.id;

      console.log('✓ User registered successfully');
    });

    it('Step 2: User Login', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({
          email: userEmail,
          password: 'SecurePass123!',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.email).toBe(userEmail);
      
      // Update auth token from login
      authToken = response.body.token;

      console.log('✓ User logged in successfully');
    });

    it('Step 3: Browse Products', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      
      const testProduct = response.body.data.find(p => p.id === productId);
      expect(testProduct).toBeDefined();
      expect(testProduct.name).toBe('E2E Test Product');

      console.log('✓ Products browsed successfully');
    });

    it('Step 4: View Product Details', async () => {
      const response = await request(app)
        .get(`/api/v1/products/${productId}`)
        .expect(200);

      expect(response.body.id).toBe(productId);
      expect(response.body.name).toBe('E2E Test Product');
      expect(response.body.base_price).toBe(149.99);

      console.log('✓ Product details viewed');
    });

    it('Step 5: Add Item to Cart', async () => {
      const response = await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variant_id: variantId,
          quantity: 2,
        })
        .expect(201);

      expect(response.body).toHaveProperty('cart_item_id');
      expect(response.body.variant_id).toBe(variantId);
      expect(response.body.quantity).toBe(2);

      console.log('✓ Item added to cart');
    });

    it('Step 6: View Cart', async () => {
      const response = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('cart_id');
      expect(response.body.items).toBeInstanceOf(Array);
      expect(response.body.items.length).toBeGreaterThan(0);
      
      cartId = response.body.cart_id;
      
      const cartItem = response.body.items.find(item => item.variant_id === variantId);
      expect(cartItem).toBeDefined();
      expect(cartItem.quantity).toBe(2);

      console.log('✓ Cart viewed with items');
    });

    it('Step 7: Update Cart Item Quantity', async () => {
      // Get cart item id
      const cartResponse = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`);
      
      const cartItemId = cartResponse.body.items[0].cart_item_id;

      const response = await request(app)
        .patch(`/api/v1/cart/items/${cartItemId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 3 })
        .expect(200);

      expect(response.body.quantity).toBe(3);

      console.log('✓ Cart quantity updated');
    });

    it('Step 8: Check Cart Count', async () => {
      const response = await request(app)
        .get('/api/v1/cart/count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.count).toBeGreaterThan(0);

      console.log('✓ Cart count retrieved');
    });

    it('Step 9: View All Orders (should be empty initially)', async () => {
      const response = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);

      console.log('✓ Orders list retrieved');
    });

    it('Step 10: Verify Authentication Required', async () => {
      // Try to access cart without token
      await request(app)
        .get('/api/v1/cart')
        .expect(401);

      // Try to add to cart without token
      await request(app)
        .post('/api/v1/cart/items')
        .send({ variant_id: variantId, quantity: 1 })
        .expect(401);

      console.log('✓ Authentication protection verified');
    });
  });

  describe('Error Handling Flow', () => {
    it('should handle invalid product ID gracefully', async () => {
      await request(app)
        .get('/api/v1/products/99999')
        .expect(404);
    });

    it('should handle invalid cart item operations', async () => {
      await request(app)
        .patch('/api/v1/cart/items/99999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ quantity: 1 })
        .expect(404);
    });

    it('should reject invalid quantity values', async () => {
      await request(app)
        .post('/api/v1/cart/items')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          variant_id: variantId,
          quantity: -1,
        })
        .expect(400);
    });

    it('should handle malformed JWT token', async () => {
      await request(app)
        .get('/api/v1/cart')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
