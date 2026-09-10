class OrderPolicy {
  static canCancel(orderStatus) {
    return ["pending", "processing"].includes(orderStatus);
  }

  static canRefund(orderStatus) {
    return ["paid", "shipped", "delivered", "fulfilled"].includes(orderStatus);
  }
}

module.exports = OrderPolicy;
