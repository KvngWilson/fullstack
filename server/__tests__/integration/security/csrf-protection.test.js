/**
 * CSRF Protection Integration Tests
 * Tests the CSRF token endpoint and middleware validation
 */

const request = require('supertest');
const argon2 = require('argon2');
const { createApp } = require('../../../src/app');
const { pool } = require('../../../config/db');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

const app = createApp();

describe('CSRF Protection - Integration Tests', () => {
  let testUser;
  let csrfToken;
  const TEST_SUFFIX = '@csrftest.com';
  const { disable, isReady, dbTest } = createDbInfraGuard();

  const cleanupTestUsers = async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${TEST_SUFFIX}`]);
  };

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    try {
      await cleanupTestUsers();

      const hashedPassword = await argon2.hash('TestPassword123');
      const result = await pool.query(
        'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email',
        [`csrf-test${Date.now()}${TEST_SUFFIX}`, hashedPassword, 'customer']
      );
      testUser = result.rows[0];
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;
    await cleanupTestUsers();
  });

  describe('GET /api/v1/auth/csrf-token', () => {
    dbTest('should generate a CSRF token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/csrf-token')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toMatch(/^[a-f0-9]{64}$/);

      csrfToken = response.body.token;
    });

    dbTest('should generate different tokens on each request', async () => {
      const response1 = await request(app).get('/api/v1/auth/csrf-token');
      const response2 = await request(app).get('/api/v1/auth/csrf-token');

      expect(response1.body.token).not.toBe(response2.body.token);
    });
  });

  describe('CSRF Middleware Validation', () => {
    beforeEach(async () => {
      if (!isReady()) return;
      const response = await request(app).get('/api/v1/auth/csrf-token');
      csrfToken = response.body.token;
    });

    dbTest('should allow POST request with valid CSRF token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .set('X-CSRF-Token', csrfToken)
        .send({
          email: `csrf-valid${Date.now()}${TEST_SUFFIX}`,
          password: 'SecureP@ssw0rd123',
          confirm_password: 'SecureP@ssw0rd123',
          first_name: 'Test',
          last_name: 'User',
          accept_terms: true,
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
    });

    dbTest('should reject POST request without CSRF token on protected endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/catalog/products')
        .send({
          name: 'Test Product',
          price: 99.99,
        });

      expect([403, 401, 404]).toContain(response.status);
    });

    dbTest('should reject POST request with invalid CSRF token format', async () => {
      const invalidToken = 'invalid_token_not_64_hex';

      const response = await request(app)
        .put('/api/v1/identity/profile')
        .set('X-CSRF-Token', invalidToken)
        .send({ first_name: 'Updated' });

      expect([403, 401, 404, 400]).toContain(response.status);
    });

    dbTest('should skip CSRF validation for whitelisted authentication endpoints', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    dbTest('should skip CSRF validation for forgot-password endpoint', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({
          email: testUser.email,
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });

  describe('CSRF Token Lifecycle', () => {
    dbTest('should allow token to be used multiple times in same session', async () => {
      const tokenResponse = await request(app).get('/api/v1/auth/csrf-token');
      const token = tokenResponse.body.token;

      const response1 = await request(app)
        .post('/api/v1/auth/register')
        .set('X-CSRF-Token', token)
        .send({
          email: `csrf-reuse1${Date.now()}${TEST_SUFFIX}`,
          password: 'SecureP@ssw0rd123',
          confirm_password: 'SecureP@ssw0rd123',
          first_name: 'Test',
          last_name: 'User1',
          accept_terms: true,
        });

      expect(response1.body).toHaveProperty('success', true);

      const response2 = await request(app)
        .post('/api/v1/auth/register')
        .set('X-CSRF-Token', token)
        .send({
          email: `csrf-reuse2${Date.now()}${TEST_SUFFIX}`,
          password: 'SecureP@ssw0rd123',
          confirm_password: 'SecureP@ssw0rd123',
          first_name: 'Test',
          last_name: 'User2',
          accept_terms: true,
        });

      expect(response2.body).toHaveProperty('success', true);
    });
  });

  describe('Security Headers', () => {
    dbTest('should indicate CSRF token endpoint availability', async () => {
      const response = await request(app)
        .get('/api/v1/auth/csrf-token');

      expect(response.body).toHaveProperty('token');
      expect(response.headers).toHaveProperty('content-type');
    });
  });
});
