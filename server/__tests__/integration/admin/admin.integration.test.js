const request = require('supertest');
const { createApp } = require('../../../src/app');

describe('Admin Endpoints (Integration)', () => {
  const app = createApp();

  test('admin routes reject anonymous requests', async () => {
    const routes = [
      '/api/v1/admin/users',
      '/api/v1/admin/orders',
      '/api/v1/admin/dashboard',
      '/api/v1/admin/dashboard/profile',
    ];

    for (const route of routes) {
      const response = await request(app).get(route);
      expect(response.status).toBe(401);
    }
  });

  test('admin routes reject invalid bearer token', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });
});
