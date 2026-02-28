import apiClient from '../client';

export const paymentsApi = {
  createPayment: async (payload) => apiClient.post('/payments', payload),
  listPayments: async () => apiClient.get('/payments'),
  verifyPaymentStatus: async (reference) => apiClient.get(`/payments/verify/${reference}`),
  getPaymentById: async (paymentId) => apiClient.get(`/payments/${paymentId}`),
};
