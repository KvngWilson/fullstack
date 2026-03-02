/**
 * Test Fixtures Index - Phase 7
 * Central export point for all test fixtures across all domains
 */

// Re-export all fixtures from individual domain files
const identityFixtures = require("./identity.fixtures");
const catalogFixtures = require("./catalog.fixtures");
const orderingFixtures = require("./ordering.fixtures");
const paymentFixtures = require("./payment.fixtures");

module.exports = {
  // Named exports for each domain
  identity: identityFixtures,
  catalog: catalogFixtures,
  ordering: orderingFixtures,
  payment: paymentFixtures,

  // Convenience: Direct access to commonly used factories
  users: {
    createCustomer: identityFixtures.createCustomerUser,
    createAdmin: identityFixtures.createAdminUser,
    createUnverified: identityFixtures.createUnverifiedUser,
    createMultiple: identityFixtures.createMultipleUsers,
    createAuthenticated: identityFixtures.createAuthenticatedUser,
  },

  products: {
    createBasic: catalogFixtures.createBasicProduct,
    createPremium: catalogFixtures.createPremiumProduct,
    createMultiple: catalogFixtures.createMultipleProducts,
    createWithVariants: catalogFixtures.createProductWithVariants,
    createLowStock: catalogFixtures.createLowStockProduct,
    createOutOfStock: catalogFixtures.createOutOfStockProduct,
  },

  orders: {
    createAddress: orderingFixtures.createStandardAddress,
    createMultipleAddresses: orderingFixtures.createMultipleAddresses,
    createSimple: orderingFixtures.createSimpleOrder,
    createWithItems: orderingFixtures.createOrderWithItems,
    createCompleted: orderingFixtures.createCompletedOrder,
    createShipping: orderingFixtures.createShippingOrder,
    createCancelled: orderingFixtures.createCancelledOrder,
    createPopulatedCart: orderingFixtures.createPopulatedCart,
    createDiscounted: orderingFixtures.createDiscountedOrder,
    createHighValue: orderingFixtures.createHighValueOrder,
  },

  payments: {
    createPending: paymentFixtures.createPendingPayment,
    createSuccessful: paymentFixtures.createSuccessfulPayment,
    createFailed: paymentFixtures.createFailedPayment,
    createForOrder: paymentFixtures.createPaymentForOrder,
    createRefund: paymentFixtures.createSuccessfulRefund,
    createPartialRefund: paymentFixtures.createPartialRefund,
    createFullReturn: paymentFixtures.createFullReturnWorkflow,
    createPartialReturn: paymentFixtures.createPartialReturnWorkflow,
  },
};


// USAGE EXAMPLES:
//
// 1. Import specific domain fixtures:
//    const { identity } = require('./fixtures');
//    const user = await identity.createCustomerUser();
//
// 2. Use convenience shortcuts:
//    const fixtures = require('./fixtures');
//    const user = await fixtures.users.createCustomer();
//    const product = await fixtures.products.createBasic();
//
// 3. Access all data for a domain:
//    const orderingFixtures = require('./fixtures').ordering;
//    const validPayload = orderingFixtures.validOrderPayload;
//    const scenarios = orderingFixtures.orderWorkflowScenarios;
//
// 4. Full E2E test with all domains:
//    const fixtures = require('./fixtures');
//    const user = await fixtures.users.createAuthenticated();
//    const product = await fixtures.products.createWithVariants(2);
//    const order = await fixtures.orders.createWithItems(user.id);
//    const payment = await fixtures.payments.createSuccessful(order.id, { amount: order.total });
