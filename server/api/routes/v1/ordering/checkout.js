const router = require("express").Router();
const { protect, customer } = require("../../../decorators");
const { privateData } = require("../../../middleware/cache-headers");
const createCheckoutValidationMiddleware = require("../../../middleware/checkoutValidationMiddleware");
const createCheckoutController = require("../../../controllers/v1/ordering/checkout");

const domain = require("../../../../domain");
const CheckoutService = domain.ordering.services.CheckoutService;
const CheckoutValidationService = domain.ordering.services.CheckoutValidationService;
const PaymentService = domain.payment.services.PaymentService;

// Get repository instances
const { orderRepository } = domain.ordering.repositories;
const ShippingCacheClient = require("../../../../infrastructure/cache/ShippingCacheClient");
const EasyshipGateway = require("../../../../infrastructure/shipping/EasyshipGateway");


// Instantiate services
const checkoutService = new CheckoutService();
const shippingCacheClient = new ShippingCacheClient();
const easyshipGateway = new EasyshipGateway();
const checkoutValidationService = new CheckoutValidationService(
  shippingCacheClient,
  easyshipGateway,
  orderRepository
);
const paymentService = new PaymentService();

// Create middleware and controllers
const checkoutValidationMiddleware = createCheckoutValidationMiddleware(checkoutValidationService);
const checkoutController = createCheckoutController(paymentService);

// GET checkout data (JSON for client-side rendering)
router.get("/", ...protect(), privateData, async (req, res, next) => {
  try {
    const checkoutData = await checkoutService.getCheckoutData(req.user);
    res.json(checkoutData);
  } catch (err) {
    if (
      err?.message === "Shipping address is required" ||
      err?.message === "Shipping address not found" ||
      err?.message === "No shipping rates available"
    ) {
      return res.status(400).json({ error: err.message });
    }

    next(err);
  }
});

// POST finalize checkout with payment processing
router.post(
  "/finalize",
  ...customer(),
  privateData,
  checkoutValidationMiddleware,
  checkoutController.finalizeCheckout
);

// POST validate checkout without finalizing (pre-flight check)
router.post(
  "/validate",
  ...customer(),
  privateData,
  checkoutValidationMiddleware,
  checkoutController.validateCheckoutOnly
);

module.exports = router;
