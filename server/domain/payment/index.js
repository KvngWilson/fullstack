/**
 * Payment Domain
 * 
 * Handles payments, refunds, and payment provider integrations.
 * 
 * Services:
 * - PaymentService: Core payment processing
 * - RefundService: Refund processing
 * - PaystackService: Paystack integration
 * - StripeService: Stripe integration
 */

module.exports = {
  services: {
    PaymentService: require("./services/PaymentService"),
    RefundService: require("./services/RefundService"),
    PaystackService: require("./services/PaystackService"),
    StripeService: require("./services/StripeService"),
  },
  repositories: require("./repositories"),
  policies: require("./policies"),
  events: require("./events"),
};
