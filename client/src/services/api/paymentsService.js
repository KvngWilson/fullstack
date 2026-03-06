import { paymentsApi } from '@/api/endpoints/payments';

export const paymentsService = {
  createPayment: (payload) => paymentsApi.createPayment(payload),
  listPayments: (params) => paymentsApi.listPayments(params),
  verifyPaymentStatus: (reference) => paymentsApi.verifyPaymentStatus(reference),
  getPaymentById: (paymentId) => paymentsApi.getPaymentById(paymentId),
  getLatestPaymentForOrder: (orderId) => paymentsApi.getLatestPaymentForOrder(orderId),
};

export default paymentsService;
