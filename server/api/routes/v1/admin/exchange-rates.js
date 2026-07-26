const express = require("express");
const { protect, permission } = require("../../../decorators");
const exchangeRatesControllers = require("../../../controllers/v1/admin/exchange-rates");
const { query, params, body } = require("../../../decorators");
const {
  validateListRatesQuery,
  validateRateHistoryParams,
  validateRateHistoryQuery,
  validateExchangeRateIdParam,
  validateCreateExchangeRate,
  validateUpdateExchangeRate,
} = require("../../../validators/admin");
const PERMISSIONS = require("../../../../shared/constants/permissions");

const router = express.Router();

/**
 * Admin Exchange Rates Management Routes
 * Public current-rate endpoint remains open
 * All other routes require authentication and explicit permission checks
 */

// GET /api/v1/admin/exchange-rates/current/:from/:to - Get current rate (public)
router.get("/current/:from/:to", exchangeRatesControllers.getCurrentRate);

router.use(...protect());

// GET /api/v1/admin/exchange-rates - List exchange rates
router.get(
  "/",
  ...permission(PERMISSIONS.EXCHANGE_RATES.READ),
  ...query(validateListRatesQuery),
  exchangeRatesControllers.listExchangeRates,
);

// GET /api/v1/admin/exchange-rates/history/:from/:to - Get rate history
router.get(
  "/history/:from/:to",
  ...permission(PERMISSIONS.EXCHANGE_RATES.READ),
  ...params(validateRateHistoryParams),
  ...query(validateRateHistoryQuery),
  exchangeRatesControllers.getRateHistory,
);

// POST /api/v1/admin/exchange-rates - Create exchange rate
router.post(
  "/",
  ...permission(PERMISSIONS.EXCHANGE_RATES.CREATE),
  ...body(validateCreateExchangeRate),
  exchangeRatesControllers.createExchangeRate,
);

// GET /api/v1/admin/exchange-rates/:id - Get exchange rate details
router.get(
  "/:id",
  ...permission(PERMISSIONS.EXCHANGE_RATES.READ),
  ...params(validateExchangeRateIdParam),
  exchangeRatesControllers.getExchangeRate,
);

// PUT /api/v1/admin/exchange-rates/:id - Update exchange rate
router.put(
  "/:id",
  ...permission(PERMISSIONS.EXCHANGE_RATES.UPDATE),
  ...params(validateExchangeRateIdParam),
  ...body(validateUpdateExchangeRate),
  exchangeRatesControllers.updateExchangeRate,
);

// DELETE /api/v1/admin/exchange-rates/:id - Deactivate exchange rate
router.delete(
  "/:id",
  ...permission(PERMISSIONS.EXCHANGE_RATES.DEACTIVATE),
  ...params(validateExchangeRateIdParam),
  exchangeRatesControllers.deactivateRate,
);

module.exports = router;
