const request = require('supertest');
const { createApp } = require('../../../src/app');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

describe('Catalog Endpoints (Integration)', () => {
  let app;
  const { disable, dbTest } = createDbInfraGuard();
  const it = dbTest;

  beforeAll(() => {
    app = createApp();
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
    }
  });

  test('GET /api/v1/catalog/products supports listing', async () => {
    const response = await request(app).get('/api/v1/catalog/products');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('GET /api/v1/catalog/products supports pagination', async () => {
    const response = await request(app).get('/api/v1/catalog/products?page=1&limit=10');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('GET /api/v1/catalog/products supports category filtering', async () => {
    const response = await request(app).get('/api/v1/catalog/products?category=1');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('GET /api/v1/catalog/products/:id handles missing product', async () => {
    const response = await request(app).get('/api/v1/catalog/products/99999');
    expect(response.status).toBe(404);
  });
});
