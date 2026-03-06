const { InvalidShippingRequest } = require("../../../shared/utils/errors");

class ShippingRatePolicy {
  static validateRateRequest({ cartItems, address } = {}) {
    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
      throw new InvalidShippingRequest("Cart must contain at least one item");
    }

    const requiredAddressFields = ["country_code", "city", "postal_code", "state"];
    const missingFields = requiredAddressFields.filter((field) => !address?.[field]);

    if (missingFields.length > 0) {
      throw new InvalidShippingRequest(`Invalid address: missing ${missingFields.join(", ")}`);
    }
  }

  static isValidRate(rate) {
    const required = [
      "easyshipRateId",
      "courierId",
      "courierName",
      "totalChargeMinor",
      "currency",
    ];

    return required.every(
      (field) => rate?.[field] !== undefined && rate?.[field] !== null,
    );
  }
}

module.exports = ShippingRatePolicy;
