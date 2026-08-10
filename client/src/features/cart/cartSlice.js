import { createSlice } from "@reduxjs/toolkit";
import {
  fetchCartThunk,
  addToCartThunk,
  updateCartItemThunk,
  removeFromCartThunk,
  clearCartThunk,
} from "./cartThunks";

const initialState = {
  cart: null,
  isLoading: false,
  error: null,
  isDrawerOpen: false,
};

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    openCartDrawer: (state) => {
      state.isDrawerOpen = true;
    },
    closeCartDrawer: (state) => {
      state.isDrawerOpen = false;
    },
    toggleCartDrawer: (state) => {
      state.isDrawerOpen = !state.isDrawerOpen;
    },
    clearCartError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Fetch cart
    builder
      .addCase(fetchCartThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCartThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.cart = action.payload;
      })
      .addCase(fetchCartThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Failed to fetch cart";
      });

    // Add to cart
    builder
      .addCase(addToCartThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(addToCartThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.cart = action.payload;
        state.isDrawerOpen = true; // Open cart drawer on add
      })
      .addCase(addToCartThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || "Failed to add item to cart";
      });

    // Update cart item
    builder
      .addCase(updateCartItemThunk.fulfilled, (state, action) => {
        state.cart = action.payload;
      })
      .addCase(updateCartItemThunk.rejected, (state, action) => {
        state.error = action.payload || "Failed to update cart item";
      });

    // Remove from cart
    builder
      .addCase(removeFromCartThunk.fulfilled, (state, action) => {
        state.cart = action.payload;
      })
      .addCase(removeFromCartThunk.rejected, (state, action) => {
        state.error = action.payload || "Failed to remove cart item";
      });

    // Clear cart
    builder
      .addCase(clearCartThunk.fulfilled, (state, action) => {
        state.cart = action.payload;
      })
      .addCase(clearCartThunk.rejected, (state, action) => {
        state.error = action.payload || "Failed to clear cart";
      });
  },
});

export const {
  openCartDrawer,
  closeCartDrawer,
  toggleCartDrawer,
  clearCartError,
} = cartSlice.actions;

export default cartSlice.reducer;
