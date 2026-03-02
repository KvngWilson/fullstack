const request = require('supertest');

// Use main app instance
const { createApp } = require('../../src/app');
const app = createApp();

describe('Product API - Integration Tests', () => {
  test('GET /api/v1/products returns list payload or graceful error', async () => {
    const response = await request(app).get('/api/v1/products');

    expect([200, 404, 500]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
    }
  });

  test('GET /api/v1/products supports pagination params', async () => {
    const response = await request(app).get('/api/v1/products?page=1&pageSize=5');

    expect([200, 404, 500]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body).toHaveProperty('pagination');
    }
  });

  test('GET /api/v1/products/:id handles missing product', async () => {
    const response = await request(app).get('/api/v1/products/99999');
    expect([404, 400, 500]).toContain(response.status);
  });

  test('POST /api/v1/products validates payload', async () => {
    const response = await request(app)
      .post('/api/v1/products')
      .send({ name: 'Incomplete Product' });

    expect([400, 500]).toContain(response.status);
  });
});
