import { createSelector } from '@reduxjs/toolkit';

export const selectCartState = (state) => state.cart;

export const selectCart = (state) => state.cart.cart;

export const selectCartItems = (state) => state.cart.cart?.items || [];

export const selectCartItemCount = createSelector([selectCart], (cart) => {
  if (!cart) {
    return 0;
  }

  if (typeof cart.item_count === 'number') {
    return cart.item_count;
  }

  if (Array.isArray(cart.items)) {
    return cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  }

  return 0;
});

export const selectCartSubtotal = createSelector([selectCart], (cart) => {
  if (!cart) {
    return 0;
  }

  if (cart.subtotal != null) {
    return Number(cart.subtotal);
  }

  if (cart.total != null) {
    return Number(cart.total);
  }

  if (Array.isArray(cart.items)) {
    return cart.items.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
  }

  return 0;
});

export const selectIsCartDrawerOpen = (state) => state.cart.isDrawerOpen;

export const selectCartIsLoading = (state) => state.cart.isLoading;

export const selectCartError = (state) => state.cart.error;
