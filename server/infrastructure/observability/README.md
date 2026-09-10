## Observability Infrastructure

This folder is the canonical home for runtime observability primitives used by the platform.

### Terminology

- **Observability** = the umbrella for traces, metrics, logs, and monitoring.
- **Tracing** = request/operation correlation and span lifecycle.
- **Metrics** = counters, gauges, and histograms exposed by the application.
- **Telemetry** = environment-facing operational assets and deployment helpers kept outside the runtime code.

### Layout

- `metrics/`
  - in-process metrics registry and helpers
- `tracing/`
  - request trace context and tracing middleware

### Current active surfaces

- request correlation IDs
- request timing headers
- inbound HTTP request spans
- child spans for DB queries, Redis commands, and outbound service calls
- W3C `traceparent` propagation (`traceId` + parent span continuation)
- optional trace exporters (`TRACING_EXPORTER=logger|http`, `TRACING_EXPORT_URL`)
- Prometheus metrics collection exposed at `/metrics` with route/method/status labels
- process runtime gauges (RSS, heap, uptime)

### Related project areas

- [telemetry/](/home/wilson/Desktop/fullstack/telemetry) holds environment-level telemetry assets such as Prometheus, Grafana, alert rules, and compose/deployment helpers.
- [server/api/middleware/requestContext.js](/home/wilson/Desktop/fullstack/server/api/middleware/requestContext.js) activates request tracing.
- [server/api/middleware/metrics.js](/home/wilson/Desktop/fullstack/server/api/middleware/metrics.js) activates metrics collection.
