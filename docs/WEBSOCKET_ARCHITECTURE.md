# WebSocket Architecture

## Purpose

The websocket layer provides browser-facing, low-latency push updates for:

- order status changes
- admin dashboard alerts
- other live UI events as they are added

## Core components

- [server/infrastructure/websocket/WebSocketManager.js](/home/wilson/Desktop/fullstack/server/infrastructure/websocket/WebSocketManager.js)
- [server/src/setup.js](/home/wilson/Desktop/fullstack/server/src/setup.js)
- [server/domain/ordering/services/OrderService.js](/home/wilson/Desktop/fullstack/server/domain/ordering/services/OrderService.js)
- [server/domain/ordering/events/OrderStatusChanged.js](/home/wilson/Desktop/fullstack/server/domain/ordering/events/OrderStatusChanged.js)
- [server/domain/subscribers/OrderStatusChangedSubscriber.js](/home/wilson/Desktop/fullstack/server/domain/subscribers/OrderStatusChangedSubscriber.js)
- [nginx/proxy.conf](/home/wilson/Desktop/fullstack/nginx/proxy.conf)
- [client/src/app/providers/WebSocketProvider.jsx](/home/wilson/Desktop/fullstack/client/src/app/providers/WebSocketProvider.jsx)
- [client/src/features/orders/hooks/useOrderRealtime.js](/home/wilson/Desktop/fullstack/client/src/features/orders/hooks/useOrderRealtime.js)

## End-to-end flow

```text
Browser
  -> Socket.IO client
  -> Nginx /socket.io upgrade
  -> Express HTTP server
  -> WebSocketManager
  -> room join / auth / connection tracking
  -> event subscribers
  -> browser listeners
```

## Server boot flow

1. [src/index.js](/home/wilson/Desktop/fullstack/server/src/index.js) creates the app.
2. [src/setup.js](/home/wilson/Desktop/fullstack/server/src/setup.js) bootstraps Redis, queues, and the event bus.
3. The HTTP server is created and Socket.IO is attached.
4. `registerDomainSubscribers({ websocketManager })` wires the order event subscriber.
5. The server starts listening and exposes `/socket.io/`.

## Connection flow

1. The client connects with `withCredentials: true`.
2. The websocket middleware reads:
   - `token` / `access_token` cookie for authenticated users
   - `guestId` for anonymous users
3. Authenticated sockets join `user:{id}`.
4. Clients can subscribe to `order:{id}` and `admin:dashboard`.
5. Connections are written to `websocket_sessions` when a real user is present.

## Order update flow

1. [OrderService.js](/home/wilson/Desktop/fullstack/server/domain/ordering/services/OrderService.js) updates the order status.
2. It publishes `ordering.order.status.changed` through the domain event bus.
3. [OrderStatusChangedSubscriber.js](/home/wilson/Desktop/fullstack/server/domain/subscribers/OrderStatusChangedSubscriber.js) handles the event.
4. The subscriber:
   - emits `order:status-updated` to the order room
   - emits `order:status-updated` to the user room
   - queues customer email
   - broadcasts admin updates

## Room model

- `user:{id}`: private per-user updates
- `order:{id}`: order-specific tracking
- `admin:dashboard`: admin notifications

## Client wiring

- [AppProviders.jsx](/home/wilson/Desktop/fullstack/client/src/app/providers/AppProviders.jsx) mounts the websocket provider globally.
- [WebSocketProvider.jsx](/home/wilson/Desktop/fullstack/client/src/app/providers/WebSocketProvider.jsx) manages the socket lifecycle, admin notifications, and room subscriptions.
- [useOrderRealtime.js](/home/wilson/Desktop/fullstack/client/src/features/orders/hooks/useOrderRealtime.js) lets order pages subscribe to live updates and refresh data.

## Scaling and persistence

The websocket manager uses the Redis adapter so multiple API processes can share rooms and broadcasts.

Connection tracking is persisted in `websocket_sessions` so the app can inspect active websocket presence over time.

## Relationship to Bull and RabbitMQ

They are complementary, not interchangeable:

- **WebSocket**: immediate push to browsers
- **Bull**: background job execution and retries
- **RabbitMQ**: backend event transport / decoupling between services

Typical pattern:

```text
Domain event
  -> RabbitMQ / in-memory bus
  -> subscriber or worker
  -> websocket emit
  -> browser update
```

## Notes

- WebSocket should not be used for long-running jobs.
- Bull/RabbitMQ should not be used to stream live UI state directly.
- WebSocket is the last-mile delivery channel; queues/brokers are the backend coordination layer.
