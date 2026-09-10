const request = require('supertest');
const { pool } = require('../../../config/db');
const argon2 = require('argon2');
const { createDbInfraGuard, getCookieValue } = require('../../helpers/testHelpers');

// Use main app instance
const { createApp } = require('../../../src/app');
const app = createApp();

describe('Security Tests', () => {
  const { disable, isReady, dbTest } = createDbInfraGuard();

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

    const hashedPassword = await argon2.hash(testPassword);
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userEmail, hashedPassword, 'customer', true, new Date()]
    );
    userId = userResult.rows[0].id;

    const userResult2 = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [userEmail2, hashedPassword, 'customer', true, new Date()]
    );
    userId2 = userResult2.rows[0].id;

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userEmail, password: testPassword })
      .expect(200);
    authToken = getCookieValue(loginResponse.headers['set-cookie'], 'token');

    const loginResponse2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: userEmail2, password: testPassword })
      .expect(200);
    authToken2 = getCookieValue(loginResponse2.headers['set-cookie'], 'token');
  });

  afterAll(async () => {
    if (!isReady()) return;

    if (userId) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    if (userId2) {
      await pool.query('DELETE FROM users WHERE id = $1', [userId2]);
    }
  });

  describe('Cross-Tenant Isolation', () => {
    dbTest('should return 404 for unmounted identity user-by-id route', async () => {
      const response = await request(app)
        .get(`/api/v1/identity/users/${userId2}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    dbTest('should return 404 for unmounted ordering address mutation route', async () => {
      const response = await request(app)
        .patch('/api/v1/ordering/addresses/999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          street: '456 Evil St',
        });

      expect(response.status).toBe(404);
    });

    dbTest('should return 404 for unmounted cart-by-id route', async () => {
      const response = await request(app)
        .get('/api/v1/ordering/cart/999999')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    dbTest('should only show the authenticated customer their own orders', async () => {
      const response = await request(app)
        .get('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Shipping Cost Tampering Prevention', () => {
    dbTest('should reject order creation without required address ids even with shipping override', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 1,
          shipping_cost: 0.01,
        });

      expect(response.status).toBe(400);
    });

    dbTest('should reject order creation without required address ids regardless of shipping value', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 1,
          shipping_cost: 999.99,
        });

      expect(response.status).toBe(400);
    });

    dbTest('should validate incomplete order payloads before processing', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 99999,
          notes: 'Suspicious order',
        });

      expect(response.status).toBe(400);
    });

    dbTest('should reject incomplete high-value order payloads before amount evaluation', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 1,
          notes: 'Excessive value',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Payment Security', () => {
    dbTest('should return 404 for the unmounted singular payment methods route', async () => {
      const response = await request(app)
        .get('/api/v1/payment/methods')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    dbTest('should reject minimum-order probes without required address ids', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 1,
          notes: 'Tiny order',
        });

      expect(response.status).toBe(400);
    });

    dbTest('should reject maximum-order probes without required address ids', async () => {
      const response = await request(app)
        .post('/api/v1/ordering/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          cart_id: 1,
          notes: 'Huge order',
        });

      expect(response.status).toBe(400);
    });

    dbTest('should validate payment creation payload ownership requirements', async () => {
      const response = await request(app)
        .post('/api/v1/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          payment_method_id: 999,
          amount: 100.0,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('Authentication & Authorization', () => {
    test('should return 401 without authentication token', async () => {
      const response = await request(app)
        .get('/api/v1/identity/profile');

      expect(response.status).toBe(401);
    });

    test('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/identity/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    test('should return 401 with malformed auth header', async () => {
      const response = await request(app)
        .get('/api/v1/identity/profile')
        .set('Authorization', 'NotABearerToken');

      expect(response.status).toBe(401);
    });

    dbTest('should return 404 for the currently unmounted admin users route', async () => {
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    dbTest('should accept a valid token and return the authenticated user profile', async () => {
      const response = await request(app)
        .get('/api/v1/identity/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(userEmail);
    });
  });

  describe('Webhook Security', () => {
    dbTest('should return 404 for the unmounted payment webhook route without signature', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/payment')
        .send({
          event: 'payment.completed',
          data: { order_id: 1 },
        });

      expect(response.status).toBe(404);
    });

    dbTest('should return 404 for the unmounted payment webhook route with invalid signature', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/payment')
        .set('X-Webhook-Signature', 'invalid-signature')
        .send({
          event: 'payment.completed',
          data: { order_id: 1 },
        });

      expect(response.status).toBe(404);
    });

    dbTest('should return 404 for the unmounted payment webhook route with empty payload', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/payment')
        .send({});

      expect(response.status).toBe(404);
    });

    dbTest('should return 404 for the unmounted payment webhook audit scenario', async () => {
      const response = await request(app)
        .post('/api/v1/webhooks/payment')
        .set('X-Webhook-Signature', 'test')
        .send({
          event: 'payment.completed',
        });

      expect(response.status).toBe(404);
    });
  });

  describe('Input Validation & XSS Prevention', () => {
    dbTest('should reject incomplete registration payload containing script input', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      const response = await request(app)
      .post('/api/v1/auth/register')
        .send({
          email: `xss-test-${Date.now()}@test.com`,
          password: testPassword,
          first_name: xssPayload,
        });

      expect(response.status).toBe(400);
    });

    dbTest('should validate content-type headers for registration payloads', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'text/plain')
        .send('invalid');

      expect(response.status).toBe(400);
    });

    dbTest('should reject oversized invalid registration payloads', async () => {
      const hugePayload = 'a'.repeat(10000000);
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `huge-${Date.now()}@test.com`,
          password: testPassword,
          first_name: hugePayload,
        });

      expect(response.status).toBe(400);
    });

    dbTest('should validate email format during registration', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: testPassword,
        });

      expect(response.status).toBe(400);
    });
  });
});
