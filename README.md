# Fullstack E-Commerce Platform

Production-oriented e-commerce monorepo with:

- `client/`: React + Vite storefront/admin UI surfaces
- `server/`: Node.js + Express API (DDD-inspired structure)
- PostgreSQL + Redis + Docker Compose runtime

The stack supports authenticated and guest shopping flows, checkout/order/payment pipelines, RBAC-admin APIs, dual admin surfaces (CSR + SSR), and migration tooling for database hygiene.

## Contents

- [Architecture](#architecture)
- [Core Features](#core-features)
- [Quick Start (Docker)](#quick-start-docker)
- [Local Development](#local-development)
- [Guest/Auth Entry Flow](#guestauth-entry-flow)
- [Migrations](#migrations)
- [Testing](#testing)
- [Useful Commands](#useful-commands)
- [Troubleshooting](#troubleshooting)

## Architecture

### Frontend (`client/`)

- React 19 + React Router + Redux Toolkit
- Tailwind CSS + component primitives
- Vite build pipeline
- Jest unit/integration tests + Cypress e2e suite

### Backend (`server/`)

- Express 5, Node 20 runtime
- PostgreSQL (primary data), Redis (sessions/cache/guest sessions)
- Cookie-first auth (`token`, `refresh_token`) with JWT support for API clients
- Joi-based request validation
- Domain modules under `server/domain/*`
- API surface under `server/api/*`

### Container Runtime

Main compose file (`docker-compose.yml`) runs:

- `postgres` (5432)
- `redis` (6379)
- `server` + `server-replica`
- `worker` (background job processor)
- `gateway` (NGINX reverse proxy, exposed at 5000)
- `client` (direct frontend container, exposed at 5173 by default)

Gateway host routing:
- `localhost:5000` serves the client app (CSR)
- `admin.localhost:5000` serves the admin SSR app
- `localhost:5000/api/v1/*` (plus `/health`, `/metrics`, `/api-docs`, `/uploads`) routes to backend

## Core Features

- Product catalog, variants, wishlist, cart, ordering, payments
- Guest checkout support with Redis-backed guest sessions
- Admin API surface with policy-based permission checks
- Exchange-rate and translation subsystems
- RBAC-sensitive operations with audit logging patterns
- Migration audit/strict tooling to detect duplicate numeric prefixes

## Quick Start (Docker)

### 1) Start stack

```bash
cp .env.example .env
docker compose up -d
```

### 2) Access services

- Frontend (via gateway): `http://localhost:5000`
- Frontend (direct client container): `http://localhost:5173`
- Admin CSR routes (v1): `http://localhost:5000/admin`
- Admin SSR subdomain: `http://admin.localhost:5000`
- API gateway (same host): `http://localhost:5000/api/v1`
- Health: `http://localhost:5000/health/live`
- Swagger: `http://localhost:5000/api-docs`
- MailHog (dev email inbox): `http://localhost:8025`

### 3) Stop stack

```bash
docker compose down
```

### 4) Logs

```bash
docker compose logs -f
```

## Local Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### Install

```bash
cd server && npm install
cd ../client && npm install
cd ..
```

### Configure env

Copy `.env.example` to `.env` in the repository root and adjust values for your machine.  
If you use Docker Compose, most local defaults are already wired through compose env values.

If you run services directly on your host while using Docker-managed Postgres/Redis, use:

- `DB_HOST=localhost`
- `DB_PORT=54322`
- `REDIS_HOST=localhost`
- `REDIS_PORT=63799`

### Run backend

```bash
cd server
npm run dev
```

### Run optional admin runtime

```bash
cd server
npm run dev:admin
```

If testing subdomain SSR locally, ensure your hosts file maps `admin.localhost` to `127.0.0.1`.

### Run frontend

```bash
cd client
npm run dev
```

## Guest/Auth Entry Flow

The API now exposes a first-visit session resolver:

### `GET /api/v1/checkout/guest/session`

Behavior:

1. **Authenticated user with valid token**
   - Returns `authenticated: true`, `guest: false`
   - Does not mint a guest token
2. **Unauthenticated user with valid guest token**
   - Reuses existing guest session
   - Returns `guest: true`, `existing: true`
3. **First-time or expired guest session**
   - Creates guest token/cart
   - Returns `201` with `guest: true`, `existing: false`, `token`, `cartId`

Recommended frontend bootstrap sequence:

1. Call `GET /api/v1/checkout/guest/session` on app start
2. Branch to authenticated or guest cart/checkout state from response
3. Use guest token (cookie or `x-guest-token`) for guest endpoints

Related guest endpoints:

- `GET /api/v1/checkout/guest/session` (first-visit/auth-or-guest resolver)
- `POST /api/v1/checkout/guest/session` (persist guest contact/session details)
- `POST /api/v1/checkout/guest/init` (manual guest init)
- `GET /api/v1/guest/cart`
- `POST /api/v1/guest/cart/add`
- `POST /api/v1/guest/cart/validate`
- `POST /api/v1/checkout/guest/finalize`

## Migrations

Migration scripts live in `server/infrastructure/database/migrations`.

### Run pending migrations

```bash
cd server
npm run migrate
```

### Rollback

```bash
npm run migrate:rollback
```

### Audit migration prefix hygiene

```bash
npm run migrate:audit
```

### Enforce strict prefix uniqueness

```bash
MIGRATIONS_STRICT_PREFIX_ORDER=true npm run migrate:audit
MIGRATIONS_STRICT_PREFIX_ORDER=true npm run migrate
```

Notes:

- Migration identity is filename-based (`schema_migrations.version`).
- Duplicate numeric prefixes are deterministic but operationally ambiguous; use audit mode to detect and track.

## Testing

### Backend

```bash
cd server
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:security
```

### Frontend

```bash
cd client
npm test
npm run test:coverage
npm run e2e
```

### Focused guest/session tests (backend)

```bash
cd server
npm test -- __tests__/unit/guestEntrySession.test.js --runInBand
npm test -- __tests__/integration/ordering/guest-session.integration.test.js --runInBand
```

## Useful Commands

### Backend runtime

```bash
cd server
npm run dev
npm run dev:admin
npm run start
npm run start:admin
npm run migrate
npm run migrate:audit
```

### Frontend runtime

```bash
cd client
npm run dev
npm run build
npm run lint
npm run e2e
```

### Docker operations

```bash
docker compose up -d
docker compose ps
docker compose logs -f gateway
docker compose down
```

## Troubleshooting

### API unavailable on `:5000`

- Check gateway and server containers:

```bash
docker compose ps
docker compose logs -f gateway server
```

### Admin SSR subdomain not loading

- Verify the full stack is up: `docker compose ps`
- Open `http://admin.localhost:5000` (include `:5000`)
- If your machine does not resolve `admin.localhost`, add `127.0.0.1 admin.localhost` to your hosts file

### UI changes not appearing

- Prefer the gateway URL: `http://localhost:5000` (it reflects the current composed routing model).
- Rebuild and recreate frontend/gateway after UI edits:

```bash
docker compose up -d --build client gateway
```

- If stale assets persist, force recreation:

```bash
docker compose up -d --build --force-recreate client gateway
```

### `Unknown command: "dev:admin"`

- Run admin runtime scripts from [server/](/home/wilson/Desktop/fullstack/server), not repository root:

```bash
cd server
npm run dev:admin
```

### Test DB warnings in unit/integration runs

Some suites may emit local DB availability warnings (for example, `ECONNREFUSED 127.0.0.1:5445`) depending on test harness mode. If a suite still passes, that warning is non-fatal for the run.

### Guest flow not persisting

- Ensure cookies are enabled in browser/client
- Confirm `guestToken` cookie or `x-guest-token` header is sent
- Verify Redis is healthy and reachable

---

For deeper backend internals, inspect `server/api`, `server/domain`, and migration docs under `server/infrastructure/database/migrations`.
For end-to-end infrastructure and runtime topology, see [BACKEND_ARCHITECTURE.md](/home/wilson/Desktop/fullstack/docs/BACKEND_ARCHITECTURE.md).
