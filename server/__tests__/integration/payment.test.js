const request = require('supertest');
const { createApp } = require('../../src/app');
const { pool } = require('../../config/db');
const jwt = require('jsonwebtoken');

// Mock payment service
jest.mock('../../api/controllers/payment');
const paymentController = require('../../api/controllers/payment');

describe('Payment API - Integration Tests', () => {
  const runId = Date.now();
  const primaryUserEmail = `payment-${runId}@test.com`;
  let authToken;
  let userId;
  let orderId;
  let paymentId;

  beforeAll(async () => {
    // Create test user
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, email_verified) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [primaryUserEmail, 'hashedpassword', 'customer', true]
    );
    userId = userResult.rows[0].id;

    // Generate JWT token
    authToken = jwt.sign(
      { id: userId, email: primaryUserEmail, role: 'customer' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );

    // Create test order
    const orderResult = await pool.query(
      `INSERT INTO orders (user_id, net_amount, tax, shipping_cost, total_amount, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [userId, 140.00, 10.00, 0, 150.00, 'pending']
    );
    orderId = orderResult.rows[0].id;
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    await pool.query('DELETE FROM payments WHERE order_id = $1', [orderId]);
    await pool.query('DELETE FROM orders WHERE id = $1', [orderId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/payments', () => {
    it('should initialize payment successfully', async () => {
      paymentService.initializePayment.mockResolvedValue({
        success: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/test123',
          access_code: 'access123',
          reference: 'PAY-123-ABC',
        },
      });

      paymentService.generateReference.mockReturnValue('PAY-123-ABC');

      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          order_id: orderId,
          amount: 150.00,
          currency: 'USD',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.authorization_url).toBeDefined();
      expect(response.body.data.reference).toBe('PAY-123-ABC');

      // Save payment ID for later tests
      paymentId = response.body.data.payment_id;
    });

    it('should reject payment for non-existent order', async () => {
      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          order_id: 999999,
          amount: 100.00,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Order not found');
    });

    it('should reject payment without authentication', async () => {
      await request(app)
        .post('/api/v1/payments')
        .send({
          order_id: orderId,
          amount: 150.00,
        })
        .expect(401);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing order_id and amount
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('order_id');
    });

    it('should handle payment service errors', async () => {
      paymentService.generateReference.mockReturnValue('PAY-ERROR-123');
      paymentService.initializePayment.mockResolvedValue({
        success: false,
        message: 'Paystack API error',
      });

      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          order_id: orderId,
          amount: 150.00,
        })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/payments', () => {
    it('should list user payments with pagination', async () => {
      const response = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.payments).toBeInstanceOf(Array);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.page).toBe(1);
    });

    it('should return empty array for user with no payments', async () => {
      const noPayEmail = `nopay-${runId}@test.com`;

      // Create new user with no payments
      const newUserResult = await pool.query(
        `INSERT INTO users (email, password_hash, role, email_verified) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [noPayEmail, 'hashedpass', 'customer', true]
      );
      const newUserId = newUserResult.rows[0].id;

      const newUserToken = jwt.sign(
        { id: newUserId, email: noPayEmail, role: 'customer' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '24h' }
      );

      const response = await request(app)
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(response.body.data.payments).toHaveLength(0);

      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [newUserId]);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/payments')
        .expect(401);
    });
  });

  describe('GET /api/v1/payments/:paymentId', () => {
    it('should get payment details', async () => {
      // First create a payment
      await pool.query(
        `INSERT INTO payments (id, order_id, processor, transaction_id, amount, status) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [12345, orderId, 'paystack', 'TXN-TEST-123', 150.00, 'success']
      );

      const response = await request(app)
        .get('/api/v1/payments/12345')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(12345);
      expect(response.body.data.amount).toBe('150.00');

      // Cleanup
      await pool.query('DELETE FROM payments WHERE id = $1', [12345]);
    });

    it('should return 404 for non-existent payment', async () => {
      const response = await request(app)
        .get('/api/v1/payments/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should deny access to other users payments', async () => {
      const otherUserEmail = `other-${runId}@test.com`;

      // Create another user
      const otherUserResult = await pool.query(
        `INSERT INTO users (email, password_hash, role, email_verified) 
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [otherUserEmail, 'hashedpass', 'customer', true]
      );
      const otherUserId = otherUserResult.rows[0].id;

      // Create order for other user
      const otherOrderResult = await pool.query(
        `INSERT INTO orders (user_id, net_amount, tax, shipping_cost, total_amount, status) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [otherUserId, 90.00, 10.00, 0, 100.00, 'pending']
      );
      const otherOrderId = otherOrderResult.rows[0].id;

      // Create payment for other user
      const otherPaymentResult = await pool.query(
        `INSERT INTO payments (order_id, processor, transaction_id, amount, status) 
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [otherOrderId, 'paystack', 'TXN-OTHER-123', 100.00, 'success']
      );
      const otherPaymentId = otherPaymentResult.rows[0].id;

      const response = await request(app)
        .get(`/api/v1/payments/${otherPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);

      // Cleanup
      await pool.query('DELETE FROM payments WHERE id = $1', [otherPaymentId]);
      await pool.query('DELETE FROM orders WHERE id = $1', [otherOrderId]);
      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('GET /api/v1/payments/verify/:reference', () => {
    it('should verify payment successfully', async () => {
      const reference = 'PAY-VERIFY-123';

      // Create pending payment
      await pool.query(
        `INSERT INTO payments (order_id, processor, transaction_id, amount, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, 'paystack', reference, 150.00, 'pending']
      );

      paymentService.verifyPayment.mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          reference: reference,
          amount: 150.00,
          currency: 'USD',
          paid_at: new Date().toISOString(),
          channel: 'card',
          customer: { email: primaryUserEmail },
          metadata: {},
        },
      });

      const response = await request(app)
        .get(`/api/v1/payments/verify/${reference}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('success');
      expect(response.body.data.transaction_details.status).toBe('success');

      // Check that order status was updated
      const orderCheck = await pool.query(
        'SELECT status FROM orders WHERE id = $1',
        [orderId]
      );
      expect(orderCheck.rows[0].status).toBe('paid');

      // Cleanup
      await pool.query('DELETE FROM payments WHERE transaction_id = $1', [reference]);
    });

    it('should handle failed payment verification', async () => {
      const reference = 'PAY-FAILED-123';

      paymentService.verifyPayment.mockResolvedValue({
        success: false,
        message: 'Payment failed',
      });

      const response = await request(app)
        .get(`/api/v1/payments/verify/${reference}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/payments/callback', () => {
    it('should redirect to confirmation page on successful payment', async () => {
      const reference = 'PAY-CALLBACK-123';

      // Create pending payment
      await pool.query(
        `INSERT INTO payments (order_id, processor, transaction_id, amount, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, 'paystack', reference, 150.00, 'pending']
      );

      paymentService.verifyPayment.mockResolvedValue({
        success: true,
        data: {
          status: 'success',
          reference: reference,
          amount: 150.00,
          paid_at: new Date().toISOString(),
        },
      });

      const response = await request(app)
        .get('/api/v1/payments/callback')
        .query({ reference })
        .expect(302);

      expect(response.headers.location).toContain('/order-confirmation');
      expect(response.headers.location).toContain(`order_id=${orderId}`);
      expect(response.headers.location).toContain('status=success');

      // Cleanup
      await pool.query('DELETE FROM payments WHERE transaction_id = $1', [reference]);
    });

    it('should redirect with failed status on payment failure', async () => {
      const reference = 'PAY-CALLBACK-FAIL-123';

      paymentService.verifyPayment.mockResolvedValue({
        success: false,
        message: 'Payment declined',
      });

      const response = await request(app)
        .get('/api/v1/payments/callback')
        .query({ reference })
        .expect(302);

      expect(response.headers.location).toContain('status=failed');
    });
  });

  describe('POST /api/v1/payments/webhook', () => {
    it('should process charge.success webhook event', async () => {
      const reference = 'PAY-WEBHOOK-123';
      const crypto = require('crypto');

      // Create pending payment
      await pool.query(
        `INSERT INTO payments (order_id, processor, transaction_id, amount, status) 
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, 'paystack', reference, 150.00, 'pending']
      );

      const payload = {
        event: 'charge.success',
        data: {
          reference: reference,
          amount: 15000,
          currency: 'USD',
          status: 'success',
        },
      };

      const signature = crypto
        .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || 'test-secret')
        .update(JSON.stringify(payload))
        .digest('hex');

      paymentService.validateWebhookSignature.mockReturnValue(true);

      const response = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-paystack-signature', signature)
        .send(payload)
        .expect(200);

      expect(response.body.status).toBe('success');

      // Check payment status updated
      const paymentCheck = await pool.query(
        'SELECT status FROM payments WHERE transaction_id = $1',
        [reference]
      );
      expect(paymentCheck.rows[0].status).toBe('success');

      // Cleanup
      await pool.query('DELETE FROM payments WHERE transaction_id = $1', [reference]);
    });

    it('should reject webhook with invalid signature', async () => {
      paymentService.validateWebhookSignature.mockReturnValue(false);

      const response = await request(app)
        .post('/api/v1/payments/webhook')
        .set('x-paystack-signature', 'invalid-signature')
        .send({ event: 'charge.success', data: {} })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid signature');
    });
  });
});
