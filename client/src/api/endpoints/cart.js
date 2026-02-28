import apiClient from '../client';

export const cartApi = {
  /**
   * Get user's cart
   */
  getCart: async () => {
    return apiClient.get('/cart');
  },

  /**
   * Add item to cart
   */
  addToCart: async (payload) => {
    return apiClient.post('/cart/items', payload);
  },

  /**
   * Update cart item quantity
   */
  updateCartItem: async (payload) => {
    return apiClient.patch(`/cart/items/${payload.cart_item_id}`, {
      quantity: payload.quantity,
    });
  },

  /**
   * Remove item from cart
   */
  removeFromCart: async (cartItemId) => {
    return apiClient.delete(`/cart/items/${cartItemId}`);
  },

  /**
   * Clear cart
   */
  clearCart: async () => {
    return apiClient.delete('/cart');
  },

  /**
   * Get cart item count
   */
  getCartCount: async () => {
    return apiClient.get('/cart/count');
  },
};
