import apiClient from "../client";

const getWithFallback = async (primaryPath, fallbackPath) => {
  try {
    return await apiClient.get(primaryPath);
  } catch {
    if (!fallbackPath) {
      throw new Error(`Request failed for ${primaryPath}`);
    }
    return apiClient.get(fallbackPath);
  }
};

const postWithFallback = async (primaryPath, payload, fallbackPath) => {
  try {
    return await apiClient.post(primaryPath, payload);
  } catch {
    if (!fallbackPath) {
      throw new Error(`Request failed for ${primaryPath}`);
    }
    return apiClient.post(fallbackPath, payload);
  }
};

const deleteWithFallback = async (primaryPath, fallbackPath) => {
  try {
    return await apiClient.delete(primaryPath);
  } catch {
    if (!fallbackPath) {
      throw new Error(`Request failed for ${primaryPath}`);
    }
    return apiClient.delete(fallbackPath);
  }
};

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
    const response = await postWithFallback(
      "/ordering/orders",
      payload,
      "/orders",
    );
    return normalizeOrderResponse(response);
  },

  /**
   * Get user's orders
   */
  getOrders: async (page = 1, pageSize = 10, status) => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString(),
    });
    if (status) params.append("status", status);

    const response = await getWithFallback(
      `/ordering/orders/my-orders?${params.toString()}`,
      `/orders/my-orders?${params.toString()}`,
    );
    return normalizeOrderListResponse(response);
  },

  /**
   * Get order by ID
   */
  getOrderById: async (orderId) => {
    const response = await getWithFallback(
      `/ordering/orders/${orderId}`,
      `/orders/${orderId}`,
    );
    return normalizeOrderResponse(response);
  },

  /**
   * Cancel order
   */
  cancelOrder: async (orderId) => {
    const response = await deleteWithFallback(
      `/ordering/orders/${orderId}`,
      `/orders/${orderId}`,
    );
    return normalizeOrderResponse(response);
  },

  /**
   * Track order
   */
  trackOrder: async (orderId) => {
    try {
      const response = await getWithFallback(
        `/ordering/orders/${orderId}/tracking`,
        `/orders/${orderId}/tracking`,
      );
      return response?.data || response;
    } catch {
      const order = await ordersApi.getOrderById(orderId);
      return {
        order_id: order?.id || orderId,
        status: order?.tracking_status || order?.status || "unknown",
        tracking_number: order?.tracking_number || null,
        tracking_url:
          order?.tracking_url || order?.shipment?.tracking_url || null,
        carrier: order?.carrier || order?.shipment?.carrier || null,
        updated_at: order?.tracking_updated_at || order?.updated_at || null,
      };
    }
  },
};
