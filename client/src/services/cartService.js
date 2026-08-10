import { cartApi } from "@/api/endpoints/cart";

export const cartService = {
  getCart: () => cartApi.getCart(),
  addToCart: (payload) => cartApi.addToCart(payload),
  updateCartItem: (payload) => cartApi.updateCartItem(payload),
  removeFromCart: (cartItemId) => cartApi.removeFromCart(cartItemId),
  clearCart: () => cartApi.clearCart(),
  getCartCount: () => cartApi.getCartCount(),
};

export default cartService;
