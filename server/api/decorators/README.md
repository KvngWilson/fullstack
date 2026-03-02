# API Route Decorators

Composable decorator patterns for cleaner, more maintainable route definitions. Decorators wrap common middleware combinations using the spread operator for readable route composition.

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Authentication Decorators](#authentication-decorators)
- [Validation Decorators](#validation-decorators)
- [Caching Decorators](#caching-decorators)
- [Rate Limiting Decorators](#rate-limiting-decorators)
- [Combined Decorators](#combined-decorators)
- [Usage Patterns](#usage-patterns)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

Route decorators are composable middleware patterns that simplify route definitions by wrapping common middleware combinations. Instead of manually listing multiple middleware functions, decorators provide semantic, reusable patterns.

### Before (Without Decorators)

```javascript
const { requireAuth, requireAdmin } = require('./middleware/auth');
const { validateBody } = require('./middleware/validation');
const { apiLimiter } = require('./middleware/rateLimiter');
const { validateCreateProduct } = require('./validators/catalog');

router.post('/products',
  requireAuth,
  requireAdmin,
  apiLimiter,
  validateBody(validateCreateProduct),
  controller.create
);
```

### After (With Decorators)

```javascript
const { adminValidated } = require('./decorators');
const { validateCreateProduct } = require('./validators/catalog');

router.post('/products',
  ...adminValidated(validateCreateProduct),
  controller.create
);
```

## Installation

Decorators are automatically available in the project:

```javascript
// Import individual decorators
const { protect, body, admin, cache } = require('./api/decorators');

// Import by category
const { auth, validation, caching } = require('./api/decorators');

// Import specific category
const authDecorators = require('./api/decorators/auth');
```

---

## Authentication Decorators

**File**: `auth.js`  
**Purpose**: Authentication and authorization patterns

### `protect()`
Requires authenticated user.

```javascript
router.get('/profile', ...protect(), controller.profile);
```

### `verified()`
Requires authenticated user with verified email.

```javascript
router.post('/premium-order', ...verified(), controller.create);
```

### `admin()`
Requires admin role.

```javascript
router.delete('/users/:id', ...admin(), controller.delete);
```

### `customer()`
Requires customer role (or admin for support purposes).

```javascript
router.post('/orders', ...customer(), controller.create);
```

### `role(...roles)`
Requires specific role(s).

```javascript
router.get('/dashboard', ...role('admin', 'staff'), controller.dashboard);
```

### `permission(permissionCode)`
Requires specific permission.

```javascript
router.post('/products', ...permission('products:create'), controller.create);
```

### `anyPermission(permissions)`
Requires at least one of the specified permissions.

```javascript
router.get('/orders', ...anyPermission(['orders:view', 'orders:manage']), controller.list);
```

### `allPermissions(permissions)`
Requires all specified permissions.

```javascript
router.post('/refund', ...allPermissions(['orders:manage', 'payments:refund']), controller.refund);
```

### `ownership(options)`
Requires user to own the resource.

```javascript
router.put('/orders/:id',
  ...ownership({ 
    getResource: async (req) => getOrder(req.params.id) 
  }),
  controller.update
);
```

### `optional()`
Optional authentication (non-blocking).

```javascript
router.get('/products', ...optional(), controller.list);
```

---

## Validation Decorators

**File**: `validation.js`  
**Purpose**: Request validation patterns

### `body(validator)`
Validates request body.

```javascript
const { validateLogin } = require('../validators/auth');

router.post('/login', ...body(validateLogin), controller.login);
```

### `query(validator)`
Validates query parameters.

```javascript
const { validateOrdersListQuery } = require('../validators/order');

router.get('/orders', ...query(validateOrdersListQuery), controller.list);
```

### `params(validator)`
Validates route parameters.

```javascript
router.get('/orders/:id', ...params(validateIdParam), controller.get);
```

### `all(validators)`
Validates multiple request parts.

```javascript
router.post('/orders',
  ...all({ 
    body: validateCreateOrder, 
    query: validatePagination 
  }),
  controller.create
);
```

### `validated(validator)`
Alias for `body()` (most common case).

```javascript
router.post('/register', ...validated(validateRegister), controller.register);
```

---

## Caching Decorators

**File**: `caching.js`  
**Purpose**: Response caching patterns

### `cache(options)`
Cache response with custom options.

```javascript
router.get('/products', 
  ...cache({ ttl: 300 }), // 5 minutes
  controller.list
);
```

**Options**:
- `ttl` - Time to live in seconds (default: 300)
- `keyGenerator` - Custom key generator function
- `skipOnError` - Skip caching on error (default: true)

### `cacheShort(options)`
Cache for 1 minute.

```javascript
router.get('/trending', ...cacheShort(), controller.trending);
```

### `cacheMedium(options)`
Cache for 5 minutes (default).

```javascript
router.get('/products', ...cacheMedium(), controller.list);
```

### `cacheLong(options)`
Cache for 1 hour.

```javascript
router.get('/categories', ...cacheLong(), controller.list);
```

### `cacheUser(options)`
Cache user-specific data.

```javascript
router.get('/profile', 
  ...protect(), 
  ...cacheUser({ ttl: 60 }),
  controller.profile
);
```

### `cacheCustom(keyGenerator, options)`
Cache with custom key generation.

```javascript
router.get('/products/:id',
  ...cacheCustom((req) => `product:${req.params.id}`, { ttl: 600 }),
  controller.get
);
```

### `invalidate(pattern)`
Invalidate cache on mutation.

```javascript
router.post('/products',
  ...admin(),
  ...invalidate('products:*'),
  controller.create
);
```

---

## Rate Limiting Decorators

**File**: `rateLimiting.js`  
**Purpose**: Rate limiting patterns

### `rateAuth()`
Strict rate limit for authentication endpoints (5 requests per 15 minutes).

```javascript
router.post('/login', ...rateAuth(), ...body(validateLogin), controller.login);
```

### `ratePasswordReset()`
Very strict rate limit for password resets (3 requests per hour).

```javascript
router.post('/forgot-password', ...ratePasswordReset(), controller.forgot);
```

### `rateApi()`
Moderate rate limit for API endpoints (100 requests per 15 minutes).

```javascript
router.post('/orders', ...rateApi(), controller.create);
```

### `rateGeneral()`
Lenient rate limit for general routes (1000 requests per 15 minutes).

```javascript
router.get('/products', ...rateGeneral(), controller.list);
```

### `rateLimited()`
Alias for `rateApi()` (most common case).

```javascript
router.post('/orders', ...rateLimited(), controller.create);
```

---

## Combined Decorators

**File**: `combined.js`  
**Purpose**: Pre-composed decorator combinations for common scenarios

### Auth + Validation Combos

#### `protectedValidated(validator)`
Protected route with body validation.

```javascript
router.post('/orders', 
  ...protectedValidated(validateCreateOrder),
  controller.create
);
```

#### `adminValidated(validator)`
Admin route with body validation.

```javascript
router.post('/products', 
  ...adminValidated(validateCreateProduct),
  controller.create
);
```

#### `customerValidated(validator)`
Customer route with body validation.

```javascript
router.post('/orders', 
  ...customerValidated(validateCreateOrder),
  controller.create
);
```

#### `verifiedValidated(validator)`
Verified user route with body validation.

```javascript
router.post('/premium-order', 
  ...verifiedValidated(validatePremiumOrder),
  controller.create
);
```

### Caching Combos

#### `protectedCached(validator, cacheOptions)`
Protected route with query validation and caching.

```javascript
router.get('/orders', 
  ...protectedCached(validateOrdersListQuery, { ttl: 60 }),
  controller.list
);
```

#### `publicCached(cacheOptions)`
Public route with caching.

```javascript
router.get('/products', 
  ...publicCached({ ttl: 300 }),
  controller.list
);
```

### Rate Limiting Combos

#### `authRoute(validator)`
Auth route with strict rate limiting and validation.

```javascript
router.post('/login', 
  ...authRoute(validateLogin),
  controller.login
);
```

#### `passwordResetRoute(validator)`
Password reset route with very strict rate limiting.

```javascript
router.post('/forgot-password', 
  ...passwordResetRoute(validateForgotPassword),
  controller.forgot
);
```

### Full Stack Combos

#### `apiRoute(validator)`
Standard API route (auth + rate limit + validation).

```javascript
router.post('/orders', 
  ...apiRoute(validateCreateOrder),
  controller.create
);
```

#### `listRoute(validator, cacheOptions)`
List route (auth + query validation + user-specific caching).

```javascript
router.get('/orders', 
  ...listRoute(validateOrdersListQuery, { ttl: 60 }),
  controller.list
);
```

#### `createRoute(validator)`
Create route (admin + rate limit + validation).

```javascript
router.post('/products', 
  ...createRoute(validateCreateProduct),
  controller.create
);
```

#### `updateRoute(validator, ownershipOptions)`
Update route (ownership + validation).

```javascript
router.put('/orders/:id', 
  ...updateRoute(validateUpdateOrder, {
    getResource: async (req) => getOrder(req.params.id)
  }),
  controller.update
);
```

#### `deleteRoute()`
Delete route (admin + rate limit).

```javascript
router.delete('/products/:id', 
  ...deleteRoute(),
  controller.delete
);
```

#### `getRoute(cacheOptions)`
Get single resource (optional auth + caching).

```javascript
router.get('/products/:id', 
  ...getRoute({ ttl: 300 }),
  controller.get
);
```

---

## Usage Patterns

### Basic CRUD Operations

```javascript
const { 
  listRoute, 
  getRoute, 
  createRoute, 
  updateRoute, 
  deleteRoute 
} = require('./decorators');

// List all resources
router.get('/', 
  ...listRoute(validateOrdersListQuery),
  controller.list
);

// Get single resource
router.get('/:id', 
  ...getRoute({ ttl: 300 }),
  controller.get
);

// Create resource
router.post('/', 
  ...createRoute(validateCreateOrder),
  controller.create
);

// Update resource
router.put('/:id', 
  ...updateRoute(validateUpdateOrder, {
    getResource: async (req) => getOrder(req.params.id)
  }),
  controller.update
);

// Delete resource
router.delete('/:id', 
  ...deleteRoute(),
  controller.delete
);
```

### Authentication Routes

```javascript
const { authRoute, passwordResetRoute } = require('./decorators');

// Login
router.post('/login', 
  ...authRoute(validateLogin),
  controller.login
);

// Register
router.post('/register', 
  ...authRoute(validateRegister),
  controller.register
);

// Forgot password
router.post('/forgot-password', 
  ...passwordResetRoute(validateForgotPassword),
  controller.forgot
);

// Reset password
router.post('/reset-password', 
  ...passwordResetRoute(validateResetPassword),
  controller.reset
);
```

### Public vs Protected Routes

```javascript
const { optional, protect, publicCached } = require('./decorators');

// Public route with caching
router.get('/products', 
  ...publicCached({ ttl: 300 }),
  controller.list
);

// Optional auth (personalized if logged in)
router.get('/homepage', 
  ...optional(),
  controller.homepage
);

// Protected route
router.get('/profile', 
  ...protect(),
  controller.profile
);
```

### Permission-Based Routes

```javascript
const { permission, anyPermission, allPermissions } = require('./decorators');

// Specific permission
router.post('/products', 
  ...permission('products:create'),
  ...body(validateCreateProduct),
  controller.create
);

// Any of multiple permissions
router.get('/reports', 
  ...anyPermission(['reports:view', 'reports:manage']),
  controller.reports
);

// All permissions required
router.post('/bulk-import', 
  ...allPermissions(['products:create', 'inventory:manage']),
  controller.bulkImport
);
```

### Custom Combinations

You can compose your own decorator patterns:

```javascript
const { protect, verified, body, rateApi, cacheUser } = require('./decorators');

// Premium feature route
function premiumRoute(validator) {
  return [
    ...protect(),
    ...verified(),
    ...rateApi(),
    ...body(validator),
  ];
}

router.post('/premium-feature', 
  ...premiumRoute(validatePremiumFeature),
  controller.feature
);
```

---

## Best Practices

### 1. Use Spread Operator

Always use spread operator (`...`) when applying decorators:

```javascript
// [CORRECT] Use spread operator
router.get('/orders', ...protect(), controller.list);

// [WRONG] Don't forget spread operator
router.get('/orders', protect(), controller.list);
```

### 2. Order Matters

Apply decorators in logical order:

1. Rate limiting (first - protect server)
2. Authentication (early - security)
3. Validation (before expensive operations)
4. Caching (after validation)
5. Controller (last)

```javascript
// [GOOD] Order the decorators correctly
router.post('/orders',
  ...rateApi(),           // 1. Rate limit
  ...protect(),           // 2. Auth
  ...body(validateOrder), // 3. Validate
  controller.create       // 4. Controller
);
```

### 3. Use Combined Decorators

For common patterns, use combined decorators:

```javascript
// [BETTER] Use combined decorators
router.post('/orders', ...apiRoute(validateCreateOrder), controller.create);

// [NOTE] More verbose approach without combined decorator
router.post('/orders',
  ...protect(),
  ...rateApi(),
  ...body(validateCreateOrder),
  controller.create
);
```

### 4. Cache Read Operations Only

Only cache GET requests:

```javascript
// [GOOD] Cache only read operations
router.get('/products', ...publicCached({ ttl: 300 }), controller.list);

// [BAD] Don't cache write operations
router.post('/products', ...cache({ ttl: 300 }), controller.create);
```

### 5. Invalidate Cache on Mutations

Invalidate related cache when data changes:

```javascript
router.post('/products',
  ...createRoute(validateCreateProduct),
  ...invalidate('products:*'),
  controller.create
);
```

### 6. Choose Appropriate Rate Limits

Use stricter limits for sensitive operations:

```javascript
// Auth operations - very strict
router.post('/login', ...rateAuth(), controller.login);

// Password reset - extremely strict
router.post('/reset', ...ratePasswordReset(), controller.reset);

// Standard API - moderate
router.post('/orders', ...rateApi(), controller.create);

// Public content - lenient
router.get('/blog', ...rateGeneral(), controller.blog);
```

### 7. Validate Before Authorization

Validate input before expensive authorization checks:

```javascript
// [GOOD] Validate before expensive checks
router.post('/orders',
  ...body(validateCreateOrder),  // Fast
  ...protect(),                  // Slower
  controller.create
);

// [INEFFICIENT] Checking auth before validation
router.post('/orders',
  ...protect(),                  // Check auth first
  ...body(validateCreateOrder),  // Then validate
  controller.create
);
```

### 8. Use Semantic Names

Decorator names should describe intent:

```javascript
// [CLEAR] Use semantic names
router.post('/admin/products', ...adminValidated(validator), controller.create);

// [UNCLEAR] Less clear intent
router.post('/admin/products', ...protect(), ...body(validator), controller.create);
```

### 9. Document Custom Decorators

When creating custom decorators, document them:

```javascript
/**
 * Premium feature route decorator
 * Requires: auth, verified email, rate limiting, validation
 */
function premiumRoute(validator) {
  return [
    ...protect(),
    ...verified(),
    ...rateApi(),
    ...body(validator),
  ];
}
```

### 10. Don't Over-Compose

Keep decorator chains readable:

```javascript
// [GOOD] Simple and readable
router.post('/orders', ...apiRoute(validator), controller.create);

// [POOR] Too many decorators in one chain
router.post('/orders',
  ...protect(),
  ...verified(),
  ...rateApi(),
  ...body(validator),
  ...query(queryValidator),
  ...cacheUser(),
  ...invalidate('*'),
  controller.create
);
```

---

## Examples

### Complete CRUD API

```javascript
const express = require('express');
const router = express.Router();
const { 
  listRoute,
  getRoute,
  createRoute,
  updateRoute,
  deleteRoute,
} = require('./decorators');

const {
  validateCreateProduct,
  validateUpdateProduct,
  validateProductsListQuery,
} = require('./validators/catalog');

const controller = require('./controllers/products');

// List products
router.get('/', 
  ...listRoute(validateProductsListQuery, { ttl: 300 }),
  controller.list
);

// Get single product
router.get('/:id', 
  ...getRoute({ ttl: 600 }),
  controller.get
);

// Create product
router.post('/', 
  ...createRoute(validateCreateProduct),
  controller.create
);

// Update product
router.put('/:id', 
  ...updateRoute(validateUpdateProduct, {
    getResource: async (req) => controller.getProductById(req.params.id)
  }),
  controller.update
);

// Delete product
router.delete('/:id', 
  ...deleteRoute(),
  controller.delete
);

module.exports = router;
```

### Auth Routes

```javascript
const express = require('express');
const router = express.Router();
const { authRoute, passwordResetRoute } = require('./decorators');
const {
  validateLogin,
  validateRegister,
  validateForgotPassword,
  validateResetPassword,
} = require('./validators/auth');

const controller = require('./controllers/auth');

router.post('/login', ...authRoute(validateLogin), controller.login);
router.post('/register', ...authRoute(validateRegister), controller.register);
router.post('/forgot-password', ...passwordResetRoute(validateForgotPassword), controller.forgot);
router.post('/reset-password', ...passwordResetRoute(validateResetPassword), controller.reset);

module.exports = router;
```

### User Routes

```javascript
const express = require('express');
const router = express.Router();
const { 
  protect, 
  admin, 
  body, 
  query,
  cacheUser,
} = require('./decorators');

const {
  validateUpdateProfile,
  validateChangePassword,
  validateUsersListQuery,
} = require('./validators/users');

const controller = require('./controllers/users');

// Get profile (with caching)
router.get('/profile', 
  ...protect(), 
  ...cacheUser({ ttl: 60 }),
  controller.getProfile
);

// Update profile
router.put('/profile', 
  ...protect(),
  ...body(validateUpdateProfile),
  controller.updateProfile
);

// Change password
router.post('/change-password',
  ...protect(),
  ...body(validateChangePassword),
  controller.changePassword
);

// Admin: List all users
router.get('/', 
  ...admin(),
  ...query(validateUsersListQuery),
  controller.list
);

module.exports = router;
```

---

## Testing with Decorators

```javascript
const request = require('supertest');
const app = require('../app');

describe('Routes with Decorators', () => {
  describe('Protected Routes', () => {
    it('should block unauthenticated requests', async () => {
      const response = await request(app)
        .get('/api/profile')
        .expect(401);
      
      expect(response.body.error).toBe('Authentication required');
    });
    
    it('should allow authenticated requests', async () => {
      const token = await getAuthToken();
      
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });
  });
  
  describe('Validation Decorators', () => {
    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/orders')
        .send({ invalid: 'data' })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.details).toBeDefined();
    });
  });
  
  describe('Caching Decorators', () => {
    it('should cache responses', async () => {
      const first = await request(app).get('/api/products').expect(200);
      const second = await request(app).get('/api/products').expect(200);
      
      expect(second.body.cached).toBe(true);
    });
  });
});
```

---

## Summary

| Decorator Category | Use Case | Example |
|-------------------|----------|---------|
| **Authentication** | User identity | `...protect()` |
| **Validation** | Input validation | `...body(validator)` |
| **Caching** | Response caching | `...cache({ ttl: 300 })` |
| **Rate Limiting** | Abuse prevention | `...rateApi()` |
| **Combined** | Common patterns | `...apiRoute(validator)` |

### Quick Reference

```javascript
// Authentication
...protect()              // Requires auth
...admin()                // Requires admin
...verified()             // Requires verified email
...optional()             // Optional auth

// Validation
...body(validator)        // Validate body
...query(validator)       // Validate query
...validated(validator)   // Shorthand for body

// Caching
...cache({ ttl: 300 })    // Cache response
...cacheUser()            // Cache user-specific
...invalidate(pattern)    // Invalidate on mutation

// Rate Limiting
...rateAuth()             // Strict (5/15min)
...rateApi()              // Moderate (100/15min)
...rateGeneral()          // Lenient (1000/15min)

// Combined
...apiRoute(validator)    // Auth + rate + validation
...listRoute(validator)   // Auth + validate + cache
...createRoute(validator) // Admin + rate + validation
```

---

**Last Updated**: Phase 7 Milestone 4 Complete  
**Decorators**: 40+ composable patterns  
**Categories**: 5 (auth, validation, caching, rate limiting, combined)
