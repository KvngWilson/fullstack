import { createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '@/api/endpoints/auth';
import { getErrorMessage } from '@/utils/getErrorMessage';

/**
 * Login user
 * Token is automatically stored in httpOnly cookie by backend
 * Only user data is returned to store in Redux
 */
export const loginThunk = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      const response = await authApi.login(credentials);
      // Backend automatically sets httpOnly cookie
      // We only return user data for Redux state
      return { user: response.user };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

/**
 * Register new user
 * Token is automatically stored in httpOnly cookie by backend
 * Only user data is returned to store in Redux
 */
export const registerThunk = createAsyncThunk(
  'auth/register',
  async (data, { rejectWithValue }) => {
    try {
      const response = await authApi.register(data);
      // Backend automatically sets httpOnly cookie
      // We only return user data for Redux state
      return { user: response.user };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

/**
 * Logout user
 * Backend clears httpOnly cookies
 */
export const logoutThunk = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.logout();
      // Backend cleared httpOnly cookies
      return null;
    } catch (error) {
      // Even if logout API fails, clear local state
      // Browser will still have the cookies, but they should be expired
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

/**
 * Refresh authentication token
 * Backend uses refresh token from httpOnly cookie to issue new access token
 * Returns updated user data
 */
export const refreshTokenThunk = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.refreshToken();
      // Backend automatically updates httpOnly cookies
      // We return user data if available
      return response.user ? { user: response.user } : null;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

/**
 * Fetch current user (for hydrating Redux on app load)
 * Checks if user is still authenticated
 */
export const fetchCurrentUserThunk = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { rejectWithValue }) => {
    try {
      const response = await authApi.me();
      return { user: response.user };
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }

);
