import apiClient from '../client';
import { guestSessionService } from '@/services/api/guestSessionService';

const isUnauthorized = (error) => {
  const status = error?.status || error?.response?.status;
  return status === 401 || status === 403;
};

const normalizeGuestCartItem = (item = {}) => {
  const variantId = Number(item.productVariantId || item.variant_id || item.id || 0);
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.price || item.unit_price || 0);

  return {
    cart_item_id: variantId,
    variant_id: variantId,
    quantity,
    unit_price: unitPrice,
    item_total: Number((unitPrice * quantity).toFixed(2)),
    product: {
      name: item.name || 'Product',
    },
    variant: {
      id: variantId,
      sku: item.sku || null,
    },
  };
};

const normalizeGuestCartResponse = (response = {}) => {
  const items = Array.isArray(response.items) ? response.items.map(normalizeGuestCartItem) : [];
  const total = Number(response.total || 0);
  const itemCount = Number(
    response.itemCount || items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  );

  return {
    data: {
      cart_id: 'guest-cart',
      items,
      total,
      item_count: itemCount,
    },
  };
};

const buildGuestAddPayload = (payload = {}) => {
  const variantId = payload.variant_id ?? payload.product_variant_id;
  const quantity = Math.max(1, Number(payload.quantity || 1));
  const price = Number(payload.price ?? payload.unit_price ?? payload.base_price ?? 0);

  return {
    productVariantId: Number(variantId),
    quantity,
    price,
    name: payload.product_name || payload.name || 'Product',
    sku: payload.sku || null,
    weight: payload.weight,
  };
};

const getGuestRequestConfig = async () => ({
  headers: await guestSessionService.getGuestHeaders(),
});

export const cartApi = {
  /**
   * Get user's cart
   */
  getCart: async () => {
    try {
      return await apiClient.get('/ordering/cart');
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error;
      }

      const response = await apiClient.get('/guest/cart', await getGuestRequestConfig());
      return normalizeGuestCartResponse(response);
    }
  },

  /**
   * Add item to cart
   */
  addToCart: async (payload) => {
    try {
      return await apiClient.post('/ordering/cart/items', payload);
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error;
      }

      return apiClient.post(
        '/guest/cart/add',
        buildGuestAddPayload(payload),
        await getGuestRequestConfig(),
      );
    }
  },

  /**
   * Update cart item quantity
   */
  updateCartItem: async (payload) => {
    try {
      return await apiClient.patch(`/ordering/cart/items/${payload.cart_item_id}`, {
        quantity: payload.quantity,
      });
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error;
      }

      return apiClient.patch(
        `/guest/cart/${payload.variant_id || payload.cart_item_id}`,
        { quantity: payload.quantity },
        await getGuestRequestConfig(),
      );
    }
  },

  /**
   * Remove item from cart
   */
  removeFromCart: async (cartItemId) => {
    try {
      return await apiClient.delete(`/ordering/cart/items/${cartItemId}`);
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error;
      }

      return apiClient.delete(`/guest/cart/${cartItemId}`, await getGuestRequestConfig());
    }
  },

  /**
   * Clear cart
   */
  clearCart: async () => {
    try {
      return await apiClient.delete('/ordering/cart');
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error;
      }

      return apiClient.delete('/guest/cart', await getGuestRequestConfig());
    }
  },

  /**
   * Get cart item count
   */
  getCartCount: async () => {
    try {
      return await apiClient.get('/ordering/cart/count');
    } catch (error) {
      if (!isUnauthorized(error)) {
        throw error;
      }

      const cart = await cartApi.getCart();
      return {
        data: Number(cart?.data?.item_count || 0),
      };
    }
  },
};
