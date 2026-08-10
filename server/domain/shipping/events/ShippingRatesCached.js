class ShippingRatesCached {
  constructor({ vendorId, rateCount = 0, occurredAt = new Date() } = {}) {
    this.type = "shipping.rates.cached";
    this.vendorId = vendorId;
    this.rateCount = Number(rateCount) || 0;
    this.occurredAt = occurredAt;
  }
}

module.exports = ShippingRatesCached;