import { ordersApi } from '@/api/endpoints/orders';

export const ordersService = {
  createOrder: (payload) => ordersApi.createOrder(payload),
  getOrders: (page = 1, pageSize = 10, status) => ordersApi.getOrders(page, pageSize, status),
  getOrderById: (orderId) => ordersApi.getOrderById(orderId),
  cancelOrder: (orderId) => ordersApi.cancelOrder(orderId),
  trackOrder: (orderId) => ordersApi.trackOrder(orderId),
};

export default ordersService;
