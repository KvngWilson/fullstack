const request = require('supertest');
const express = require('express');
const userRoutes = require('../../routes/user');
const { pool } = require('../../config/db');
const argon2 = require('argon2');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/users', userRoutes);

const AUTH_TEST_EMAIL_SUFFIX = '@auth-test.local';

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

  beforeAll(async () => {
    await cleanupAuthTestUsers();
  });

  afterAll(async () => {
    await cleanupAuthTestUsers();
  });

  describe('POST /api/v1/users/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: `user${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`,
        password: 'securePassword123',
      };

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(userData.email);
      
      testUserId = response.body.id;
    });

    it('should reject registration with invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: 'securePassword123',
      };

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with short password', async () => {
      const userData = {
        email: `shortpass${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`,
        password: '12345',
      };

      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject registration with duplicate email', async () => {
      const userData = {
        email: `duplicate${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`,
        password: 'securePassword123',
      };

      // First registration
      await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(201);

      // Attempt duplicate registration
      const response = await request(app)
        .post('/api/v1/users/register')
        .send(userData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('already exists');
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/v1/users/register')
        .send({ email: `missing${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}` })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/v1/users/login', () => {
    let testUser;

    beforeAll(async () => {
      // Create a test user for login
      const hashedPassword = await argon2.hash('testPassword123');
      const result = await pool.query(
        'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id, email',
        [`login${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`, hashedPassword]
      );
      testUser = result.rows[0];
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({
          email: testUser.email,
          password: 'testPassword123',
        })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.email).toBe(testUser.email);
    });

    it('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({
          email: testUser.email,
          password: 'wrongPassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({
          email: `nonexistent${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}`,
          password: 'anyPassword',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/users/login')
        .send({ email: `nocreds${Date.now()}${AUTH_TEST_EMAIL_SUFFIX}` })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
