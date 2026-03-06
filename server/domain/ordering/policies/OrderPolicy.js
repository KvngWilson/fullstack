class OrderPolicy {
  static canCancel(orderStatus) {
    return ["pending", "processing"].includes(orderStatus);
  }

  static canRefund(orderStatus) {
    return ["paid", "fulfilled"].includes(orderStatus);
  }
}

module.exports = OrderPolicy;
