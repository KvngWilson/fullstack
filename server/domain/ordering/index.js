/**
 * Ordering Domain
 *
 * Handles orders, carts, checkout, and shipping.
 *
 * Aggregates:
 * - Order (aggregate root)
 * - Cart (aggregate root)
 *
 * Services:
 * - OrderService: Order processing
 * - CartService: Shopping cart
 * - CheckoutService: Checkout flow
 * - ShippingService: Shipping rate adapter (ShippingCacheService-backed)
 * - TaxService: Shared tax calculation
 */

module.exports = {
  services: {
    OrderService: require("./services/OrderService"),
    CartService: require("./services/CartService"),
    CheckoutService: require("./services/CheckoutService"),
    CheckoutValidationService: require("./services/CheckoutValidationService"),
    ShippingService: require("./services/ShippingService"),
    TaxService: require("./services/TaxService"),
  },
  repositories: require("./repositories"),
  entities: require("./entities"),
  events: require("./events"),
  policies: require("./policies"),
};
