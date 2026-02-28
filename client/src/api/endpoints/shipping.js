import apiClient from '../client';

export const shippingApi = {
  /**
   * Calculate shipping rates for destination and items
   */
  calculateShippingRates: async (payload) => {
    const response = await apiClient.post('/shipping/rates', payload);
    return response?.data || response || [];
  },

  /**
   * Get shipping rates for checkout
   */
  getCheckoutShippingRates: async (destination, items) => {
    return shippingApi.calculateShippingRates({
      destination,
      items: items.map((item) => ({
        weight: item.weight || 0.5,
        quantity: item.quantity || 1,
        price: item.price || 0,
      })),
    });
  },
};
