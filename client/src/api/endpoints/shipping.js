import apiClient from '../client';

const normalizeShippingRatesResponse = (response) => {
  if (Array.isArray(response)) {
    return { success: true, rates: response };
  }

  if (Array.isArray(response?.rates)) {
    return response;
  }

  if (Array.isArray(response?.data?.rates)) {
    return response.data;
  }

  return { success: false, rates: [] };
};

const postShippingRatesWithFallback = async (payload) => {
  try {
    return await apiClient.post('/ordering/shipping/rates', payload);
  } catch {
    return apiClient.post('/shipping/rates', payload);
  }
};

export const shippingApi = {
  /**
   * Calculate shipping rates for destination and items
   */
  calculateShippingRates: async (payload) => {
    const response = await postShippingRatesWithFallback(payload);
    return normalizeShippingRatesResponse(response);
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
