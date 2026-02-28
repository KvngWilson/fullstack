import { createSlice } from '@reduxjs/toolkit';
import {
  fetchOrdersThunk,
  fetchOrderByIdThunk,
  createOrderThunk,
  cancelOrderThunk,
  trackOrderThunk,
} from './ordersThunks';

const initialState = {
  items: [],
  currentOrder: null,
  pagination: null,
  trackingByOrderId: {},
  isLoading: false,
  error: null,
};

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    clearCurrentOrder: (state) => {
      state.currentOrder = null;
    },
    clearOrdersError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrdersThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrdersThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = action.payload?.orders || [];
        state.pagination = action.payload?.pagination || null;
      })
      .addCase(fetchOrdersThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to fetch orders';
      })
      .addCase(fetchOrderByIdThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchOrderByIdThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentOrder = action.payload || null;
      })
      .addCase(fetchOrderByIdThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to fetch order details';
      })
      .addCase(createOrderThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createOrderThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        if (action.payload) {
          state.items = [action.payload, ...state.items];
          state.currentOrder = action.payload;
        }
      })
      .addCase(createOrderThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to create order';
      })
      .addCase(cancelOrderThunk.fulfilled, (state, action) => {
        const canceledOrder = action.payload;

        if (!canceledOrder) {
          return;
        }

        state.items = state.items.map((order) =>
          order.id === canceledOrder.id ? canceledOrder : order
        );

        if (state.currentOrder?.id === canceledOrder.id) {
          state.currentOrder = canceledOrder;
        }
      })
      .addCase(cancelOrderThunk.rejected, (state, action) => {
        state.error = action.payload || 'Failed to cancel order';
      })
      .addCase(trackOrderThunk.fulfilled, (state, action) => {
        const { orderId, tracking } = action.payload;
        state.trackingByOrderId[orderId] = tracking;
      })
      .addCase(trackOrderThunk.rejected, (state, action) => {
        state.error = action.payload || 'Failed to track order';
      });
  },
});

export const { clearCurrentOrder, clearOrdersError } = ordersSlice.actions;

export default ordersSlice.reducer;
