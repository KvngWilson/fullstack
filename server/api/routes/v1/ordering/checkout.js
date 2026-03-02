const router = require("express").Router();
const { protect } = require("../../../decorators");
const domain = require("../../../../domain");
const CheckoutService = domain.ordering.services.CheckoutService;

const checkoutService = new CheckoutService();

// Checkout page (server-rendered)
router.get("/", ...protect(), async (req, res, next) => {
  try {
    const viewModel = await checkoutService.getCheckoutData(req.user);
    res.render("checkout", viewModel);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
