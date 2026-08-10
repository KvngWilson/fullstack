class ShipmentStatusPolicy {
  static knownExternalStatuses() {
    return [
      "created",
      "label_created",
      "shipped",
      "in_transit",
      "out_for_delivery",
      "delivered",
      "failed",
      "exception",
      "cancelled",
      "lost",
      "damaged",
    ];
  }

  static isKnownExternalStatus(externalStatus) {
    const normalized = String(externalStatus || "").toLowerCase();
    return this.knownExternalStatuses().includes(normalized);
  }

  static mapExternalStatus(externalStatus) {
    const statusMap = {
      created: "label_created",
      label_created: "label_created",
      shipped: "in_transit",
      in_transit: "in_transit",
      out_for_delivery: "in_transit",
      delivered: "delivered",
      failed: "failed",
      exception: "failed",
      cancelled: "cancelled",
      lost: "failed",
      damaged: "failed",
    };

    const normalized = String(externalStatus || "").toLowerCase();
    return statusMap[normalized] || "in_transit";
  }
}

module.exports = ShipmentStatusPolicy;
