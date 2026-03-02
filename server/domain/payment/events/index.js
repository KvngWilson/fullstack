/**
 * Payment Domain Events
 */

const PaymentInitiated = require("./PaymentInitiated");
const PaymentSucceeded = require("./PaymentSucceeded");
const PaymentFailed = require("./PaymentFailed");
const RefundProcessed = require("./RefundProcessed");

module.exports = {
  PaymentInitiated,
  PaymentSucceeded,
  PaymentFailed,
  RefundProcessed,
};
