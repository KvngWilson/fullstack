/**
 * ShippingService - Ordering domain adapter for shipping rates
 *
 * Uses ShippingCacheService as the canonical rate engine.
 */

const logger = require("../../../shared/utils/logger");
const { redisClient } = require("../../../config/redis");
const ShippingCacheClient = require("../../../infrastructure/cache/ShippingCacheClient");
const EasyshipGateway = require("../../../infrastructure/shipping/EasyshipGateway");
const ShippingCacheService = require("../../shipping/services/ShippingCacheService");
const { InvalidShippingRequest } = require("../../../shared/utils/errors");

const cacheClient = new ShippingCacheClient(redisClient);
const easyshipGateway = new EasyshipGateway();
const shippingCacheService = new ShippingCacheService(
  cacheClient,
  easyshipGateway,
);

const DEFAULT_VENDOR_ID = Number.parseInt(
  process.env.DEFAULT_VENDOR_ID || "1",
  10,
);

const getShippingRates = async (params = {}) => {
  try {
    const {
      destination,
      items = [],
      vendorId,
      currency = "USD",
      apiKey,
    } = params;

    if (!destination) {
      throw new InvalidShippingRequest("Destination address is required");
    }

    const effectiveVendorId = Number.isInteger(Number(vendorId))
      ? Number(vendorId)
      : DEFAULT_VENDOR_ID;

    const rates = await shippingCacheService.getShippingRates({
      vendorId: effectiveVendorId,
      cartItems: items,
      address: destination,
      currency,
      apiKey,
    });

    return {
      success: true,
      rates,
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

module.exports = {
  getShippingRates,
};
