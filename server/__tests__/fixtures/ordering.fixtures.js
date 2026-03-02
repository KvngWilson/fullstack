/**
 * Ordering Domain Test Fixtures
 * Provides pre-configured test data and factories for orders/cart testing
 */

const testHelpers = require("../helpers/testHelpers");

// ===== FIXTURE DEFAULTS =====

const ADDRESS_DEFAULTS = {
  street: "123 Main Street",
  city: "Test City",
  state: "TC",
  postal_code: "12345",
  country: "Test Country",
  is_default: false,
};

const ORDER_DEFAULTS = {
  subtotal: 100.0,
  tax: 10.0,
  discount: 0.0,
  shipping_cost: 5.0,
  total: 115.0,
  status: "pending",
};

const CART_DEFAULTS = {
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
};

// ===== FIXTURE FACTORIES =====

/**
 * Create standard address
 */
async function createStandardAddress(userId, overrides = {}) {
  return testHelpers.createTestAddress(userId, {
    ...ADDRESS_DEFAULTS,
    ...overrides,
  });
}

/**
 * Create default billing address
 */
async function createDefaultAddress(userId, overrides = {}) {
  return testHelpers.createTestAddress(userId, {
    ...ADDRESS_DEFAULTS,
    is_default: true,
    ...overrides,
  });
}

/**
 * Create multiple addresses for user
 */
async function createMultipleAddresses(userId, count = 3, overrides = {}) {
  const addresses = [];
  const cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix"];

  for (let i = 0; i < Math.min(count, cities.length); i++) {
    const address = await testHelpers.createTestAddress(userId, {
      city: cities[i],
      is_default: i === 0, // First one is default
      ...overrides,
    });
    addresses.push(address);
  }

  return addresses;
}

/**
 * Create simple order
 */
async function createSimpleOrder(userId, overrides = {}) {
  const address = await createStandardAddress(userId);
  return testHelpers.createTestOrder(userId, address.id, {
    ...ORDER_DEFAULTS,
    ...overrides,
  });
}

/**
 * Create order with items
 */
async function createOrderWithItems(userId, orderOverrides = {}) {
  const address = await createStandardAddress(userId);
  const catalogFixtures = require("./catalog.fixtures");

  // Create product with variant
  const product = await catalogFixtures.createBasicProduct();
  const variant = await testHelpers.createTestVariant(product.id);

  const order = await testHelpers.createTestOrder(userId, address.id, {
    ...ORDER_DEFAULTS,
    ...orderOverrides,
  });

  // Add item to order (in real scenario, done through checkout)
  return {
    ...order,
    items: [{ variant, quantity: 1, price: product.base_price }],
    address,
    product,
  };
}

/**
 * Create completed order
 */
async function createCompletedOrder(userId, overrides = {}) {
  return createSimpleOrder(userId, {
    status: "completed",
    ...overrides,
  });
}

/**
 * Create cancelled order
 */
async function createCancelledOrder(userId, overrides = {}) {
  return createSimpleOrder(userId, {
    status: "cancelled",
    ...overrides,
  });
}

/**
 * Create shipping order
 */
async function createShippingOrder(userId, overrides = {}) {
  return createSimpleOrder(userId, {
    status: "shipping",
    ...overrides,
  });
}

/**
 * Create user's cart with products
 */
async function createPopulatedCart(userId) {
  const catalogFixtures = require("./catalog.fixtures");

  // Create multiple products
  const product1 = await catalogFixtures.createBasicProduct({
    name: "Cart Test Product 1",
    base_price: 29.99,
  });
  const variant1 = await testHelpers.createTestVariant(product1.id);

  const product2 = await catalogFixtures.createPremiumProduct({
    name: "Cart Test Product 2",
  });
  const variant2 = await testHelpers.createTestVariant(product2.id);

  // Add to cart
  const item1 = await testHelpers.addToCart(userId, variant1.id, 1);
  const item2 = await testHelpers.addToCart(userId, variant2.id, 2);

  return {
    cartId: item1.cart_id,
    items: [
      { variant: variant1, quantity: 1, product: product1 },
      { variant: variant2, quantity: 2, product: product2 },
    ],
  };
}

/**
 * Create discount scenario
 */
async function createDiscountedOrder(userId, discount = 10.0, overrides = {}) {
  return createSimpleOrder(userId, {
    subtotal: 100.0,
    discount: discount,
    total: 115.0 - discount, // Adjust total by discount
    ...overrides,
  });
}

/**
 * Create high-value order
 */
async function createHighValueOrder(userId, overrides = {}) {
  return createSimpleOrder(userId, {
    subtotal: 500.0,
    tax: 50.0,
    shipping_cost: 15.0,
    total: 565.0,
    ...overrides,
  });
}

// ===== FIXTURE PRESETS =====

/**
 * Preset: Standard address for shipping
 */
const standardAddressPreset = {
  factory: createStandardAddress,
  defaults: ADDRESS_DEFAULTS,
};

/**
 * Preset: Order in pending status
 */
const pendingOrderPreset = {
  factory: createSimpleOrder,
  defaults: { status: "pending" },
};

/**
 * Preset: Completed order
 */
const completedOrderPreset = {
  factory: createCompletedOrder,
  defaults: { status: "completed" },
};

/**
 * Preset: Order with items for integration tests
 */
const orderWithItemsPreset = {
  factory: createOrderWithItems,
  defaults: { status: "pending" },
};

/**
 * Preset: Populated shopping cart
 */
const populatedCartPreset = {
  factory: createPopulatedCart,
  defaults: { itemCount: 2 },
};

// ===== MOCK DATA FOR TESTING =====

/**
 * Valid address payload
 */
const validAddressPayload = {
  street: "456 Oak Avenue",
  city: "New York",
  state: "NY",
  postal_code: "10001",
  country: "United States",
};

/**
 * Invalid address payloads for validation tests
 */
const invalidAddressPayloads = {
  missingStreet: {
    city: "New York",
    state: "NY",
    postal_code: "10001",
    country: "United States",
  },
  missingCity: {
    street: "456 Oak Avenue",
    state: "NY",
    postal_code: "10001",
    country: "United States",
  },
  missingPostalCode: {
    street: "456 Oak Avenue",
    city: "New York",
    state: "NY",
    country: "United States",
  },
  invalidPostalCode: {
    street: "456 Oak Avenue",
    city: "New York",
    state: "NY",
    postal_code: "invalid",
    country: "United States",
  },
};

/**
 * Valid order payload
 */
const validOrderPayload = {
  items: [
    {
      variant_id: 1,
      quantity: 2,
    },
  ],
  shipping_address_id: 1,
  billing_address_id: 1,
};

/**
 * Invalid order payloads for validation tests
 */
const invalidOrderPayloads = {
  missingItems: {
    shipping_address_id: 1,
    billing_address_id: 1,
  },
  emptyItems: {
    items: [],
    shipping_address_id: 1,
    billing_address_id: 1,
  },
  invalidQuantity: {
    items: [
      {
        variant_id: 1,
        quantity: -1,
      },
    ],
    shipping_address_id: 1,
    billing_address_id: 1,
  },
  missingAddresses: {
    items: [
      {
        variant_id: 1,
        quantity: 1,
      },
    ],
  },
};

/**
 * Valid cart item payload
 */
const validCartItemPayload = {
  variant_id: 1,
  quantity: 1,
};

/**
 * Order status workflow scenarios
 */
const orderWorkflowScenarios = {
  newOrder: {
    initialStatus: "pending",
    expectedNextStatus: "confirmed",
    action: "confirmOrder",
  },
  confirmedOrder: {
    initialStatus: "confirmed",
    expectedNextStatus: "shipping",
    action: "shipOrder",
  },
  shippingOrder: {
    initialStatus: "shipping",
    expectedNextStatus: "delivered",
    action: "deliverOrder",
  },
  cancelPendingOrder: {
    initialStatus: "pending",
    expectedNextStatus: "cancelled",
    action: "cancelOrder",
  },
};

/**
 * Checkout flow scenarios
 */
const checkoutScenarios = {
  simpleCheckout: {
    items: 1,
    hasCoupon: false,
    hasTax: true,
    expectedSteps: ["review", "shipping", "payment", "confirmation"],
  },
  multiItemCheckout: {
    items: 3,
    hasCoupon: false,
    hasTax: true,
    expectedSteps: ["review", "shipping", "payment", "confirmation"],
  },
  discountedCheckout: {
    items: 2,
    hasCoupon: true,
    couponCode: "SAVE10",
    expectedDiscount: 10.0,
    hasTax: true,
    expectedSteps: ["review", "shipping", "payment", "confirmation"],
  },
};

/**
 * Shipping scenarios
 */
const shippingScenarios = {
  standardShipping: {
    method: "standard",
    cost: 5.0,
    estimatedDays: 5,
  },
  expressShipping: {
    method: "express",
    cost: 15.0,
    estimatedDays: 2,
  },
  overnightShipping: {
    method: "overnight",
    cost: 25.0,
    estimatedDays: 1,
  },
  localPickup: {
    method: "pickup",
    cost: 0,
    estimatedDays: 1,
  },
};

/**
 * Sample city/state combinations for address testing
 */
const sampleAddresses = [
  {
    street: "123 Main St",
    city: "New York",
    state: "NY",
    postal_code: "10001",
  },
  {
    street: "456 Market St",
    city: "San Francisco",
    state: "CA",
    postal_code: "94102",
  },
  {
    street: "789 Michigan Ave",
    city: "Chicago",
    state: "IL",
    postal_code: "60611",
  },
  {
    street: "101 Colorado Blvd",
    city: "Denver",
    state: "CO",
    postal_code: "80202",
  },
];

module.exports = {
  // Factories
  createStandardAddress,
  createDefaultAddress,
  createMultipleAddresses,
  createSimpleOrder,
  createOrderWithItems,
  createCompletedOrder,
  createCancelledOrder,
  createShippingOrder,
  createPopulatedCart,
  createDiscountedOrder,
  createHighValueOrder,

  // Presets
  standardAddressPreset,
  pendingOrderPreset,
  completedOrderPreset,
  orderWithItemsPreset,
  populatedCartPreset,

  // Mock data
  validAddressPayload,
  invalidAddressPayloads,
  validOrderPayload,
  invalidOrderPayloads,
  validCartItemPayload,

  // Scenarios
  orderWorkflowScenarios,
  checkoutScenarios,
  shippingScenarios,
  sampleAddresses,

  // Constants
  ADDRESS_DEFAULTS,
  ORDER_DEFAULTS,
  CART_DEFAULTS,
};
