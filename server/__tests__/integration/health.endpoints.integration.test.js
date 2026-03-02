const request = require('supertest');
const { createApp } = require('../../src/app');

describe('Health Endpoints (Integration)', () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  test('GET /health returns 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
  });

  test('GET /health/live returns 200', async () => {
    const response = await request(app).get('/health/live');
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
