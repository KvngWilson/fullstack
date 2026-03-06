# Tracing Infrastructure (Scaffold Only)

This folder contains tracing primitives prepared for future rollout.

## Current status

- `TracingContext.js` exists as a lightweight tracing context primitive.
- `tracingMiddleware.js` provides optional request middleware.
- Nothing in this folder is wired into application bootstrap/routes yet.

## Why not wired now?

This is intentionally kept as **non-active scaffolding** to avoid runtime behavior changes before full tracing adoption.

## Future integration points

When enabling tracing, typical first steps are:

1. Mount `createTracingMiddleware()` near the top of Express middleware stack.
2. Include correlation ID in logs/response headers.
3. Add spans around external calls (DB, Redis, payment/shipping APIs).
4. Export traces to your chosen backend (e.g., OpenTelemetry collector).

## Example (not active)

```js
const { createTracingMiddleware } = require('../infrastructure/tracing/tracingMiddleware');
app.use(createTracingMiddleware());
```

Do not enable this until tracing rollout is explicitly approved.
