/**
 * Payments Domain Controllers
 * Exports payment processing controllers
 */

const payment = require("./payment");
const paymentSupport = require("../../../../domain/payment/services/payment.support");

module.exports = {
  payment,
  paymentSupport,
};
