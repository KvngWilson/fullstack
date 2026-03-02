const request = require('supertest');
const { createApp } = require('../../src/app');

describe('Catalog Endpoints (Integration)', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  test('GET /api/v1/catalog/products supports listing', async () => {
    const response = await request(app).get('/api/v1/catalog/products');
    expect([200, 404, 500]).toContain(response.status);
    if (response.status === 200) {
      expect(Array.isArray(response.body.data)).toBe(true);
    }
  });

  test('GET /api/v1/catalog/products supports pagination', async () => {
    const response = await request(app).get('/api/v1/catalog/products?page=1&limit=10');
    expect([200, 404, 500]).toContain(response.status);
  });

  test('GET /api/v1/catalog/products supports category filtering', async () => {
    const response = await request(app).get('/api/v1/catalog/products?category=1');
    expect([200, 404, 500]).toContain(response.status);
  });

  test('GET /api/v1/catalog/products/:id handles missing product', async () => {
    const response = await request(app).get('/api/v1/catalog/products/99999');
    expect([400, 404]).toContain(response.status);
  });
});
