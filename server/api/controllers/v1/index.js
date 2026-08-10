/**
 * API Controllers V1 - Domain-Driven Organization
 * All controllers organized by business domain
 */

const auth = require("./auth");
const identity = require("./identity");
const catalog = require("./catalog");
const ordering = require("./ordering");
const payments = require("./payments");
const vendor = require("./vendor");
const wishlist = require("./wishlist");

module.exports = {
  auth,
  identity,
  catalog,
  ordering,
  payments,
  vendor,
  wishlist,
};
