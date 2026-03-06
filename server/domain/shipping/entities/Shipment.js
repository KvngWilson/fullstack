class Shipment {
  constructor({
    shipmentId,
    orderId,
    trackingNumber = null,
    courierName = null,
    status = "label_created",
    labelUrl = null,
  } = {}) {
    this.shipmentId = shipmentId;
    this.orderId = orderId;
    this.trackingNumber = trackingNumber;
    this.courierName = courierName;
    this.status = status;
    this.labelUrl = labelUrl;
  }
}

module.exports = Shipment;
