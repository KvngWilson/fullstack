/**
 * Example Route Definitions Using Decorators
 * 
 * This file demonstrates how to use decorators to simplify route definitions
 * Compare the before/after to see the improvement in readability
 */

const express = require('express');
const router = express.Router();

// Import decorators
const {
  // Auth decorators
  protect,
  admin,
  verified,
  
  // Validation decorators
  body,
  query,
  
  // Caching decorators
  cache,
  cacheUser,
  
  // Combined decorators
  apiRoute,
  listRoute,
  createRoute,
  updateRoute,
  deleteRoute,
  getRoute,
  authRoute,
} = require('./decorators');

// Import validators
const {
  validateCreateOrder,
  validateUpdateOrder,
  validateOrdersListQuery,
} = require('./validators/order');

const {
  validateLogin,
  validateRegister,
} = require('./validators/auth');

// Import controller
const controller = require('./controllers/orders');

// ============================================
// EXAMPLE 1: Basic CRUD with Decorators
// ============================================

// List orders (protected, query validation, user-specific caching)
router.get('/',
  ...listRoute(validateOrdersListQuery, { ttl: 60 }),
  controller.list
);

// Get single order (optional auth, caching)
router.get('/:id',
  ...getRoute({ ttl: 300 }),
  controller.get
);

// Create order (auth, rate limit, validation)
router.post('/',
  ...apiRoute(validateCreateOrder),
  controller.create
);

// Update order (ownership check, validation)
router.put('/:id',
  ...updateRoute(validateUpdateOrder, {
    getResource: async (req) => {
      const result = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
      return result.rows[0];
    }
  }),
  controller.update
);

// Delete order (admin only, rate limit)
router.delete('/:id',
  ...deleteRoute(),
  controller.delete
);

// ============================================
// EXAMPLE 2: Authentication Routes
// ============================================

// Login (rate limited, validated)
router.post('/login',
  ...authRoute(validateLogin),
  controller.login
);

// Register (rate limited, validated)
router.post('/register',
  ...authRoute(validateRegister),
  controller.register
);

// ============================================
// EXAMPLE 3: Before and After Comparison
// ============================================

// --- WITHOUT DECORATORS (Old Way) ---
const { requireAuth } = require('./middleware/auth');
const { validateBody } = require('./middleware/validation');
const { apiLimiter } = require('./middleware/rateLimiter');

router.post('/orders-old-way',
  requireAuth,
  apiLimiter,
  validateBody(validateCreateOrder),
  controller.create
);

// --- WITH DECORATORS (New Way) ---
router.post('/orders-new-way',
  ...apiRoute(validateCreateOrder),
  controller.create
);

// ============================================
// EXAMPLE 4: Custom Decorator Combinations
// ============================================

// Verified users only with validation
router.post('/premium-feature',
  ...verified(),
  ...body(validateCreateOrder),
  controller.premiumFeature
);

// Admin with custom validation and caching
router.get('/admin/reports',
  ...admin(),
  ...query(validateReportQuery),
  ...cache({ ttl: 120 }),
  controller.reports
);

// Protected route with user-specific cache
router.get('/profile',
  ...protect(),
  ...cacheUser({ ttl: 60 }),
  controller.profile
);

// ============================================
// EXAMPLE 5: Mixing Individual Decorators
// ============================================

// You can mix and match decorators as needed
router.post('/complex-endpoint',
  ...protect(),                          // Require auth
  ...body(validateComplexData),          // Validate body
  ...cache({ ttl: 300 }),                // Cache response
  controller.complexOperation
);

module.exports = router;

/**
 * Key Benefits of Using Decorators:
 * 
 * 1. Readability - Intent is immediately clear
 * 2. Reusability - Common patterns are pre-defined
 * 3. Maintainability - Easy to update middleware stacks
 * 4. Consistency - Same patterns across all routes
 * 5. Composability - Mix and match as needed
 * 6. Less Code - Fewer lines, same functionality
 * 
 * Compare:
 * 
 * OLD (5 lines):
 *   requireAuth,
 *   apiLimiter,
 *   validateBody(validator),
 *   controller.create
 * 
 * NEW (2 lines):
 *   ...apiRoute(validator),
 *   controller.create
 */
