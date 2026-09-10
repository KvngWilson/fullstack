# Tracing Infrastructure

This folder contains the active request-tracing primitives used by the platform.

## How this fits the layout

- [server/infrastructure/observability/](/home/wilson/Desktop/fullstack/server/infrastructure/observability) is the runtime observability root.
- This [tracing/](/home/wilson/Desktop/fullstack/server/infrastructure/observability/tracing) folder is specifically for trace context and middleware.
- Prometheus/Grafana assets live separately under [telemetry/](/home/wilson/Desktop/fullstack/telemetry).

## Current status

- `TracingContext.js` provides the active per-request trace context primitive.
- `tracingMiddleware.js` is mounted through the request-context middleware in app bootstrap.
- Every request now receives a correlation ID and request span.
- `X-Correlation-ID`, `X-Trace-ID`, `traceparent`, and `X-Response-Time` are exposed in responses.
- Incoming `traceparent` headers are parsed to continue upstream traces.
- Trace export is configurable with:
  - `TRACING_EXPORTER=none|logger|http`
  - `TRACING_EXPORT_URL=https://collector.example/v1/traces` (required when exporter is `http`)

## Current rollout scope

The current rollout is intentionally lightweight:

1. Request correlation IDs are active.
2. HTTP request spans are created for inbound requests.
3. Child spans are automatically created for DB queries, Redis commands, and instrumented outbound service calls.
4. Request timing remains active for response headers and operational debugging.

## Next integration points

To deepen tracing coverage, the next steps are:

1. Expand outbound child-span coverage to additional gateways/services.
2. Standardize the HTTP exporter payload to your collector ingestion contract.
3. Correlate logs and metrics with trace IDs in dashboards.

## Bootstrap wiring

```js
const { createTracingMiddleware } = require("../infrastructure/observability/tracing/tracingMiddleware");
app.use(createTracingMiddleware());
```
