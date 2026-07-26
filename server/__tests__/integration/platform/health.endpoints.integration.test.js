const request = require('supertest');
const { createApp } = require('../../../src/app');
const { createAdminApp } = require('../../../src/admin-app');

describe('Health Endpoints (Integration)', () => {
  let app;
  let adminApp;

  beforeAll(() => {
    app = createApp();
    adminApp = createAdminApp();
  });

  test('GET /health returns 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  test('GET /health/live returns 200', async () => {
    const response = await request(app).get('/health/live');
    expect(response.status).toBe(200);
  });

  test('GET /health/live returns 200 on the admin app', async () => {
    const response = await request(adminApp).get('/health/live');
    expect(response.status).toBe(200);
  });

  test('GET /health/ready returns readiness status', async () => {
    const response = await request(app).get('/health/ready');
    expect([200, 503]).toContain(response.status);
  });

  test('GET /health/detailed returns detailed status', async () => {
    const response = await request(app).get('/health/detailed');
    expect([200, 503]).toContain(response.status);
  });
});
