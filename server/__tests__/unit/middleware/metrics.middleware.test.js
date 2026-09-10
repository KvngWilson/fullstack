const express = require('express');
const request = require('supertest');

describe('metrics middleware', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('exposes Prometheus metrics with route labels and histogram buckets', async () => {
    const { metricsMiddleware, metricsEndpoint } = require('../../../api/middleware/metrics');
    const app = express();

    app.use(metricsMiddleware);
    app.get('/orders/:orderId', (_req, res) => {
      res.status(201).json({ ok: true });
    });
    app.get('/metrics', metricsEndpoint);

    await request(app).get('/orders/123');
    const metricsResponse = await request(app).get('/metrics');

    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.headers['content-type']).toContain('text/plain');
    expect(metricsResponse.text).toContain('# TYPE http_requests_total counter');
    expect(metricsResponse.text).toContain('# TYPE http_request_duration_ms histogram');
    expect(metricsResponse.text).toContain(
      'http_requests_by_route_total{method="GET",route="/orders/:orderId",status_code="201"} 1',
    );
    expect(metricsResponse.text).toContain(
      'http_request_duration_ms_bucket{method="GET",route="/orders/:orderId",status_code="201",le="10"}',
    );
  });
});
