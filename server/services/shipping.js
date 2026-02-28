const easyship = require("@api/easyship");
const logger = require("../utils/logger");

// Configure Easyship API key from environment
if (process.env.EASYSHIP_API_KEY) {
  easyship.auth(process.env.EASYSHIP_API_KEY);
}

/**
 * Calculate shipping rates for a given order
 * @param {Object} params - Shipping parameters
 * @param {Object} params.destination - Destination address
 * @param {Array} params.items - Array of items to ship
 * @param {Object} params.origin - Origin address
 * @returns {Promise<Object>} Shipping rates and options
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
      incoterms: "DDU", // Delivered Duty Unpaid
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
      error: error,
    };
  }
};

/**
 * Get estimated delivery times for shipping options
 * @param {string} countryCode - Destination country code
 * @returns {Promise<Object>} Delivery estimates
 */
const getDeliveryEstimates = async (countryCode) => {
  try {
    // This is a placeholder - implement actual Easyship delivery time API
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

/**
 * Validate shipping address
 * @param {Object} address - Address to validate
 * @returns {Promise<Object>} Validation result
 */
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
  } catch (error) {
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
