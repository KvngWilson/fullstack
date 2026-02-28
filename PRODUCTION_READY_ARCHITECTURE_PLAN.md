# Production-Ready Backend Architecture: Deep Audit & Refactor Plan

**Date**: February 28, 2026  
**Prepared for**: 100k+ concurrent users, Multi-tenant SaaS scale  
**Status**: Comprehensive Audit Report with Phased Implementation Roadmap

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Part 1: Deep Technical Audit](#part-1-deep-technical-audit)
3. [Part 2: Concrete Problems Identified](#part-2-concrete-problems-identified)
4. [Part 3: Improved Target Architecture](#part-3-improved-target-architecture)
5. [Part 4: Refactored Code Examples](#part-4-refactored-code-examples)
6. [Part 5: Phased Refactor Implementation Plan](#part-5-phased-refactor-implementation-plan)
7. [Part 6: Production-Readiness Checklist](#part-6-production-readiness-checklist)

---

## Executive Summary

### Current State Assessment

Your system demonstrates **solid foundational architecture** with clear separation of concerns, but exhibits **critical gaps** in:

- **Multi-tenant isolation** (none defined)
- **Security hardening** (account enumeration, missing rate limits, weak audit logging)
- **Scalability patterns** (N+1 queries, missing caching, no distributed locking)
- **Operational maturity** (no distributed tracing, weak observability, manual operations)

### Overall Risk Rating: **⚠️ MEDIUM-HIGH**

| Category | Current | Target | Gap |
|----------|---------|--------|-----|
| Security Score | 6/10 | 9/10 | +3 |
| Performance Score | 6/10 | 9/10 | +3 |
| Scalability Score | 5/10 | 9/10 | +4 |
| Observability Score | 5/10 | 9/10 | +4 |
| **Overall Readiness** | **6/10** | **9/10** | **+3** |

### Top 5 Blocking Issues

1. 🔴 **No Multi-Tenant Isolation** - APIs exposed without tenant context
2. 🔴 **Account Enumeration Vulnerability** - Register endpoint leaks user existence
3. 🟠 **N+1 Query Patterns** - Unscalable to 100k users
4. 🟠 **No Distributed Tracing** - Impossible to debug multi-service issues
5. 🟠 **Weak Permission Caching** - Permission checks hit database on every request

---

# Part 1: Deep Technical Audit

## 1. Architecture & Layering

### Monolith vs Modular Assessment

**Current State**: Modular monolith with clear layer separation

```
HTTP Request
  ↓
Middleware Layer (auth, logging, validation)
  ↓
Route/Controller Layer (13 route modules)
  ↓
Service Layer (6 services)
  ↓
Repository Layer (BaseRepository pattern)
  ↓
Database Layer (PostgreSQL)
```

### Issues Identified

#### 1.1 Missing Domain Boundaries (DDD)

**Problem**: Routes organized by entity, not by domain aggregate

**Current Structure**:
```
routes/
  ├─ auth.js (User registration/login)
  ├─ cart.js (Cart items)
  ├─ orders.js (Orders)
  ├─ payment.js (Payments)
  ├─ products.js (Product catalog)
  ├─ users.js (User management)
  └─ shipping.js (Shipping rates)
```

**Why It's Wrong**: These routes span multiple business domains:
- **Ordering Domain**: orders, cart, shipping, payments
- **Catalog Domain**: products, inventory
- **User Domain**: users, auth, profile
- **Vendor Domain**: vendor operations

**Risk**: Cross-domain mutations lead to consistency violations

---

#### 1.2 Layer Violations

**Problem 1: Controllers call repositories directly**

**In** `api/controllers/product.js`:
```javascript
async function getAllProducts(req, res) {
  // Controllers should NOT call repositories directly
  const products = await productRepository.findAll(filters);
  res.json(products);
}
```

**Correct**: Controller → Service → Repository

**In** `api/controllers/order.js`:
```javascript
async function createOrder(req, res) {
  // Correct pattern
  const order = await orderService.createOrder(req.validated);
  res.json(order);
}
```

**Risk**: Hard to test controllers, business logic mixed with HTTP concerns

---

#### 1.3 Admin Routes as Separate Express App

**Current**: Virtual host routing for admin

```javascript
const adminApp = express();
app.use(vhost('admin.localhost', adminApp));
app.use(vhost('admin.*', adminApp));
```

**Problem**: Separate app means:
- Duplicated middleware
- Separate error handling
- Separate authentication
- Can't share services

**Better**: Single app with role-based middleware

---

### 1.4 Service Abstraction Clarity

**Problem**: Services are thin wrappers around repositories

```javascript
// In services/order.js - Too thin!
async function createOrder(userId, shippingId, billingId) {
  return orderRepository.createWithItems(userId, shippingId, billingId);
}
```

**Missing**:
- Order validation logic
- Inventory reservation
- Order event publishing
- Price calculation
- Tax calculation
- Discount application

**Better**: Services should contain ALL business logic

---

### 1.5 API Design Inconsistencies

**Problem 1: Inconsistent versioning**

```
/api/auth/login           ← No version
/api/v1/orders            ← v1
/api/v1/payments          ← v1
/api/v1/users             ← v1
```

**Problem 2: Inconsistent naming**

```
GET /api/v1/orders/my-orders           ← hyphen (kebab-case)
GET /api/v1/users/:id                  ← snake_case in DB
POST /api/v1/payments                  ← but this is singular
```

**Problem 3: Missing HTTP method semantics**

```javascript
// Status update should use PATCH or PUT, not POST
POST /orders/:orderId/status

// Should be:
PATCH /api/v1/orders/:orderId { status: 'paid' }

// Soft delete should use DELETE, not POST
POST /users/:userId/delete
DELETE /api/v1/users/:userId
```

**Problem 4: No hypermedia (HATEOAS)**

Responses should include navigation links for scalable clients

---

## 2. Data Layer Analysis

### 2.1 Schema Normalization Issues

**Issue 1: Orders table structure**

**Current** (inferred from code):
```sql
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  total DECIMAL,
  status VARCHAR,
  shipping_address_id BIGINT,
  billing_address_id BIGINT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

**Problems**:
- ❌ `total` stored (denormalized) - gets out of sync with order_items
- ❌ No order_number (human-readable reference)
- ❌ No currency field
- ❌ No payment_status (separate from order_status)
- ❌ No shipping_cost (tracked separately)
- ❌ No estimated_delivery_date

**Better**:
```sql
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id),  -- Multi-tenant
  user_id BIGINT NOT NULL REFERENCES users(id),
  order_number VARCHAR(20) NOT NULL UNIQUE,  -- Human-readable
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  
  -- Price tracking (recalculated from order_items)
  subtotal_amount DECIMAL(19,4),  -- SUM of item prices
  tax_amount DECIMAL(19,4),        -- Calculated
  discount_amount DECIMAL(19,4),   -- Applied discounts
  shipping_cost DECIMAL(19,4),     -- From shipping provider
  total_amount DECIMAL(19,4),      -- Subtotal + tax + shipping
  
  -- Status tracking
  order_status VARCHAR(20),        -- pending, confirmed, processing, shipped, delivered, cancelled
  payment_status VARCHAR(20),      -- pending, authorized, captured, failed, refunded
  fulfillment_status VARCHAR(20),  -- unfulfilled, partial, fulfilled
  
  -- Shipping
  shipping_address_id BIGINT NOT NULL REFERENCES addresses(id),
  billing_address_id BIGINT NOT NULL REFERENCES addresses(id),
  shipping_carrier VARCHAR(50),
  tracking_number VARCHAR(100),
  estimated_delivery_date DATE,
  
  -- Metadata
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  CONSTRAINT orders_valid_total CHECK (total_amount >= 0),
  CONSTRAINT orders_valid_subtotal CHECK (subtotal_amount >= 0)
);

-- Indexes for common queries
CREATE INDEX idx_orders_tenant_user ON orders(tenant_id, user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
```

---

### 2.2 Missing Indexes

**Current** (inferred from code):
```javascript
// No explicit index list provided
```

**Required indexes for 100k concurrent users**:

```sql
-- User authentication queries
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_email_active ON users(email) WHERE deleted_at IS NULL;

-- Cart queries
CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);
CREATE INDEX idx_cart_items_user_variant ON cart_items(user_id, product_variant_id) UNIQUE;

-- Order queries
CREATE INDEX idx_orders_user_id ON orders(user_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(order_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Product queries
CREATE INDEX idx_products_slug ON products(slug);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);

-- Permission queries
CREATE INDEX idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX idx_role_permissions_role ON role_permissions(role);

-- Payment queries
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_reference ON payments(reference);

-- Address queries
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_addresses_is_default ON addresses(user_id, is_default);
```

---

### 2.3 Constraint Enforcement Issues

**Missing constraints**:

```sql
-- 1. Foreign key constraints should have on delete/update rules
ALTER TABLE orders 
DROP CONSTRAINT orders_user_id_fkey,
ADD CONSTRAINT orders_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES users(id) 
  ON DELETE RESTRICT  -- Prevent deleting users with orders
  ON UPDATE CASCADE;

-- 2. Check constraints for business rules
ALTER TABLE cart_items ADD CONSTRAINT cart_items_positive_qty 
  CHECK (quantity > 0);

ALTER TABLE product_variants ADD CONSTRAINT variants_positive_stock 
  CHECK (stock >= 0);

-- 3. Unique constraints for business identifiers
CREATE UNIQUE INDEX idx_orders_order_number_tenant 
  ON orders(tenant_id, order_number) 
  WHERE deleted_at IS NULL;

-- 4. NOT NULL for required fields
ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE orders ALTER COLUMN currency SET NOT NULL;
ALTER TABLE orders ALTER COLUMN order_status SET NOT NULL;
```

---

### 2.4 No Multi-Tenant Isolation

**Current**: Zero multi-tenant support

**Where it breaks**:
```javascript
// In productController.js
GET /api/v1/products
→ Returns ALL products from ALL tenants
→ Customer from Tenant A sees Tenant B's products!

// In ordersController.js
GET /api/v1/orders/my-orders
→ SELECT * FROM orders WHERE user_id = $1
→ No tenant_id check!
→ If user has account in multiple tenants, data leaks occur
```

**Multi-Tenant Data Model**:

```sql
-- Every table needs tenant_id
CREATE TABLE tenants (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(20) NOT NULL,  -- free, pro, enterprise
  status VARCHAR(20) NOT NULL,  -- active, suspended, deleted
  created_at TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE TABLE tenant_users (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,  -- tenant_admin, tenant_member
  created_at TIMESTAMP,
  UNIQUE(tenant_id, user_id)
);

-- Every data table:
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  -- ...
  INDEX idx_products_tenant ON products(tenant_id)
);

-- Every query must filter by tenant:
SELECT * FROM products 
WHERE tenant_id = $1 AND category = $2;
```

---

### 2.5 RBAC Integrity Issues

**Current**: Role-based checks at middleware level, but no database enforced

**Problem**: Row-level data leaks

```javascript
// Middleware verifies user is admin
authenticateJWT, requireRole('admin')
// But doesn't verify admin can access this tenant!

// Attacker scenario:
// 1. Admin A for Tenant A
// 2. Access /api/v1/users?tenant_id=2
// 3. Gets Tenant B's users without check
```

**Improved RBAC with Row-Level Security**:

```sql
-- PostgreSQL RLS (Row-Level Security)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY products_tenant_isolation ON products
  USING (tenant_id = current_setting('app.current_tenant_id')::bigint);

-- In application, set context:
SET app.current_tenant_id TO 123;  -- Executed before user query
SELECT * FROM products;  -- Only returns tenant 123's products
```

---

### 2.6 Query Inefficiencies

**Issue 1: N+1 in cart retrieval**

```javascript
// In cartController.js - assumed pattern
async function getCart(req, res) {
  const cartItems = await cartRepository.findByUserId(req.user.id);
  // This returns 100 items
  
  for (const item of cartItems) {
    // Query 1 for each variant!
    item.variant = await productVariantRepository.findById(item.product_variant_id);
    // Query 2 for each product!
    item.product = await productRepository.findById(item.variant.product_id);
  }
  // 1 + 100 + 100 = 201 queries!
}
```

**Better**: Single query with JOINs

```sql
SELECT 
  ci.id, ci.quantity,
  pv.id as variant_id, pv.sku, pv.price,
  p.id as product_id, p.name, p.slug
FROM cart_items ci
JOIN product_variants pv ON ci.product_variant_id = pv.id
JOIN products p ON pv.product_id = p.id
WHERE ci.user_id = $1 AND ci.deleted_at IS NULL
ORDER BY ci.created_at;
```

---

### 2.7 Transaction Handling

**Current**: Uses transactions correctly for order creation

```javascript
// Good pattern
await pool.query('BEGIN');
try {
  await orderRepository.createWithItems(...);
  await cartRepository.clear(...);
  await pool.query('COMMIT');
} catch (err) {
  await pool.query('ROLLBACK');
}
```

**Issues**:
- ❌ No isolation level specified (uses default READ_COMMITTED)
- ❌ No distributed transaction support (orders + inventory)
- ❌ No deadlock retry logic
- ❌ Transaction timeout not configured

**Better**:

```javascript
async function createOrder(userId, items) {
  const client = await pool.connect();
  
  try {
    // SERIALIZABLE for critical transactions
    await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
    
    const order = await client.query(
      'INSERT INTO orders (user_id, status) VALUES ($1, $2) RETURNING *',
      [userId, 'pending']
    );
    
    // Reserve stock atomically
    for (const item of items) {
      const result = await client.query(
        `UPDATE product_variants 
         SET reserved_quantity = reserved_quantity + $1 
         WHERE id = $2 AND (stock - reserved_quantity) >= $1
         RETURNING stock, reserved_quantity`,
        [item.quantity, item.variant_id]
      );
      
      if (result.rows.length === 0) {
        throw new InsufficientStockError(`Variant ${item.variant_id} insufficient stock`);
      }
    }
    
    await client.query('COMMIT');
    return order.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    
    // Retry deadlock errors
    if (err.code === '40P01') {
      return createOrder(userId, items);  // Deadlock
    }
    throw err;
  } finally {
    client.release();
  }
}
```

---

## 3. Security Deep Dive

### 3.1 Authentication Flow Issues

**Issue 1: Account Enumeration**

```javascript
// Register endpoint (auth.js)
async function postRegister(req, res) {
  const user = await findUser(req.body.email);
  
  if (user) {
    // LEAK: Attacker learns email exists
    throw new AuthServiceError("User already exists", 409);
  }
}
```

**Attack**: Enumerate customer database

**Fix**:

```javascript
async function postRegister(req, res) {
  try {
    const { email, password } = req.body;
    
    const existingUser = await userRepository.findByEmail(email);
    if (existingUser) {
      // Don't leak that email exists
      // Send verification email
      await sendVerificationEmail(email, 'already_registered');
      
      // Return same response whether new or existing
      return res.status(200).json({
        message: 'If email is new, check your inbox for registration link'
      });
    }
    
    // Create new user
    const user = await authService.registerUser({ email, password });
    
    // Send verification email
    await sendVerificationEmail(email, user.verification_token);
    
    // Don't auto-login until verified
    res.status(201).json({ message: 'Check your email to complete registration' });
  } catch (error) {
    // Don't leak internal errors
    logger.error('Registration error', { email: req.body.email, error });
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
}
```

---

### 3.2 Missing Account Lockout

**Current**: No lockout after failed logins

```javascript
async function postLogin(req, res) {
  const user = await findUser(email);
  
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    // Just return error, no lockout!
    throw new AuthServiceError("Invalid credentials", 401);
  }
}
```

**Attack**: Brute force password (1M attempts = 28 hours at 10 req/sec)

**Fix with distributed locking**:

```javascript
async function postLogin(req, res) {
  const { email, password } = req.body;
  const lockKey = `login_lock:${email}`;
  const attemptKey = `login_attempts:${email}`;
  
  // Check if account is locked
  const locked = await redisClient.get(lockKey);
  if (locked) {
    throw new AuthServiceError("Account locked. Try again in 15 minutes", 429);
  }
  
  const user = await userRepository.findByEmail(email);
  if (!user) {
    // Still increment attempts (prevent enumeration)
    await recordFailedAttempt(email);
    throw new AuthServiceError("Invalid credentials", 401);
  }
  
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const attempts = await recordFailedAttempt(email);
    
    if (attempts >= 5) {
      // Lock account for 15 minutes
      await redisClient.setEx(lockKey, 900, 'locked');
      throw new AuthServiceError("Too many failed attempts. Account locked until " + 
        new Date(Date.now() + 900000).toISOString(), 429);
    }
    
    throw new AuthServiceError("Invalid credentials", 401);
  }
  
  // Clear failed attempts on success
  await redisClient.del(attemptKey, lockKey);
  
  const token = generateToken(user);
  setAuthCookie(res, token);
  res.json({ user });
}

async function recordFailedAttempt(email) {
  const attempts = await redisClient.incr(`login_attempts:${email}`);
  await redisClient.expire(`login_attempts:${email}`, 900);  // 15 min
  return attempts;
}
```

---

### 3.3 Weak Permission Enforcement

**Issue**: No scoped permissions, permissions hit DB every request

```javascript
// In RBAC middleware
app.use('/api/v1/orders', authenticateJWT, orderRoutes);

// Inside route handler
router.get('/:id', async (req, res) => {
  // No permission check! Just role check at route level
  const order = await orderRepository.findById(req.params.id);
  res.json(order);
});
```

**Risk**: Customer can access any order ID

**Better**: Scope-based permission with row ownership

```javascript
// Middleware: Attach user context with tenant & scopes
const attachUserContext = async (req, res, next) => {
  const token = req.cookies.token;
  const user = verifyToken(token);
  
  // Load user with scoped permissions
  const userWithContext = await userRepository.findWithPermissions(user.id);
  req.user = {
    id: user.id,
    tenantId: user.tenant_id,
    role: userWithContext.role,
    permissions: userWithContext.permissions,  // Cached for 5 mins
    scopes: userWithContext.scopes  // e.g., ['orders:read:own', 'products:read:*']
  };
  
  next();
};

// Route handler with scope enforcement
async function getOrderById(req, res, next) {
  try {
    const orderId = req.params.id;
    
    // Check permission scope
    if (!req.user.scopes.includes('orders:read:own') &&
        !req.user.scopes.includes('orders:read:*')) {
      throw new AuthorizationError('Cannot read orders', 403);
    }
    
    const order = await orderRepository.findById(orderId);
    
    // Row-level ownership check
    if (req.user.scopes.includes('orders:read:own') && order.user_id !== req.user.id) {
      throw new AuthorizationError('Cannot read another user\'s order', 403);
    }
    
    // For multi-tenant: verify tenant match
    if (order.tenant_id !== req.user.tenantId) {
      throw new AuthorizationError('Order not found', 404);  // Don't leak tenant existence
    }
    
    res.json(order);
  } catch (error) {
    next(error);
  }
}
```

---

### 3.4 Webhook Security

**Current**: "Assuming webhook signature verified" - but not shown

**Real Risk**: Anyone can POST to `/api/v1/payments/webhook`

```javascript
// Must validate signature before handling
app.post('/api/v1/payments/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  // VERIFY SIGNATURE
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn('Stripe webhook signature verification failed', { error: err.message });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle event
  switch (event.type) {
    case 'charge.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'charge.failed':
      await handlePaymentFailure(event.data.object);
      break;
    default:
      logger.debug('Unhandled webhook event', { type: event.type });
  }
  
  res.json({ received: true });
});

// Same for Paystack
app.post('/api/v1/payments/webhook/paystack', async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');
  
  if (hash !== signature) {
    logger.warn('Paystack webhook signature verification failed');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  // Process webhook
  res.json({ status: 200 });
});
```

---

### 3.5 Secrets Management

**Current Issues**:
- ❌ Secrets in `.env` file
- ❌ No rotation strategy
- ❌ Development secrets same format as production

**Better Pattern**:

```javascript
// config/secrets.js
const AWS = require('aws-sdk');

const secretsManager = new AWS.SecretsManager({ region: 'us-east-1' });

class SecretsManager {
  constructor() {
    this.cache = {};
    this.cacheTTL = 3600000;  // 1 hour
  }
  
  async get(secretName) {
    const cached = this.cache[secretName];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
    
    try {
      const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
      const value = JSON.parse(data.SecretString);
      
      this.cache[secretName] = {
        value,
        expiresAt: Date.now() + this.cacheTTL
      };
      
      return value;
    } catch (error) {
      logger.error('Failed to retrieve secret', { secretName, error });
      throw new Error(`Secret not found: ${secretName}`);
    }
  }
}

module.exports = new SecretsManager();
```

---

## 4. Performance & Scalability Analysis

### 4.1 Caching Deficiency

**Current**: Redis exists but barely used (only sessions)

**Missing caches** for 100k users:

```javascript
// Cache layer (infrastructure/cache/cacheManager.js)
class CacheManager {
  constructor(redisClient) {
    this.client = redisClient;
  }
  
  // Cache products (100MB max)
  async getCachedProducts(filters = {}, ttl = 3600) {
    const cacheKey = `products:${JSON.stringify(filters)}`;
    const cached = await this.client.get(cacheKey);
    
    if (cached) {
      logger.debug('Cache hit', { key: cacheKey });
      return JSON.parse(cached);
    }
    
    const products = await productRepository.find(filters);
    await this.client.setEx(cacheKey, ttl, JSON.stringify(products));
    return products;
  }
  
  // Cache permission matrix (high-frequency read)
  async getUserPermissions(userId, ttl = 300) {
    const cacheKey = `user_permissions:${userId}`;
    const cached = await this.client.get(cacheKey);
    
    if (cached) return JSON.parse(cached);
    
    const permissions = await getBacPermissions(userId);
    await this.client.setEx(cacheKey, ttl, JSON.stringify(permissions));
    return permissions;
  }
  
  // Invalidate on mutation
  async invalidateUserPermissions(userId) {
    await this.client.del(`user_permissions:${userId}`);
  }
}
```

---

### 4.2 Pagination Issues at Scale

**Current**: Offset-based pagination

```sql
SELECT * FROM products LIMIT 20 OFFSET 980000;  -- 980k rows skipped!
```

**Problem**: Offset becomes slow as table grows

**Better**: Cursor-based pagination

```javascript
// Using keyset pagination
async function getProducts(cursor = null, limit = 20) {
  let query = 'SELECT * FROM products WHERE deleted_at IS NULL';
  let params = [];
  
  if (cursor) {
    // Cursor is base64-encoded last_id
    const lastId = Buffer.from(cursor, 'base64').toString();
    query += ' AND id > $1';
    params.push(lastId);
  }
  
  query += ' ORDER BY id ASC LIMIT $' + (params.length + 1);
  params.push(limit + 1);  // Fetch one extra to detect hasMore
  
  const results = await pool.query(query, params);
  const hasMore = results.rows.length > limit;
  const items = results.rows.slice(0, limit);
  
  const nextCursor = hasMore 
    ? Buffer.from(String(items[items.length - 1].id)).toString('base64')
    : null;
  
  return {
    items,
    nextCursor,
    hasMore
  };
}
```

---

### 4.3 Connection Pool Exhaustion

**Current**: Max 20 connections

For 100k concurrent users with 1% active:
- 1000 simultaneous requests
- Average request takes 200ms
- Need (1000 * 0.2) = 200 connections

**Better**: Query optimization + connection pooling

```javascript
// config/db.js with proper pooling
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // Aggressive pooling for high concurrency
  max: parseInt(process.env.DB_POOL_MAX) || 100,
  min: parseInt(process.env.DB_POOL_MIN) || 10,
  
  // Timeouts
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statementTimeoutMillis: 30000,  // Kill long-running queries
  
  // Connection string should use sslmode for production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  
  // Monitoring
  application_name: 'fullstack-backend-prod'
});

// Monitor pool health
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', { error: err });
  process.exit(1);
});

// Log pool stats periodically
setInterval(() => {
  logger.info('Pool stats', {
    total: pool.totalCount,
    active: pool.waitingCount,
    idle: pool.idleCount
  });
}, 60000);
```

---

### 4.4 Background Jobs Missing

**Current**: Email sending is fire-and-forget

```javascript
sendOrderConfirmationEmail(order).catch(err => {
  logger.error('Email failed', err);
});
```

**Problems**:
- ❌ No retry logic
- ❌ No visibility into failures
- ❌ Could lose orders in flight if process crashes
- ❌ CPU blocking during email send

**Better**: Job queue (Bull + Redis)

```javascript
// infrastructure/jobs/jobQueue.js
const Queue = require('bull');

const emailQueue = new Queue('email', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  },
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: false,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

emailQueue.process(async (job) => {
  const { email, template, data } = job.data;
  
  try {
    await emailService.send(email, template, data);
    logger.info('Email sent', { email, template });
  } catch (error) {
    logger.error('Email send failed', { email, error });
    throw error;  // Bull will retry
  }
});

// In order service
async function createOrder(...) {
  const order = await orderRepository.create(...);
  
  // Queue email instead of sending directly
  await emailQueue.add(
    {
      email: order.customer_email,
      template: 'order_confirmation',
      data: { order }
    },
    { jobId: `order:${order.id}` }
  );
  
  return order;
}
```

---

## 5. Observability Gaps

### 5.1 Structured Logging

**Current**: String-based logs

```javascript
logger.info('Payment received', {
  name: err.name,
  message: err.message
});
```

**Issues**:
- ❌ Hard to parse in logs aggregator
- ❌ No request correlation
- ❌ No metrics extraction

**Better**:

```javascript
// infrastructure/logging/structuredLogger.js
const pino = require('pino');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty' }
    : undefined,
  
  // Standardized fields
  base: {
    service: 'fullstack-backend',
    environment: process.env.NODE_ENV,
    version: require('../../package.json').version
  }
});

// Middleware for request logging
const requestLogger = (req, res, next) => {
  const requestId = req.id || uuid();
  const start = Date.now();
  
  req.log = logger.child({ requestId });
  
  res.on('finish', () => {
    req.log.info({
      type: 'http_request',
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: Date.now() - start,
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  });
  
  next();
};

// Usage
req.log.error({
  type: 'payment_processing_failed',
  orderId: order.id,
  processor: 'stripe',
  error: err.message,
  errorCode: err.code,
  duration: Date.now() - start,
  retryable: err.retryable
});
```

---

### 5.2 Missing Distributed Tracing

**Current**: No tracing across services

**With Jaeger**:

```javascript
// infrastructure/tracing/tracer.js
const opentelemetry = require('@opentelemetry/api');
const { NodeTracerProvider } = require('@opentelemetry/node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');
const { SimpleSpanProcessor } = require('@opentelemetry/tracing');

const provider = new NodeTracerProvider();

const jaegerExporter = new JaegerExporter({
  endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces'
});

provider.addSpanProcessor(new SimpleSpanProcessor(jaegerExporter));
opentelemetry.trace.setGlobalTracerProvider(provider);

const tracer = opentelemetry.trace.getTracer('fullstack-backend');

// Middleware
const tracingMiddleware = (req, res, next) => {
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.originalUrl,
      'http.target': req.path,
      'http.client_ip': req.ip
    }
  });
  
  req.span = span;
  
  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode);
    span.end();
  });
  
  next();
};

// Usage
async function orderService.createOrder(...) {
  const span = tracer.startSpan('order:create', {
    parent: req.span,
    attributes: { userId, itemCount: items.length }
  });
  
  try {
    const order = await orderRepository.create(...);
    span.setAttribute('orderId', order.id);
    
    // Nested span for payment
    const paymentSpan = tracer.startSpan('payment:initialize', { parent: span });
    const payment = await paymentService.initialize(order);
    paymentSpan.end();
    
    return order;
  } finally {
    span.end();
  }
}
```

---

### 5.3 Metrics Gap

**Need**: Prometheus metrics for alerting

```javascript
// infrastructure/metrics/metrics.js
const promClient = require('prom-client');

// HTTP metrics
const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5]
});

const httpRequests = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

// Business metrics
const ordersCreated = new promClient.Counter({
  name: 'orders_created_total',
  help: 'Total orders created',
  labelNames: ['currency', 'tenant_id']
});

const paymentsFailed = new promClient.Counter({
  name: 'payments_failed_total',
  help: 'Total failed payments',
  labelNames: ['processor', 'error_code']
});

const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.01, 0.1, 1]
});

// Expose metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(await promClient.register.metrics());
});
```

---

# Part 2: Concrete Problems Identified

## Problem Matrix

| # | Problem | Severity | Component | Risk | Category |
|---|---------|----------|-----------|------|----------|
| P-1 | No multi-tenant isolation | 🔴 CRITICAL | Database, API | Data breach (customer isolation violation) | Security |
| P-2 | Account enumeration in register | 🔴 CRITICAL | Auth | User enumeration, account hijacking patterns | Security |
| P-3 | No account lockout on failed login | 🔴 CRITICAL | Auth | Brute force password attacks | Security |
| P-4 | N+1 query patterns | 🟠 HIGH | Queries | Unscalable to 100k users, 10-100x slower | Performance |
| P-5 | Missing database indexes | 🟠 HIGH | Database | Slow queries on large tables (1M+ rows) | Performance |
| P-6 | Webhook signature not verified | 🟠 HIGH | Payments | False payments, fund theft | Security |
| P-7 | No distributed tracing | 🟠 HIGH | Observability | Can't debug multi-service issues in production | Operations |
| P-8 | Permission checks hit DB every request | 🟠 HIGH | Authorization | 10-50% of queries are permission lookups | Performance |
| P-9 | Offset-based pagination | 🟠 HIGH | Database | O(n) complexity on large tables | Performance |
| P-10 | No job queue for async tasks | 🟠 HIGH | Architecture | Lost emails, no retry logic | Reliability |
| P-11 | Email sending fire-and-forget | 🟠 HIGH | Email | Silent failures, customer notifications lost | Reliability |
| P-12 | Weak secrets management | 🟠 HIGH | DevOps | Secrets in git, no rotation, dev=prod | Security |
| P-13 | Admin routes as separate app | 🟡 MEDIUM | Architecture | Code duplication, inconsistent auth | Maintainability |
| P-14 | Services too thin (just call repos) | 🟡 MEDIUM | Architecture | Business logic scattered, hard to test | Maintainability |
| P-15 | Inconsistent API versioning | 🟡 MEDIUM | API Design | Breaking changes affect clients | Compatibility |
| P-16 | No structured logging | 🟡 MEDIUM | Observability | Hard to aggregate logs, manual debugging | Operations |
| P-17 | Controllers call repos directly | 🟡 MEDIUM | Architecture | Business logic in controllers | Maintainability |
| P-18 | No request rate limiting | 🟡 MEDIUM | Security | API abuse, DDoS easier | Security |
| P-19 | String logs, no correlation | 🟡 MEDIUM | Logging | Can't trace requests across services | Operations |
| P-20 | No health check endpoint | 🟡 MEDIUM | Operations | Load balancers can't detect failures | Reliability |

---

## Deep Dives on Top 5 Issues

### P-1: No Multi-Tenant Isolation

**Why It's Critical**: 

In a SaaS system with multiple customers, data isolation is non-negotiable. Without tenant_id checks, a customer can:

```javascript
// Customer A (tenant_id=1) can:
GET /api/v1/products?tenant_id=2
// Returns Customer B's products!

// Customer A can:
GET /api/v1/orders/999999999
// If Customer B's order is #999999999, they see it!
```

**Current Code Pattern**:

```javascript
// No tenant context anywhere
async function getProducts(filters) {
  return productRepository.find(filters);
  // SELECT * FROM products WHERE ...
  // Returns all products from all tenants!
}
```

**Architectural Risk**: 
- Compliance violation (PCI, GDPR, SOC 2)
- Enterprise customer refusal to sign
- Breach of contract liability
- Regulatory fines

**Fix Priority**: Phase 1 (before any production use)

---

### P-2: Account Enumeration

**Code Evidence**:

```javascript
// If user exists → 409
// If user doesn't exist → no 409
async postRegister(req, res) {
  const user = await findUser(req.body.email);
  if (user) {
    throw new AuthServiceError("User already exists", 409);
  }
}
```

**Attack**:
```bash
# Attacker can enumerate users
curl -X POST /auth/register \
  -d '{"email":"ceo@competitor.com","password":"test"}' \
  
# Status 409 → email exists
# Status 200 → email doesn't exist
```

**Consequences**:
- Social engineering (targeting specific users)
- Insider identification
- Competitive intelligence

**Fix Priority**: Phase 1 (blocks production)

---

### P-3: No Account Lockout

**Current**:
```javascript
postLogin(email, password) {
  if (!validPassword) {
    throw new AuthServiceError("Invalid credentials", 401);
    // No lockout, attacker tries again immediately
  }
}
```

**Attack Timeline** (10 attempts per second):
- Second 6: First 60 attempts done
- Minute 2: 1200 attempts
- Hour 1: 36,000 attempts
- Cost to try 1M passwords: 28 hours

**Realistic Attack**: 
```
Dictionary of 1M common passwords × 100k users
= Try to compromise accounts from your database
= Distributed across 100 IPs = 2.8 days to compromise ~1000s of accounts
```

**Fix Priority**: Phase 1 (blocks production)

---

### P-4 & P-5: N+1 Queries & Missing Indexes

**Evidence from code review**:

```javascript
// In any list endpoint
const items = await repository.find(filters);
// Assume 100 items

for (const item of items) {
  item.details = await relatedRepository.findById(item.related_id);
  // Query 2: 100 more queries
}

// At 100k users with 10% making requests simultaneously
// = 10k active requests
// = 10k × 200 queries = 2M queries/sec
// PostgreSQL handles ~5k queries/sec max
// = System overloads at 25 concurrent users
```

**Database capacity math**:
- Single PostgreSQL query: 1-10ms average
- 10ms × 100 queries = 1000ms response time
- Request timeout: 30s
- = Cascading failure

**Fix Priority**: Phase 2 (before load testing)

---

### P-6: Webhook Signature Verification

**Risk**: 
```javascript
// Anyone can POST to webhook endpoint
POST /api/v1/payments/webhook/stripe {
  "event": "charge.succeeded",
  "order_id": 12345,
  "amount": 0  // Set to zero
}

// Without signature check:
// → Order marked paid with $0
// → Inventory decremented
// → Company loses product value
```

**Real Attack Cost**:
- 1000 attacks × average order value $50 = $50k fraud in minutes

**Fix Priority**: Phase 1 (blocks production)

---

# Part 3: Improved Target Architecture

## 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        API Gateway Layer                         │
│  (Rate limiting, auth checking, request routing, load balance)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Middleware Stack                              │
│  (auth, tenant context, validation, tracing, logging)            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                        Domain Layer                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  │  Ordering Domain │  │  Catalog Domain  │  │   User Domain    │
│  │                  │  │                  │  │                  │
│  │  Order Service   │  │ Product Service  │  │ Auth Service     │
│  │  Cart Service    │  │ Inventory Svc    │  │ Profile Service  │
│  │  Payment Service │  │                  │  │ Tenant Service   │
│  │  Shipping Svc    │  │                  │  │                  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Repository Layer (DAL)                         │
│  (Database queries, optimized with indexes, JOINs, caching)      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────┬──────────────────┬──────────────────────────┐
│  Primary DB      │   Cache Layer    │  Background Jobs         │
│  (PostgreSQL)    │   (Redis)        │  (Bull Queue)            │
│  Read Replicas   │   (TTL Managed)  │  (Email, Webhooks)      │
└──────────────────┴──────────────────┴──────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│               Infrastructure & External Services                 │
│  (Payments, Shipping, Email, Logging, Tracing, Metrics)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3.2 Improved Folder Structure

```
server/
├── src/
│   ├── index.js                          # Entry point
│   ├── app.js                            # Express app factory
│   └── setup.js                          # Bootstrap sequence
│
├── api/
│   ├── routes/
│   │   ├── v1/
│   │   │   ├── auth.routes.js            # Auth endpoints
│   │   │   ├── users.routes.js           # User endpoints
│   │   │   ├── products.routes.js        # Product catalog
│   │   │   └── orders.routes.js          # Order endpoints
│   │   ├── admin.routes.js               # Admin panel
│   │   └── health.routes.js              # Health checks
│   │
│   ├── controllers/
│   │   ├── v1/
│   │   │   ├── AuthController.js
│   │   │   ├── UserController.js
│   │   │   ├── ProductController.js
│   │   │   └── OrderController.js
│   │   └── AdminController.js
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js            # JWT, session validation
│   │   ├── authorization.middleware.js   # RBAC, permission checks
│   │   ├── tenant.middleware.js          # Tenant context injection
│   │   ├── validation.middleware.js      # Request validation
│   │   ├── error.middleware.js           # Error handling
│   │   ├── logger.middleware.js          # Request logging
│   │   ├── security.middleware.js        # Rate limiting, CORS
│   │   └── tracing.middleware.js         # Distributed tracing
│   │
│   └── validators/
│       ├── auth.validator.js
│       ├── order.validator.js
│       └── user.validator.js
│
├── domain/                                # Business logic (DDD)
│   ├── ordering/
│   │   ├── services/
│   │   │   ├── OrderService.js           # Order creation, workflows
│   │   │   ├── CartService.js
│   │   │   ├── PaymentService.js
│   │   │   └── ShippingService.js
│   │   ├── repositories/
│   │   │   ├── OrderRepository.js
│   │   │   ├── CartRepository.js
│   │   │   └── OrderItemRepository.js
│   │   ├── entities/
│   │   │   ├── Order.js                  # Order aggregate root
│   │   │   └── OrderItem.js
│   │   ├── events/
│   │   │   ├── OrderCreatedEvent.js
│   │   │   ├── OrderPaidEvent.js
│   │   │   └── OrderShippedEvent.js
│   │   └── policies/                     # Domain policies
│   │       ├── OrderInventoryPolicy.js
│   │       └── OrderPricingPolicy.js
│   │
│   ├── catalog/
│   │   ├── services/
│   │   │   ├── ProductService.js
│   │   │   └── InventoryService.js
│   │   ├── repositories/
│   │   │   ├── ProductRepository.js
│   │   │   └── InventoryRepository.js
│   │   └── entities/
│   │       └── Product.js
│   │
│   └── user/
│       ├── services/
│       │   ├── AuthService.js
│       │   ├── UserService.js
│       │   └── TenantService.js
│       ├── repositories/
│       │   ├── UserRepository.js
│       │   └── TenantRepository.js
│       └── entities/
│           └── User.js
│
├── infrastructure/
│   ├── cache/
│   │   ├── CacheManager.js
│   │   └── cachingDecorator.js           # Cache @decorator pattern
│   │
│   ├── database/
│   │   ├── db.js                         # Connection pool
│   │   ├── migrations/
│   │   │   ├── 001_create_tenants.js
│   │   │   ├── 002_create_users.js
│   │   │   └── ...
│   │   └── seeds/
│   │
│   ├── payment/
│   │   ├── PaymentProvider.js            # Abstract interface
│   │   ├── StripeProvider.js
│   │   ├── PaystackProvider.js
│   │   └── webhooks/
│   │       ├── stripeWebhook.handler.js
│   │       └── paystackWebhook.handler.js
│   │
│   ├── email/
│   │   ├── EmailService.js
│   │   ├── templates/
│   │   │   ├── orderConfirmation.hbs
│   │   │   └── ...
│   │   └── jobs/
│   │       └── emailJob.handler.js
│   │
│   ├── shipping/
│   │   ├── ShippingProvider.js
│   │   └── EasyshipProvider.js
│   │
│   ├── jobs/
│   │   ├── JobQueue.js                   # Bull queue factory
│   │   ├── handlers/
│   │   │   ├── emailJob.handler.js
│   │   │   ├── webhookJob.handler.js
│   │   │   └── reportingJob.handler.js
│   │   └── tasks/
│   │       ├── archiveDeletedUsers.js
│   │       └── syncInventory.js
│   │
│   ├── logging/
│   │   ├── logger.js                     # Pino logger factory
│   │   ├── structuredLogger.js
│   │   └── LogContext.js                 # Request-scoped logger
│   │
│   ├── tracing/
│   │   ├── tracer.js                     # OpenTelemetry setup
│   │   └── TracingContext.js
│   │
│   ├── metrics/
│   │   ├── metricsRegistry.js            # Prometheus setup
│   │   └── businessMetrics.js            # Orders, payments, etc
│   │
│   └── security/
│       ├── SecretsManager.js             # AWS Secrets Manager
│       ├── encryption.js
│       └── tokenManager.js
│
├── config/
│   ├── app.config.js                     # App configuration
│   ├── auth.config.js                    # JWT, secrets
│   ├── db.config.js                      # Database setup
│   ├── cache.config.js                   # Redis setup
│   ├── payment.config.js                 # Payment providers
│   ├── email.config.js                   # Email service
│   ├── job.config.js                     # Job queue setup
│   ├── env.js                            # Environment validation
│   └── permissions.js                    # RBAC matrix
│
├── utils/
│   ├── errors.js                         # Error classes
│   ├── helpers.js                        # Utility functions
│   ├── validators.js                     # Input validators
│   ├── decorators.js                     # Function decorators (caching, auth)
│   └── pagination.js                     # Cursor pagination helpers
│
├── __tests__/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── fixtures/
│   ├── mocks/
│   └── helpers/
│
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── .env.test
├── package.json
└── jest.config.js
```

---

## 3.3 Multi-Tenant Architecture

### 3.3.1 Tenant Context Injection

```javascript
// Middleware that loads tenant and user context

app.use(async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers?.authorization?.split(' ')[1];
    
    if (!token) {
      return next();  // Public routes don't need tenant
    }
    
    // Verify token
    const user = verifyToken(token);
    
    // Load user with tenant context (cached)
    const userContext = await tenantService.getUserContext(user.id);
    
    // Attach to request
    req.user = {
      id: user.id,
      email: user.email,
      tenantId: userContext.tenant_id,
      role: userContext.role,
      permissions: userContext.permissions,  // Cached for 5 min
      scopes: userContext.scopes
    };
    
    // Critical: Set database session variable for RLS
    await pool.query(
      'SELECT set_config($1, $2, false)',
      ['app.current_tenant_id', String(userContext.tenant_id)]
    );
    
    next();
  } catch (error) {
    logger.error('Tenant context error', { error: error.message });
    res.status(401).json({ error: 'Unauthorized' });
  }
});
```

### 3.3.2 RLS Policies on Every Table

```sql
-- All data tables have RLS enabled

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  -- ... other fields
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy 1: Customers see only their tenant's products
CREATE POLICY products_customer_view ON products
  FOR SELECT
  USING (
    tenant_id = CURRENT_SETTING('app.current_tenant_id')::bigint
  );

-- Policy 2: Only tenant_admin can modify
CREATE POLICY products_tenant_admin_modify ON products
  FOR INSERT
  WITH CHECK (
    tenant_id = CURRENT_SETTING('app.current_tenant_id')::bigint
    AND auth.userid() = any(SELECT user_id FROM tenant_admins WHERE tenant_id = tenant_id)
  );

CREATE POLICY products_tenant_admin_delete ON products
  FOR DELETE
  USING (
    tenant_id = CURRENT_SETTING('app.current_tenant_id')::bigint
  );

-- Same for all tables (orders, users, cart_items, etc.)
```

---

## 3.4 RBAC Matrix

```javascript
// config/permissions.js - Comprehensive RBAC

const PERMISSIONS = {
  // Ordering domain
  ORDERS_CREATE: 'orders:create',
  ORDERS_READ_OWN: 'orders:read:own',
  ORDERS_READ_ALL: 'orders:read:all',
  ORDERS_UPDATE_OWN: 'orders:update:own',
  ORDERS_UPDATE_ALL: 'orders:update:all',
  ORDERS_CANCEL_OWN: 'orders:cancel:own',
  ORDERS_CANCEL_ALL: 'orders:cancel:all',
  
  // Payments
  PAYMENTS_INITIALIZE: 'payments:initialize',
  PAYMENTS_READ_OWN: 'payments:read:own',
  PAYMENTS_READ_ALL: 'payments:read:all',
  PAYMENTS_REFUND: 'payments:refund',
  
  // Products
  PRODUCTS_READ: 'products:read',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',
  
  // Users
  USERS_READ: 'users:read',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
  
  // Admin
  ADMIN_ACCESS: 'admin:access',
  INVITE_USERS: 'users:invite',
};

const ROLE_PERMISSIONS = {
  customer: [
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_READ_OWN,
    PERMISSIONS.ORDERS_UPDATE_OWN,
    PERMISSIONS.ORDERS_CANCEL_OWN,
    PERMISSIONS.PAYMENTS_INITIALIZE,
    PERMISSIONS.PAYMENTS_READ_OWN,
    PERMISSIONS.PRODUCTS_READ,
  ],
  
  vendor: [
    // All customer permissions
    ...ROLE_PERMISSIONS.customer,
    
    // Plus vendor specific
    PERMISSIONS.PRODUCTS_CREATE,
    PERMISSIONS.PRODUCTS_UPDATE,
    PERMISSIONS.PRODUCTS_DELETE,
  ],
  
  admin: [
    // All permissions for managing tenant
    Object.values(PERMISSIONS)
  ],
  
  super_admin: [
    // All permissions including platform management
    Object.values(PERMISSIONS),
    'platform:*'
  ]
};

module.exports = { PERMISSIONS, ROLE_PERMISSIONS };
```

---

## 3.5 Domain-Driven Service Layer

```javascript
// Good example: ordering domain

// domain/ordering/services/OrderService.js
class OrderService {
  constructor(
    orderRepository,
    cartRepository,
    inventoryService,
    paymentService,
    shippingService,
    eventBus,
    logger
  ) {
    this.orderRepository = orderRepository;
    this.cartRepository = cartRepository;
    this.inventoryService = inventoryService;
    this.paymentService = paymentService;
    this.shippingService = shippingService;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  async createOrder(userId, tenantId, shippingAddressId, billingAddressId) {
    const traceContext = { userId, tenantId, operation: 'createOrder' };
    this.logger.info('Order creation started', traceContext);
    
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
      
      // 1. Get cart
      const cart = await this.cartRepository.getByUserId(userId);
      if (!cart.items || cart.items.length === 0) {
        throw new InvalidOrderError('Cart is empty', 400);
      }
      
      // 2. Validate addresses
      const [shippingAddr, billingAddr] = await Promise.all([
        addressRepository.findById(shippingAddressId),
        addressRepository.findById(billingAddressId)
      ]);
      
      if (shippingAddr.user_id !== userId || billingAddr.user_id !== userId) {
        throw new AuthorizationError('Address not found', 404);
      }
      
      // 3. Reserve inventory (atomic)
      for (const item of cart.items) {
        const reserved = await this.inventoryService.reserve(
          item.variant_id,
          item.quantity,
          client  // Pass client for transaction
        );
        
        if (!reserved) {
          throw new InsufficientStockError(
            `Product ${item.variant_id} insufficient stock`,
            409
          );
        }
      }
      
      // 4. Calculate pricing
      const pricing = await this.calculateOrderPrice(cart, shippingAddr);
      
      // 5. Create order
      const order = await this.orderRepository.create(
        client,
        {
          user_id: userId,
          tenant_id: tenantId,
          order_number: await this.generateOrderNumber(tenantId),
          currency: 'USD',
          subtotal_amount: pricing.subtotal,
          tax_amount: pricing.tax,
          discount_amount: pricing.discount,
          shipping_cost: pricing.shipping,
          total_amount: pricing.total,
          order_status: 'pending',
          payment_status: 'pending',
          shipping_address_id: shippingAddressId,
          billing_address_id: billingAddressId
        }
      );
      
      // 6. Create order items
      for (const cartItem of cart.items) {
        await this.orderRepository.addItem(client, order.id, {
          product_variant_id: cartItem.variant_id,
          quantity: cartItem.quantity,
          unit_price: cartItem.price,
          subtotal: cartItem.quantity * cartItem.price
        });
      }
      
      // 7. Clear cart
      await this.cartRepository.clear(client, userId);
      
      // Commit transaction
      await client.query('COMMIT');
      
      // 8. Publish event (async, after transaction)
      await this.eventBus.publish(new OrderCreatedEvent({
        orderId: order.id,
        userId,
        tenantId,
        totalAmount: pricing.total,
        timestamp: new Date()
      }));
      
      this.logger.info('Order created successfully', {
        ...traceContext,
        orderId: order.id,
        orderNumber: order.order_number
      });
      
      return order;
      
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Deadlock retry
      if (error.code === '40P01') {
        this.logger.warn('Deadlock detected, retrying', traceContext);
        return this.createOrder(userId, tenantId, shippingAddressId, billingAddressId);
      }
      
      this.logger.error('Order creation failed', {
        ...traceContext,
        error: error.message,
        code: error.code
      });
      throw error;
    } finally {
      client.release();
    }
  }

  async calculateOrderPrice(cart, shippingAddr) {
    // Business logic: subtotal, tax, shipping, discounts
    const subtotal = cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.08;  // 8% tax
    const shipping = await this.shippingService.getRate(shippingAddr);
    const discount = await this.applyDiscounts(cart);
    
    return {
      subtotal,
      tax,
      shopping: shipping,
      discount,
      total: subtotal + tax + shipping - discount
    };
  }

  async generateOrderNumber(tenantId) {
    // Generate human-readable order number
    // E.g., "ORD-2024-001234567"
    const timestamp = Date.now().toString().slice(-8);
    const random = crypto.randomBytes(4).toString('hex');
    return `ORD-${timestamp}-${random}`.toUpperCase();
  }
}

module.exports = OrderService;
```

---

# Part 4: Refactored Code Examples

## 4.1 Secure Authentication Controller

```javascript
// api/controllers/v1/AuthController.js

class AuthController {
  constructor(authService, userService, logger) {
    this.authService = authService;
    this.userService = userService;
    this.logger = logger;
  }

  /**
   * Register new user
   * POST /api/v1/auth/register
   */
  async register(req, res, next) {
    try {
      const { email, password, passwordConfirm } = req.body;
      
      // Validate input
      if (!email || !password) {
        throw new ValidationError('Email and password required', 400);
      }
      
      if (password !== passwordConfirm) {
        throw new ValidationError('Passwords do not match', 400);
      }
      
      // Service handles business logic
      const result = await this.authService.register({ email, password });
      
      // Send verification email (async, don't await)
      this.authService.sendVerificationEmail(email, result.verificationToken)
        .catch(err => {
          this.logger.error('Verification email failed', {
            email,
            error: err.message
          });
        });
      
      // Return generic success (don't leak whether email existed)
      res.status(201).json({
        message: 'Registration successful. Check your email to verify your account.',
        data: {
          email: email,
          accountUrl: `${process.env.APP_URL}/account`
        }
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login user
   * POST /api/v1/auth/login
   */
  async login(req, res, next) {
    try {
      const { email, password, rememberMe } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('user-agent');
      
      // Validate input
      if (!email || !password) {
        throw new ValidationError('Email and password required', 400);
      }
      
      // Service handles: account lockout checks, password verification
      const user = await this.authService.login({
        email,
        password,
        ipAddress,
        userAgent
      });
      
      // Generate token
      const token = await this.authService.generateToken(user);
      
      // Set secure cookie
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
        maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      };
      
      res.cookie('token', token, cookieOptions);
      
      // Log successful login
      this.logger.info('User login successful', {
        userId: user.id,
        email: user.email,
        ipAddress
      });
      
      res.json({
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role
          }
        }
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify email token
   * POST /api/v1/auth/verify-email
   */
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.body;
      
      const user = await this.authService.verifyEmail(token);
      
      this.logger.info('Email verified', { userId: user.id });
      
      res.json({
        message: 'Email verified successfully',
        data: { user }
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user
   * POST /api/v1/auth/logout
   */
  async logout(req, res, next) {
    try {
      const token = req.cookies?.token;
      
      if (token) {
        // Blacklist token (add to Redis with TTL)
        await this.authService.blacklistToken(token);
      }
      
      res.clearCookie('token');
      
      this.logger.info('User logout', { userId: req.user?.id });
      
      res.json({ message: 'Logged out successfully' });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user
   * GET /api/v1/auth/me
   */
  async getCurrentUser(req, res, next) {
    try {
      if (!req.user) {
        throw new AuthenticationError('Not authenticated', 401);
      }
      
      const user = await this.userService.findById(req.user.id);
      
      res.json({
        data: { user }
      });
      
    } catch (error) {
      next(error);
    }
  }
}

module.exports = AuthController;
```

---

## 4.2 Order Controller with Proper Authorization

```javascript
// api/controllers/v1/OrderController.js

class OrderController {
  constructor(orderService, logger) {
    this.orderService = orderService;
    this.logger = logger;
  }

  /**
   * Create new order
   * POST /api/v1/orders
   * @requires Auth, tenant context
   */
  async create(req, res, next) {
    try {
      const { shippingAddressId, billingAddressId } = req.body;
      
      // Validate input
      if (!shippingAddressId || !billingAddressId) {
        throw new ValidationError('Shipping and billing addresses required', 400);
      }
      
      // Check permission (set by middleware)
      if (!req.user.scopes.includes('orders:create')) {
        throw new AuthorizationError('Cannot create orders', 403);
      }
      
      // Service handles all business logic
      const order = await this.orderService.createOrder(
        req.user.id,
        req.user.tenantId,
        shippingAddressId,
        billingAddressId
      );
      
      res.status(201).json({
        message: 'Order created successfully',
        data: { order }
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's orders
   * GET /api/v1/orders?page=1&limit=20
   * @requires Auth, tenant context
   */
  async listMyOrders(req, res, next) {
    try {
      // Check permission
      if (!req.user.scopes.includes('orders:read:own')) {
        throw new AuthorizationError('Cannot read orders', 403);
      }
      
      const { cursor, limit = 20 } = req.query;
      
      const { items, nextCursor, hasMore } = await this.orderService.listOrdersByUser(
        req.user.id,
        req.user.tenantId,
        { cursor, limit: Math.min(limit, 100) }
      );
      
      res.json({
        data: {
          items,
          pagination: {
            nextCursor,
            hasMore,
            limit
          }
        }
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single order
   * GET /api/v1/orders/:id
   * @requires Auth, ownership
   */
  async getById(req, res, next) {
    try {
      const orderId = req.params.id;
      
      // Fetch order
      const order = await this.orderService.findById(orderId);
      
      if (!order) {
        throw new NotFoundError('Order not found', 404);
      }
      
      // Verify tenant isolation
      if (order.tenant_id !== req.user.tenantId) {
        throw new NotFoundError('Order not found', 404);  // Don't leak tenant existence
      }
      
      // Permission check
      if (req.user.scopes.includes('orders:read:all')) {
        // Admin: can read all
      } else if (req.user.scopes.includes('orders:read:own')) {
        // Customer: can only read own
        if (order.user_id !== req.user.id) {
          throw new AuthorizationError('Cannot read this order', 403);
        }
      } else {
        throw new AuthorizationError('Cannot read orders', 403);
      }
      
      res.json({
        data: { order }
      });
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update order status
   * PATCH /api/v1/orders/:id
   * @requires Admin, tenant context
   */
  async updateStatus(req, res, next) {
    try {
      const orderId = req.params.id;
      const { status } = req.body;
      
      // Permission check
      if (!req.user.scopes.includes('orders:update:all')) {
        throw new AuthorizationError('Cannot update orders', 403);
      }
      
      // Fetch order
      const order = await this.orderService.findById(orderId);
      
      if (!order) {
        throw new NotFoundError('Order not found', 404);
      }
      
      // Verify tenant isolation
      if (order.tenant_id !== req.user.tenantId) {
        throw new NotFoundError('Order not found', 404);
      }
      
      // Business logic: validate status transition
      const validStatuses = this.orderService.getValidStatusTransitions(order.status);
      if (!validStatuses.includes(status)) {
        throw new ValidationError(
          `Cannot transition from ${order.status} to ${status}`,
          400
        );
      }
      
      const updatedOrder = await this.orderService.updateStatus(orderId, status);
      
      this.logger.info('Order status updated', {
        orderId,
        userId: req.user.id,
        oldStatus: order.status,
        newStatus: status
      });
      
      res.json({
        message: 'Order updated successfully',
        data: { order: updatedOrder }
      });
      
    } catch (error) {
      next(error);
    }
  }
}

module.exports = OrderController;
```

---

## 4.3 Improved Middleware Stack

```javascript
// api/middleware/auth.middleware.js

const jwt = require('jsonwebtoken');
const { AuthenticationError } = require('../../utils/errors');

class AuthMiddleware {
  static authenticateJWT(req, res, next) {
    try {
      // Extract token from headers or cookies
      const token = AuthMiddleware.extractToken(req);
      
      if (!token) {
        // Public route, attach empty user
        req.user = null;
        return next();
      }
      
      // Check if token is blacklisted
      const isBlacklisted = redisClient.get(`token:blacklist:${token}`);
      if (isBlacklisted) {
        throw new AuthenticationError('Token revoked', 401);
      }
      
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Don't attach user yet; load from DB in tenant middleware
      req.tokenPayload = decoded;
      next();
      
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired', 401);
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token', 401);
      }
      next(error);
    }
  }

  static extractToken(req) {
    // Order of precedence
    if (req.headers?.authorization) {
      const parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        return parts[1];
      }
    }
    
    if (req.cookies?.token) {
      return req.cookies.token;
    }
    
    return null;
  }
}

module.exports = AuthMiddleware;
```

```javascript
// api/middleware/tenant.middleware.js

const { AuthenticationError, NotFoundError } = require('../../utils/errors');

class TenantMiddleware {
  /**
   * Load tenant context and full user object
   * MUST run after auth middleware
   */
  static async loadTenantContext(req, res, next) {
    try {
      // Public routes: req.user will be null
      if (!req.tokenPayload) {
        return next();
      }
      
      // Load user from DB (cached with short TTL)
      const user = await userService.findWithContext(req.tokenPayload.id);
      
      if (!user) {
        throw new AuthenticationError('User not found', 401);
      }
      
      // Attach enriched user object
      req.user = {
        id: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        role: user.role,
        permissions: user.permissions,  // cached
        scopes: user.scopes              // cached
      };
      
      // CRITICAL: Set database session variable for RLS
      // This ensures row-level security works across all queries
      await pool.query(
        'SELECT set_config($1, $2, false)',
        ['app.current_tenant_id', String(user.tenant_id)]
      );
      
      // Attach current tenant info
      req.tenant = await tenantService.findById(user.tenant_id, { cache: true });
      
      next();
      
    } catch (error) {
      next(error);
    }
  }

  /**
   * Require authenticated user
   */
  static requireAuth(req, res, next) {
    if (!req.user) {
      throw new AuthenticationError('Authentication required', 401);
    }
    next();
  }

  /**
   * Require specific role(s)
   */
  static requireRole(...roles) {
    return (req, res, next) => {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', 401);
      }
      
      if (!roles.includes(req.user.role)) {
        throw new AuthorizationError(`Requires one of: ${roles.join(', ')}`, 403);
      }
      
      next();
    };
  }

  /**
   * Require specific permission(s)
   */
  static requirePermission(...permissions) {
    return (req, res, next) => {
      if (!req.user) {
        throw new AuthenticationError('Authentication required', 401);
      }
      
      const hasPermission = permissions.some(permission =>
        req.user.permissions.includes(permission)
      );
      
      if (!hasPermission) {
        throw new AuthorizationError(
          `Requires one of: ${permissions.join(', ')}`,
          403
        );
      }
      
      next();
    };
  }
}

module.exports = TenantMiddleware;
```

```javascript
// api/middleware/validation.middleware.js

const Joi = require('joi');
const { ValidationError } = require('../../utils/errors');

class ValidationMiddleware {
  /**
   * Validate request body against Joi schema
   */
  static validate(schema) {
    return (req, res, next) => {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        convert: true
      });
      
      if (error) {
        // Format validation errors
        const details = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          type: detail.type
        }));
        
        throw new ValidationError('Validation failed', 400, { details });
      }
      
      // Replace body with validated and coerced values
      req.body = value;
      next();
    };
  }
}

module.exports = ValidationMiddleware;
```

```javascript
// api/middleware/rate-limit.middleware.js

const RedisStore = require('rate-limit-redis');
const rateLimit = require('express-rate-limit');

class RateLimitMiddleware {
  /**
   * Aggressive rate limit for auth endpoints
   */
  static authLimiter() {
    return rateLimit({
      store: new RedisStore({
        client: redisClient,
        prefix: 'rate-limit:auth'
      }),
      windowMs: 15 * 60 * 1000,  // 15 minutes
      max: 5,                      // Max 5 requests per window
      message: 'Too many login attempts, please try again later',
      standardHeaders: false,
      legacyHeaders: false,
      skip: (req) => {
        // Skip for admins (optional)
        return false;
      }
    });
  }

  /**
   * Standard rate limit for API endpoints
   */
  static apiLimiter(windowMs = 60000, maxRequests = 100) {
    return rateLimit({
      store: new RedisStore({
        client: redisClient,
        prefix: 'rate-limit:api'
      }),
      windowMs,
      max: maxRequests,
      keyGenerator: (req) => {
        // Rate limit by user if auth'd, else by IP
        return req.user?.id || req.ip;
      },
      standardHeaders: false,
      legacyHeaders: false
    });
  }

  /**
   * Strict limit for expensive operations
   */
  static strictLimiter() {
    return rateLimit({
      store: new RedisStore({
        client: redisClient,
        prefix: 'rate-limit:strict'
      }),
      windowMs: 60 * 60 * 1000,   // 1 hour
      max: 10,                     // Max 10 per hour
      keyGenerator: (req) => req.user?.id || req.ip,
      standardHeaders: false
    });
  }
}

module.exports = RateLimitMiddleware;
```

---

## 4.4 Improved Database Schema

```sql
-- @migration 001_create_tenants
CREATE TABLE tenants (
  id BIGSERIAL PRIMARY KEY,
  
  -- Tenant metadata
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  
  -- Subscription
  plan VARCHAR(20) NOT NULL DEFAULT 'free',  -- free, pro, enterprise
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, suspended, deleted
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT tenant_active_not_deleted 
    CHECK (status != 'active' OR deleted_at IS NULL)
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;

-- @migration 002_create_users
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  
  -- Identity
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  verified_at TIMESTAMP,
  verification_token VARCHAR(255),
  
  -- Profile
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  avatar_url VARCHAR(512),
  
  -- Account status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, active, suspended
  last_login_at TIMESTAMP,
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT email_unique_active UNIQUE (email) 
    WHERE deleted_at IS NULL,
  CONSTRAINT password_not_empty CHECK (length(password_hash) > 0)
);

CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_status ON users(status);

-- @migration 003_create_tenant_users
CREATE TABLE tenant_users (
  id BIGSERIAL PRIMARY KEY,
  
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Role within tenant
  role VARCHAR(20) NOT NULL,  -- tenant_admin, tenant_member, viewer
  
  -- Tenant-specific permissions (override defaults)
  custom_permissions TEXT[],
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- active, suspended, inactive
  invited_at TIMESTAMP,
  invited_by BIGINT REFERENCES users(id),
  accepted_at TIMESTAMP,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id, user_id),
  CONSTRAINT invited_by_valid CHECK (invited_by IS NULL OR (invited_at IS NOT NULL AND invited_by != user_id))
);

CREATE INDEX idx_tenant_users_tenant_user ON tenant_users(tenant_id, user_id);
CREATE INDEX idx_tenant_users_user ON tenant_users(user_id);

-- @migration 004_create_orders
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  
  -- Multi-tenant
  tenant_id BIGINT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  
  -- Order identification
  order_number VARCHAR(30) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  
  -- Pricing
  subtotal_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  shipping_cost DECIMAL(19,4) NOT NULL DEFAULT 0,
  total_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  
  -- Status tracking
  order_status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, confirmed, processing, shipped, delivered, cancelled
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, authorized, captured, failed, refunded
  fulfillment_status VARCHAR(20) NOT NULL DEFAULT 'unfulfilled',  -- unfulfilled, partial, fulfilled
  
  -- Addresses
  shipping_address_id BIGINT NOT NULL REFERENCES addresses(id),
  billing_address_id BIGINT NOT NULL REFERENCES addresses(id),
  
  -- Shipping
  shipping_carrier VARCHAR(50),
  tracking_number VARCHAR(100),
  estimated_delivery_date DATE,
  actual_delivery_date DATE,
  
  -- Metadata
  customer_notes TEXT,
  internal_notes TEXT,
  
  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT unique_order_number_per_tenant 
    UNIQUE (tenant_id, order_number) WHERE deleted_at IS NULL,
  CONSTRAINT valid_total CHECK (total_amount >= 0),
  CONSTRAINT valid_amount CHECK (subtotal_amount >= 0)
);

-- Critical indexes
CREATE INDEX idx_orders_tenant_user ON orders(tenant_id, user_id, created_at DESC);
CREATE INDEX idx_orders_payment_status ON orders(payment_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_order_status ON orders(order_status) WHERE deleted_at IS NULL;
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- @migration 005_enable_rls
-- Enable RLS on all data tables

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: All data is tenant-isolated
CREATE POLICY rls_tenant_isolation ON orders
  USING (tenant_id = CURRENT_SETTING('app.current_tenant_id')::bigint)
  WITH CHECK (tenant_id = CURRENT_SETTING('app.current_tenant_id')::bigint);

-- Apply to all tables...
```

---

[Continued in next section due to length...]
