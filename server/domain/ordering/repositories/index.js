const { pool } = require("../../../config/db");
const OrderRepository = require("./OrderRepository");

const orderRepository = new OrderRepository(pool);

module.exports = {
  OrderRepository,
  orderRepository,
};