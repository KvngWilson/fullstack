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
    expect(response.headers['x-correlation-id']).toBeTruthy();
    expect(response.headers['x-response-time']).toMatch(/ms$/);
  });

  test('GET /health/live returns 200', async () => {
    const response = await request(app).get('/health/live');
    expect(response.status).toBe(200);
  });

  test('GET /health/live returns 200 on the admin app', async () => {
    const response = await request(adminApp).get('/health/live');
    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toBeTruthy();
    expect(response.headers['x-response-time']).toMatch(/ms$/);
  });

  test('GET /health preserves incoming correlation id', async () => {
    const response = await request(app)
      .get('/health')
      .set('X-Correlation-ID', 'test-correlation-id');

    expect(response.status).toBe(200);
    expect(response.headers['x-correlation-id']).toBe('test-correlation-id');
  });

  test('GET /health/ready returns readiness status', async () => {
    const response = await request(app).get('/health/ready');
    if (global.__TEST_DB_AVAILABLE === false) {
      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: 'not_ready',
        reason: 'database_unavailable',
      });
      return;
    }

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
  });

  test('GET /health/detailed returns detailed status', async () => {
    const response = await request(app).get('/health/detailed');
    expect(['healthy', 'degraded']).toContain(response.body.status);
    expect(response.body).toHaveProperty('timestamp');
    expect(response.body).toHaveProperty('system');
    expect(response.body).toHaveProperty('dependencies.database');
    expect(response.body).toHaveProperty('dependencies.redis');
    const allHealthy =
      response.body.dependencies.database.status === 'healthy' &&
      ['healthy', 'not_configured'].includes(response.body.dependencies.redis.status);

    if (allHealthy) {
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.dependencies.database.status).toBe('healthy');
    } else {
      expect(response.status).toBe(503);
      expect(response.body.status).toBe('degraded');
    }
  });
});
