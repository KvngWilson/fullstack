import apiClient from '../client';

const normalizeOrderListResponse = (response) => ({
  orders: response?.data || response?.orders || [],
  pagination: response?.meta || response?.pagination || null,
});

const normalizeOrderResponse = (response) => response?.data || response;

export const ordersApi = {
  /**
   * Create order from cart
   */
  createOrder: async (payload) => {
    const response = await apiClient.post('/orders', payload);
    return normalizeOrderResponse(response);
  },

  /**
   * Get user's orders
   */
  getOrders: async (page = 1, pageSize = 10, status) => {
    const params = new URLSearchParams({ page: page.toString(), pageSize: pageSize.toString() });
    if (status) params.append('status', status);

    const response = await apiClient.get(`/orders/my-orders?${params.toString()}`);
    return normalizeOrderListResponse(response);
  },

  /**
   * Get order by ID
   */
  getOrderById: async (orderId) => {
    const response = await apiClient.get(`/orders/${orderId}`);
    return normalizeOrderResponse(response);
  },

  /**
   * Cancel order
   */
  cancelOrder: async (orderId) => {
    const response = await apiClient.post(`/orders/${orderId}/cancel`);
    return normalizeOrderResponse(response);
  },

  /**
   * Track order
   */
  trackOrder: async (orderId) => {
    const order = await ordersApi.getOrderById(orderId);
    return {
      order_id: order?.id || orderId,
      status: order?.status || 'unknown',
      updated_at: order?.updated_at || null,
    };
  },
};
