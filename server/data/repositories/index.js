const { pool } = require("../../config/db");
const OrderRepository = require("./OrderRepository");
const ProductRepository = require("./ProductRepository");

// Singleton instances
const orderRepository = new OrderRepository(pool);
const productRepository = new ProductRepository(pool);

module.exports = {
  OrderRepository,
  ProductRepository,
  orderRepository,
  productRepository,
};