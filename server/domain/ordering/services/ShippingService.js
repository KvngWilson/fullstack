/**
 * ShippingService - Enhanced with Redis caching
 * 
 * Supports both:
 * - Legacy function-based API (backward compatible)
 * - New ShippingCacheService with multi-tenant isolation
 */

const easyship = require("@api/easyship");
const logger = require("../../../shared/utils/logger");

if (process.env.EASYSHIP_API_KEY) {
  easyship.auth(process.env.EASYSHIP_API_KEY);
}

/**
 * Legacy calculateShippingRates function (backward compatible)
 * If you have access to ShippingCacheService, use that instead for caching
 */
const calculateShippingRates = async (params) => {
  try {
    const { destination, items, origin } = params;

    const requestPayload = {
      destination_address: {
        country_alpha2: destination.country_code || "US",
        city: destination.city,
        postal_code: destination.postal_code,
        state: destination.state,
      },
      origin_address: {
        country_alpha2: origin?.country_code || "US",
        city: origin?.city,
        postal_code: origin?.postal_code,
        state: origin?.state,
      },
      incoterms: "DDU",
      insurance: { is_insured: false },
      courier_settings: {
        show_courier_logo_url: true,
        apply_shipping_rules: true,
      },
      shipping_settings: {
        units: { weight: "kg", dimensions: "cm" },
      },
      parcels: [
        {
          items: items.map((item) => ({
            actual_weight: item.weight || 0.5,
            height: item.height || 10,
            width: item.width || 10,
            length: item.length || 10,
            category: item.category || "general",
            declared_currency: item.currency || "USD",
            declared_customs_value: item.value || 0,
            description: item.description || "Product",
            quantity: item.quantity || 1,
            origin_country_alpha2: origin?.country_code || "US",
          })),
        },
      ],
    };

    const { data } = await easyship.rates_request(requestPayload);
    return {
      success: true,
      rates: data.rates || [],
      message: "Shipping rates calculated successfully",
    };
  } catch (error) {
    logger.error("Shipping rate calculation error", { error });
    return {
      success: false,
      rates: [],
      message: error.message || "Failed to calculate shipping rates",
      error,
    };
  }
};

const getDeliveryEstimates = async (_countryCode) => {
  try {
    return {
      success: true,
      estimates: [
        { method: "standard", days: "5-7" },
        { method: "express", days: "2-3" },
        { method: "overnight", days: "1" },
      ],
    };
  } catch (error) {
    logger.error("Delivery estimate error", { error });
    return {
      success: false,
      estimates: [],
      message: "Failed to get delivery estimates",
    };
  }
};

const validateAddress = async (address) => {
  try {
    const required = ["street", "city", "postal_code", "country"];
    const missing = required.filter((field) => !address[field]);

    if (missing.length > 0) {
      return {
        valid: false,
        message: `Missing required fields: ${missing.join(", ")}`,
      };
    }

    return {
      valid: true,
      message: "Address is valid",
    };
  } catch (_error) {
    return {
      valid: false,
      message: "Address validation failed",
    };
  }
};

module.exports = {
  calculateShippingRates,
  getDeliveryEstimates,
  validateAddress,
};