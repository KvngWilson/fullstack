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
 * - ShippingService: Shipping logic
 */

module.exports = {
  services: {
    OrderService: require("./services/OrderService"),
    CartService: require("./services/CartService"),
    CheckoutService: require("./services/CheckoutService"),
    ShippingService: require("./services/ShippingService"),
  },
  repositories: require("./repositories"),
  // Entities will be added in Phase 4
  // Events will be added in Phase 4
  // Policies will be added in Phase 4
};
