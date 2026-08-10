# Web App - Full Visual Control Flow (Mermaid)

This document provides an end-to-end control-flow view of the web application across user journeys, admin surface, API execution, payment/webhook handling, background jobs, and operational controls.

## 1) End-to-End Runtime Topology

```mermaid
flowchart LR
  B[Browser / Client App] --> N[nginx reverse proxy]
  N --> E[Express app server/src/app.js]

  E --> CM[Core middleware security cors request-context metrics logging]
  E --> SS[Session middleware express-session + Redis store]
  E --> VH[vhost routing admin.localhost and admin.*]

  VH --> AAPP[adminApp SSR routes]
  E --> API[api v1 router]

  API --> AUTH[auth + identity]
  API --> CAT[catalog]
  API --> ORD[ordering]
  API --> PAY[payments]
  API --> GST[guest cart + guest checkout]
  API --> ADM[admin APIs]
  API --> VND[vendor + wishlist + platform]

  AUTH --> DB[(PostgreSQL)]
  CAT --> DB
  ORD --> DB
  PAY --> DB
  GST --> DB
  ADM --> DB
  VND --> DB

  SS --> R[(Redis)]
  E --> OBS[health endpoints + metrics endpoint]
```

## 2) HTTP Request Control Pipeline

```mermaid
flowchart TD
  RQ[Incoming HTTP request] --> SEC[helmet security middleware]
  SEC --> CORS[cors origin policy]
  CORS --> CTX[correlationId + timing middleware]
  CTX --> MET[metrics middleware counters + histograms]
  MET --> LOG[morgan request logging]
  LOG --> PARSE[json urlencoded cookie parsers]

  PARSE --> RT{route type}
  RT -->|Admin host| VHOST[vhost to adminApp]
  RT -->|API path| APIR[path-based /api/v1 routes]

  APIR --> AUTHN{requires auth}
  AUTHN -->|No| CTRL1[controller action]
  AUTHN -->|Yes| A1[authenticate requireAuth decorators]

  A1 --> AUTHZ{requires permission/role}
  AUTHZ -->|No| CTRL2[controller action]
  AUTHZ -->|Yes| A2[permission and role checks]

  CTRL1 --> SRV[domain service]
  CTRL2 --> SRV
  A2 --> SRV
  VHOST --> SSR[SSR controller + EJS render]

  SRV --> REPO[repository/sql queries]
  REPO --> DB[(PostgreSQL)]
  DB --> RESP[HTTP response]
  SSR --> RESP
  RESP --> END[finish event updates metrics]
```

## 3) Customer Journey: Browse -> Cart -> Checkout -> Payment

```mermaid
sequenceDiagram
  participant U as User
  participant FE as Frontend
  participant API as API /api/v1
  participant ORD as Ordering Service
  participant PAY as Payment Service
  participant DB as PostgreSQL

  U->>FE: Browse products
  FE->>API: GET /catalog and /products
  API->>DB: Read products/categories
  DB-->>API: Product data
  API-->>FE: Product list/detail

  U->>FE: Add item to cart
  FE->>API: POST /ordering/cart
  API->>ORD: validate stock + pricing
  ORD->>DB: upsert cart/cart_items
  DB-->>ORD: cart state
  ORD-->>API: cart updated
  API-->>FE: cart response

  U->>FE: Submit checkout
  FE->>API: POST /ordering/checkout
  API->>ORD: create order + totals + shipping
  ORD->>DB: persist order + order_items
  DB-->>ORD: order id

  ORD->>PAY: initialize payment intent/transaction
  PAY->>DB: persist payment record
  PAY-->>API: payment authorization payload
  API-->>FE: redirect url / client secret
```

## 4) Guest Checkout Control Flow

```mermaid
flowchart TD
  G1[Guest starts checkout] --> G2[POST /api/v1/checkout/guest/init]
  G2 --> G3[Guest token issued]

  G3 --> G4[POST /api/v1/guest/cart/add]
  G4 --> G5[guestOnly decorator validates token]
  G5 --> G6[Guest cart controller writes cart state]

  G6 --> G7[POST /api/v1/checkout/guest/session]
  G7 --> G8[Save contact + shipping data]

  G8 --> G9[POST /api/v1/checkout/guest/finalize]
  G9 --> G10[Create order + process payment]
  G10 --> G11[(Order persisted)]

  G11 --> G12{Convert to account?}
  G12 -->|Yes| G13[POST /api/v1/checkout/guest/convert]
  G12 -->|No| G14[Guest order complete]
  G13 --> G15[Create user + link guest order]
```

## 5) Payment and Webhook Control Flow

```mermaid
sequenceDiagram
  participant FE as Frontend
  participant PAYC as Payments Controller
  participant PS as PaymentService
  participant PSP as Stripe/Paystack
  participant DB as PostgreSQL

  FE->>PAYC: POST create payment
  PAYC->>PS: createPayment
  PS->>DB: insert pending payment
  DB-->>PS: payment reference
  PS-->>PAYC: processor payload
  PAYC-->>FE: payment initialization response

  FE->>PSP: Complete payment offsite/on SDK
  PSP-->>PAYC: callback or webhook event

  alt Callback path
    PAYC->>PS: handlePaymentCallback
  else Webhook path
    PAYC->>PAYC: validate signature
    PAYC->>PS: handleWebhook(event)
  end

  PS->>DB: update payment + order status
  DB-->>PS: committed
  PS-->>PAYC: success
```

## 6) Admin Portal Flow (Subdomain + SSR + Admin APIs)

```mermaid
flowchart TD
  AD1[Admin user opens admin.localhost] --> AD2[vhost routes to adminApp]
  AD2 --> AD3[admin auth login route]
  AD3 --> AD4{Credentials + allowed role}
  AD4 -->|Yes| AD5[session/cookie established]
  AD4 -->|No| ADX1[deny login]

  AD5 --> AD6[GET /dashboard SSR route]
  AD6 --> AD7[protect + permission decorators]
  AD7 --> AD8{Authorized}
  AD8 -->|Yes| AD9[Render EJS admin view]
  AD8 -->|No| ADX2[401/403 response]

  AD9 --> AD10[Client calls admin SSR API routes]
  AD10 --> AD11[validate-resource + ui-config + hydration]
  AD11 --> AD12[Admin APIs employees roles permissions rates translations audit jobs]
  AD12 --> AD13[(PostgreSQL)]
```

## 7) Startup, Background Jobs, and Shutdown Controls

```mermaid
flowchart LR
  S1[Process start] --> S2[testConnection PostgreSQL]
  S2 --> S3[connectRedis]
  S3 --> S4[initializeJobs]
  S4 --> S5[register exchange-rate-refresh hourly runImmediately]
  S5 --> S6[HTTP server listen]

  S6 --> J1[Scheduled job refreshExchangeRates]
  J1 --> J2[fetch provider rates]
  J2 --> J3[upsert exchange_rates per pair]
  J3 --> J4[log sync result]

  S6 --> X1[SIGINT or SIGTERM]
  X1 --> X2[stopJobs]
  X2 --> X3[close HTTP server]
  X3 --> X4[close DB pool]
  X4 --> X5[quit Redis]
  X5 --> X6[process exit]
```

## 8) Observability and Failure Paths

```mermaid
flowchart TD
  O1[Request enters app] --> O2[metrics increment + active connections]
  O2 --> O3[controller/service execution]
  O3 --> O4{Error occurred}
  O4 -->|No| O5[normal response]
  O4 -->|Yes| O6[error middleware formats error response]
  O6 --> O7[logger error with context]

  O5 --> O8[metrics duration observed]
  O7 --> O8
  O8 --> O9[metrics scrape]
  O9 --> O10[monitoring dashboard/alerts]
```

---

## Source Anchors

- server/src/app.js
- server/src/setup.js
- nginx/proxy.conf
- server/api/routes/v1/admin/index.js
- server/api/routes/admin/index.js
- server/api/routes/v1/checkout/guest.js
- server/api/routes/v1/guest/cart.js
- server/api/controllers/v1/payments/payment.js
- server/infrastructure/jobs/initializeJobs.js
