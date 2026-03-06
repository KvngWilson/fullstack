import { createAsyncThunk } from '@reduxjs/toolkit';
import { cartService } from '@/services/api/cartService';
import { getErrorMessage } from '@/utils/getErrorMessage';
import { CLIENT_MOCKS_ENABLED } from '@/utils/runtimeFlags';

const MOCK_CART_KEY = 'mockCartState';

const createEmptyCart = () => ({ cart_id: 'mock-cart', items: [], total: 0, item_count: 0 });

const getMockCart = () => {
  if (!CLIENT_MOCKS_ENABLED) {
    return createEmptyCart();
  }

  try {
    const stored = localStorage.getItem(MOCK_CART_KEY);
    if (!stored) {
      return createEmptyCart();
    }

    const parsed = JSON.parse(stored);
    if (!parsed || !Array.isArray(parsed.items)) {
      return createEmptyCart();
    }

    const total = parsed.items.reduce((sum, item) => sum + Number(item.item_total || 0), 0);
    const itemCount = parsed.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    return {
      cart_id: parsed.cart_id || 'mock-cart',
      items: parsed.items,
      total,
      item_count: itemCount,
    };
  } catch {
    return createEmptyCart();
  }
};

const saveMockCart = (cart) => {
  if (!CLIENT_MOCKS_ENABLED) {
    return;
  }

  try {
    localStorage.setItem(MOCK_CART_KEY, JSON.stringify(cart));
  } catch {
    // Ignore local storage write failures.
  }
};

const fallbackFetchCart = () => getMockCart();

const fallbackAddToCart = (payload = {}) => {
  const variantId = payload.variant_id ?? payload.product_variant_id;
  if (!variantId) {
    return getMockCart();
  }

  const quantity = Math.max(1, Number(payload.quantity || 1));
  const name = payload.product_name || payload.name || 'Product';
  const unitPrice = Number(payload.price || payload.base_price || 49.99);

  const cart = getMockCart();
  const existing = cart.items.find((item) => Number(item.variant_id) === Number(variantId));

  if (existing) {
    existing.quantity += quantity;
    existing.item_total = Number((existing.quantity * Number(existing.unit_price || unitPrice)).toFixed(2));
  } else {
    const newItem = {
      cart_item_id: Date.now(),
      variant_id: Number(variantId),
      quantity,
      unit_price: unitPrice,
      item_total: Number((unitPrice * quantity).toFixed(2)),
      product: { name },
      variant: {
        id: Number(variantId),
        sku: payload.sku || `SKU-${variantId}`,
      },
    };
    cart.items.push(newItem);
  }

  cart.item_count = cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  cart.total = Number(
    cart.items.reduce((sum, item) => sum + Number(item.item_total || 0), 0).toFixed(2),
  );

  const normalized = normalizeCartResponse(cart);
  saveMockCart(normalized);
  return normalized;
};

const fallbackUpdateCartItem = (payload = {}) => {
  const cart = getMockCart();
  const cartItemId = Number(payload.cart_item_id);
  const quantity = Math.max(1, Number(payload.quantity || 1));
  const item = cart.items.find((entry) => Number(entry.cart_item_id) === cartItemId);

  if (item) {
    item.quantity = quantity;
    item.item_total = Number((quantity * Number(item.unit_price || 0)).toFixed(2));
  }

  cart.item_count = cart.items.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
  cart.total = Number(
    cart.items.reduce((sum, entry) => sum + Number(entry.item_total || 0), 0).toFixed(2),
  );

  const normalized = normalizeCartResponse(cart);
  saveMockCart(normalized);
  return normalized;
};

const fallbackRemoveCartItem = (cartItemId) => {
  const cart = getMockCart();
  cart.items = cart.items.filter((item) => Number(item.cart_item_id) !== Number(cartItemId));
  cart.item_count = cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  cart.total = Number(
    cart.items.reduce((sum, item) => sum + Number(item.item_total || 0), 0).toFixed(2),
  );
  const normalized = normalizeCartResponse(cart);
  saveMockCart(normalized);
  return normalized;
};

const fallbackClearCart = () => {
  const cleared = createEmptyCart();
  saveMockCart(cleared);
  return cleared;
};

const normalizeCartResponse = (response) => {
  if (!response) {
    return { cart_id: null, items: [], total: 0, item_count: 0 };
  }

  if (response.data && typeof response.data === 'object') {
    return {
      ...response.data,
      total: Number(response.data.total ?? 0),
      item_count:
        response.data.item_count ??
        (Array.isArray(response.data.items)
          ? response.data.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
          : 0),
    };
  }

  return {
    ...response,
    total: Number(response.total ?? 0),
    item_count:
      response.item_count ??
      (Array.isArray(response.items)
        ? response.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        : 0),
  };
};

const fetchNormalizedCart = async () => {
  const cart = await cartService.getCart();
  const normalized = normalizeCartResponse(cart);
  if (!CLIENT_MOCKS_ENABLED) {
    return normalized;
  }

  const mock = getMockCart();
  if (Number(mock.item_count || 0) > Number(normalized.item_count || 0)) {
    return mock;
  }
  return normalized;
};

export const fetchCartThunk = createAsyncThunk('cart/fetchCart', async (_, { rejectWithValue }) => {
  try {
    return await fetchNormalizedCart();
  } catch (error) {
    if (!CLIENT_MOCKS_ENABLED) {
      return rejectWithValue(getErrorMessage(error));
    }

    try {
      return fallbackFetchCart();
    } catch {
      return rejectWithValue(getErrorMessage(error));
    }
  }
});

export const addToCartThunk = createAsyncThunk(
  'cart/addToCart',
  async (payload, { rejectWithValue }) => {
    if (!CLIENT_MOCKS_ENABLED) {
      try {
        await cartService.addToCart(payload);
        return await fetchNormalizedCart();
      } catch (error) {
        return rejectWithValue(getErrorMessage(error));
      }
    }

    try {
      const mockCart = fallbackAddToCart(payload);
      try {
        await cartService.addToCart(payload);
      } catch {
        // Ignore API failures and keep deterministic local cart state.
      }
      return mockCart;
    } catch (error) {
      try {
        return fallbackAddToCart(payload);
      } catch {
        return rejectWithValue(getErrorMessage(error));
      }
    }
  }
);

export const updateCartItemThunk = createAsyncThunk('cart/updateCartItem', async (payload, { rejectWithValue }) => {
  if (!CLIENT_MOCKS_ENABLED) {
    try {
      await cartService.updateCartItem(payload);
      return await fetchNormalizedCart();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }

  try {
    const mockCart = fallbackUpdateCartItem(payload);
    try {
      await cartService.updateCartItem(payload);
    } catch {
      // Ignore API failures and keep deterministic local cart state.
    }
    return mockCart;
  } catch (error) {
    try {
      return fallbackUpdateCartItem(payload);
    } catch {
      return rejectWithValue(getErrorMessage(error));
    }
  }
});

export const removeFromCartThunk = createAsyncThunk(
  'cart/removeFromCart',
  async (cartItemId, { rejectWithValue }) => {
    if (!CLIENT_MOCKS_ENABLED) {
      try {
        await cartService.removeFromCart(cartItemId);
        return await fetchNormalizedCart();
      } catch (error) {
        return rejectWithValue(getErrorMessage(error));
      }
    }

    try {
      const mockCart = fallbackRemoveCartItem(cartItemId);
      try {
        await cartService.removeFromCart(cartItemId);
      } catch {
        // Ignore API failures and keep deterministic local cart state.
      }
      return mockCart;
    } catch (error) {
      try {
        return fallbackRemoveCartItem(cartItemId);
      } catch {
        return rejectWithValue(getErrorMessage(error));
      }
    }
  }
);

export const clearCartThunk = createAsyncThunk('cart/clearCart', async (_, { rejectWithValue }) => {
  if (!CLIENT_MOCKS_ENABLED) {
    try {
      await cartService.clearCart();
      return await fetchNormalizedCart();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }

  try {
    const cleared = fallbackClearCart();
    try {
      await cartService.clearCart();
    } catch {
      // Ignore API failures and keep deterministic local cart state.
    }
    return cleared;
  } catch (error) {
    try {
      return fallbackClearCart();
    } catch {
      return rejectWithValue(getErrorMessage(error));
    }
  }
});
