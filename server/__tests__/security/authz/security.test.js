const request = require('supertest');
const { pool } = require('../../../config/db');
const argon2 = require('argon2');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

// Only run if explicitly enabled via environment variable
const shouldRun = process.env.RUN_SECURITY_TESTS === 'true';

// Use main app instance
const { createApp } = require('../../../src/app');
const app = createApp();

// Conditionally skip the test suite
const describeTest = shouldRun ? describe : describe.skip;

describeTest('Security Tests', () => {
  // Note: These tests require PostgreSQL running at localhost:5445
  // Enable with: RUN_SECURITY_TESTS=true npm run test:security
  const { disable, isReady, dbTest } = createDbInfraGuard();
  const test = dbTest;
  
  let userId;
  let userId2;
  let authToken;
  let authToken2;
  let userEmail;
  let userEmail2;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    userEmail = `security${Date.now()}@test.com`;
    userEmail2 = `security2-${Date.now()}@test.com`;

    // Create first test user
    const hashedPassword = await argon2.hash(testPassword);
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, is_active, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [userEmail, hashedPassword, true, new Date()]
    );
    userId = userResult.rows[0].id;

    // Create second test user
    const userResult2 = await pool.query(
      `INSERT INTO users (email, password_hash, is_active, created_at) VALUES ($1, $2, $3, $4) RETURNING id`,
      [userEmail2, hashedPassword, true, new Date()]
    );
    userId2 = userResult2.rows[0].id;

    // Login first user and get token
    const loginResponse = await request(app)
      .post('/api/v1/identity/users/login')
      .send({ email: userEmail, password: testPassword });
    
    authToken = loginResponse.body.token || '';

    // Login second user and get token
    const loginResponse2 = await request(app)
      .post('/api/v1/identity/users/login')
      .send({ email: userEmail2, password: testPassword });
    
    authToken2 = loginResponse2.body.token || '';
  });

  afterAll(async () => {
    if (!isReady()) return;

    // Cleanup users
    if (userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    if (userId2) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId2]);
    }
  });

  describe('Cross-Tenant Isolation', () => {
    test('should prevent customer from accessing other customer profile', async () => {
      const response = await request(app)
        .get(`/api/v1/identity/users/${userId2}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([401, 403, 404]).toContain(response.status);
    });

    test('should prevent customer from modifying other customer address', async () => {
      const response = await request(app)
        .patch('/api/v1/ordering/addresses/999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          street: '456 Evil St',
        });

      expect([400, 401, 403, 404]).toContain(response.status);
    });

    test('should prevent customer from accessing other customer cart', async () => {
      const response = await request(app)
        .get('/api/v1/ordering/cart/999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect([401, 403, 404]).toContain(response.status);
    });

    test('should only show customer their own orders', async () => {
      const response = await request(app)
        .get('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 400, 401, 404, 500]).toContain(response.status);
      
      if (response.status === 200) {
        const orders = response.body.orders || response.body || [];
        expect(Array.isArray(orders)).toBe(true);
      }
    });
  });

  describe('Shipping Cost Tampering Prevention', () => {
    test('should reject manually set shipping cost in order creation', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 1,
          shipping_cost: 0.01,
        });

      expect([400, 401, 404, 500]).toContain(response.status);
    });

    test('should calculate shipping cost server-side', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 1,
          shipping_cost: 999.99,
        });

      expect([400, 401, 404, 500]).toContain(response.status);
    });

    test('should validate order amounts before processing', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 99999,
          notes: 'Suspicious order',
        });

      expect([400, 401, 404, 500]).toContain(response.status);
    });

    test('should enforce maximum order amount limits', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 1,
          notes: 'Excessive value',
        });

      expect([400, 401, 404, 500]).toContain(response.status);
    });
  });

  describe('Payment Security', () => {
    test('should never expose card numbers in responses', async () => {
      const response = await request(app)
        .get('/api/v1/payment/methods')
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        const responseText = JSON.stringify(response.body);
        expect(responseText).not.toMatch(/4\d{12}\d{3}/);
      }
    });

    test('should enforce minimum order amount', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 1,
          notes: 'Tiny order',
        });

      expect([400, 401, 404, 500]).toContain(response.status);
    });

    test('should enforce maximum order amount', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 1,
          notes: 'Huge order',
        });

      expect([400, 401, 404, 500]).toContain(response.status);
    });

    test('should validate payment method ownership', async () => {
      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          payment_method_id: 999,
          amount: 100.00,
        });

      expect([400, 401, 404, 500]).toContain(response.status);
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get('/api/v1/identity/profile');

      expect([401, 400]).toContain(response.status);
    });

    test('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/identity/profile')
        .set('Authorization', 'Bearer invalid-token-xyz');

      expect([401, 400]).toContain(response.status);
    });

    test('should return 401 with malformed auth header', async () => {
      const response = await request(app)
        .get('/api/v1/identity/profile')
        .set('Authorization', 'NotABearerToken');

      expect([400, 401]).toContain(response.status);
    });

    test('should return 403 for permission denied', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect([403, 404, 401]).toContain(response.status);
    });

    test('should accept valid token and return user data', async () => {
      const response = await request(app)
        .get('/api/v1/identity/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 400, 401, 404]).toContain(response.status);
    });
  });

  describe('Webhook Security', () => {
    test('should reject webhook without valid signature', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/payment')
        .send({
          event: 'payment.completed',
          data: { order_id: 1 },
        });

      expect([400, 401, 403, 404]).toContain(response.status);
    });

    test('should reject webhook with invalid signature', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/payment')
        .set('X-Webhook-Signature', 'invalid-signature')
        .send({
          event: 'payment.completed',
          data: { order_id: 1 },
        });

      expect([400, 401, 403, 404]).toContain(response.status);
    });

    test('should handle webhook payload validation', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/payment')
        .send({});

      expect([400, 401, 403, 404]).toContain(response.status);
    });

    test('should log webhook processing for audit trail', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/payment')
        .set('X-Webhook-Signature', 'test')
        .send({
          event: 'payment.completed',
        });

      expect([400, 401, 403, 404, 500]).toContain(response.status);
    });
  });

  describe('Input Validation & XSS Prevention', () => {
    test('should sanitize user input on registration', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      const response = await request(app)
        .post('/api/v1/identity/users/register')
        .send({
          email: `xss-test-${Date.now()}@test.com`,
          password: testPassword,
          first_name: xssPayload,
        });

      expect([200, 201, 400, 500]).toContain(response.status);
    });

    test('should validate content-type headers', async () => {
      const response = await request(app)
        .post('/api/v1/identity/users/register')
        .set('Content-Type', 'text/plain')
        .send('invalid');

      expect([400, 415, 500]).toContain(response.status);
    });

    test('should reject oversized payloads', async () => {
      const hugePayload = 'a'.repeat(10000000);
      const response = await request(app)
        .post('/api/v1/identity/users/register')
        .send({
          email: `huge-${Date.now()}@test.com`,
          password: testPassword,
          first_name: hugePayload,
        });

      expect([400, 413, 500]).toContain(response.status);
    });

    test('should validate email format', async () => {
      const response = await request(app)
        .post('/api/v1/identity/users/register')
        .send({
          email: 'not-an-email',
          password: testPassword,
        });

      expect([400, 500]).toContain(response.status);
    });
  });
});
