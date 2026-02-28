import { createSlice } from '@reduxjs/toolkit';
import {
  fetchWishlistThunk,
  addToWishlistThunk,
  removeFromWishlistThunk,
  clearWishlistThunk,
} from './wishlistThunks';

const initialState = {
  items: [],
  isLoading: false,
  error: null,
};

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    // Fetch wishlist
    builder
      .addCase(fetchWishlistThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWishlistThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload || [];
      })
      .addCase(fetchWishlistThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to fetch wishlist';
      });

    // Add to wishlist
    builder
      .addCase(addToWishlistThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addToWishlistThunk.fulfilled, (state) => {
        state.isLoading = false;
        // Note: We don't add the item here because we don't have full product data
        // The UI should refetch the wishlist or the thunk should return full data
      })
      .addCase(addToWishlistThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to add to wishlist';
      });

    // Remove from wishlist
    builder
      .addCase(removeFromWishlistThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(removeFromWishlistThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        const productId = action.payload;
        state.items = state.items.filter((item) => item.product_id !== productId);
      })
      .addCase(removeFromWishlistThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to remove from wishlist';
      });

    // Clear wishlist
    builder
      .addCase(clearWishlistThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(clearWishlistThunk.fulfilled, (state) => {
        state.isLoading = false;
        state.items = [];
      })
      .addCase(clearWishlistThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to clear wishlist';
      });
  },
});

export default wishlistSlice.reducer;
