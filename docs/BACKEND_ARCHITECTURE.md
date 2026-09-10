# Backend Architecture

This document describes the current runtime structure of the backend and its adjacent services.

## Runtime topology

- [server/src/index.js](/home/wilson/Desktop/fullstack/server/src/index.js) starts the API server.
- [server/src/setup.js](/home/wilson/Desktop/fullstack/server/src/setup.js) bootstraps Redis, Bull queues, RabbitMQ fallback transport, and WebSocket.
- [server/src/app.js](/home/wilson/Desktop/fullstack/server/src/app.js) creates the main Express app.
- [server/src/admin-app.js](/home/wilson/Desktop/fullstack/server/src/admin-app.js) creates the admin SSR app.
- [server/src/worker.js](/home/wilson/Desktop/fullstack/server/src/worker.js) processes background jobs.
- [nginx/proxy.conf](/home/wilson/Desktop/fullstack/nginx/proxy.conf) routes HTTP and websocket traffic.

## Request flow

1. Nginx forwards browser and API traffic to the correct upstream.
2. Express applies security, session, CORS, metrics, and request-context middleware.
3. Routes dispatch to domain controllers and services.
4. Domain services use repositories and the shared event bus.
5. Background work is handled by Bull queues or the worker process.

## Realtime flow

1. Socket.IO is attached to the HTTP server during bootstrap.
2. Authenticated clients connect using cookies or guest ids.
3. Sockets join user and order rooms.
4. Order domain events are emitted to the relevant websocket rooms.
5. The React client listens for updates through the global websocket provider.

## Data and infra

- PostgreSQL stores orders, users, events, sessions, and reporting data.
- Redis stores sessions, CSRF tokens, cache entries, token blacklists, and websocket adapter state.
- Bull handles retryable background jobs.
- RabbitMQ is used when configured; otherwise the in-memory event bus is used.

## Key backend domains

- Identity: authentication, sessions, authorization
- Catalog: products, categories, inventory
- Ordering: carts, checkout, order lifecycle
- Payment: payment initiation, callbacks, webhooks
- Shipping: shipment updates and tracking
- Vendor: onboarding, payouts, commissions
- Shared: common events, errors, and utilities

## Auth and security

- Browser auth uses httpOnly cookies.
- CSRF protects state-changing API requests.
- Role and permission checks are enforced in middleware and service layers.
- WebSocket auth reuses the existing authenticated cookie flow.

## Documentation map

- [IMPLEMENTATION_SUMMARY.md](/home/wilson/Desktop/fullstack/docs/IMPLEMENTATION_SUMMARY.md)
- [FEATURE_INTEGRATION_GUIDE.md](/home/wilson/Desktop/fullstack/docs/FEATURE_INTEGRATION_GUIDE.md)
- [WEBSOCKET_ARCHITECTURE.md](/home/wilson/Desktop/fullstack/docs/WEBSOCKET_ARCHITECTURE.md)
- [SCHEMA.md](/home/wilson/Desktop/fullstack/docs/SCHEMA.md)
- [endpoints.md](/home/wilson/Desktop/fullstack/docs/endpoints.md)
