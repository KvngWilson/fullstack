import { createAsyncThunk } from '@reduxjs/toolkit';
import { profileApi } from '@/api/endpoints/profile';
import { getErrorMessage } from '@/utils/getErrorMessage';

export const fetchUserProfileThunk = createAsyncThunk(
  'user/fetchUserProfile',
  async (_, { rejectWithValue }) => {
    try {
      return await profileApi.getProfile();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const updateUserProfileThunk = createAsyncThunk(
  'user/updateUserProfile',
  async (payload, { rejectWithValue }) => {
    try {
      return await profileApi.updateProfile(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const fetchAddressesThunk = createAsyncThunk(
  'user/fetchAddresses',
  async (_, { rejectWithValue }) => {
    try {
      return await profileApi.getAddresses();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const addAddressThunk = createAsyncThunk(
  'user/addAddress',
  async (payload, { rejectWithValue }) => {
    try {
      return await profileApi.addAddress(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const updateAddressThunk = createAsyncThunk(
  'user/updateAddress',
  async ({ addressId, ...payload }, { rejectWithValue }) => {
    try {
      return await profileApi.updateAddress(addressId, payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const deleteAddressThunk = createAsyncThunk(
  'user/deleteAddress',
  async (addressId, { rejectWithValue }) => {
    try {
      await profileApi.deleteAddress(addressId);
      return addressId;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const fetchSavedCardsThunk = createAsyncThunk(
  'user/fetchSavedCards',
  async (_, { rejectWithValue }) => {
    try {
      return await profileApi.getSavedCards();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const addSavedCardThunk = createAsyncThunk(
  'user/addSavedCard',
  async (payload, { rejectWithValue }) => {
    try {
      return await profileApi.addSavedCard(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const setPrimaryCardThunk = createAsyncThunk(
  'user/setPrimaryCard',
  async (cardId, { rejectWithValue }) => {
    try {
      return await profileApi.setPrimaryCard(cardId);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const deleteSavedCardThunk = createAsyncThunk(
  'user/deleteSavedCard',
  async (cardId, { rejectWithValue }) => {
    try {
      await profileApi.deleteSavedCard(cardId);
      return cardId;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const changePasswordThunk = createAsyncThunk(
  'user/changePassword',
  async (payload, { rejectWithValue }) => {
    try {
      return await profileApi.changePassword(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);

export const deleteAccountThunk = createAsyncThunk(
  'user/deleteAccount',
  async (payload, { rejectWithValue }) => {
    try {
      return await profileApi.deleteAccount(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  }
);
