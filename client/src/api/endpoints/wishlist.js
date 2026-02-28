import apiClient from '../client';

export const wishlistApi = {
  /**
   * Get user's wishlist
   */
  getWishlist: async () => {
    const response = await apiClient.get('/wishlist');
    return response?.data || response || [];
  },

  /**
   * Add product to wishlist
   */
  addToWishlist: async (productId) => {
    const response = await apiClient.post('/wishlist', { product_id: productId });
    return response?.data || response;
  },

  /**
   * Remove product from wishlist
   */
  removeFromWishlist: async (productId) => {
    const response = await apiClient.delete(`/wishlist/${productId}`);
    return response?.data || response;
  },

  /**
   * Check if product is in wishlist
   */
  checkInWishlist: async (productId) => {
    const response = await apiClient.get(`/wishlist/check/${productId}`);
    return response?.isInWishlist || false;
  },

  /**
   * Clear entire wishlist
   */
  clearWishlist: async () => {
    const response = await apiClient.delete('/wishlist');
    return response?.data || response;
  },
};
