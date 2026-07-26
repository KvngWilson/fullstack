# System Control Visual Flow

This document maps runtime control flow for the current codebase from ingress to domain execution, including admin subdomain SSR, auth gates, and operational controls.

## 1) System Control Topology

```mermaid
flowchart LR
  C[Client Browser / API Consumer] --> N[nginx reverse proxy nginx/proxy.conf]
  N --> A[Express App server/src/app.js]

  A --> M[Core Middleware Chain helmet • cors • request context • metrics • morgan]
  A --> S[Session Layer express-session + RedisStore]
  A --> VH[vhost Router admin.localhost / admin.*]

  VH --> AD[Admin Sub-App SSR routes + EJS views]
  A --> API[Main API Router /api/v1/*]

  API --> D1[Identity]
  API --> D2[Catalog]
  API --> D3[Ordering/Payments]
  API --> D4[Vendor]
  API --> D5[Wishlist/Platform]
  API --> D6[Admin API /api/v1/admin/*]

  D1 --> DB[(PostgreSQL)]
  D2 --> DB
  D3 --> DB
  D4 --> DB
  D5 --> DB
  D6 --> DB

  S --> R[(Redis)]
  A --> O[Observability /health* + /metrics]
```

## 2) Request Control Path (API)

```mermaid
flowchart TD
  RQ[Incoming HTTP Request] --> SEC[Security Middleware helmet policies]
  SEC --> CORS[CORS evaluation allowed origin/credentials]
  CORS --> CTX[Correlation + timing context]
  CTX --> MET[Metrics middleware request counters & latency]
  MET --> BODY[Body parsing / cookies]

  BODY --> AUTHN{Auth present? JWT or session}
  AUTHN -->|No| ROUTE[Route handler (public path)]
  AUTHN -->|Yes| USER[req.user attached]

  USER --> AUTHZ{Route requires auth/role/permission?}
  AUTHZ -->|No| ROUTE
  AUTHZ -->|Yes| ENFORCE[requireAuth / domain permission checks]

  ENFORCE --> CTRL[Controller]
  ROUTE --> CTRL
  CTRL --> SRV[Service / Domain policy]
  SRV --> REPO[Repository / SQL]
  REPO --> DB[(PostgreSQL)]
  DB --> RESP[HTTP Response]

  RESP --> OBS[Finish hook error count + duration histogram]
```

## 3) Admin Portal Control Flow (Subdomain + SSR)

```mermaid
sequenceDiagram
  participant U as Admin User
  participant N as nginx
  participant APP as Express app
  participant V as vhost(admin.localhost)
  participant ADM as adminApp routes
  participant SSR as /api/v1/admin/ssr/*
  participant AUTH as AdminAuthService
  participant DB as PostgreSQL

  U->>N: GET https://admin.<host>/dashboard
  N->>APP: Forward request with Host header
  APP->>V: Host match (admin.localhost/admin.*)
  V->>ADM: Route to admin sub-app
  ADM->>AUTH: validate auth + permission
  AUTH->>DB: role/permission lookup
  DB-->>AUTH: access result

  alt Authorized
    ADM-->>U: SSR HTML (EJS admin view)
    U->>SSR: GET /api/v1/admin/ssr/ui-config
    SSR->>AUTH: employee permission resolution
    AUTH->>DB: fetch permission graph
    DB-->>SSR: permission set
    SSR-->>U: hydration/config JSON
  else Unauthorized
    ADM-->>U: 401/403 (deny)
  end
```

## 4) Operational Control Loop (Jobs, Health, Metrics)

```mermaid
flowchart LR
  OP[Operator / SRE] --> J[/api/v1/admin/jobs/*]
  J --> RA[requireAuth + role gate\nroot/super_admin]
  RA --> JS[JobScheduler / Job Controllers]
  JS --> EXT[External providers\n(e.g., exchange rates)]
  JS --> DB[(PostgreSQL)]

  APP[Express runtime] --> H[/health /health/ready /health/live]
  APP --> MX[/metrics]
  MX --> MON[Prometheus/Grafana or monitor]

  DB --> HEALTH[Health checks & readiness signals]
  RED[(Redis)] --> HEALTH
```

## Source Anchors

- Entry and middleware orchestration: `server/src/app.js`
- Server bootstrap: `server/src/index.js`
- Admin vhost SSR router: `server/api/routes/admin/index.js`
- Admin SSR API routes: `server/api/routes/v1/admin/ssr.js`
- Admin SSR control logic: `server/api/controllers/v1/admin/ssr.js`
- Session control: `server/config/session.js`
- Security + CORS policy: `server/config/security.js`
- Auth middleware behavior: `server/api/middleware/auth.js`
- Metrics middleware and endpoint: `server/api/middleware/metrics.js`
- Reverse proxy ingress: `nginx/proxy.conf`
