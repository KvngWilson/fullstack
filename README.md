# E-Commerce Full-Stack Application

Enterprise e-commerce platform with a React frontend, Node/Express backend, PostgreSQL, Redis, Bull queues, RabbitMQ event transport, Swagger docs, and Socket.IO realtime updates.

## What it does

- Product catalog, cart, checkout, orders, payments, wishlist
- Guest checkout and account conversion
- Vendor applications, onboarding, and vendor self-service
- Admin SSR + API surface
- WebSocket realtime order updates
- Redis-backed sessions, CSRF tokens, cache, and token blacklisting

## Stack

- **Frontend:** React 19, React Router, Redux Toolkit, Vite
- **Backend:** Node.js, Express 5, Passport, Joi, Swagger
- **Data:** PostgreSQL 16, Redis 7
- **Async:** Bull queues, RabbitMQ event bus
- **Realtime:** Socket.IO with Redis adapter
- **Styling:** Tailwind CSS

## Runtime services

- `client`
- `server`
- `server-replica`
- `worker`
- `postgres`
- `rabbitmq`
- `redis`
- `mailhog`
- `gateway`

## Local development

```bash
docker compose up -d postgres redis rabbitmq mailhog

cd server
npm install
npm run migrate
npm run personas:seed
npm run dev
```

In a second terminal:

```bash
cd client
npm install
npm run dev
```

Optional full stack:

```bash
docker compose up --build
```

The backend expects PostgreSQL, Redis, RabbitMQ, and MailHog for a representative local environment.

To prepare deterministic browser/demo accounts after the database is ready:

```bash
cd server
npm run personas:seed

# optional: with the API running, capture authenticated cookie/session files
npm run personas:login:all
```

Persona manifests and authenticated session artifacts are written to `server/.persona-sessions/` for local use only.

## Key URLs

- Frontend: `http://localhost:5173`
- API: `http://localhost:5000/api/v1`
- Swagger: `http://localhost:5000/api-docs`
- Health: `http://localhost:5000/health`
- Admin SSR: `http://admin.localhost:5000`
- RabbitMQ UI: `http://localhost:15672`
- MailHog UI: `http://localhost:8025`
- WebSocket path: `/socket.io/`

## Docs

- [Backend Architecture](/home/wilson/Desktop/fullstack/docs/BACKEND_ARCHITECTURE.md)
- [Feature Integration Guide](/home/wilson/Desktop/fullstack/docs/FEATURE_INTEGRATION_GUIDE.md)
- [Implementation Summary](/home/wilson/Desktop/fullstack/docs/IMPLEMENTATION_SUMMARY.md)
- [WebSocket Architecture](/home/wilson/Desktop/fullstack/docs/WEBSOCKET_ARCHITECTURE.md)
- [Schema](/home/wilson/Desktop/fullstack/docs/SCHEMA.md)
- [API Endpoints](/home/wilson/Desktop/fullstack/docs/endpoints.md)

## Notes

- Browser auth uses httpOnly cookies; tokens are not stored in localStorage.
- Canonical auth endpoints live under `/api/v1/auth`; `/api/v1/identity` is now profile, employees, and onboarding.
- WebSocket is for live UI delivery, not background work.
- Bull handles jobs; RabbitMQ handles backend event transport when enabled.
