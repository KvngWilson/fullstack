import { wishlistApi } from '@/api/endpoints/wishlist';

export const wishlistService = {
  getWishlist: () => wishlistApi.getWishlist(),
  addToWishlist: (productId) => wishlistApi.addToWishlist(productId),
  removeFromWishlist: (productId) => wishlistApi.removeFromWishlist(productId),
  checkInWishlist: (productId) => wishlistApi.checkInWishlist(productId),
  clearWishlist: () => wishlistApi.clearWishlist(),
};

export default wishlistService;
