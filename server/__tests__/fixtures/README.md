# Test Fixtures - Phase 7

Comprehensive test data factories and fixtures for all four domains: identity, catalog, ordering, and payment.

## Overview

Test fixtures provide:
- **Factory Functions**: Create pre-configured test data for each domain
- **Mock Data**: Valid and invalid payloads for testing validation
- **Test Scenarios**: Common testing scenarios and workflows
- **Presets**: Quick-start fixture configurations for common test patterns
- **Sample Data**: Collections of realistic test values

## Without Fixtures (Old Way)

Before Phase 7:
```javascript
// Manual test data creation - tedious and error-prone
const result = await pool.query(
  `INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified)
   VALUES ($1, $2, $3, $4, $5, $6)`,
  [email, hash, fname, lname, "customer", true]
);
const userId = result.rows[0].id;
const token = jwt.sign({ id: userId }, secret);
// ... more manual setup ...
```

## With Fixtures (New Way - Phase 7)

```javascript
const fixtures = require("../__tests__/fixtures");

// Simple one-liner
const user = await fixtures.users.createCustomer();

// With authentication
const authenticatedUser = await fixtures.users.createAuthenticated();

// Complex E2E scenario with fixtures
const user = await fixtures.users.createCustomer();
const product = await fixtures.products.createWithVariants(3);
const order = await fixtures.orders.createWithItems(user.id);
const payment = await fixtures.payments.createSuccessful(order.id);
```

## Structure

```
__tests__/
├── fixtures/
│   ├── index.js                    # Central export point
│   ├── identity.fixtures.js        # User/auth fixtures
│   ├── catalog.fixtures.js         # Product/variant fixtures
│   ├── ordering.fixtures.js        # Order/cart/address fixtures
│   └── payment.fixtures.js         # Payment/refund fixtures
└── helpers/
    └── testHelpers.js              # Core helper functions
```

## Domain Fixtures

### Identity Fixtures (`identity.fixtures.js`)

User and authentication testing.

**Factories:**
```javascript
const { identity } = require("../fixtures");

// Create standard customer
const customer = await identity.createCustomerUser();

// Create admin user
const admin = await identity.createAdminUser();

// Create unverified user
const unverified = await identity.createUnverifiedUser();

// Create multiple users
const users = await identity.createMultipleUsers(5);

// Create authenticated user with tokens
const authUser = await identity.createAuthenticatedUser();
// Returns: { ...user, accessToken, refreshToken, authHeader }
```

**Mock Data:**
```javascript
identity.validRegistrationPayload
// { email, password, first_name, last_name }

identity.invalidRegistrationPayloads
// { missingEmail, missingPassword, invalidEmail, weakPassword }

identity.authScenarios
// { validCustomer, validAdmin, invalidToken, expiredToken, missingToken }
```

### Catalog Fixtures (`catalog.fixtures.js`)

Product and variant testing.

**Factories:**
```javascript
const { catalog } = require("../fixtures");

// Create basic product
const product = await catalog.createBasicProduct();

// Create premium product
const premium = await catalog.createPremiumProduct();

// Create product with variants
const withVariants = await catalog.createProductWithVariants(3);

// Create low stock product
const lowStock = await catalog.createLowStockProduct();

// Create out of stock product
const outOfStock = await catalog.createOutOfStockProduct();
```

**Mock Data:**
```javascript
catalog.validProductPayload
catalog.invalidProductPayloads

catalog.validVariantPayload
catalog.invalidVariantPayloads

catalog.catalogScenarios
// { inStock, lowStock, outOfStock, pricing scenarios, etc }

catalog.sampleProductNames
catalog.sampleBrands
catalog.sampleColors
catalog.sampleSizes
```

### Ordering Fixtures (`ordering.fixtures.js`)

Order, cart, and address testing.

**Factories:**
```javascript
const { ordering } = require("../fixtures");

// Create address
const address = await ordering.createStandardAddress(userId);

// Create order
const order = await ordering.createSimpleOrder(userId);

// Create order with items
const withItems = await ordering.createOrderWithItems(userId);

// Create order with specific status
const completed = await ordering.createCompletedOrder(userId);
const shipping = await ordering.createShippingOrder(userId);
const cancelled = await ordering.createCancelledOrder(userId);

// Create cart with products
const cart = await ordering.createPopulatedCart(userId);

// Create discounted order
const discounted = await ordering.createDiscountedOrder(userId, 10.0);

// Create high-value order
const highValue = await ordering.createHighValueOrder(userId);
```

**Mock Data:**
```javascript
ordering.validOrderPayload
ordering.invalidOrderPayloads

ordering.validAddressPayload
ordering.invalidAddressPayloads

ordering.orderWorkflowScenarios
ordering.checkoutScenarios
ordering.shippingScenarios
ordering.sampleAddresses
```

### Payment Fixtures (`payment.fixtures.js`)

Payment and refund testing.

**Factories:**
```javascript
const { payment } = require("../fixtures");

// Create payment with status
const pending = await payment.createPendingPayment(orderId);
const successful = await payment.createSuccessfulPayment(orderId);
const failed = await payment.createFailedPayment(orderId);

// Create refund
const refund = await payment.createSuccessfulRefund(paymentId);
const partial = await payment.createPartialRefund(paymentId, 50.0);

// Create workflows
const fullReturn = await payment.createFullReturnWorkflow(userId);
// Returns: { order, payment, refund }

const partialReturn = await payment.createPartialReturnWorkflow(userId, 25.0);

// Create error scenarios
const paymentError = await payment.createPaymentErrorScenario(orderId, "card_declined");

// Create webhook test scenario
const webhook = await payment.createWebhookTestPayment(orderId);
```

**Mock Data:**
```javascript
payment.validPaymentPayload
payment.invalidPaymentPayloads

payment.validRefundPayload
payment.invalidRefundPayloads

payment.paymentWorkflowScenarios
payment.refundWorkflowScenarios
payment.paymentErrorScenarios

payment.stripeTestCards
payment.supportedPaymentMethods
payment.refundReasons
payment.supportedCurrencies
```

## Convenience Shortcuts

The root fixtures `index.js` provides convenient shortcuts:

```javascript
const fixtures = require("../__tests__/fixtures");

// User shortcuts
await fixtures.users.createCustomer();
await fixtures.users.createAdmin();
await fixtures.users.createAuthenticated();

// Product shortcuts
await fixtures.products.createBasic();
await fixtures.products.createPremium();
await fixtures.products.createWithVariants(3);

// Order shortcuts
await fixtures.orders.createSimple(userId);
await fixtures.orders.createWithItems(userId);
await fixtures.orders.createCompleted(userId);

// Payment shortcuts
await fixtures.payments.createSuccessful(orderId);
await fixtures.payments.createRefund(paymentId);
await fixtures.payments.createFullReturn(userId);
```

## Common Testing Patterns

### Unit Test with Fixtures

```javascript
describe("UserService", () => {
  let testUser;

  beforeEach(async () => {
    testUser = await fixtures.users.createCustomer();
  });

  afterEach(async () => {
    await testHelpers.cleanupUser(testUser.id);
  });

  it("should retrieve user by ID", async () => {
    const user = await userService.getUserById(testUser.id);
    expect(user.email).toBe(testUser.email);
  });
});
```

### Integration Test with Complete Workflow

```javascript
describe("Checkout Flow", () => {
  it("should complete full checkout", async () => {
    // Setup: Create customer with authenticated context
    const user = await fixtures.users.createAuthenticated();

    // Create products and add to cart
    const product = await fixtures.products.createWithVariants();
    const cart = await fixtures.orders.createPopulatedCart(user.id);

    // Create order
    const order = await fixtures.orders.createWithItems(user.id);

    // Process payment
    const payment = await fixtures.payments.createSuccessful(order.id);

    // Verify state
    expect(payment.status).toBe("succeeded");
  });
});
```

### E2E Test with All Domains

```javascript
describe("Complete Customer Journey", () => {
  it("should complete purchase and support return", async () => {
    // Identity: Create and authenticate customer
    const customer = await fixtures.users.createAuthenticated();

    // Catalog: Browse products
    const products = await fixtures.products.createMultiple(5);
    const selectedProduct = await fixtures.products.createWithVariants(2);

    // Ordering: Add to cart and checkout
    await fixtures.orders.addToCart(
      customer.id,
      selectedProduct.variants[0].id,
      1
    );
    const order = await fixtures.orders.createOrderWithItems(customer.id);

    // Payment: Process payment
    const payment = await fixtures.payments.createSuccessful(order.id, {
      amount: order.total,
    });

    // Payment: Handle return
    const refund = await fixtures.payments.createSuccessfulRefund(
      payment.id,
      { amount: order.total }
    );

    expect(refund.status).toBe("succeeded");
  });
});
```

### Testing with Mock Data

```javascript
describe("Authentication", () => {
  const { validRegistrationPayload, invalidRegistrationPayloads } =
    require("../__tests__/fixtures").identity;

  it("should accept valid registration", async () => {
    const response = await request(app).post("/auth/register").send(
      validRegistrationPayload
    );

    expect(response.status).toBe(201);
  });

  it("should reject invalid email", async () => {
    const response = await request(app)
      .post("/auth/register")
      .send(invalidRegistrationPayloads.invalidEmail);

    expect(response.status).toBe(400);
  });
});
```

### Testing Validation Scenarios

```javascript
describe("Product Validation", () => {
  const { catalogScenarios } = require("../__tests__/fixtures").catalog;

  Object.entries(catalogScenarios).forEach(([scenario, config]) => {
    it(`should handle ${scenario}`, async () => {
      const product = await fixtures.products.createBasic({
        base_price: config.base_price,
      });

      expect(product.base_price).toBe(config.expectedPrice || config.base_price);
    });
  });
});
```

## Test Cleanup

Always clean up after tests:

```javascript
afterEach(async () => {
  await testHelpers.cleanupTestData(); // Clean all test data
  // OR
  await testHelpers.cleanupUser(userId); // Clean specific user
});

afterAll(async () => {
  await pool.end(); // Close database connection
});
```

## Best Practices

1. **Use Presets**: Leverage presets for common scenarios
   ```javascript
   const { customerUserPreset } = fixtures.identity;
   ```

2. **Compose Fixtures**: Build complex scenarios from simpler factories
   ```javascript
   const user = await fixtures.users.createCustomer();
   const product = await fixtures.products.createWithVariants();
   const order = await fixtures.orders.createWithItems(user.id);
   ```

3. **Override Defaults**: Pass overrides for custom variations
   ```javascript
   const premium = await fixtures.products.createBasic({
     base_price: 199.99,
     brand: "Premium Brand",
   });
   ```

4. **Use Mock Data**: Leverage provided payloads for validation testing
   ```javascript
   Object.entries(fixtures.identity.invalidRegistrationPayloads).forEach(
     ([key, payload]) => {
       // Test each invalid case
     }
   );
   ```

5. **Group Cleanup**: Minimize database queries in cleanup
   ```javascript
   await testHelpers.cleanupTestData(); // Much faster than individual deletes
   ```

## Extending Fixtures

To add new fixture factories:

1. **Add to appropriate domain file**:
   ```javascript
   // In identity.fixtures.js
   async function createCustomizedUser(customization) {
     // Implementation
   }
   module.exports = { createCustomizedUser, ... };
   ```

2. **Update index.js** shortcuts if needed:
   ```javascript
   users: {
     createCustom: identityFixtures.createCustomizedUser,
     // ...
   }
   ```

3. **Add to documentation** above

## Performance Considerations

- **Factories are async**: Each call queries the database. Cache results if creating multiple items:
  ```javascript
  const products = await Promise.all([
    fixtures.products.createBasic(),
    fixtures.products.createBasic(),
    fixtures.products.createBasic(),
  ]);
  ```

- **Cleanup is crucial**: Use `afterEach` hooks to prevent data bloat
- **Override sparingly**: Only override fields you need to test
- **Reuse fixtures**: Don't create new ones for each assertion in a test

## Related Files

- **Test Helpers**: [testHelpers.js](./helpers/testHelpers.js) - Core database operations
- **Test Setup**: [setup.js](./setup.js) - Test environment configuration
- **Integration Tests**: [integration/](./integration/) - Example usage
- **Unit Tests**: [unit/](./unit/) - Example usage

## Contributing

When adding new test scenarios or fixtures:

1. Keep fixtures domain-focused
2. Provide both factories and mock data
3. Include realistic defaults
4. Document usage examples
5. Update this README

---

**Phase 7 Milestone**: Test Fixtures [COMPLETE]
