const router = require("express").Router();
const { shortCache } = require("../../../middleware/cache-headers");
const domain = require("../../../../domain");
const { getShippingRates } = domain.ordering.services.ShippingService;
const logger = require("../../../../shared/utils/logger");

// Shipping rates calculation - volatile real-time data
router.post("/rates", shortCache, async (req, res) => {
  try {
    const { destination, origin, items } = req.body;

    // Validate required fields
    if (!destination || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: "Validation error",
        message: "Destination and items array are required",
      });
    }

    // Validate destination fields
    if (!destination.country_code || !destination.city || !destination.postal_code) {
      return res.status(400).json({
        error: "Validation error",
        message: "Destination must include country_code, city, and postal_code",
      });
    }

    // Calculate shipping rates
    const result = await getShippingRates({
      destination,
      origin: origin || {
        country_code: "US",
        city: "San Francisco",
        postal_code: "94102",
        state: "CA",
      },
      items,
    });

    if (result.success) {
      // Transform rates for API response
      const rates = result.rates.slice(0, 10).map(rate => ({
        id: rate.courierId,
        name: rate.courierName,
        service: rate.serviceName,
        cost: Number((Number(rate.totalChargeMinor || 0) / 100).toFixed(2)),
        currency: rate.currency,
        min_delivery_time: rate.minDeliveryDays,
        max_delivery_time: rate.maxDeliveryDays,
        logo_url: null,
      }));

      return res.json({
        success: true,
        rates,
        message: result.message,
      });
    } else {
      const isValidationError =
        result.error?.name === "InvalidShippingRequest" ||
        result.error?.statusCode === 400;

      return res.status(isValidationError ? 400 : 500).json({
        success: false,
        rates: [],
        message: result.message,
        error: result.error?.message || "Failed to calculate shipping rates",
      });
    }
  } catch (error) {
    logger.error("Shipping rate calculation error", { error });
    return res.status(500).json({
      success: false,
      rates: [],
      message: "Internal server error",
      error: error.message,
    });
  }
});

module.exports = router;
