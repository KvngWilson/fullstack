const express = require('express');
const request = require('supertest');

describe('tracing middleware', () => {
  beforeEach(() => {
    process.env.TRACING_EXPORTER = 'none';
    jest.resetModules();
  });

  test('continues incoming traceparent and sets tracing headers', async () => {
    const {
      createTracingMiddleware,
    } = require('../../../infrastructure/observability/tracing/tracingMiddleware');

    const app = express();
    app.use(createTracingMiddleware());
    app.get('/ping', (req, res) => {
      res.status(200).json({
        traceId: req.traceId,
        correlationId: req.correlationId,
      });
    });

    const incomingTraceparent =
      '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
    const response = await request(app)
      .get('/ping')
      .set('x-correlation-id', 'corr-123')
      .set('traceparent', incomingTraceparent);

    expect(response.status).toBe(200);
    expect(response.body.correlationId).toBe('corr-123');
    expect(response.body.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(response.headers['x-correlation-id']).toBe('corr-123');
    expect(response.headers['x-trace-id']).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(response.headers.traceparent).toMatch(
      /^00-4bf92f3577b34da6a3ce929d0e0e4736-[a-f0-9]{16}-01$/,
    );
  });
});
