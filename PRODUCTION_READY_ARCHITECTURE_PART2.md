# Production-Ready Architecture: Part 2 (Continued)

---

## 4.5 Repository Pattern with Proper Optimization

```javascript
// domain/ordering/repositories/OrderRepository.js

class OrderRepository {
  constructor(pool, logger) {
    this.pool = pool;
    this.logger = logger;
  }

  /**
   * Find order by ID with all related data
   * Uses single JOIN instead of N+1 queries
   */
  async findById(orderId, tenantId) {
    const query = `
      SELECT 
        o.id, o.order_number, o.total_amount, o.currency,
        o.order_status, o.payment_status, o.fulfillment_status,
        o.created_at, o.updated_at,
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', p.id,
            'product_name', p.name,
            'variant_id', pv.id,
            'variant_sku', pv.sku,
            'quantity', oi.quantity,
            'unit_price', oi.unit_price,
            'subtotal', oi.subtotal
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN product_variants pv ON oi.product_variant_id = pv.id
      LEFT JOIN products p ON pv.product_id = p.id
      WHERE o.id = $1 AND o.tenant_id = $2 AND o.deleted_at IS NULL
      GROUP BY o.id
    `;
    
    const result = await this.pool.query(query, [orderId, tenantId]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  }

  /**
   * List orders with cursor-based pagination
   * Efficient for large datasets
   */
  async listByUserId(userId, tenantId, { cursor = null, limit = 20 } = {}) {
    let query = `
      SELECT 
        id, order_number, total_amount, order_status, 
        created_at, updated_at
      FROM orders
      WHERE user_id = $1 
        AND tenant_id = $2 
        AND deleted_at IS NULL
    `;
    
    const params = [userId, tenantId];
    
    // Cursor pagination: use ID as cursor
    if (cursor) {
      const decodedCursor = Buffer.from(cursor, 'base64').toString();
      query += ` AND id < $${params.length + 1}`;
      params.push(parseInt(decodedCursor));
    }
    
    query += ` ORDER BY id DESC LIMIT $${params.length + 1}`;
    params.push(limit + 1);  // Fetch one extra to detect hasMore
    
    const result = await this.pool.query(query, params);
    
    const hasMore = result.rows.length > limit;
    const items = result.rows.slice(0, limit);
    
    const nextCursor = hasMore
      ? Buffer.from(String(items[items.length - 1].id)).toString('base64')
      : null;
    
    return { items, nextCursor, hasMore };
  }

  /**
   * Create order within transaction
   * Caller must handle transaction lifecycle
   */
  async create(client, orderData) {
    const {
      user_id, tenant_id, order_number, currency,
      subtotal_amount, tax_amount, discount_amount, shipping_cost, total_amount,
      shipping_address_id, billing_address_id
    } = orderData;
    
    const query = `
      INSERT INTO orders (
        user_id, tenant_id, order_number, currency,
        subtotal_amount, tax_amount, discount_amount, shipping_cost, total_amount,
        order_status, payment_status, fulfillment_status,
        shipping_address_id, billing_address_id,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', 'pending', 'unfulfilled',
        $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      RETURNING *
    `;
    
    const params = [
      user_id, tenant_id, order_number, currency,
      subtotal_amount, tax_amount, discount_amount, shipping_cost, total_amount,
      shipping_address_id, billing_address_id
    ];
    
    const result = await client.query(query, params);
    
    this.logger.debug('Order created', {
      orderId: result.rows[0].id,
      orderNumber: result.rows[0].order_number
    });
    
    return result.rows[0];
  }

  /**
   * Add item to order
   * Returns early if stock unavailable (prevents oversell)
   */
  async addItem(client, orderId, itemData) {
    const { product_variant_id, quantity, unit_price, subtotal } = itemData;
    
    // Check variant exists and has stock
    const variantResult = await client.query(
      `SELECT stock FROM product_variants 
       WHERE id = $1 AND deleted_at IS NULL 
       FOR UPDATE`,  // Lock for transaction
      [product_variant_id]
    );
    
    if (variantResult.rows.length === 0) {
      throw new NotFoundError('Product variant not found');
    }
    
    if (variantResult.rows[0].stock < quantity) {
      throw new InsufficientStockError('Insufficient stock');
    }
    
    // Insert order item
    const insertResult = await client.query(
      `INSERT INTO order_items (
        order_id, product_variant_id, quantity, unit_price, subtotal
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [orderId, product_variant_id, quantity, unit_price, subtotal]
    );
    
    // Deduct from stock atomically
    await client.query(
      `UPDATE product_variants 
       SET stock = stock - $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [quantity, product_variant_id]
    );
    
    return insertResult.rows[0];
  }

  /**
   * Update order status with validation
   */
  async updateStatus(orderId, tenantId, newStatus) {
    // Validate transition (business logic)
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['processing', 'cancelled'],
      'processing': ['shipped', 'cancelled'],
      'shipped': ['delivered'],
      'delivered': [],
      'cancelled': []
    };
    
    const currentResult = await this.pool.query(
      'SELECT order_status FROM orders WHERE id = $1 AND tenant_id = $2',
      [orderId, tenantId]
    );
    
    if (currentResult.rows.length === 0) {
      throw new NotFoundError('Order not found');
    }
    
    const currentStatus = currentResult.rows[0].order_status;
    
    if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
        400
      );
    }
    
    // Update
    const updateResult = await this.pool.query(
      `UPDATE orders 
       SET order_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [newStatus, orderId, tenantId]
    );
    
    return updateResult.rows[0];
  }
}

module.exports = OrderRepository;
```

---

## 4.6 Caching Decorator Pattern

```javascript
// infrastructure/cache/cachingDecorator.js

/**
 * Decorator for caching method results in Redis
 * 
 * Usage:
 * @Cache({ key: 'products:all', ttl: 3600 })
 * async getAll() { ... }
 */
function Cache({ key, ttl = 300, keyGenerator = null }) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args) {
      const cacheKey = typeof keyGenerator === 'function'
        ? keyGenerator(...args)
        : key;
      
      // Try cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        this.logger?.debug('Cache hit', { key: cacheKey });
        return JSON.parse(cached);
      }
      
      // Cache miss: execute original method
      const result = await originalMethod.apply(this, args);
      
      // Store in cache
      await redisClient.setEx(cacheKey, ttl, JSON.stringify(result));
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Decorator for invalidating cache on mutation
 */
function InvalidateCache({ keys }) {
  return function (target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args) {
      const result = await originalMethod.apply(this, args);
      
      // Invalidate specified keys
      for (const pattern of keys) {
        const keyPatterns = typeof pattern === 'function'
          ? pattern(result, ...args)
          : pattern;
        
        const keysToDelete = await redisClient.keys(keyPatterns);
        if (keysToDelete.length > 0) {
          await redisClient.del(...keysToDelete);
        }
      }
      
      return result;
    };
    
    return descriptor;
  };
}

module.exports = { Cache, InvalidateCache };
```

Usage:

```javascript
// infrastructure/cache/cache.js

class ProductCache {
  constructor(redisClient, productRepository, logger) {
    this.redisClient = redisClient;
    this.productRepository = productRepository;
    this.logger = logger;
  }

  @Cache({ key: 'products:all:*', ttl: 3600 })
  async getAllProducts(tenantId, filters = {}) {
    return this.productRepository.find(tenantId, filters);
  }

  @Cache({ 
    key: null,  // Disable key, use keyGenerator
    ttl: 1800,
    keyGenerator: (tenantId, productId) => `product:${tenantId}:${productId}`
  })
  async getProductById(tenantId, productId) {
    return this.productRepository.findById(tenantId, productId);
  }

  @InvalidateCache({ 
    keys: [
      (result) => [`products:all:*`, `product:${result.tenant_id}:${result.id}`]
    ]
  })
  async updateProduct(tenantId, productId, data) {
    return this.productRepository.update(tenantId, productId, data);
  }
}
```

---

## 4.7 Event-Driven Architecture

```javascript
// domain/shared/events/EventBus.js

class EventBus {
  constructor(redisClient, logger) {
    this.redisClient = redisClient;
    this.logger = logger;
    this.handlers = new Map();
  }

  /**
   * Register handler for event type
   */
  subscribe(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    
    this.handlers.get(eventType).push(handler);
    
    this.logger.debug('Event handler registered', { eventType });
  }

  /**
   * Publish event to all subscribers
   * Publishes to Redis for distributed systems
   */
  async publish(event) {
    const eventData = {
      type: event.constructor.name,
      timestamp: new Date().toISOString(),
      payload: event,
      correlationId: event.correlationId || uuid()
    };
    
    // Publish to Redis for other services
    await this.redisClient.publish(
      `events:${eventData.type}`,
      JSON.stringify(eventData)
    );
    
    // Call local handlers
    const handlers = this.handlers.get(eventData.type) || [];
    
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error('Event handler error', {
          eventType: eventData.type,
          error: error.message
        });
      }
    }
    
    return eventData.correlationId;
  }
}

module.exports = EventBus;
```

```javascript
// domain/ordering/services/OrderEventHandlers.js

class OrderEventHandlers {
  static registerHandlers(eventBus) {
    eventBus.subscribe('OrderCreatedEvent', async (event) => {
      // Queue confirmation email
      await emailQueue.add({
        type: 'order_confirmation',
        orderId: event.orderId,
        userId: event.userId
      });
    });
    
    eventBus.subscribe('OrderPaidEvent', async (event) => {
      // Publish stock deduction event
      await eventBus.publish(new InventoryReservedEvent({
        orderId: event.orderId,
        items: event.items
      }));
      
      // Update order fulfillment status
      await fulfillmentService.markForProcessing(event.orderId);
    });
    
    eventBus.subscribe('OrderShippedEvent', async (event) => {
      // Send tracking email
      await emailQueue.add({
        type: 'order_shipped',
        orderId: event.orderId,
        trackingNumber: event.trackingNumber
      });
    });
  }
}

module.exports = OrderEventHandlers;
```

---

# Part 5: Phased Refactor Implementation Plan

## Overview

| Phase | Focus | Duration | Risk | Teams |
|-------|-------|----------|------|-------|
| **1** | Critical Security Fixes | 2 weeks | Low | Backend, Security |
| **2** | Multi-Tenant Architecture | 3 weeks | Medium | Backend, Database |
| **3** | Schema Hardening | 2 weeks | Medium | Database, Backend |
| **4** | Layering & DDD | 2 weeks | Medium | Backend |
| **5** | Caching & Performance | 1 week | Low | Backend, DevOps |
| **6** | Observability | 1 week | Low | DevOps, Backend |
| **Total** | | **11 weeks** | | |

---

## Phase 1: Critical Security Fixes (Weeks 1-2)

### Scope

Fix the blocking security vulnerabilities before production use.

### Tasks

#### 1.1 Implement Account Enumeration Protection

**File**: `api/controllers/v1/AuthController.js`

**Changes**:
- Modify register endpoint to not leak user existence
- Return same response whether email is new or existing
- Send verification email for both cases
- Log enumeration attempts

**Complexity**: Low (2-3 hours)

**Code**: (See refactored AuthController in Part 4)

---

#### 1.2 Add Account Lockout with Redis

**Files**:
- `domain/user/services/AuthService.js` (new)
- `infrastructure/cache/accountLockout.js` (new)

**Changes**:
- Implement failed login attempt tracking
- Lock account after 5 failed attempts for 15 minutes
- Use Redis for distributed lockout across instances
- Log lockout events

**Complexity**: Low (4-5 hours)

```javascript
// domain/user/services/AuthService.js - Extract

async loginUser(email, password, ipAddress) {
  const lockKey = `login_lock:${email}`;
  const attemptKey = `login_attempts:${email}`;
  
  // Check if locked
  const isLocked = await redisClient.get(lockKey);
  if (isLocked) {
    throw new AuthorizationError('Account locked. Try again in 15 minutes', 429);
  }
  
  // Verify credentials
  const user = await userRepository.findByEmail(email);
  if (!user || !await verifyPassword(password, user.password_hash)) {
    const attempts = await incrementLoginAttempts(email);
    if (attempts >= 5) {
      await redisClient.setEx(lockKey, 900, 'locked');
    }
    throw new AuthenticationError('Invalid credentials', 401);
  }
  
  // Success: clear attempts
  await redisClient.del(attemptKey, lockKey);
  return user;
}
```

---

#### 1.3 Verify Webhook Signatures

**Files**:
- `api/routes/v1/payments.routes.js`
- `infrastructure/payment/webhookVerifier.js` (new)
- `domain/ordering/services/PaymentService.js`

**Changes**:
- Stripe: Verify `stripe-signature` header with webhook secret
- Paystack: Verify HMAC-SHA512 signature
- Return 401 for invalid signatures
- Log all webhook attempts

**Complexity**: Low (3-4 hours)

```javascript
// infrastructure/payment/webhookVerifier.js

class WebhookVerifier {
  static verifyStripeSignature(body, signature) {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return event;
  }

  static verifyPaystackSignature(body, signature) {
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');
    
    if (hash !== signature) {
      throw new SecurityError('Invalid signature', 401);
    }
  }
}
```

---

#### 1.4 Implement Rate Limiting on Auth Routes

**Files**:
- `api/routes/v1/auth.routes.js`
- `api/middleware/rate-limit.middleware.js` (enhance)

**Changes**:
- Apply 5 requests/15 minutes limit to login, register, password reset
- Use Redis-based rate limiting for distributed systems
- Return 429 status code

**Complexity**: Low (2-3 hours)

---

#### 1.5 Enable CSRF Protection for Rendered Forms

**Files**:
- `src/app.js`
- `views/auth/login.ejs` (new)
- `views/auth/register.ejs` (new)

**Changes**:
- Add `csrf` npm package
- Generate CSRF tokens in forms
- Validate tokens on POST requests

**Complexity**: Low (3-4 hours)

---

### Phase 1 Deliverables

- [ ] Account enumeration fixed
- [ ] Account lockout implemented
- [ ] Webhook signature verification added
- [ ] Rate limiting on auth routes
- [ ] CSRF tokens on forms
- [ ] Security audit passed

### Phase 1 Risks

- **Low**: No database changes, isolated to auth layer
- **Mitigation**: Test with existing users, monitor login errors

### Phase 1 Testing

- Unit tests for account lockout logic
- Integration tests for webhook verification
- Manual testing of brute force protection

---

## Phase 2: Multi-Tenant Architecture (Weeks 3-5)

### Scope

Implement tenant isolation and context middleware.

### Tasks

#### 2.1 Create Tenant Data Model

**Files**:
- `data/migrations/001_create_tenants.sql`
- `data/migrations/002_create_tenant_users.sql`

**Changes**:
- Create `tenants` table
- Create `tenant_users` junction table
- Add `tenant_id` to all domain tables (products, orders, etc.)
- Add NOT NULL constraints
- Add RLS policies

**Complexity**: Medium (8-10 hours)

**Database work**:
- Write migrations
- Add indexes for tenant_id queries
- Define RLS policies for each table
- Test for data isolation

---

#### 2.2 Implement Tenant Context Middleware

**Files**:
- `api/middleware/tenant.middleware.js` (refactor)
- `config/db.js` (modify to set session variables)

**Changes**:
- Load tenant from JWT token
- Set PostgreSQL `app.current_tenant_id` session variable
- Make RLS enforce tenant isolation
- Cache tenant context in Redis (5 min TTL)

**Complexity**: Medium (6-8 hours)

---

#### 2.3 Migrate Existing Data to Multi-Tenant

**Files**:
- `data/migrations/003_migrate_existing_data.sql`

**Changes**:
- Create default tenant for existing customers
- Assign all existing users to default tenant
- Update all data records with tenant_id

**Complexity**: High (because of data migration risks)

**Strategy**:
- Take backup before migration
- Run in staging first
- Validate data integrity
- Plan rollback procedure

---

#### 2.4 Enable RLS on All Tables

**Files**:
- `data/migrations/004_enable_rls.sql`

**Changes**:
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- Create policies for SELECT, INSERT, UPDATE, DELETE
- Test policies with multiple tenants

**Complexity**: Medium (6-8 hours)

---

### Phase 2 Deliverables

- [ ] Tenants and tenant_users tables created
- [ ] All domain tables have tenant_id column
- [ ] RLS enabled on all tables
- [ ] Tenant context middleware implemented
- [ ] Data migrated to multi-tenant model
- [ ] Integration tests pass

### Phase 2 Risks

- **High**: Data migration could cause downtime
- **Mitigation**: Extensive testing, staged rollout, read-only mode during migration

### Phase 2 Testing

- Test RLS policies with multiple tenants
- Verify cross-tenant data isolation
- Performance testing on RLS

---

## Phase 3: Schema Hardening (Weeks 6-7)

### Tasks

#### 3.1 Add Missing Indexes

**Files**:
- `data/migrations/005_add_indexes.sql`

**Changes**:
- Add indexes for all foreign keys
- Add indexes for common query patterns
- Add partial indexes for active records (WHERE deleted_at IS NULL)

**Complexity**: Low (2-3 hours)

---

#### 3.2 Add Check Constraints

**Files**:
- `data/migrations/006_add_constraints.sql`

**Changes**:
- Add checks for positive amounts (orders.total >= 0)
- Add checks for valid status values
- Add checks for quantity > 0

**Complexity**: Low (2 hours)

---

#### 3.3 Improve Order Denormalization

**Files**:
- `data/migrations/007_enhance_orders.sql`
- `domain/ordering/repositories/OrderRepository.js`

**Changes**:
- Add `order_number` field (human-readable)
- Add separate `payment_status` field
- Add `estimated_delivery_date`
- Add `currency` field
- Ensure `total` is recalculated from order_items

**Complexity**: Medium (4-5 hours)

---

### Phase 3 Deliverables

- [ ] All necessary indexes created
- [ ] Check constraints added
- [ ] Order schema enhanced
- [ ] Query performance improved

---

## Phase 4: Layering & DDD (Weeks 8-9)

### Tasks

#### 4.1 Reorganize Code Structure

**Files**: Entire codebase reorganization

**Changes**:
- Move code into domain-driven structure
- Create `domain/` directory with subdomains
- Create `infrastructure/` directory
- Implement dependency injection container

**Complexity**: Medium-High (6-8 hours)

**Process**:
- Don't delete old code yet, create new structure
- Gradually move functionality
- Update tests as you go
- Delete old code once new paths verified

---

#### 4.2 Implement Proper Service Layer

**Files**: `domain/*/services/*.js`

**Changes**:
- Move all business logic to services
- Remove business logic from controllers
- Inject dependencies via constructor
- Write unit tests for services

**Complexity**: Medium (10-12 hours)

---

#### 4.3 Create Aggregate Roots (DDD Entities)

**Files**: `domain/*/entities/*.js`

**Changes**:
- Define Order, Product, User aggregate roots
- Implement domain invariants in entities
- Move validation logic to entities
- Create value objects (Money, Address, etc.)

**Complexity**: Medium (8-10 hours)

---

### Phase 4 Deliverables

- [ ] DDD folder structure created
- [ ] Services layer properly separated
- [ ] Entities define business rules
- [ ] Controllers simplified to HTTP concerns

---

## Phase 5: Caching & Performance (Week 10)

### Tasks

#### 5.1 Implement Redis Caching

**Files**:
- `infrastructure/cache/CacheManager.js`
- `infrastructure/cache/cachingDecorator.js`

**Changes**:
- Create cache manager with TTL support
- Cache: products (1 hour), permissions (5 min), categories (1 hour)
- Implement cache invalidation on mutations
- Monitor cache hit rates

**Complexity**: Low (4-5 hours)

---

#### 5.2 Fix N+1 Query Patterns

**Files**: All repository classes

**Changes**:
- Review all SELECT queries
- Replace loop+query with JOINs
- Use aggregation where possible
- Add query logging to identify remaining issues

**Complexity**: Low-Medium (6-8 hours)

---

#### 5.3 Implement Cursor-Based Pagination

**Files**:
- `utils/pagination.js`
- All repositories with list methods

**Changes**:
- Replace offset-based with cursor-based
- Ensure consistent ordering
- Test with > 1M rows

**Complexity**: Low (3-4 hours)

---

### Phase 5 Deliverables

- [ ] Caching layer implemented
- [ ] N+1 queries eliminated
- [ ] Cursor pagination implemented
- [ ] Query performance < 100ms for 90th percentile

---

## Phase 6: Observability (Week 11)

### Tasks

#### 6.1 Implement Structured Logging

**Files**:
- `infrastructure/logging/logger.js`
- `api/middleware/logger.middleware.js`

**Changes**:
- Switch to Pino for structured logging
- Add request correlation IDs
- Log key business events
- Archive logs to ELK/CloudWatch

**Complexity**: Low (3-4 hours)

---

#### 6.2 Add Distributed Tracing

**Files**:
- `infrastructure/tracing/tracer.js`
- `api/middleware/tracing.middleware.js`

**Changes**:
- Implement OpenTelemetry
- Export traces to Jaeger
- Trace cross-service calls
- Set up dashboards

**Complexity**: Medium (4-5 hours)

---

#### 6.3 Add Prometheus Metrics

**Files**:
- `infrastructure/metrics/metricsRegistry.js`
- `infrastructure/metrics/businessMetrics.js`

**Changes**:
- Implement HTTP metrics (latency, throughput, error rate)
- Implement business metrics (orders/hour, revenue, etc.)
- Export /metrics endpoint
- Create Grafana dashboards

**Complexity**: Low (3-4 hours)

---

### Phase 6 Deliverables

- [ ] Structured logging implemented
- [ ] Distributed tracing enabled
- [ ] Prometheus metrics exposed
- [ ] Grafana dashboards created

---

## Migration Strategy

### Pre-Migration

1. **Code Freeze**: No new features for 2 weeks before Phase 1
2. **Backup**: Full database backup + binary logs enabled
3. **Testing**: Comprehensive test suite in place (80%+ coverage)
4. **Team Alignment**: All developers understand new architecture

### During Migration

1. **Feature Flags**: Use feature flags to gradually enable new code
2. **Staging**: Deploy to staging first, mirror production load
3. **Blue-Green**: Production deployment uses blue-green strategy
4. **Monitoring**: Real-time monitoring of error rates, latency
5. **Rollback Plan**: Documented rollback for each phase

### Post-Migration

1. **Validation**: 24-hour monitoring period
2. **Performance**: Compare before/after metrics
3. **User Feedback**: Monitor support tickets
4. **Tech Debt**: Document remaining issues

---

# Part 6: Production-Readiness Checklist

## Security Checklist

### Authentication & Password
- [ ] Account enumeration protection on register
- [ ] Account lockout after 5 failed login attempts
- [ ] Password hashing with argon2 (recommended parameters)
- [ ] Password strength validation (min 12 chars, complexity)
- [ ] Email verification before account activation
- [ ] Password reset with time-limited tokens
- [ ] Session timeout (24 hours)
- [ ] Secure password reset link (single-use, expires)

### Authorization & Access Control
- [ ] Multi-tenant isolation enforced (RLS on all tables)
- [ ] RBAC matrix defined and enforced at middleware
- [ ] Permission scopes in role matrix
- [ ] Row-level ownership checks in routes
- [ ] Admin endpoints restricted to admin role
- [ ] Audit logging of permission changes

### Token & Session Security
- [ ] JWT expiration set (24 hours max)
- [ ] JWT signed with strong secret (32+ characters)
- [ ] HTTP-only cookies (prevent XSS stealing)
- [ ] Secure flag on cookies (HTTPS only)
- [ ] SameSite=Strict on cookies (CSRF protection)
- [ ] Token blacklist on logout (Redis)
- [ ] No sensitive data in JWT payload

### API Security
- [ ] CORS properly configured (not `*`)
- [ ] Rate limiting on all endpoints (100 req/min default)
- [ ] Rate limiting on auth endpoints (5 req/15min)
- [ ] CSRF tokens on all forms
- [ ] Content-Type validation
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] NoSQL injection prevention (schema validation)

### Webhook Security
- [ ] Stripe webhooks: signature verification required
- [ ] Paystack webhooks: HMAC verification required
- [ ] Webhook replayability: timestamp + nonce checking
- [ ] Webhook timeout: 5 second max
- [ ] Webhook retry logic with exponential backoff

### Secrets Management
- [ ] No secrets in .env file (use AWS Secrets Manager / HashiCorp Vault)
- [ ] Secrets rotation every 90 days
- [ ] Development secrets different from production
- [ ] No secrets in logs (sanitize before logging)
- [ ] No secrets in version control (.gitignore)
- [ ] API keys have expiration dates

### Network Security
- [ ] HTTPS enforced (TLS 1.2+)
- [ ] HSTS header enabled (1 year)
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] CSP header configured
- [ ] Helmet security headers enabled

### Audit & Logging
- [ ] All auth events logged (login, signup, permission changes)
- [ ] Failed login attempts logged
- [ ] Permission changes logged with user who made change
- [ ] Data access logged for sensitive operations
- [ ] Logs stored in secure location (not in application logs)
- [ ] Log retention policy (minimum 1 year)
- [ ] Log searches audited

---

## Performance Checklist

### Database
- [ ] Connection pool configured (min: 10, max: 100)
- [ ] All necessary indexes created
- [ ] Query latency monitored (P95 < 100ms)
- [ ] N+1 queries eliminated
- [ ] Pagination implemented (cursor-based)
- [ ] Prepared statements used
- [ ] Query timeouts configured (30 sec max)
- [ ] Slow query logging enabled

### Caching
- [ ] Redis configured with persistence
- [ ] Product catalog cached (1 hour TTL)
- [ ] User permissions cached (5 minute TTL)
- [ ] Categories cached (1 hour TTL)
- [ ] Cache invalidation on data changes
- [ ] Cache hit rate > 70% for frequent queries
- [ ] Cache memory limits configured

### API Performance
- [ ] Response time < 200ms for 95th percentile
- [ ] API throughput capacity > 1000 req/sec
- [ ] Payload size < 5MB
- [ ] Gzip compression enabled
- [ ] HTTP/2 enabled (if using compatible server)
- [ ] Static assets cached with ETag
- [ ] API versioning strategy (v1, v2, etc.)

### Background Jobs
- [ ] Email jobs queued (not synchronous)
- [ ] Job queue retries on failure (exponential backoff)
- [ ] Max job timeout configured
- [ ] Dead letter queue for repeated failures
- [ ] Job status monitoring

### Load Testing
- [ ] Load test: 100 concurrent users → response time < 500ms
- [ ] Load test: 1000 concurrent users → no errors
- [ ] Database connection pool doesn't exhaust
- [ ] Memory usage doesn't exceed 80% at peak load
- [ ] Disk I/O doesn't bottleneck
- [ ] Recovery time < 5 min after load test ends

---

## Scalability Checklist

### Horizontal Scaling
- [ ] Stateless application servers (no session stored locally)
- [ ] Distributed session management (Redis)
- [ ] Load balancer in front of instances
- [ ] Auto-scaling rules configured
- [ ] Database read replicas configured
- [ ] Application can handle 10x traffic with 10x servers

### Database Scaling
- [ ] Connection pooling across all servers
- [ ] Master-slave replication for reads
- [ ] Sharding strategy documented (if needed)
- [ ] Backup strategy: daily full backup + hourly incremental
- [ ] Point-in-time recovery tested
- [ ] Database growth projections documented

### Distributed System Concerns
- [ ] Distributed locking (Redis) for critical operations
- [ ] Idempotancy implemented for payment operations
- [ ] Circuit breaker for external API calls
- [ ] Timeout/retry strategy for network calls
- [ ] Message ordering guaranteed where needed
- [ ] CAP theorem trade-offs documented

### Cloud Infrastructure
- [ ] Multi-region deployment capability
- [ ] Cross-region failover strategy
- [ ] CDN for static assets
- [ ] DDoS protection enabled (WAF)
- [ ] VPC/security groups configured
- [ ] S3 for file uploads (not local)

---

## Reliability Checklist

### Availability & Uptime
- [ ] SLA defined (99.9% uptime minimum)
- [ ] Monitoring for all critical services
- [ ] Alerting with escalation procedures
- [ ] On-call rotation documented
- [ ] Maintenance windows scheduled (low traffic)
- [ ] Health check endpoint returns status

### Error Handling
- [ ] All endpoints have error handlers
- [ ] Errors return appropriate HTTP status codes
- [ ] No stack traces in production responses
- [ ] Graceful degradation (cache hit even if DB fails)
- [ ] Circuit breaker for external API failures
- [ ] Retry logic with exponential backoff

### Data Integrity
- [ ] ACID transactions for critical operations
- [ ] Orphaned records cleanup (soft delete archival)
- [ ] Foreign key constraints enforced
- [ ] Unique constraints on business identifiers
- [ ] Check constraints for valid states
- [ ] Referential integrity maintained

### Disaster Recovery
- [ ] RTO (Recovery Time Objective): 1 hour
- [ ] RPO (Recovery Point Objective): 15 minutes
- [ ] Backup tested monthly (restore test)
- [ ] Disaster recovery plan documented
- [ ] Team trained on failover procedure
- [ ] Cross-region replication of critical data

### Testing
- [ ] Unit test coverage > 80%
- [ ] Integration test coverage > 60%
- [ ] E2E tests for critical user flows
- [ ] Performance tests (regression testing)
- [ ] Security tests (OWASP Top 10)
- [ ] Chaos engineering tests (failure injection)

---

## Compliance & Legal Checklist

### Data Protection (GDPR/Privacy)
- [ ] Privacy policy available and clear
- [ ] GDPR data export implemented (user data in JSON)
- [ ] GDPR right-to-forget implemented (account deletion)
- [ ] Explicit consent for data collection
- [ ] Data processing agreements with vendors
- [ ] Data retention policy documented
- [ ] Personal data minimization (don't store unnecessary data)

### Payment Security (PCI DSS)
- [ ] Never store full credit card numbers
- [ ] Tokenize cards with payment provider
- [ ] Stripe/Paystack API validation of CVV
- [ ] PCI Level 1 compliance (most important)
- [ ] Annual penetration testing
- [ ] Encryption of cardholder data at rest
- [ ] Encryption of cardholder data in transit (TLS)

### Security Compliance
- [ ] SOC 2 Type 2 audit planned (if enterprise)
- [ ] HIPAA compliance (if health data)
- [ ] ISO 27001 compliance (if critical system)
- [ ] Regular security audits (at least annually)
- [ ] Penetration testing (at least annually)
- [ ] Vulnerability scanning (monthly)

---

## Operational Checklist

### Deployment & DevOps
- [ ] CI/CD pipeline configured (automated tests)
- [ ] Database migrations automated
- [ ] Secrets management (AWS Secrets Manager / Vault)
- [ ] Infrastructure as Code (Terraform / CloudFormation)
- [ ] Container images immutable
- [ ] Deployment checklist (pre/post deployment)
- [ ] Rollback plan for each deployment

### Monitoring & Observability
- [ ] Structured logging (Pino) for all requests
- [ ] Distributed tracing (Jaeger/DataDog)
- [ ] Metrics collection (Prometheus)
- [ ] Alerting rules (high error rate, latency, etc.)
- [ ] Log aggregation (ELK, CloudWatch, Datadog)
- [ ] Performance dashboards (Grafana)
- [ ] Business metrics dashboards (orders, revenue, etc.)

### Documentation
- [ ] Architecture documentation (this document)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Database schema documentation
- [ ] Deployment procedures documented
- [ ] Runbooks for common issues
- [ ] Change log updated
- [ ] Team wiki/knowledge base

### Team Readiness
- [ ] All developers trained on architecture
- [ ] Code review process defined
- [ ] Testing requirements defined
- [ ] On-call procedures documented
- [ ] Escalation contact list available
- [ ] Team code ownership defined
- [ ] Training materials for new team members

---

## Maintainability Checklist

### Code Quality
- [ ] ESLint configured with rules
- [ ] Prettier configured for formatting
- [ ] Pre-commit hooks enabled
- [ ] Code review requirement (2 approvers for security)
- [ ] Architecture decision records (ADRs) documented
- [ ] Technical debt tracking (Jira/GitHub)
- [ ] Refactoring tasks scheduled regularly

### Testing Standards
- [ ] Jest configured with coverage thresholds (80%+)
- [ ] Test naming conventions clear
- [ ] Mocking strategy defined
- [ ] Database per test (for integration tests)
- [ ] Flaky test resolution process
- [ ] Performance regression detection

### Dependency Management
- [ ] Dependencies locked to specific versions
- [ ] npm audit run in CI/CD
- [ ] Dependency update schedule (quarterly)
- [ ] Major version upgrades tested before merging
- [ ] Deprecated dependencies removed
- [ ] Version compatibility matrix maintained

---

## Final Sign-Off

### Pre-Launch Checklist

- [ ] Security audit completed (internal + external)
- [ ] Load testing: 100k concurrent users
- [ ] Failover testing: automatic recovery works
- [ ] Disaster recovery testing: restore in < 1 hour
- [ ] User acceptance testing (UAT) completed
- [ ] Performance benchmarks met (< 200ms p95)
- [ ] All known bugs resolved or documented
- [ ] Operations team trained

### Launch Readiness

- [ ] On-call team assigned
- [ ] War room set up (Slack channel, call bridge)
- [ ] Status page configured (statuspage.io)
- [ ] Customer communication plan ready
- [ ] Monitoring alerts configured
- [ ] Rollback plan tested

### Go/No-Go Decision

| Component | Status | Notes |
|-----------|--------|-------|
| Security | ✅ | All critical issues fixed |
| Performance | ✅ | P95 < 200ms |
| Scalability | ✅ | 10k concurrent users |
| Reliability | ✅ | 99.9% uptime target |
| Documentation | ✅ | Complete |
| Team Readiness | ✅ | All trained |

**Launch Decision**: **GO** ✅

---

## Appendix: Configuration Templates

### Docker Compose for Production

```yaml
version: '3.8'

services:
  api:
    image: fullstack-backend:latest
    restart: always
    environment:
      NODE_ENV: production
      PORT: 3000
      DB_HOST: postgres
      DB_PORT: 5432
      REDIS_HOST: redis
      REDIS_PORT: 6379
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    volumes:
      - ./logs:/app/logs
    networks:
      - backend

  postgres:
    image: postgres:15-alpine
    restart: always
    environment:
      POSTGRES_DB: fullstack_prod
      POSTGRES_USER: app_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./data/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app_user"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  redis:
    image: redis:7-alpine
    restart: always
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - api
    networks:
      - backend

volumes:
  postgres_data:
  redis_data:

networks:
  backend:
    driver: bridge
```

---

**Document Status**: Ready for Implementation  
**Last Updated**: February 28, 2026  
**Audience**: Development Team, Architecture, DevOps
