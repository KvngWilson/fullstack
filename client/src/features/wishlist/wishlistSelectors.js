export const selectWishlistItems = (state) => state.wishlist.items;
export const selectWishlistIsLoading = (state) => state.wishlist.isLoading;
export const selectWishlistError = (state) => state.wishlist.error;
export const selectWishlistCount = (state) => state.wishlist.items.length;
export const selectIsInWishlist = (productId) => (state) =>
  state.wishlist.items.some((item) => item.product_id === productId);
