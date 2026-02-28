import { createAsyncThunk } from '@reduxjs/toolkit';
import { cartApi } from '@/api/endpoints/cart';
import { getErrorMessage } from '@/utils/getErrorMessage';

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
  const cart = await cartApi.getCart();
  return normalizeCartResponse(cart);
};

export const fetchCartThunk = createAsyncThunk('cart/fetchCart', async (_, { rejectWithValue }) => {
  try {
    return await fetchNormalizedCart();
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const addToCartThunk = createAsyncThunk(
  'cart/addToCart',
  async (payload, { rejectWithValue }) => {
    try {
      await cartApi.addToCart(payload);
      return await fetchNormalizedCart();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const updateCartItemThunk = createAsyncThunk('cart/updateCartItem', async (payload, { rejectWithValue }) => {
  try {
    await cartApi.updateCartItem(payload);
    return await fetchNormalizedCart();
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const removeFromCartThunk = createAsyncThunk(
  'cart/removeFromCart',
  async (cartItemId, { rejectWithValue }) => {
    try {
      await cartApi.removeFromCart(cartItemId);
      return await fetchNormalizedCart();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const clearCartThunk = createAsyncThunk('cart/clearCart', async (_, { rejectWithValue }) => {
  try {
    await cartApi.clearCart();
    return { cart_id: null, items: [], total: 0, item_count: 0 };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});
