import { createAsyncThunk } from "@reduxjs/toolkit";
import { wishlistService } from "@/services/wishlistService";
import { getErrorMessage } from "@/utils/getErrorMessage";

export const fetchWishlistThunk = createAsyncThunk(
  "wishlist/fetchWishlist",
  async (_, { rejectWithValue }) => {
    try {
      const data = await wishlistService.getWishlist();
      return data;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const addToWishlistThunk = createAsyncThunk(
  "wishlist/addToWishlist",
  async (productId, { rejectWithValue }) => {
    try {
      await wishlistService.addToWishlist(productId);
      return productId;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const removeFromWishlistThunk = createAsyncThunk(
  "wishlist/removeFromWishlist",
  async (productId, { rejectWithValue }) => {
    try {
      await wishlistService.removeFromWishlist(productId);
      return productId;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const clearWishlistThunk = createAsyncThunk(
  "wishlist/clearWishlist",
  async (_, { rejectWithValue }) => {
    try {
      await wishlistService.clearWishlist();
      return true;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);
