const request = require('supertest');
const { createApp } = require('../../../src/app');

describe('Admin Endpoints (Integration)', () => {
  const app = createApp();

  test('admin routes are protected or unavailable for anonymous requests', async () => {
    const routes = [
      '/api/v1/admin/users',
      '/api/v1/admin/orders',
      '/api/v1/admin/products',
      '/api/v1/admin/dashboard/stats',
    ];

    for (const route of routes) {
      const response = await request(app).get(route);
      expect([401, 403, 404, 500]).toContain(response.status);
    }
  });

  test('admin routes reject invalid bearer token', async () => {
    const response = await request(app)
      .get('/api/v1/admin/users')
      .set('Authorization', 'Bearer invalid-token');

    expect([401, 403, 404, 500]).toContain(response.status);
  });
});
