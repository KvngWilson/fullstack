# Client Application

React 19 + Vite frontend for the ecommerce platform.

## What it covers

- customer storefront and account pages
- admin and vendor dashboards
- checkout, orders, wishlist, auth, and onboarding flows
- Socket.IO realtime updates for order status and admin activity

## Runtime

The client talks to the backend through:

- `VITE_API_URL` (defaults to `http://localhost:5000`)
- `VITE_API_VERSION` (defaults to `v1`)
- `VITE_WS_URL` (optional, falls back to `VITE_API_URL`)

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run test
npm run e2e:critical
```

## Notes

- Auth uses httpOnly cookies; tokens are not stored in localStorage.
- WebSocket connections use credentials and `/socket.io/`.
- The root [README](/home/wilson/Desktop/fullstack/README.md) has the full project overview and docs map.
