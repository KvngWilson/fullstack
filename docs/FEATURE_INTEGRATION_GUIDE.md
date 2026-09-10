# Feature Integration Guide

This guide covers the current integration points that exist in the codebase.

## Prerequisites

- Run database migrations.
- Configure `FRONTEND_URL`, `REDIS_*`, `JWT_SECRET`, `SESSION_SECRET`, and email settings.
- Install dependencies in both server and client workspaces.

## Runtime startup

1. Start the server from [server/src/index.js](/home/wilson/Desktop/fullstack/server/src/index.js).
2. Server bootstrap in [server/src/setup.js](/home/wilson/Desktop/fullstack/server/src/setup.js) initializes:
   - Redis
   - Bull queues
   - RabbitMQ fallback transport
   - Socket.IO via [WebSocketManager.js](/home/wilson/Desktop/fullstack/server/infrastructure/websocket/WebSocketManager.js)
3. Start the client from [client/src/main.jsx](/home/wilson/Desktop/fullstack/client/src/main.jsx).

## WebSocket integration

- WebSocket auth comes from cookies (`token` / `access_token`) or `guestId`.
- Authenticated users join `user:{id}`.
- Orders can subscribe to `order:{id}`.
- Admin users can join `admin:dashboard`.
- Live updates are emitted from order status domain events.

Relevant files:

- [WebSocket architecture](/home/wilson/Desktop/fullstack/docs/WEBSOCKET_ARCHITECTURE.md)
- [WebSocketProvider.jsx](/home/wilson/Desktop/fullstack/client/src/app/providers/WebSocketProvider.jsx)
- [useOrderRealtime.js](/home/wilson/Desktop/fullstack/client/src/features/orders/hooks/useOrderRealtime.js)

## Feature entry points

### Orders

- Create/update flow: [OrderService.js](/home/wilson/Desktop/fullstack/server/domain/ordering/services/OrderService.js)
- Domain event: [OrderStatusChanged.js](/home/wilson/Desktop/fullstack/server/domain/ordering/events/OrderStatusChanged.js)
- Subscriber: [OrderStatusChangedSubscriber.js](/home/wilson/Desktop/fullstack/server/domain/subscribers/OrderStatusChangedSubscriber.js)

### Reviews

- Review APIs and moderation live in the server domain/controllers.

### Analytics

- Analytics endpoints use cached SQL queries and snapshot tables.

### Vendor management

- Vendor onboarding, payout, and commission flows are server-side and exposed through API routes.

## Client integration

- [AppProviders.jsx](/home/wilson/Desktop/fullstack/client/src/app/providers/AppProviders.jsx) mounts global providers.
- Account order pages subscribe to live updates and refresh order data.
- Admin pages can listen for admin dashboard events.

## Troubleshooting

- If sockets do not connect, check Nginx upgrade headers in [nginx/proxy.conf](/home/wilson/Desktop/fullstack/nginx/proxy.conf).
- If authenticated sockets fail, confirm the cookie is present and JWT validation succeeds.
- If live updates do not appear, confirm the order event is being published and the subscriber is registered.
