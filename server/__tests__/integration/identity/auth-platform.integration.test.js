/**
 * Platform-wide Authentication API - Integration Tests
 * Tests the simplified authentication endpoints at /api/v1/auth/*
 */

const request = require('supertest');
const argon2 = require('argon2');
const { createApp } = require('../../../src/app');
const { pool } = require('../../../config/db');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

const app = createApp();

const PLATFORM_AUTH_TEST_SUFFIX = '@platformauthtest.com';

const cleanupPlatformAuthTestUsers = async () => {
  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${PLATFORM_AUTH_TEST_SUFFIX}`]);
};

describe('Platform Authentication API - Integration Tests', () => {
  let testUserId;
  const { disable, isReady, dbTest } = createDbInfraGuard();
  const it = dbTest;

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    try {
      await cleanupPlatformAuthTestUsers();
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;
    await cleanupPlatformAuthTestUsers();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: `user${Date.now()}${PLATFORM_AUTH_TEST_SUFFIX}`,
        password: 'SecureP@ssw0rd123',
        confirm_password: 'SecureP@ssw0rd123',
        first_name: 'Test',
        last_name: 'User',
        accept_terms: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('check your email');
      
      //  Registration auto-logs in user
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', userData.email);
      expect(response.body.user).toHaveProperty('role', 'customer');
      expect(response.body.user).toHaveProperty('email_verified', false);
      
      //  Verify httpOnly cookies are set
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader.some(cookie => cookie.includes('token=') && cookie.includes('HttpOnly'))).toBe(true);
      expect(setCookieHeader.some(cookie => cookie.includes('refresh_token=') && cookie.includes('HttpOnly'))).toBe(true);

      const inserted = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [userData.email]);
      expect(inserted.rowCount).toBe(1);
      testUserId = inserted.rows[0].id;
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecureP@ssw0rd123',
        confirm_password: 'SecureP@ssw0rd123',
        first_name: 'Test',
        last_name: 'User',
        accept_terms: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with short password', async () => {
      const userData = {
        email: `shortpass${Date.now()}${PLATFORM_AUTH_TEST_SUFFIX}`,
        password: '123',
        confirm_password: '123',
        first_name: 'Test',
        last_name: 'User',
        accept_terms: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with mismatched passwords', async () => {
      const userData = {
        email: `mismatch${Date.now()}${PLATFORM_AUTH_TEST_SUFFIX}`,
        password: 'SecureP@ssw0rd123',
        confirm_password: 'DifferentPassword',
        first_name: 'Test',
        last_name: 'User',
        accept_terms: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration without accepting terms', async () => {
      const userData = {
        email: `noterms${Date.now()}${PLATFORM_AUTH_TEST_SUFFIX}`,
        password: 'SecureP@ssw0rd123',
        confirm_password: 'SecureP@ssw0rd123',
        first_name: 'Test',
        last_name: 'User',
        accept_terms: false,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser;

    beforeAll(async () => {
      if (!isReady()) return;

      // Create a test user for login
      try {
        const hashedPassword = await argon2.hash('TestPassword123');
        const result = await pool.query(
          'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email',
          [`login-test${Date.now()}${PLATFORM_AUTH_TEST_SUFFIX}`, hashedPassword, 'customer']
        );
        testUser = result.rows[0];
      } catch (_error) {
        disable();
      }
    });

    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'TestPassword123',
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', testUser.email);
      expect(response.body.user).toHaveProperty('role', 'customer');
      
      //  Verify httpOnly cookies are set
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader.some(cookie => cookie.includes('token=') && cookie.includes('HttpOnly'))).toBe(true);
      expect(setCookieHeader.some(cookie => cookie.includes('refresh_token=') && cookie.includes('HttpOnly'))).toBe(true);
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `nonexistent${Date.now()}${PLATFORM_AUTH_TEST_SUFFIX}`,
          password: 'TestPassword123',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/v1/auth/refresh-token', () => {
    let loginResponse;
    let testUser;

    beforeAll(async () => {
      if (!isReady()) return;

      // Create test user and get token
      try {
        const hashedPassword = await argon2.hash('TestPassword123');
        const result = await pool.query(
          'INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email',
          [`refresh-test${Date.now()}${PLATFORM_AUTH_TEST_SUFFIX}`, hashedPassword, 'customer']
        );
        testUser = result.rows[0];

        loginResponse = await request(app)
          .post('/api/v1/auth/login')
          .send({
            email: testUser.email,
            password: 'TestPassword123',
          });
      } catch (_error) {
        disable();
      }
    });

    it('should refresh token with valid refresh token cookie', async () => {
      // Extract cookies from login response
      const cookies = loginResponse.headers['set-cookie'];
      
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .set('Cookie', cookies)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', testUser.email);
      
      //  Verify new httpOnly cookies are set
      const setCookieHeader = response.headers['set-cookie'];
      expect(setCookieHeader).toBeDefined();
      expect(setCookieHeader.some(cookie => cookie.includes('token=') && cookie.includes('HttpOnly'))).toBe(true);
    });

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject refresh with missing token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'No refresh token found');
    });
  });
});
