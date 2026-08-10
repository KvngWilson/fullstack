const request = require('supertest');
const { pool } = require('../../../config/db');
const argon2 = require('argon2');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

// Use main app instance
const { createApp } = require('../../../src/app');
const app = createApp();

const AUTH_TEST_EMAIL_SUFFIX = '@auth-test.com';

const cleanupAuthTestUsers = async () => {
  await pool.query(
    `DELETE FROM order_items
     WHERE order_id IN (
       SELECT o.id
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE u.email LIKE $1
     )`,
    [`%${AUTH_TEST_EMAIL_SUFFIX}`]
  );

  await pool.query(
    `DELETE FROM payments
     WHERE order_id IN (
       SELECT o.id
       FROM orders o
       JOIN users u ON o.user_id = u.id
       WHERE u.email LIKE $1
     )`,
    [`%${AUTH_TEST_EMAIL_SUFFIX}`]
  );

  await pool.query(
    `DELETE FROM orders
     WHERE user_id IN (
       SELECT id FROM users WHERE email LIKE $1
     )`,
    [`%${AUTH_TEST_EMAIL_SUFFIX}`]
  );

  await pool.query(
    `DELETE FROM cart_items
     WHERE cart_id IN (
       SELECT c.id
       FROM carts c
       JOIN users u ON c.user_id = u.id
       WHERE u.email LIKE $1
     )`,
    [`%${AUTH_TEST_EMAIL_SUFFIX}`]
  );

  await pool.query(
    `DELETE FROM carts
     WHERE user_id IN (
       SELECT id FROM users WHERE email LIKE $1
     )`,
    [`%${AUTH_TEST_EMAIL_SUFFIX}`]
  );

  await pool.query(
    'DELETE FROM addresses WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)',
    [`%${AUTH_TEST_EMAIL_SUFFIX}`]
  );

  await pool.query(
    'DELETE FROM saved_cards WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)',
    [`%${AUTH_TEST_EMAIL_SUFFIX}`]
  );

  await pool.query('DELETE FROM users WHERE email LIKE $1', [`%${AUTH_TEST_EMAIL_SUFFIX}`]);
};

describe('User Authentication API - Integration Tests', () => {
  let testUserId;
  const { disable, isReady, dbTest } = createDbInfraGuard();

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    try {
      await cleanupAuthTestUsers();
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;
    await cleanupAuthTestUsers();
  });

  describe('POST /api/v1/auth/register', () => {
    dbTest('should register a new user successfully', async () => {
      const userData = {
        email: `user${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`,
        password: 'SecurePassword123!',
        confirm_password: 'SecurePassword123!',
        first_name: 'Test',
        last_name: 'User',
        accept_terms: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('check your inbox');

      const inserted = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [userData.email]);
      expect(inserted.rowCount).toBe(1);
      testUserId = inserted.rows[0].id;
    });

    dbTest('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'SecurePassword123!',
        confirm_password: 'SecurePassword123!',
        first_name: 'Test',
        last_name: 'User',
        accept_terms: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    dbTest('should reject registration with short password', async () => {
      const userData = {
        email: `shortpass${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`,
        password: '12345',
        confirm_password: '12345',
        first_name: 'Test',
        last_name: 'User',
        accept_terms: true,
      };

      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    dbTest('should reject registration with duplicate email', async () => {
      const userData = {
        email: `duplicate${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`,
        password: 'SecurePassword123!',
        confirm_password: 'SecurePassword123!',
        first_name: 'Test',
        last_name: 'User',
        accept_terms: true,
      };

      // First registration
      await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(200);

      // Attempt duplicate registration
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(userData)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('check your inbox');
    });

    dbTest('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: `missing${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`,
          confirm_password: 'SecurePassword123!',
          first_name: 'Test',
          last_name: 'User',
          accept_terms: true,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    let testUser;

    beforeAll(async () => {
      if (!isReady()) return;

      // Create a test user for login
      try {
        const hashedPassword = await argon2.hash('testPassword123');
        const result = await pool.query(
          'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
          [`login${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`, hashedPassword]
        );
        testUser = result.rows[0];
      } catch (_error) {
        disable();
      }
    });

    dbTest('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'testPassword123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.email).toBe(testUser.email);
    });

    dbTest('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongPassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    dbTest('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: `nonexistent${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`,
          password: 'anyPassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    dbTest('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: `nocreds${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}` })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
