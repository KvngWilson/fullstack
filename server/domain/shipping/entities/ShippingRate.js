class ShippingRate {
  constructor({
    easyshipRateId,
    courierId,
    courierName,
    totalChargeMinor,
    currency,
  } = {}) {
    this.easyshipRateId = easyshipRateId;
    this.courierId = courierId;
    this.courierName = courierName;
    this.totalChargeMinor = Number(totalChargeMinor) || 0;
    this.currency = currency;
  }

  isValid() {
    return Boolean(
      this.easyshipRateId &&
        this.courierId &&
        this.courierName &&
        this.currency &&
        Number.isFinite(this.totalChargeMinor),
    );
  }
}

module.exports = ShippingRate;
