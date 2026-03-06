class ShipmentStatusUpdated {
  constructor({
    orderId,
    shipmentId,
    previousStatus = null,
    currentStatus,
    occurredAt = new Date(),
  } = {}) {
    this.type = "shipping.shipment.status_updated";
    this.orderId = orderId;
    this.shipmentId = shipmentId;
    this.previousStatus = previousStatus;
    this.currentStatus = currentStatus;
    this.occurredAt = occurredAt;
  }
}

module.exports = ShipmentStatusUpdated;
