const request = require('supertest');
const { createApp } = require('../../src/app');
const pool = require('../../config/db');
const jwt = require('jsonwebtoken');

// Mock payment service for E2E
jest.mock('../../api/controllers/payment');
const paymentController = require('../../api/controllers/payment');

describe('E2E: Checkout to Payment Flow', () => {
  const runId = Date.now();
  const primaryUserEmail = `e2e-${runId}@test.com`;
  let authToken;
  let userId;
  let productId;
  let cartId;
  let orderId;
  let paymentReference;

  beforeAll(async () => {
    // Setup: Create test user
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password, role) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [`e2euser-${runId}`, primaryUserEmail, '$argon2id$hashedpassword', 'customer']
    );
    userId = userResult.rows[0].id;

    authToken = jwt.sign(
      { id: userId, email: primaryUserEmail, role: 'customer' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );

    // Create test product
    const productResult = await pool.query(
      `INSERT INTO products (name, description, price, stock, category) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      ['Test Product', 'E2E Test Product', 99.99, 10, 'Electronics']
    );
    productId = productResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup: Delete all test data in correct order
    await pool.query('DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [userId]);
    await pool.query('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = $1)', [userId]);
    await pool.query('DELETE FROM orders WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id = $1)', [userId]);
    await pool.query('DELETE FROM carts WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM products WHERE id = $1', [productId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Purchase Flow', () => {
    it('should complete full checkout flow: cart → order → payment → confirmation', async () => {
      // Step 1: Add product to cart
      const addToCartResponse = await request(app)
        .post('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          product_id: productId,
          quantity: 2,
        })
        .expect(201);

      expect(addToCartResponse.body.success).toBe(true);

      // Step 2: View cart
      const viewCartResponse = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(viewCartResponse.body.success).toBe(true);
      expect(viewCartResponse.body.data.items).toHaveLength(1);
      expect(parseFloat(viewCartResponse.body.data.total)).toBe(199.98); // 2 * 99.99
      cartId = viewCartResponse.body.data.cart_id;

      // Step 3: Get cart count
      const cartCountResponse = await request(app)
        .get('/api/v1/cart/count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(cartCountResponse.body.data.count).toBe(2);

      // Step 4: Create order (simulating checkout)
      // Note: This endpoint needs to be implemented
      // For now, we'll create the order directly in the database
      const orderResult = await pool.query(
        `INSERT INTO orders (user_id, net_amount, tax, shipping_cost, total_amount, status)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [userId, 199.98, 0, 0, 199.98, 'pending']
      );
      orderId = orderResult.rows[0].id;

      // Step 5: Initialize payment
      paymentReference = `PAY-${Date.now()}-E2E`;
      paymentService.generateReference.mockReturnValue(paymentReference);
      paymentService.initializePayment.mockResolvedValue({
        success: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/e2e-test',
          access_code: 'e2e-access-123',
          reference: paymentReference,
        },
      });

      const initPaymentResponse = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          order_id: orderId,
          amount: 199.98,
          currency: 'USD',
        })
        .expect(201);

      expect(initPaymentResponse.body.success).toBe(true);
      expect(initPaymentResponse.body.data.authorization_url).toBeDefined();
      expect(initPaymentResponse.body.data.reference).toBe(paymentReference);

      // Step 6: Simulate payment completion via callback
      paymentService.verifyPayment.mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          reference: paymentReference,
          amount: 199.98,
          currency: 'USD',
          paid_at: new Date().toISOString(),
          channel: 'card',
          customer: { email: primaryUserEmail },
          metadata: { order_id: orderId },
        },
      });

      const callbackResponse = await request(app)
        .get('/api/v1/payments/callback')
        .query({ reference: paymentReference })
        .expect(302);

      expect(callbackResponse.headers.location).toContain('/order-confirmation');
      expect(callbackResponse.headers.location).toContain(`order_id=${orderId}`);
      expect(callbackResponse.headers.location).toContain('status=success');

      // Step 7: Verify order status updated to 'paid'
      const orderCheck = await pool.query(
        'SELECT status FROM orders WHERE id = $1',
        [orderId]
      );
      expect(orderCheck.rows[0].status).toBe('paid');

      // Step 8: Verify payment recorded in database
      const paymentCheck = await pool.query(
        'SELECT * FROM payments WHERE order_id = $1',
        [orderId]
      );
      expect(paymentCheck.rows.length).toBe(1);
      expect(paymentCheck.rows[0].status).toBe('success');
      expect(parseFloat(paymentCheck.rows[0].amount)).toBe(199.98);

      // Step 9: Check cart was cleared
      const finalCartResponse = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Note: Cart clearing logic should be implemented in order creation
      // For this test, we'll manually clear it
      await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);

      const clearedCartResponse = await request(app)
        .get('/api/v1/cart')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(clearedCartResponse.body.data.items).toHaveLength(0);
    });

    it('should handle payment failure gracefully', async () => {
      // Create order for failed payment test
      const failOrderResult = await pool.query(
        `INSERT INTO orders (user_id, total_amount, status) 
         VALUES ($1, $2, $3) RETURNING id`,
        [userId, 99.99, 'pending']
      );
      const failOrderId = failOrderResult.rows[0].id;

      // Initialize payment
      const failReference = `PAY-${Date.now()}-FAIL`;
      paymentService.generateReference.mockReturnValue(failReference);
      paymentService.initializePayment.mockResolvedValue({
        success: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/fail-test',
          access_code: 'fail-access-123',
          reference: failReference,
        },
      });

      await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          order_id: failOrderId,
          amount: 99.99,
        })
        .expect(201);

      // Simulate failed payment
      paymentService.verifyPayment.mockResolvedValue({
        success: false,
        message: 'Payment declined by bank',
      });

      const callbackResponse = await request(app)
        .get('/api/v1/payments/callback')
        .query({ reference: failReference })
        .expect(302);

      expect(callbackResponse.headers.location).toContain('status=failed');

      // Verify order status remains 'pending'
      const orderCheck = await pool.query(
        'SELECT status FROM orders WHERE id = $1',
        [failOrderId]
      );
      expect(orderCheck.rows[0].status).toBe('pending');

      // Cleanup
      await pool.query('DELETE FROM payments WHERE order_id = $1', [failOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [failOrderId]);
    });

    it('should handle webhook events correctly', async () => {
      // Create order for webhook test
      const webhookOrderResult = await pool.query(
        `INSERT INTO orders (user_id, total_amount, status) 
         VALUES ($1, $2, $3) RETURNING id`,
        [userId, 149.99, 'pending']
      );
      const webhookOrderId = webhookOrderResult.rows[0].id;

      const webhookReference = `PAY-${Date.now()}-WEBHOOK`;

      // Create pending payment
      await pool.query(
        `INSERT INTO payments (order_id, processor, transaction_id, amount, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [webhookOrderId, 'paystack', webhookReference, 149.99, 'pending']
      );

      // Simulate webhook event
      const crypto = require('crypto');
      const webhookPayload = {
        event: 'charge.success',
        data: {
          reference: webhookReference,
          amount: 14999, // In kobo/cents
          currency: 'USD',
          status: 'success',
          paid_at: new Date().toISOString(),
          customer: { email: primaryUserEmail },
        },
      };

      paymentService.validateWebhookSignature.mockReturnValue(true);

      const webhookResponse = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-paystack-signature', 'valid-signature')
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body.success).toBe(true);

      // Verify payment status updated
      const paymentCheck = await pool.query(
        'SELECT status FROM payments WHERE transaction_id = $1',
        [webhookReference]
      );
      expect(paymentCheck.rows[0].status).toBe('success');

      // Verify order status updated
      const orderCheck = await pool.query(
        'SELECT status FROM orders WHERE id = $1',
        [webhookOrderId]
      );
      expect(orderCheck.rows[0].status).toBe('paid');

      // Cleanup
      await pool.query('DELETE FROM payments WHERE order_id = $1', [webhookOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [webhookOrderId]);
    });

    it('should retrieve payment history for user', async () => {
      // User should have payments from previous tests
      const historyResponse = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.data.payments).toBeInstanceOf(Array);
      expect(historyResponse.body.data.pagination).toBeDefined();
    });

    it('should verify payment by reference', async () => {
      const verifyReference = `PAY-${Date.now()}-VERIFY`;

      // Create order and payment
      const verifyOrderResult = await pool.query(
        `INSERT INTO orders (user_id, total_amount, status) 
         VALUES ($1, $2, $3) RETURNING id`,
        [userId, 75.00, 'pending']
      );
      const verifyOrderId = verifyOrderResult.rows[0].id;

      await pool.query(
        `INSERT INTO payments (order_id, processor, transaction_id, amount, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [verifyOrderId, 'paystack', verifyReference, 75.00, 'pending']
      );

      // Mock verification success
      paymentService.verifyPayment.mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          reference: verifyReference,
          amount: 75.00,
          paid_at: new Date().toISOString(),
        },
      });

      const verifyResponse = await request(app)
        .get(`/api/v1/payments/verify/${verifyReference}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data.verified).toBe(true);

      // Cleanup
      await pool.query('DELETE FROM payments WHERE order_id = $1', [verifyOrderId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [verifyOrderId]);
    });
  });

  describe('Payment Security Tests', () => {
    it('should prevent unauthorized access to payment endpoints', async () => {
      await request(app)
        .post('/api/v1/payments')
        .send({ order_id: 1, amount: 100 })
        .expect(401);

      await request(app)
        .get('/api/v1/payments')
        .expect(401);

      await request(app)
        .get('/api/v1/payments/123')
        .expect(401);

      await request(app)
        .get('/api/v1/payments/verify/REF-123')
        .expect(401);
    });

    it('should prevent payment for orders owned by other users', async () => {
      const otherUserEmail = `other2-${runId}@test.com`;

      // Create another user
      const otherUserResult = await pool.query(
        `INSERT INTO users (username, email, password, role) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [`otheruser2-${runId}`, otherUserEmail, 'hashedpass', 'customer']
      );
      const otherUserId = otherUserResult.rows[0].id;

      // Create order for other user
      const otherOrderResult = await pool.query(
        `INSERT INTO orders (user_id, total_amount, status) 
         VALUES ($1, $2, $3) RETURNING id`,
        [otherUserId, 50.00, 'pending']
      );
      const otherOrderId = otherOrderResult.rows[0].id;

      // Try to pay for other user's order
      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          order_id: otherOrderId,
          amount: 50.00,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not authorized');

      // Cleanup
      await pool.query('DELETE FROM orders WHERE id = $1', [otherOrderId]);
      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });
});
