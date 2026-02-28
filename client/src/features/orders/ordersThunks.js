import { createAsyncThunk } from '@reduxjs/toolkit';
import { ordersApi } from '@/api/endpoints/orders';
import { getErrorMessage } from '@/utils/getErrorMessage';

export const fetchOrdersThunk = createAsyncThunk(
  'orders/fetchOrders',
  async ({ page = 1, pageSize = 10, status } = {}, { rejectWithValue }) => {
    try {
      return await ordersApi.getOrders(page, pageSize, status);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const fetchOrderByIdThunk = createAsyncThunk(
  'orders/fetchOrderById',
  async (orderId, { rejectWithValue }) => {
    try {
      return await ordersApi.getOrderById(orderId);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const createOrderThunk = createAsyncThunk(
  'orders/createOrder',
  async (payload, { rejectWithValue }) => {
    try {
      return await ordersApi.createOrder(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const cancelOrderThunk = createAsyncThunk(
  'orders/cancelOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      return await ordersApi.cancelOrder(orderId);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const trackOrderThunk = createAsyncThunk(
  'orders/trackOrder',
  async (orderId, { rejectWithValue }) => {
    try {
      const tracking = await ordersApi.trackOrder(orderId);
      return { orderId, tracking };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);
