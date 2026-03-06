class ShipmentLabelCreated {
  constructor({ orderId, shipmentId, trackingNumber = null, occurredAt = new Date() } = {}) {
    this.type = "shipping.shipment.label_created";
    this.orderId = orderId;
    this.shipmentId = shipmentId;
    this.trackingNumber = trackingNumber;
    this.occurredAt = occurredAt;
  }
}

module.exports = ShipmentLabelCreated;
