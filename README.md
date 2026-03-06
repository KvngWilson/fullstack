# Fullstack E-Commerce Platform

Production-oriented e-commerce monorepo with:

- `client/`: React + Vite storefront/admin UI surfaces
- `server/`: Node.js + Express API (DDD-inspired structure)
- PostgreSQL + Redis + Docker Compose runtime

The stack supports authenticated and guest shopping flows, checkout/order/payment pipelines, RBAC-admin APIs, and migration tooling for database hygiene.

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
- Vitest unit tests + Playwright e2e suite

### Backend (`server/`)

- Express 5, Node 20 runtime
- PostgreSQL (primary data), Redis (sessions/cache/guest sessions)
- JWT auth + refresh token flows
- Joi-based request validation
- Domain modules under `server/domain/*`
- API surface under `server/api/*`

### Container Runtime

Main compose file (`docker-compose.yml`) runs:

- `postgres` (5432)
- `redis` (6379)
- `server` + `server-replica`
- `gateway` (NGINX reverse proxy, exposed at 5000)
- `client` (exposed at 5173 by default)

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
docker compose up -d
```

### 2) Access services

- Frontend: `http://localhost:5173`
- API gateway: `http://localhost:5000`
- Health: `http://localhost:5000/health/live`
- Swagger: `http://localhost:5000/api-docs`

### 3) Stop stack

```bash
docker compose down
```

### 4) Logs

```bash
docker compose logs -f
```

For a richer local stack (for example, MailHog and expanded env defaults), use:

```bash
docker compose -f docker-compose.dev.yml up -d
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

Create env files as needed for your environment (server/client). If you use Docker Compose, many defaults are already provided through compose env values.

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

### Test DB warnings in unit/integration runs

Some suites may emit local DB availability warnings (for example, `ECONNREFUSED 127.0.0.1:5445`) depending on test harness mode. If a suite still passes, that warning is non-fatal for the run.

### Guest flow not persisting

- Ensure cookies are enabled in browser/client
- Confirm `guestToken` cookie or `x-guest-token` header is sent
- Verify Redis is healthy and reachable

---

For deeper backend internals, inspect `server/api`, `server/domain`, and migration docs under `server/infrastructure/database/migrations`.
