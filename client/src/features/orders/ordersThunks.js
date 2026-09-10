import { createAsyncThunk } from "@reduxjs/toolkit";
import { ordersService } from "@/services/orderService";
import { getErrorMessage } from "@/utils/getErrorMessage";

export const fetchOrdersThunk = createAsyncThunk(
  "orders/fetchOrders",
  async ({ page = 1, pageSize = 10, status } = {}, { rejectWithValue }) => {
    try {
      return await ordersService.getOrders(page, pageSize, status);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchOrderByIdThunk = createAsyncThunk(
  "orders/fetchOrderById",
  async (orderId, { rejectWithValue }) => {
    try {
      return await ordersService.getOrderById(orderId);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const createOrderThunk = createAsyncThunk(
  "orders/createOrder",
  async (payload, { rejectWithValue }) => {
    try {
      return await ordersService.createOrder(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const cancelOrderThunk = createAsyncThunk(
  "orders/cancelOrder",
  async (orderId, { rejectWithValue }) => {
    try {
      return await ordersService.cancelOrder(orderId);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const trackOrderThunk = createAsyncThunk(
  "orders/trackOrder",
  async (orderId, { rejectWithValue }) => {
    try {
      const tracking = await ordersService.trackOrder(orderId);
      return { orderId, tracking };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);
