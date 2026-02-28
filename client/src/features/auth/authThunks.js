import { createAsyncThunk } from '@reduxjs/toolkit';
import { authApi } from '@/api/endpoints/auth';
import { getErrorMessage } from '@/utils/getErrorMessage';

export const loginThunk = createAsyncThunk('auth/login', async (credentials, { rejectWithValue }) => {
  try {
    const response = await authApi.login(credentials);
    return response;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const registerThunk = createAsyncThunk('auth/register', async (data, { rejectWithValue }) => {
  try {
    const response = await authApi.register(data);
    return response;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
});

export const refreshTokenThunk = createAsyncThunk(
  'auth/refreshToken',
  async (refreshToken, { rejectWithValue }) => {
  try {
    const response = await authApi.refreshToken(refreshToken);
    return response;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error));
  }
}
);
