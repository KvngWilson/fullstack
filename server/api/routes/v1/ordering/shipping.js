const router = require("express").Router();
const domain = require("../../../../domain");
const { calculateShippingRates } = domain.ordering.services.ShippingService;
const logger = require("../../../../shared/utils/logger");

router.post("/rates", async (req, res) => {
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
    const result = await calculateShippingRates({
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
        id: rate.courier_id,
        name: rate.courier_name,
        service: rate.service_name,
        cost: parseFloat(rate.total_charge || 0),
        currency: rate.currency,
        min_delivery_time: rate.min_delivery_time,
        max_delivery_time: rate.max_delivery_time,
        logo_url: rate.courier_logo_url,
      }));

      return res.json({
        success: true,
        rates,
        message: result.message,
      });
    } else {
      return res.status(500).json({
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
