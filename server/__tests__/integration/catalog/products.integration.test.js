const request = require('supertest');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

// Use main app instance
const { createApp } = require('../../../src/app');

describe('Product API - Integration Tests', () => {
  let app;
  const { disable, dbTest } = createDbInfraGuard();
  const test = dbTest;

  beforeAll(() => {
    app = createApp();
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
    }
  });

  test('GET /api/v1/catalog/products returns list payload', async () => {
    const response = await request(app).get('/api/v1/catalog/products');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  test('GET /api/v1/catalog/products supports pagination params', async () => {
    const response = await request(app).get('/api/v1/catalog/products?page=1&pageSize=5');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('pagination');
  });

  test('GET /api/v1/catalog/products/:id handles missing product', async () => {
    const response = await request(app).get('/api/v1/catalog/products/99999');
    expect(response.status).toBe(404);
  });

  test('POST /api/v1/catalog/products validates payload', async () => {
    const response = await request(app)
      .post('/api/v1/catalog/products')
      .send({ name: 'Incomplete Product' });

    expect(response.status).toBe(401);
  });
});
