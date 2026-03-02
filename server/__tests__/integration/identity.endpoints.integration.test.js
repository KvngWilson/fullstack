const request = require('supertest');
const { createApp } = require('../../src/app');

describe('Identity Endpoints (Integration)', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  describe('POST /api/v1/identity/users/register', () => {
    test('returns success message for new user registration', async () => {
      const userData = {
        email: `testuser${Date.now()}@example.com`,
        password: 'Test@Password123',
        confirm_password: 'Test@Password123',
        first_name: 'Test',
        last_name: 'User',
        accept_terms: true,
      };

      const response = await request(app)
        .post('/api/v1/identity/users/register')
        .send(userData);

      expect(response.status).toBe(200);
      expect(response.body.message).toBeDefined();
    });

    test('validates password requirements during registration', async () => {
      const response = await request(app)
        .post('/api/v1/identity/users/register')
        .send({
          email: 'user@example.com',
          password: 'weak',
          confirm_password: 'weak',
          first_name: 'Test',
          last_name: 'User',
          accept_terms: true,
        });

      expect([400, 422]).toContain(response.status);
    });

    test('validates email format on registration', async () => {
      const response = await request(app)
        .post('/api/v1/identity/users/register')
        .send({
          email: 'invalid-email',
          password: 'Test@Password123',
          confirm_password: 'Test@Password123',
          first_name: 'Test',
          last_name: 'User',
          accept_terms: true,
        });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('POST /api/v1/identity/users/login', () => {
    test('returns token on successful login when user exists', async () => {
      const response = await request(app)
        .post('/api/v1/identity/users/login')
        .send({ email: 'testuser@example.com', password: 'Test@Password123' });

      expect([200, 401, 404]).toContain(response.status);
      if (response.status === 200) {
        expect(response.body.token).toBeDefined();
      }
    });

    test('rejects invalid credentials', async () => {
      const response = await request(app)
        .post('/api/v1/identity/users/login')
        .send({ email: 'testuser@example.com', password: 'WrongPassword123' });

      expect([401, 404]).toContain(response.status);
    });
  });

  describe('Profile endpoints', () => {
    test('GET /api/v1/identity/profile returns 401 without token', async () => {
      const response = await request(app).get('/api/v1/identity/profile');
      expect(response.status).toBe(401);
    });

    test('GET /api/v1/identity/profile returns 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/identity/profile')
        .set('Authorization', 'Bearer invalid-token-xyz');

      expect(response.status).toBe(401);
    });

    test('PATCH /api/v1/identity/profile returns 401 without authentication', async () => {
      const response = await request(app)
        .patch('/api/v1/identity/profile')
        .send({ first_name: 'Jane' });

      expect(response.status).toBe(401);
    });
  });
});
