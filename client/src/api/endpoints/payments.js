import apiClient from '../client';

const normalizePaymentsList = (response) => {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response?.data?.payments)) {
    return response.data.payments;
  }

  if (Array.isArray(response?.payments)) {
    return response.payments;
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
};

const normalizePayment = (response) => response?.data || response || null;

export const paymentsApi = {
  createPayment: async (payload) => {
    const response = await apiClient.post('/payments', payload);
    return normalizePayment(response);
  },
  listPayments: async ({ page = 1, pageSize = 20, orderId } = {}) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (orderId != null) {
      params.append('order_id', String(orderId));
    }

    const response = await apiClient.get(`/payments?${params.toString()}`);
    return normalizePaymentsList(response);
  },
  verifyPaymentStatus: async (reference) => {
    const response = await apiClient.get(`/payments/verify/${reference}`);
    return normalizePayment(response);
  },
  getPaymentById: async (paymentId) => {
    const response = await apiClient.get(`/payments/${paymentId}`);
    return normalizePayment(response);
  },
  getLatestPaymentForOrder: async (orderId) => {
    const payments = await paymentsApi.listPayments({ page: 1, pageSize: 100, orderId });
    const matches = payments.filter((payment) => Number(payment.order_id) === Number(orderId));
    if (matches.length === 0) {
      return null;
    }

    return matches.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  },
};
