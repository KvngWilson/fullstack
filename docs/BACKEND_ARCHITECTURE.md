# Complete Fullstack Architecture Guide

**Document Version:** 1.1  
**Last Updated:** 2026-07-21  
**Application:** E-Commerce Fullstack Platform (Client + Gateway + Backend + Worker)  
**Primary Runtime:** Docker Compose with host-based gateway routing and dual admin surfaces  
**Architecture Pattern:** Domain-Driven Design (DDD) with Clean Architecture principles

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Full Application Runtime Architecture](#full-application-runtime-architecture)
3. [Directory Structure & Layer Organization](#directory-structure--layer-organization)
4. [Entry Points & Server Setup](#entry-points--server-setup)
5. [Core Infrastructure Layer](#core-infrastructure-layer)
6. [Configuration Layer](#configuration-layer)
7. [Domain Layer (Business Logic)](#domain-layer-business-logic)
8. [API Layer (Controllers & Routes)](#api-layer-controllers--routes)
9. [Middleware Layer](#middleware-layer)
10. [Data Access Layer (Repositories)](#data-access-layer-repositories)
11. [Decorators & Cross-Cutting Concerns](#decorators--cross-cutting-concerns)
12. [Services Layer](#services-layer)
13. [Testing & Fixtures](#testing--fixtures)

---

## Architecture Overview

The application follows **Domain-Driven Design (DDD)** with **Clean Architecture** principles, organized into distinct layers:

```
┌─────────────────────────────────────────────────────┐
│  API LAYER (Express Routes & Controllers)           │
│  - Handle HTTP requests/responses                   │
│  - Route requests to appropriate domains            │
│  - Serialize/deserialize data                       │
└─────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│  MIDDLEWARE LAYER (Cross-Cutting Concerns)          │
│  - Authentication/Authorization (Auth, RBAC)        │
│  - Validation & Error Handling                      │
│  - Caching & Rate Limiting                          │
│  - Logging & Metrics                                │
│  - CSRF, Security Headers, Locale                   │
└─────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│  DOMAIN LAYER (Business Logic - DDD Pattern)        │
│  ┌─────────────────────────────────────────────┐   │
│  │ Identity Domain: User accounts, auth         │   │
│  │ Catalog Domain: Products, categories         │   │
│  │ Ordering Domain: Carts, orders               │   │
│  │ Payment Domain: Payment processing           │   │
│  │ Shipping Domain: Shipments, tracking         │   │
│  │ Vendor Domain: Seller management             │   │
│  │ Shared: Common entities, exceptions          │   │
│  └─────────────────────────────────────────────┘   │
│  Each domain contains:                             │
│  - Entities (Aggregates) & Value Objects           │
│  - Domain Services & Policies                      │
│  - Domain Events                                   │
│  - Repositories (interfaces)                       │
│  - Exceptions (domain-specific errors)             │
└─────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│  DATA ACCESS LAYER (Repositories & Services)        │
│  - BaseRepository: Common DB operations             │
│  - Domain-specific Repositories                     │
│  - Database connection pooling                      │
│  - Query building & optimization                   │
└─────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────┐
│  INFRASTRUCTURE LAYER (External Services)           │
│  - Database: PostgreSQL with RLS & multi-tenancy    │
│  - Redis: Caching, sessions, blacklists            │
│  - Payment Processors: Stripe, PayStack            │
│  - Shipping APIs: EasyShip, carriers               │
│  - Email: Transactional emails                     │
└─────────────────────────────────────────────────────┘
```

### **Key Architectural Principles**

1. **Domain-Driven Design (DDD):**
   - Business logic isolated in domain modules
   - Domain entities enforce business rules
   - Domain events represent significant occurrences

2. **Clean Architecture:**
   - Clear separation of concerns
   - Dependencies flow inward (Domain → Data Access → Infrastructure)
   - Entities are independent of frameworks

3. **Multi-Tenancy:**
   - Tenant context passed through request middleware
   - Database Row-Level Security (RLS) enforces isolation
   - Each operation scoped to current tenant

4. **Guest Checkout Support:**
   - Separate cart & checkout flows for unauthenticated users
   - Unique session tokens for guest tracking
   - Conversion to permanent accounts on purchase

5. **Scalability Patterns:**
   - JWT with cached claims (eliminates N+1 queries)
   - Redis-backed session management & token blacklisting
   - Configurable caching strategies
   - Circuit breaker for external service failures

---

## Full Application Runtime Architecture

This section documents the complete runtime topology of the entire app (not only backend internals), including frontend delivery, gateway behavior, dual admin surfaces, API routing, background processing, and data stores.

### 1) Runtime Services (Compose)

```
┌────────────────────────────────────────────────────────────────────┐
│ Host Machine                                                      │
│                                                                    │
│  :5000 → gateway (NGINX)                                           │
│  :5173 → client (direct, optional dev access)                      │
│  :55432 → postgres (host-mapped DB port)                           │
│  :63799 → redis (host-mapped cache/session port)                   │
└────────────────────────────────────────────────────────────────────┘
```

Compose services:
- `client` (React app served by NGINX in container)
- `gateway` (host/path-based reverse proxy)
- `server` + `server-replica` (Express API instances)
- `worker` (background job processor)
- `postgres` (primary relational datastore)
- `redis` (sessions, CSRF token store, token blacklist, caching, queues metadata)

### 2) Gateway Routing Contract

Current gateway behavior:
- `http://localhost:5000/*` → frontend client for non-API paths
- `http://localhost:5000/api/v1/*` → backend upstream (`server` + `server-replica`)
- `http://localhost:5000/health/*`, `/metrics`, `/api-docs`, `/uploads/*` → backend upstream
- `http://admin.localhost:5000/*` → backend upstream (admin SSR app selected via vhost in Express)

This enables both admin experiences simultaneously:
- **Route-based admin (CSR):** `http://localhost:5000/admin`
- **Subdomain admin (SSR):** `http://admin.localhost:5000`

### 3) End-to-End Request Paths

#### Storefront/API flow
1. Browser requests `localhost:5000/...`
2. Gateway serves client HTML/JS (non-API routes)
3. Client calls `/api/v1/...` on same gateway origin
4. Gateway load-balances to `server` or `server-replica`
5. Backend uses PostgreSQL + Redis and returns JSON

#### Admin subdomain SSR flow
1. Browser requests `admin.localhost:5000/...`
2. Gateway forwards to backend upstream
3. Express vhost (`admin.localhost`, `admin.*`) dispatches request to `adminApp`
4. Admin SSR routes render EJS + call admin APIs as needed

#### Background processing flow
1. API/domain emits async work (email/webhook/exchange refresh/etc.)
2. Job metadata/state is coordinated through Redis-backed queues
3. `worker` executes tasks and persists resulting state in PostgreSQL

### 4) Security & Session Model Across Surfaces

- Authentication is primarily cookie-based (`token`, `refresh_token`) for browser clients.
- Bearer JWT remains valid for API-style clients.
- CSRF middleware protects state-changing `/api/v1` routes, with auth bootstrap exclusions.
- CORS is controlled via `ALLOWED_ORIGINS` and must include active frontend/admin origins in production.
- Admin and storefront are distinct surfaces but share core identity/auth infrastructure.

---

## Directory Structure & Layer Organization

### **Root Level Structure**

```
server/
├── src/                              # Application entry points
│   ├── index.js                      # Main server startup
│   ├── app.js                        # Express app factory
│   ├── setup.js                      # Server initialization
│   ├── admin-index.js                # Admin panel entry
│   └── admin-app.js                  # Admin app setup
├── config/                           # Configuration files
│   ├── env.js                        # Environment validation
│   ├── db.js                         # Database connection
│   ├── redis.js                      # Redis setup
│   ├── auth.js                       # Authentication config
│   ├── passport.js                   # Passport.js strategies
│   ├── session.js                    # Session management
│   ├── cache.js                      # Caching strategies
│   ├── security.js                   # Security headers & CORS
│   └── swagger.js                    # OpenAPI/Swagger setup
├── core/                             # Core authentication
│   └── auth/
│       ├── verifyToken.js            # JWT verification
│       ├── authMiddleware.js         # Auth middleware chain
│       └── extractUser.js            # Token extraction from header/cookies
├── domain/                           # Business logic (DDD)
│   ├── identity/                     # User authentication & profiles
│   ├── catalog/                      # Products & categories
│   ├── ordering/                     # Shopping carts & orders
│   ├── payment/                      # Payment processing
│   ├── shipping/                     # Shipments & tracking
│   ├── vendor/                       # Vendor management
│   ├── shared/                       # Shared DDD primitives
│   └── index.js                      # Domain module exports
├── api/                              # HTTP API layer
│   ├── controllers/                  # Request handlers by domain
│   ├── routes/                       # Express routes by domain
│   ├── middleware/                   # HTTP middleware
│   ├── decorators/                   # Functional decorators
│   └── validators/                   # Request validation schemas
├── data/                             # Data access layer
│   ├── repositories/                 # Data access patterns
│   └── migrations/                   # Database migrations
├── services/                         # Cross-cutting services
│   ├── cache.js                      # Cache operations
│   ├── invitation.js                 # Invitation workflow
│   ├── admin.js                      # Admin operations
│   └── profiler.js                   # Performance profiling
├── utils/                            # Utility functions
│   └── money.js                      # Currency & money math
├── infrastructure/                   # External services
│   ├── database/                     # Database utilities
│   ├── security/                     # Security utilities
│   └── services/                     # 3rd-party integrations
├── __tests__/                        # Comprehensive test suite
│   ├── unit/                         # Unit tests
│   ├── integration/                  # Integration tests
│   ├── e2e/                          # End-to-end tests
│   ├── security/                     # Security tests
│   ├── factories/                    # Test data factories
│   └── fixtures/                     # Test fixtures
└── package.json                      # Dependencies & scripts
```

---

## Entry Points & Server Setup

### **1. `/src/index.js` — Server Startup**

**Purpose:** Application entry point  
**Responsibility:** Initialize environment and start server

```javascript
// Key responsibilities:
- Load environment variables (.env)
- Validate environment (fail fast)
- Create Express app instance
- Start HTTP server on PORT (default 5000)
```

**Import Path:** This is the file run by `npm start` or `node src/index.js`

---

### **2. `/src/app.js` — Express Application Factory**

**Purpose:** Configure and create the Express application  
**Responsibility:** Assemble middleware, routes, error handlers

**Key Functions:**

| Function | Purpose |
|----------|---------|
| `createApp()` | Creates and configures Express app instance |
| `registerCoreMiddleware(app)` | Security, logging, request parsing |
| `registerAppSettings(app)` | View engine, Swagger setup |
| `registerRoutes(app)` | Mount domain routes |
| `registerErrorHandlers(app)` | Terminal error handling |

**Middleware Chain Order:**
1. Trust proxy settings
2. Security middleware (helmet, CSP, etc.)
3. CORS headers
4. Request correlation ID
5. Request timing
6. Metrics collection
7. HTTP logging (Morgan)
8. Stripe webhook (raw body parsing)
9. JSON/form parsing
10. Cookie parsing
11. Domain routes
12. 404 & error handlers

**Special Routes:**
- `/health` - Basic health check
- `/health/detailed` - Detailed system status
- `/health/ready` - Readiness probe (K8s)
- `/health/live` - Liveness probe (K8s)
- `/metrics` - Prometheus metrics endpoint

**Virtual Hosts:**
- `admin.localhost` → Admin app
- `admin.*` → Admin app (wildcard)

---

### **3. `/src/setup.js` — Server Initialization**

**Purpose:** Handle server startup and graceful shutdown  
**Responsibility:** Listen on port, handle signals

**Key Functions:**
- `startServer()` - Bind to port, handle connections
- Graceful shutdown on SIGTERM/SIGINT
- Database connection on startup
- Cleanup on shutdown

---

### **4. `/src/admin-app.js` & `/src/admin-index.js` — Admin Panel**

**Purpose:** Separate Express app for admin dashboard  
**Responsibility:** Admin-specific routes and features

**Key Functions:**
- Admin SSR authentication (`/auth/login`, `/auth/logout`)
- Admin dashboard routes
- Admin-only middleware chain
- Static asset serving from `server/public`
- Dedicated admin session cookie (`admin_sid`)
- Admin CSRF configuration (`x-admin-csrf-token`, `/auth` excluded)
- Logout hardening: clear auth cookies, destroy admin session, revoke refresh token, blacklist current access token
- Job queue management
- System settings

---

## Core Infrastructure Layer

### **Authentication Core (`/core/auth/`)**

Centralized authentication logic used by middleware and decorators.

#### **verifyToken.js** — JWT Verification
```
Purpose: Verify JWT tokens and check blacklist
Functions:
  - verifyToken(token, options?) → decoded payload or null
  - Checks JWT signature
  - Checks token expiration
  - Checks Redis blacklist for logout
  - Async because blacklist state is stored in Redis
Returns: Decoded token payload with {id, email, role, permissions}
```

#### **authMiddleware.js** — Auth Chain
```
Purpose: Orchestrate authentication checks
Exports:
  - authMiddleware(req, res, next) - Require authentication

Behavior:
  - Extract token via Authorization header or cookie
  - Await verifyToken()
  - Return 401 for missing/invalid tokens
  - Attach req.user from JWT claims
```

#### **extractUser.js** — Token Extraction
```
Purpose: Extract bearer token from request
Sources:
  - Authorization: Bearer <token>
  - Cookie: token
  - Cookie: access_token
Returns: token string or null
```

---

## Configuration Layer

### **`/config/` — Environment & Service Configuration**

#### **env.js** — Environment Variable Validation
```
Purpose: Validate required environment variables
- Fail fast if config is incomplete
- Type checking (string, number, boolean)
- Dependency validation (if feature X, require Y)

Validates:
  - Node environment (production/test/development)
  - Database URL & credentials
  - JWT secret
  - Redis URL
  - Payment processor keys
  - Email service credentials
  - Shipping API keys
```

#### **db.js** — Database Connection Pool
```
Purpose: Create and manage PostgreSQL connection
- SSL configuration (RDS, managed databases)
- Connection pooling (max/min connections)
- Timeout settings
- Error handling
- Tenant context setup
```

#### **redis.js** — Redis Client Configuration
```
Purpose: Create Redis client for:
- Session storage
- Token blacklist
- Caching (products, permissions)
- Rate limiter
- Queue storage
```

#### **auth.js** — Authentication Configuration
```
Purpose: Define auth strategies and options
- JWT configuration (secret, expiration)
- Session timeout
- Cookie settings
- Refresh token TTL
```

#### **passport.js** — Passport.js Strategies
```
Purpose: Configure authentication strategies
Strategies:
  - JWTStrategy: Bearer token auth
  - LocalStrategy: Username/password login
  - RefreshTokenStrategy: Token refresh
  - GoogleStrategy: OAuth (if enabled)
```

#### **session.js** — Express Session Configuration
```
Purpose: Configure session store & options
- Session store type (Redis, database)
- Cookie settings (httpOnly, secure, sameSite)
- Session TTL
- Session serialization
```

#### **cache.js** — Caching Strategy Configuration
```
Purpose: Define caching behavior for different data types
Cache layers:
  - Memory cache (in-process)
  - Redis cache (distributed)
  - HTTP cache headers (client-side)
```

#### **security.js** — Security Headers & CORS
```
Purpose: Security middleware configuration
Includes:
  - Content Security Policy (CSP)
  - HSTS headers
  - X-Frame-Options
  - X-Content-Type-Options
  - Referrer Policy
  - CORS allowed origins
  - Allowed credentials
```

#### **swagger.js** — OpenAPI/Swagger Documentation
```
Purpose: Generate interactive API documentation
- API version
- Server info
- Security schemes
- Route descriptions
- Request/response schemas
```

---

## Domain Layer (Business Logic)

### **DDD Structure Each Domain Contains**

```
domain/
├── {domain-name}/
│   ├── entities/                # Business objects & aggregates
│   ├── services/                # Domain service logic
│   ├── repositories/            # Data access contracts
│   ├── events/                  # Domain events
│   ├── policies/                # Business rules & policies
│   ├── subscribers/             # Event handlers
│   └── index.js                 # Domain exports
```

---

### **1. Identity Domain (`domain/identity/`)**

**Purpose:** User accounts, authentication, profiles  
**Bounded Context:** All user-related business logic

#### **Entities**

**User.js**
```
Properties:
  - id: Unique identifier
  - email: Unique email address
  - password_hash: Argon2 hash (NOT plaintext)
  - role: enum (customer, vendor, admin, support)
  - email_verified: Boolean flag
  - profile: {first_name, last_name, avatar_url}
  - preferences: Settings object
  - created_at, updated_at, deleted_at

Business Rules Enforced:
  - Email must be unique
  - Password must meet complexity requirements
  - Role determines permissions (via RBAC)
  - Soft deletion via deleted_at
```

#### **Services**

**UserService.js**
```
Responsibilities:
  - createUser(email, password) - Register new user
  - updateProfile(userId, profile) - Update user info
  - changePassword(userId, oldPwd, newPwd) - Password change
  - deactivateAccount(userId) - Soft delete user
  - getUserById(userId) - Retrieve user (with RLS)

No database queries! Uses repositories.
```

**AuthenticationService.js**
```
Responsibilities:
  - generateJWT(user) - Create JWT token with claims
  - verifyPassword(password, hash) - Argon2 verification
  - generateRefreshToken(userId) - Refresh token lifecycle
  - validateAndRotateRefreshToken() - Token rotation
  - sendPasswordResetEmail() - Email flow
  - resetPassword(token, newPassword) - Reset completion

Notes:
  - Core login returns sanitized user + access token
  - Refresh token issuance/revocation is handled by refresh-enabled flows
```

**EmailVerificationService.js**
```
Responsibilities:
  - sendVerificationEmail(email) - Send verification link
  - verifyEmail(token) - Mark email as verified
  - resendVerificationEmail(email) - Retry verification
```

#### **Repositories**

**UserRepository.js**
```
Interface (abstract):
  - findById(id) - Get user by ID
  - findByEmail(email) - Lookup by email
  - create(userData) - Insert new user
  - update(id, changes) - Update user
  - delete(id) - Soft delete
  - findAll(filters) - List users with pagination
```

#### **Events**

**UserCreatedEvent.js**
```
Fired: When new user registers
Payload: {userId, email, created_at}
Subscribers: Send welcome email, grant default permissions
```

**PasswordChangedEvent.js**
```
Fired: When user changes password
Payload: {userId, changedAt}
Subscribers: Invalidate all sessions, send notification email
```

**EmailVerifiedEvent.js**
```
Fired: When user verifies email
Payload: {userId, email, verified_at}
Subscribers: Unlock user features, trigger onboarding
```

---

### **2. Catalog Domain (`domain/catalog/`)**

**Purpose:** Product catalog, categories, inventory  
**Bounded Context:** Product information & availability

#### **Entities**

**Product.js** (Aggregate Root)
```
Properties:
  - id: Unique product ID
  - name: Product name
  - slug: URL-friendly slug
  - description: Product description
  - brand: Brand name
  - category_id: Category reference
  - vendor_id: Seller reference
  - base_price: Base price in cents
  - is_active: Visibility flag
  - created_by, updated_by: Audit trail
  - created_at, updated_at, deleted_at

Relationships:
  - Has many ProductVariants (sizes, colors, SKUs)
  - Has many Reviews (customer ratings)
  - Has one Inventory (stock status)
```

**ProductVariant.js**
```
Properties:
  - id: Variant ID
  - product_id: Parent product
  - sku: Stock Keeping Unit (unique)
  - price_cents: Specific price override
  - attributes: {size, color, etc.}
  - stock: Current available quantity

Business Rules:
  - SKU must be unique
  - Price in cents (100 = $1.00)
  - Stock >= 0
```

**Category.js**
```
Properties:
  - id: Category ID
  - name: Category name
  - slug: URL slug
  - path: LTREE hierarchical path
  - parent_id: Parent category (nullable for roots)

Features:
  - Hierarchical categories (using PostgreSQL LTREE)
  - Enable deep browsing (Electronics → Phones → Android)
```

#### **Services**

**ProductService.js**
```
Responsibilities:
  - createProduct(vendorId, productData) - New product
  - updateProduct(productId, changes) - Edit product
  - publishProduct(productId) - Make visible
  - unpublishProduct(productId) - Hide from store
  - getProductsByCatalog(filters) - Browse catalog
  - searchProducts(query, filters) - Full-text search

Enforces:
  - Vendor can only manage own products
  - Products must have at least one variant
```

**InventoryService.js**
```
Responsibilities:
  - getAvailableStock(variantId) - Check stock level
  - reserveStock(variantId, quantity) - Hold inventory
  - releaseReservation(reservationId) - Cancel hold
  - fulfillReservation(reservationId) - Deduct sold stock
  - replenishStock(variantId, quantity) - Receive shipment

Patterns:
  - Optimistic locking for concurrent updates (Sprint 2)
  - Prevents overselling with version checks
```

**CategoryService.js**
```
Responsibilities:
  - getCategory(categoryId) - Retrieve category
  - getCategoryTree() - Full hierarchy
  - moveCategory(categoryId, newParentId) - Restructure
  - getProductsByCategory(categoryId) - Browse
```

#### **Policies**

**ProductAvailabilityPolicy.js**
```
Rule: Can purchase product if:
  - Product is_active = true
  - Inventory reserved < total stock
  - Vendor is active
```

**ProductPricingPolicy.js**
```
Rule: Apply correct pricing:
  - Use variant price if defined
  - Fallback to product base_price
  - Apply tenant-specific markups
  - Apply currency conversions
```

#### **Events**

**ProductCreatedEvent.js** → Index in search engine
**ProductPriceChangedEvent.js** → Clear price cache
**ProductOutOfStockEvent.js** → Notify subscribers

---

### **3. Ordering Domain (`domain/ordering/`)**

**Purpose:** Shopping carts, orders, checkout flow  
**Bounded Context:** Customer purchasing process

#### **Entities**

**Cart.js** (Aggregate Root)
```
Properties:
  - id: Cart ID
  - user_id: Owner (or session_id for guests)
  - tenant_id: Tenant context
  - status: active | abandoned | converted
  - items: Array of CartItem
  - created_at, updated_at

Business Rules:
  - One active cart per user per tenant
  - Items must have valid variants
  - Cart expires if abandoned (30 days default)
```

**CartItem.js**
```
Properties:
  - cart_id: Parent cart
  - product_variant_id: Which variant
  - quantity: How many units
  - unit_price_cents: Locked-in price at add time
  - added_at: When item was added

Business Rules:
  - Quantity > 0
  - Price immutable after add (no price fluctuation during shopping)
  - One instance of each variant per cart
```

**Order.js** (Aggregate Root)
```
Properties:
  - id: Order ID
  - order_number: Human-readable reference (ORD-20260718-000001)
  - user_id: Customer
  - tenant_id: Tenant context
  - status: pending → processing → paid → shipped → delivered
  - items: Array of OrderItem (immutable copy of cart)
  - subtotal_cents, tax_cents, shipping_cents, total_cents
  - payment_status: pending | succeeded | failed | refunded
  - fulfillment_status: unfulfilled | partial | fulfilled
  - currency: ISO code (USD, EUR, etc.)
  - shipping_address, billing_address (denormalized)
  - tracking_number: Carrier tracking
  - created_at, updated_at, deleted_at

Audit Trail:
  - created_by, updated_by: Responsible parties
  - timestamps for all state transitions
```

**OrderItem.js**
```
Properties:
  - order_id: Parent order
  - product_id: Reference to product
  - product_variant_id: Reference to variant
  - quantity: Ordered quantity
  - unit_price_cents: Sold price (locked at order time)
  - subtotal_cents: quantity * unit_price

Immutability:
  - Prices don't change after order placed
  - Protects against price fluctuations
```

#### **Services**

**CartService.js**
```
Responsibilities:
  - createCart(userId) - New shopping cart
  - addToCart(cartId, variantId, quantity) - Add item
  - removeFromCart(cartId, itemId) - Remove item
  - updateQuantity(cartId, itemId, newQuantity) - Change qty
  - clearCart(cartId) - Empty cart
  - getCartTotal(cartId) - Calculate totals
  - abandoneCart(cartId) - Mark inactive

Validation:
  - Variant must exist and be in stock
  - Quantity must be positive
  - Prevent duplicates (update existing instead)
```

**OrderService.js**
```
Responsibilities:
  - createOrder(userId, cartData) - New order from cart
  - getOrder(orderId) - Retrieve order
  - cancelOrder(orderId) - Cancel pending order
  - updateOrderStatus(orderId, newStatus) - State change
  - applyDiscount(orderId, discountCode) - Coupon

State Transitions:
  - pending → processing (payment initiated)
  - pending → cancelled (user cancels)
  - processing → paid (payment successful)
  - paid → shipped (carrier pickup)
  - shipped → delivered (carrier delivery)
  - * → refunded (refund issued)

Enforcement:
  - Only pending orders can be cancelled
  - Only paid orders can ship
  - Only shipped orders can be marked delivered
```

**CheckoutService.js**
```
Responsibilities:
  - validateCart(cartId) - Pre-purchase checks
  - calculateTotals(cartId) - Final amount with tax/shipping
  - prepareOrderFromCart(cartId) - Create order
  - convertGuestCheckout(guestSession, newUserId) - Guest → Registered

Validation:
  - All items in stock
  - Shipping address valid
  - Payment method valid
  - Promo codes valid
```

#### **Value Objects**

**OrderTotal.js**
```
Immutable calculation:
  - subtotal: sum of item prices
  - tax: calculated from address + items
  - shipping: based on weight & destination
  - discount: promo code reduction
  - total: subtotal + tax + shipping - discount
```

**ShippingAddress.js**
```
Immutable address:
  - first_name, last_name
  - street, city, state, postal_code
  - country
  - phone
  - validation: Must be complete before shipping
```

#### **Policies**

**CartExpirationPolicy.js**
```
Rule: Carts expire if untouched for 30 days
Action: Mark as abandoned, notify user
```

**OrderCancellationPolicy.js**
```
Rule: Order can only be cancelled if:
  - status = pending (no payment processed yet)
  - user is order owner or admin
```

#### **Events**

**CartCreatedEvent.js** → Initialize cart session
**ItemAddedToCartEvent.js** → Update cart total, clear cache
**OrderCreatedEvent.js** → Reserve inventory, send confirmation email
**OrderPaidEvent.js** → Trigger fulfillment workflow
**OrderShippedEvent.js** → Send shipment notification
**OrderDeliveredEvent.js** → Send delivery confirmation

---

### **4. Payment Domain (`domain/payment/`)**

**Purpose:** Payment processing, invoicing, refunds  
**Bounded Context:** Financial transactions

#### **Entities**

**Payment.js** (Aggregate Root)
```
Properties:
  - id: Payment ID
  - order_id: Related order
  - processor: stripe | paystack | paypal
  - processor_id: Payment processor's ID
  - amount_cents: Amount in cents
  - currency: ISO currency code
  - status: pending | authorized | captured | failed | refunded
  - metadata: Processor-specific data
  - created_at, updated_at

Audit Trail:
  - Who authorized, when
  - All status transitions
  - Associated order reference
```

**PaymentMethod.js**
```
Properties:
  - id: Payment method ID
  - user_id: Owner
  - payment_type: card | bank_transfer | mobile_money
  - processor_id: Tokenized identifier
  - brand: Visa | Mastercard | etc.
  - last_four: Last 4 digits (PCI compliant)
  - exp_month, exp_year: Expiration
  - is_primary: Default payment method
  - is_active: Can be used

Security:
  - Never stores full card numbers
  - Tokenization by payment processor
  - RLS policy prevents cross-user access (Sprint 2)
```

**Invoice.js**
```
Properties:
  - id: Invoice ID
  - order_id: Related order
  - invoice_number: Unique reference
  - status: draft | sent | paid | cancelled
  - amount_due: Total due
  - amount_paid: Amount received
  - due_date: Payment deadline
  - items: Line items (copy of order items)
  - notes: Special instructions
  - created_at, due_at, paid_at
```

#### **Services**

**PaymentService.js**
```
Responsibilities:
  - initiatePayment(orderId, paymentMethodId) - Start payment
  - handlePaymentCallback(processor, response) - Process webhook
  - capturePayment(paymentId) - Finalize transaction
  - refundPayment(paymentId, reason) - Issue refund
  - getPaymentStatus(paymentId) - Check status

Idempotency:
  - Duplicate requests return same result (Sprint 2)
  - Idempotency keys prevent double-charging
```

**StripeService.js**
```
Integrations:
  - Create PaymentIntent
  - Handle Stripe webhooks
  - Process refunds
  - Manage payment methods

Error Handling:
  - Circuit breaker for API failures
  - Retry logic with exponential backoff
  - Webhook signature validation
```

**PayStackService.js**
```
Integrations:
  - Initialize transaction
  - Handle payment verification
  - Process refunds
  - Manage currencies (supports African currencies)
```

**InvoiceService.js**
```
Responsibilities:
  - createInvoice(orderId) - Generate from order
  - sendInvoice(invoiceId, email) - Email to customer
  - recordPayment(invoiceId, amount) - Mark paid
  - cancelInvoice(invoiceId) - Void invoice
```

#### **Policies**

**PaymentAuthorizationPolicy.js**
```
Rule: User can only pay for own orders
- Only order owner can initiate payment
- Admins can override for support cases
```

**RefundPolicy.js**
```
Rule: Refunds allowed if:
  - Order status = paid or shipped (not pending)
  - Within 30 days of purchase
  - Valid refund reason
```

#### **Events**

**PaymentInitiatedEvent.js** → Lock order, hold inventory
**PaymentSucceededEvent.js** → Update order status, release inventory hold
**PaymentFailedEvent.js** → Notify user, release reservation
**RefundProcessedEvent.js** → Restore inventory, send confirmation

---

### **5. Shipping Domain (`domain/shipping/`)**

**Purpose:** Shipment tracking, carrier integration  
**Bounded Context:** Order fulfillment

#### **Entities**

**Shipment.js** (Aggregate Root)
```
Properties:
  - id: Shipment ID
  - order_id: Related order
  - status: pending | picked | shipped | in_transit | delivered | failed
  - carrier: FedEx | UPS | DHL | EasyShip
  - tracking_number: Carrier's tracking code
  - weight: Package weight
  - dimensions: Length, width, height
  - estimated_delivery: Predicted delivery date
  - actual_delivery: Actual delivery date (nullable)
  - carrier_response: Full API response from carrier
  - created_at, shipped_at, delivered_at
```

**ShipmentTracking.js**
```
Properties:
  - shipment_id: Related shipment
  - status: Current status
  - location: Current location
  - updated_at: When status changed
  - events: Array of tracking events

Events Tracked:
  - Picked up from warehouse
  - In transit
  - Out for delivery
  - Delivered
  - Delivery attempted
  - Exception/delay
```

#### **Services**

**ShipmentService.js**
```
Responsibilities:
  - createShipment(orderId, items) - New shipment
  - requestPickup(shipmentId) - Schedule carrier pickup
  - trackShipment(trackingNumber) - Get current status
  - updateShipmentStatus(shipmentId, newStatus) - State change
  - estimateDelivery(shipmentId) - Predict arrival

Features:
  - Multi-carrier support
  - Rate shopping (compare prices)
  - Label generation
```

**EasyShipGateway.js**
```
Integration with EasyShip shipping API:
  - Create shipment orders
  - Get shipping rates
  - Track shipments
  - Validate addresses
  - Generate shipping labels
  - Handle webhook updates

Error Handling:
  - Circuit breaker for API outages
  - Fallback to manual processing
```

**ShippingTrackingService.js**
```
Responsibilities:
  - Fetch tracking updates from carrier
  - Sync with database
  - Notify customers of status changes
  - Store tracking history
```

#### **Subscribers**

**ShipmentEventSubscriber.js**
```
Listens to events:
  - OrderPaidEvent → Create shipment
  - CarrierWebhookEvent → Update tracking
  - ShipmentDeliveredEvent → Mark order complete
```

#### **Events**

**ShipmentCreatedEvent.js** → Request label
**ShipmentPickedUpEvent.js** → Update customer
**ShipmentDeliveredEvent.js** → Complete order

---

### **6. Shared Domain (`domain/shared/`)**

**Purpose:** Cross-domain primitives and exceptions  
**Bounded Context:** DDD foundations

#### **Entities**

**AggregateRoot.js** — Base class for domain entities
```
Provides:
  - ID generation
  - Timestamp tracking (created_at, updated_at)
  - Soft delete support (deleted_at)
  - Event collection for domain events
  - Identity equality
```

#### **Value Objects**

**Money.js**
```
Immutable value object:
  - amount: cents (avoid floating point)
  - currency: ISO code
  - arithmetic: add(), subtract(), multiply()
  - comparison: equals(), greaterThan(), etc.
  - conversion: convertTo(newCurrency)

Example: Money(1000, 'USD') represents $10.00
```

**Email.js**
```
Immutable email value object:
  - address: valid email address
  - normalized: lowercase, trimmed
  - validation: RFC compliant
```

**PhoneNumber.js**
```
Immutable phone value object:
  - number: formatted phone
  - country: country code
  - validation: E.164 format
```

#### **Exceptions**

**DomainException.js** — Base exception
```
Hierarchy:
  - InvalidCredentialsException
  - InsufficientInventoryException
  - OrderNotFoundError
  - PaymentFailedException
  - UnauthorizedAccessException
```

#### **Events**

**DomainEvent.js** — Base event class
```
Properties:
  - aggregate_id: Which entity triggered
  - event_type: Name of event
  - timestamp: When occurred
  - correlation_id: Trace related events
  - causation_id: What caused this

Usage: New domain events inherit and add domain-specific data
```

#### **Repositories**

**RepositoryInterface.js**
```
Contract all repositories must implement:
  - findById(id)
  - create(entity)
  - update(id, changes)
  - delete(id)
  - find(criteria)
```

---

## API Layer (Controllers & Routes)

### **Structure**

```
api/
├── controllers/
│   ├── v1/
│   │   ├── auth/              # Authentication endpoints
│   │   ├── identity/          # User profile endpoints
│   │   ├── catalog/           # Product browsing
│   │   ├── ordering/          # Cart & checkout
│   │   ├── payments/          # Payment endpoints
│   │   ├── vendor/            # Seller endpoints
│   │   └── wishlist/          # Wishlist endpoints
│   ├── admin/                 # Admin-only endpoints
│   └── health.js              # Health check endpoints
├── routes/
│   ├── v1/
│   │   ├── auth.js            # Authentication routes
│   │   ├── identity.js        # Profile routes
│   │   ├── catalog.js         # Product routes
│   │   ├── ordering.js        # Cart/order routes
│   │   ├── payments.js        # Payment routes
│   │   └── admin.js           # Admin routes
│   └── index.js               # Route aggregation
└── validators/
    ├── auth.js                # Auth validation schemas
    ├── catalog.js             # Product validation
    ├── order.js               # Order validation
    └── ...
```

### **Controllers**

Controllers follow a consistent pattern:

```javascript
// Each controller exports functions matching HTTP verbs
// Pattern: {action} = async (req, res, next) => {}

Example: catalogController.js

exports.listProducts = async (req, res, next) => {
  // 1. Extract request data
  const { category, sort, page, limit } = req.query;
  
  // 2. Validate input
  const validation = validateListProductsRequest({...});
  if (!validation.valid) return res.status(400).json({error: validation.error});
  
  // 3. Call domain service
  const products = await productService.getProductsByCatalog({...});
  
  // 4. Serialize response
  const serialized = products.map(p => ({
    id: p.id,
    name: p.name,
    price: p.base_price / 100, // Convert cents to dollars
    image: p.image_url,
    category: p.category?.name
  }));
  
  // 5. Send response
  res.status(200).json({
    success: true,
    data: serialized,
    pagination: {...}
  });
}
```

### **Routes**

Routes map HTTP methods to controller functions:

```javascript
// catalogRoutes.js

const express = require('express');
const router = express.Router();
const catalogController = require('../controllers/v1/catalog');
const { validateGetProduct } = require('../validators/catalog');

// GET endpoints (read)
router.get('/', catalogController.listProducts);
router.get('/:slug', validateGetProduct, catalogController.getProduct);

// POST endpoints (create)
router.post('/', authRequired, vendorOnly, catalogController.createProduct);

// PUT endpoints (update)
router.put('/:id', authRequired, vendorOnly, catalogController.updateProduct);

// DELETE endpoints
router.delete('/:id', authRequired, adminOnly, catalogController.deleteProduct);

module.exports = router;
```

### **Health Checks** (`/api/controllers/health.js`)

```
GET /health
  - Basic health check (always returns 200)
  - Used by load balancers

GET /health/detailed
  - Database connection status
  - Redis connection status
  - External service status
  - Response time from services

GET /health/ready
  - Kubernetes readiness probe
  - Checks if ready to accept traffic
  - Database migrations completed
  
GET /health/live
  - Kubernetes liveness probe
  - Checks if process is alive
  - Returns 200 if running
```

---

## Middleware Layer

### **Request Processing Pipeline**

```
Incoming HTTP Request
    ↓
1. Security Middleware (helmet, CORS, CSP)
    ↓
2. Request Context (correlation ID, user ID)
    ↓
3. Authentication (verify JWT, extract claims)
    ↓
4. Authorization (check permissions/RBAC)
    ↓
5. Validation (request body/params validation)
    ↓
6. Caching (check cache, return if hit)
    ↓
7. Rate Limiting (check rate limit)
    ↓
8. Domain Routes (execute business logic)
    ↓
9. Response Serialization
    ↓
10. Error Handler (catch and format errors)
    ↓
Output HTTP Response
```

### **Middleware Files** (`/api/middleware/`)

#### **core/auth + decorators/auth.js** — JWT Verification & User Extraction
```
Exports:
  - authMiddleware(req, res, next) - Require valid JWT
  - protect() - Decorator wrapper for authenticated routes
  - verified() - Authenticated + verified user
  - permission(code) - Canonical permission gate

Action:
  - Extract token from Authorization header or cookies
  - Verify JWT signature & expiration
  - Check token blacklist (logout)
  - Extract user claims (id, email, role)
  - Set req.user with user data
```

#### **authorization.js** — RBAC & Permission Checks
```
Exports:
  - requireRole(roles) - Check user role
  - requirePermission(permission) - Check specific permission
  - ownerOrAdmin(req, res, next) - User is owner or admin

Patterns:
  - Role-based: user.role in ['admin', 'vendor']
  - Permission-based: user.permissions includes 'product:create'
  - Resource-based: user.id === resource.owner_id
```

#### **validation.js** — Request Validation
```
Exports:
  - validateRequest(schema)(req, res, next)
  - validateBody(schema)
  - validateParams(schema)
  - validateQuery(schema)

Implementation:
  - Uses Joi schemas for validation
  - Returns 400 Bad Request if invalid
  - Sanitizes input to prevent injection
```

#### **error.js** — Error Handling & 404
```
Exports:
  - errorHandler(err, req, res, next) - Catch all errors
  - notFoundHandler(req, res, next) - Catch 404s

Processing:
  - Log error
  - Extract status code & message
  - Remove stack trace in production
  - Return consistent JSON error format
```

#### **csrf.js** — Cross-Site Request Forgery Protection
```
Exports:
  - csrfProtection(req, res, next)
  - generateCSRFToken(req, res)

Implementation:
  - Double-submit cookie pattern
  - Validate configurable CSRF header
  - Exempt GET/OPTIONS/HEAD
  - Store token in Redis

Admin app specifics:
  - Header: x-admin-csrf-token
  - Redis key prefix: admin-csrf-token
  - Auth routes under /auth are excluded from admin CSRF enforcement
```

#### **rateLimiter.js** — Rate Limiting
```
Exports:
  - rateLimiter(options)(req, res, next)
  - createLimiter(key, limit, window)

Strategies:
  - IP-based: 100 requests per 15 minutes
  - User-based: 1000 requests per hour
  - Endpoint-specific: Login 5 per minute (brute force)
  
Storage: Redis with TTL
```

#### **cache-headers.js** — HTTP Caching
```
Exports:
  - etagSupport(req, res, next) - ETag generation
  - lastModifiedSupport(req, res, next) - Last-Modified header

Behavior:
  - Generate ETag from response body
  - Return 304 Not Modified if ETag matches
  - Client caches based on max-age
  - Reduces bandwidth & improves performance
```

#### **logger.js** — HTTP Logging
```
Uses: Morgan logging middleware
Logs:
  - HTTP method & path
  - Status code
  - Response time
  - Bytes sent/received
  - User-Agent
  - IP address
```

#### **metrics.js** — Prometheus Metrics
```
Exports:
  - metricsMiddleware(req, res, next) - Collect metrics
  - metricsEndpoint(req, res) - Export metrics

Tracks:
  - HTTP requests per endpoint
  - Response time percentiles
  - Error rates
  - Status code distribution
  - Active connections
```

#### **requestContext.js** — Request Tracing
```
Exports:
  - correlationIdMiddleware - Unique request ID
  - requestTimingMiddleware - Request duration

Usage:
  - Trace requests across distributed system
  - Log request duration for performance monitoring
  - Correlate logs from multiple services
```

#### **locale.js** — Internationalization
```
Exports:
  - localeMiddleware(req, res, next)

Logic:
  - Extract locale from Accept-Language header
  - Fallback to default (en-US)
  - Set req.locale
  - Load i18n strings for locale
```

#### **rbac.js** — Role-Based Access Control
```
Exports:
  - checkRole(requiredRoles)(req, res, next)
  - checkPermission(requiredPermissions)(req, res, next)

Behavior:
  - Load user's role & permissions from JWT
  - Verify user has required role/permission
  - Return 403 Forbidden if denied
```

---

## Decorators & Cross-Cutting Concerns

### **Functional Decorators** (`/api/decorators/`)

Decorators provide reusable enhancements to controllers without middleware:

#### **guest.js** — Guest or Authenticated
```
Purpose: Allow both guest and authenticated users
Extract user from:
  - JWT if present
  - Session if guest
  
Usage:
@guestOrAuth()
async listProducts(req, res) {
  // req.user = current user or null
  // req.isGuest = true if not authenticated
}
```

#### **auth.js** — Require Authentication
```
Purpose: Require valid JWT
Extracts:
  - Token from Authorization header
  - Token from token/access_token cookies
  - User from JWT claims
 
Primary decorator exports:
  - protect() - Require authenticated user
  - verified() - Require authenticated + verified user
  - permission(code) - Require canonical permission code

Usage:
router.get('/profile', ...protect(), controller.profile)
router.post('/products', ...protect(), ...permission('product:create'), controller.create)
```

#### **validation.js** — Request Validation
```
Purpose: Validate request body/params/query
Validates against Joi schema

Usage:
@validateRequest(schema)
async createProduct(req, res) {
  // req.body validated
  // Throws 400 if invalid
}
```

#### **caching.js** — Response Caching
```
Purpose: Cache response in Redis
Check cache key, return if hit

Usage:
@cache('products', 3600) // Cache 1 hour
async listProducts(req, res) {
  // Cached if already called
  // Cache key: products:{query}
}
```

#### **rateLimiting.js** — Rate Limit
```
Purpose: Apply rate limit to endpoint
Track by IP or user ID

Usage:
@rateLimiting(10, '1h') // 10 requests per hour
async expensiveOperation(req, res) {
  // Throws 429 if rate limit exceeded
}
```

---

## Data Access Layer (Repositories)

### **Repository Pattern** (`/data/repositories/`)

Repositories abstract database access, allowing business logic to remain infrastructure-independent.

#### **BaseRepository.js** — Abstract Base Class
```javascript
class BaseRepository {
  constructor(table, pool) {
    this.table = table;
    this.pool = pool;
  }

  // Common operations all repositories share
  async findById(id, tenantId) {
    // Query with RLS context
    // SELECT * FROM {table} WHERE id = $1 AND tenant_id = $2
  }

  async create(entity, tenantId) {
    // Insert new entity
    // Automatically set created_at, tenant_id
  }

  async update(id, changes, tenantId) {
    // Update entity
    // Automatically set updated_at
    // Prevent overwriting immutable fields
  }

  async delete(id, tenantId) {
    // Soft delete via deleted_at
    // Or hard delete if permanent
  }

  async find(criteria, tenantId) {
    // Find with filters, pagination, sorting
    // Respect RLS policies
  }

  async findAll(filters = {}) {
    // List with pagination
    // Support sorting, filtering
  }

  // Helper methods
  buildQuery(criteria) {
    // Convert criteria object to SQL WHERE clause
  }

  withTenant(tenantId) {
    // Set current tenant context
    // Used by RLS policies
  }
}
```

#### **Domain-Specific Repositories**

**ProductRepository.js**
```
Extends: BaseRepository
Table: products

Custom Methods:
  - findBySlug(slug, tenantId) - Get by URL slug
  - findByVendor(vendorId) - Vendor's products
  - search(query, filters) - Full-text search
  - getProductWithVariants(id) - Product + variants
  - findRelated(categoryId) - Similar products
```

**UserRepository.js**
```
Extends: BaseRepository
Table: users

Custom Methods:
  - findByEmail(email) - Lookup by email
  - findWithRole(roleId) - Users in role
  - findActive() - Non-deleted users
  - countByRole() - Role distribution
```

**OrderRepository.js**
```
Extends: BaseRepository
Table: orders

Custom Methods:
  - findByNumber(orderNumber) - Lookup by order number
  - findUserOrders(userId) - User's order history
  - findByStatus(status) - Orders in status
  - getOrderWithItems(orderId) - Order + line items
  - findDueInvoices() - Orders awaiting payment
```

#### **Implementation Pattern**

```javascript
// Using repository in a domain service

class OrderService {
  constructor(orderRepository, paymentRepository) {
    this.orders = orderRepository;
    this.payments = paymentRepository;
  }

  async createOrder(userId, cartData, tenantId) {
    // 1. Validate
    this.validateOrderData(cartData);

    // 2. Create entity
    const order = new Order({
      userId,
      tenantId,
      items: cartData.items,
      ...
    });

    // 3. Persist via repository
    const saved = await this.orders.create(order, tenantId);

    // 4. Return domain entity (not raw DB data)
    return saved;
  }

  async getOrder(orderId, tenantId) {
    // Repository handles RLS, soft deletes, tenant filtering
    const order = await this.orders.findById(orderId, tenantId);
    if (!order) throw new OrderNotFoundError();
    return order;
  }
}

// In controller
const orderService = new OrderService(orderRepository, paymentRepository);
const order = await orderService.createOrder(userId, cartData, tenantId);
res.json(serialize(order));
```

---

## Services Layer

### **Cross-Cutting Services** (`/services/`)

Services that support multiple domains:

#### **cache.js** — Caching Service
```
Purpose: Multi-layer caching strategy

Exports:
  - getCachedData(key, fetchFn, ttl)
  - setCachedData(key, data, ttl)
  - invalidateCache(key)
  - invalidateCachePattern(pattern)

Layers:
  1. Memory cache (in-process) - fastest
  2. Redis cache (distributed) - shared across processes
  3. HTTP cache headers - client-side
```

#### **invitation.js** — Invitation Workflow
```
Purpose: Invite users to teams/organizations

Exports:
  - inviteUser(email, role, organizationId)
  - acceptInvitation(token)
  - rejectInvitation(token)
  - revokeInvitation(token)

Workflow:
  1. Generate unique token
  2. Store in database with expiration
  3. Send email with acceptance link
  4. User clicks link
  5. System verifies token
  6. Add user to organization
```

#### **admin.js** — Admin Operations
```
Purpose: Administrative functions

Exports:
  - getOverview() - dashboard totals, recent orders, recent users
  - getUsers(query) - paginated user list
  - getOrders(query) - paginated order list
  - updateUserRole(userId, role)

Notes:
  - Order totals are normalized from orders.total_cents
  - Dashboard/admin pages consume these view-model friendly service results
```

#### **profiler.js** — Performance Profiling
```
Purpose: Monitor application performance

Exports:
  - profileFunction(fn, name)
  - measure(operation, fn)
  - recordMetric(metric, value)
  - getMetrics()
  - reportSlowQueries()

Usage:
  const result = await profiler.measure('dbQuery', async () => {
    return await db.query('SELECT ...');
  });
  // Logs timing if slower than threshold
```

---

## Testing & Fixtures

### **Testing Strategy** (`/__tests__/`)

#### **Unit Tests** (`__tests__/unit/`)
```
Purpose: Test individual units in isolation

Coverage:
  - Services (business logic)
  - Value objects (money calculations)
  - Utility functions
  - Middleware (error handling)

Mocking: Mock dependencies (repositories, external services)
Speed: Fast (< 1 second each)

Example:
describe('ProductService', () => {
  it('should create product with valid data', async () => {
    const mockRepository = createMockRepository();
    const service = new ProductService(mockRepository);
    
    const result = await service.createProduct({...});
    
    expect(result.id).toBeDefined();
    expect(mockRepository.create).toHaveBeenCalled();
  });
});
```

#### **Integration Tests** (`__tests__/integration/`)
```
Purpose: Test services with real database/Redis

Coverage:
  - Domain services + repositories
  - Database transactions
  - Event subscribers
  - Workflow orchestration

Setup: Use test database, clean between runs
Speed: Medium (1-5 seconds each)

Example:
describe('OrderService Integration', () => {
  let testDb;
  
  beforeEach(async () => {
    testDb = await setupTestDatabase();
  });
  
  it('should complete order with payment', async () => {
    const order = await createTestOrder(testDb);
    const service = new OrderService(new OrderRepository(testDb));
    
    await service.completeOrder(order.id);
    
    const updated = await testDb.query('SELECT * FROM orders WHERE id = ?');
    expect(updated.status).toBe('completed');
  });
});
```

#### **End-to-End Tests** (`__tests__/e2e/`)
```
Purpose: Test complete user workflows via HTTP

Coverage:
  - Full request/response cycle
  - Multiple domain interactions
  - Guest checkout flow
  - Admin operations

Setup: Full server + test database
Speed: Slow (5-30 seconds per test)

Example:
describe('Guest Checkout Flow', () => {
  it('should checkout as guest without account', async () => {
    const response = await supertest(app)
      .post('/api/v1/guest/cart')
      .send({sessionToken: 'guest-xyz'});
    
    expect(response.status).toBe(201);
    expect(response.body.cart.id).toBeDefined();
  });
});
```

#### **Security Tests** (`__tests__/security/`)
```
Tests:
  - SQL injection prevention
  - XSS prevention
  - CSRF protection
  - Authorization bypass
  - Authentication bypass
  - Multi-tenancy isolation
  - PCI compliance
```

### **Test Fixtures** (`__tests__/fixtures/`)

Pre-built test data for consistent testing:

#### **identity.fixtures.js** — User Test Data
```
Exports:
  - defaultUser() - Standard user
  - adminUser() - Admin with full permissions
  - vendorUser() - Vendor account
  - inactiveUser() - Soft-deleted user
  - unverifiedUser() - Email not verified
```

#### **catalog.fixtures.js** — Product Test Data
```
Exports:
  - defaultProduct() - Standard product
  - outOfStockProduct() - Zero inventory
  - expensiveProduct() - High-priced item
  - inactiveProduct() - Hidden from catalog
  - productWithVariants() - Multiple SKUs
```

#### **ordering.fixtures.js** — Order Test Data
```
Exports:
  - newOrder() - Pending order
  - paidOrder() - Payment completed
  - shippedOrder() - In transit
  - refundedOrder() - Money returned
```

#### **payment.fixtures.js** — Payment Test Data
```
Exports:
  - stripePayment() - Stripe transaction
  - paystackPayment() - PayStack transaction
  - failedPayment() - Declined
  - refundedPayment() - Refunded
```

### **Test Factories** (`__tests__/factories/`)

Builder pattern for creating test entities:

```javascript
// user.factory.js
class UserFactory {
  static create(overrides = {}) {
    return {
      id: randomId(),
      email: randomEmail(),
      password_hash: '$argon2id$examplehash',
      role: 'customer',
      email_verified: true,
      created_at: new Date(),
      ...overrides
    };
  }

  static createAdmin(overrides = {}) {
    return this.create({ role: 'admin', ...overrides });
  }

  static createMany(count, overrides = {}) {
    return Array.from({length: count}, () => this.create(overrides));
  }
}

// Usage in tests:
const user = UserFactory.create({role: 'vendor'});
const admin = UserFactory.createAdmin();
const manyUsers = UserFactory.createMany(10);
```

---

## Summary: File Organization by Separation of Concerns

### **By Layer**

| Layer | Purpose | Key Directories | Files Count |
|-------|---------|-----------------|------------|
| **Entry Point** | Server startup | `/src/` | 5 |
| **Configuration** | Environment setup | `/config/` | 9 |
| **Middleware** | Cross-cutting concerns | `/api/middleware/` | 12 |
| **API** | HTTP endpoints | `/api/controllers/`, `/api/routes/` | 50+ |
| **Domain** | Business logic (DDD) | `/domain/{domain}/` | 80+ |
| **Data Access** | Repositories & DB | `/data/repositories/` | 15+ |
| **Services** | Cross-domain logic | `/services/` | 8 |
| **Testing** | Automated testing | `/__tests__/` | 70+ |
| **Infrastructure** | External integrations | `/infrastructure/` | 20+ |
| **Utilities** | Helper functions | `/utils/` | 5 |

### **By Domain**

| Domain | Tables | Services | Repositories | Controllers | Routes |
|--------|--------|----------|--------------|-------------|--------|
| **Identity** | users, roles, permissions | 3 | 2 | 8 | 4 |
| **Catalog** | products, categories, variants | 4 | 3 | 6 | 3 |
| **Ordering** | carts, orders, items | 4 | 3 | 10 | 5 |
| **Payment** | payments, invoices, methods | 3 | 2 | 6 | 3 |
| **Shipping** | shipments, tracking | 2 | 2 | 4 | 2 |
| **Vendor** | vendors, staff | 2 | 2 | 5 | 2 |

### **Data Flow Example: User Login**

```
User submits login form
    ↓
POST /api/v1/auth/login (routes/v1/auth.js)
    ↓
authController.login() (controllers/v1/auth/...)
    ↓
1. Validate request (validators/auth.js)
2. Call AuthenticationService.login(email, password)
3. Service queries UserRepository.findByEmail()
4. Service compares password with Argon2
5. Service generates JWT with user claims
6. Set httpOnly cookie with token
7. Return {success: true, user: {...}}
    ↓
Response sent to client with authentication cookie
    ↓
Subsequent requests
    ↓
authMiddleware extracts JWT from Authorization header or token/access_token cookie
    ↓
verifyToken() checks signature, expiration, blacklist
    ↓
protect()/auth middleware sets req.user from JWT claims
    ↓
Controller receives authenticated user without DB query (N+1 prevention)
```

### **Request Processing: Create Product (Vendor)**

```
POST /api/v1/catalog/products
    ↓
Route matched (routes/v1/catalog.js)
    ↓
1. validateRequest middleware - validate body schema
2. requireAuth decorator - verify JWT
3. checkRole decorator - verify vendor role
    ↓
catalogController.createProduct() called
    ↓
1. Extract & sanitize request data
2. Call ProductService.createProduct()
3. Service enforces business rules:
   - Vendor can only create own products
   - Product must have at least 1 variant
   - Pricing must be positive
4. Service calls ProductRepository.create()
5. Repository executes INSERT via connection pool
6. RLS policy enforces tenant_id matching
7. Trigger sets created_at timestamp
    ↓
Domain event fired: ProductCreatedEvent
    ↓
Subscribers handle:
- Index product in search engine
- Clear category cache
- Notify affiliated users
    ↓
Service returns created Product entity
    ↓
Controller serializes to JSON
    ↓
cacheMiddleware wraps response
    ↓
Response sent: {id, name, sku, price, ...}
```

---

## Performance Optimizations

### **N+1 Query Prevention**

1. **JWT Claims Caching (Sprint 1)** ✅
   - User data extracted from JWT (no DB query)
   - Eliminates user lookup per request
   - 10x auth latency improvement

2. **Repository Query Aggregation**
   - Use `JSON_AGG()` to load related data in single query
   - Get product + variants in 1 query instead of N+1

3. **Eager Loading**
   - Repositories load common relationships by default
   - Lazy loading only when explicitly requested

### **Caching Strategies**

1. **HTTP Cache Headers**
   - ETag & Last-Modified headers
   - 304 Not Modified responses
   - Reduces bandwidth

2. **Redis Caching**
   - Cache products (1 hour)
   - Cache permissions (30 minutes)
   - Cache exchange rates (15 minutes)
   - Cache user preferences (1 hour)

3. **In-Memory Cache**
   - LRU cache for hot data
   - Shared across requests
   - Invalidated strategically

### **Database Optimization**

1. **Indexes** (Strategic)
   - (email) - Fast login
   - (user_id, status) - Order queries
   - (vendor_id) - Vendor products
   - GIST indexes on LTREE paths - Category hierarchy

2. **Row-Level Security (RLS)**
   - Database enforces tenant isolation
   - No application-level filtering needed
   - Automatic for all queries

3. **Connection Pooling**
   - Min 10, max 20 connections
   - Reuse connections
   - Timeout idle connections

---

## Deployment Architecture

### **Scaling Topology (Full App)**

```
Internet
    ↓
Load Balancer / Edge Proxy
    ↓
┌──────────────────────────────┐
│ Gateway Tier
│ ├─ gateway-1 (NGINX host/path routing)
│ └─ gateway-N (optional horizontal scale)
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│ Frontend Tier
│ ├─ client-1 (React static assets)
│ └─ client-N (optional CDN/object storage backed)
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│ API/App Tier (Auto-scale)
│ ├─ server-1 (Node.js/Express)
│ ├─ server-2 (Node.js/Express)
│ └─ server-N (Node.js/Express)
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│ Worker Tier
│ ├─ worker-1 (queue processor)
│ └─ worker-N (optional horizontal workers)
└──────────────────────────────┘
         ↓
┌──────────────────────────────┐
│ Shared Services
│ ├─ PostgreSQL (RDS)
│ ├─ Redis (ElastiCache)
│ └─ S3 (file storage)
└──────────────────────────────┘
```

### **Environment Variables** (`.env`)

**Core runtime & URLs:**
- `NODE_ENV` - Environment (production/test/development)
- `PORT` - Backend server port
- `APP_URL` - Primary app origin (typically gateway URL)
- `FRONTEND_URL` - Frontend canonical URL

**CORS / browser surface controls:**
- `ALLOWED_ORIGINS` - Comma-separated trusted browser origins

**Database:**
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `DB_SSL_CA`, `DB_SSL_CERT`, `DB_SSL_KEY` (for managed TLS database connections)

**Cache/session/queue:**
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`

**Authentication/security:**
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `SESSION_SECRET`

**Integrations:**
- `STRIPE_SECRET_KEY`, `PAYSTACK_SECRET_KEY`
- `EASYSHIP_API_KEY`

---

## Conclusion

This fullstack platform implements enterprise-grade architecture through:

✅ **Domain-Driven Design** - Business logic organized by domain  
✅ **Clean Architecture** - Clear separation of concerns  
✅ **Middleware Pattern** - Reusable cross-cutting logic  
✅ **Repository Pattern** - Data access abstraction  
✅ **Multi-Tenancy** - Tenant isolation via RLS  
✅ **Guest Checkout** - Support unauthenticated users  
✅ **Dual Admin Surfaces** - CSR admin routes + SSR admin subdomain  
✅ **Security First** - JWT/cookie auth, RBAC, CSRF protection  
✅ **Performance** - Caching, connection pooling, N+1 prevention  
✅ **Observability** - Logging, metrics, correlation IDs  
✅ **Testability** - Unit, integration, E2E test suites

**Implementation Scope:** Client + gateway + API + worker + data infrastructure organized into cohesive layers and domains, enabling scalability, maintainability, and future growth.

---

**Document Version:** 1.1  
**Last Updated:** 2026-07-21  
**Maintained By:** Development Team
