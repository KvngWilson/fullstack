import { createSelector } from '@reduxjs/toolkit';

export const selectOrdersState = (state) => state.orders;

export const selectOrders = (state) => state.orders.items;

export const selectCurrentOrder = (state) => state.orders.currentOrder;

export const selectOrdersPagination = (state) => state.orders.pagination;

export const selectOrderTrackingById = (state) => state.orders.trackingByOrderId;

export const selectOrdersIsLoading = (state) => state.orders.isLoading;

export const selectOrdersError = (state) => state.orders.error;

export const selectOrdersCount = createSelector([selectOrders], (orders) => orders.length);
