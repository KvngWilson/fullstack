import { createAsyncThunk } from "@reduxjs/toolkit";
import { profileService } from "@/services/profileService";
import { getErrorMessage } from "@/utils/getErrorMessage";

export const fetchUserProfileThunk = createAsyncThunk(
  "user/fetchUserProfile",
  async (_, { rejectWithValue }) => {
    try {
      return await profileService.getProfile();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateUserProfileThunk = createAsyncThunk(
  "user/updateUserProfile",
  async (payload, { rejectWithValue }) => {
    try {
      return await profileService.updateProfile(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchAddressesThunk = createAsyncThunk(
  "user/fetchAddresses",
  async (_, { rejectWithValue }) => {
    try {
      return await profileService.getAddresses();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const addAddressThunk = createAsyncThunk(
  "user/addAddress",
  async (payload, { rejectWithValue }) => {
    try {
      return await profileService.addAddress(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const updateAddressThunk = createAsyncThunk(
  "user/updateAddress",
  async ({ addressId, ...payload }, { rejectWithValue }) => {
    try {
      return await profileService.updateAddress(addressId, payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const deleteAddressThunk = createAsyncThunk(
  "user/deleteAddress",
  async (addressId, { rejectWithValue }) => {
    try {
      await profileService.deleteAddress(addressId);
      return addressId;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const fetchSavedCardsThunk = createAsyncThunk(
  "user/fetchSavedCards",
  async (_, { rejectWithValue }) => {
    try {
      return await profileService.getSavedCards();
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const addSavedCardThunk = createAsyncThunk(
  "user/addSavedCard",
  async (payload, { rejectWithValue }) => {
    try {
      return await profileService.addSavedCard(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const setPrimaryCardThunk = createAsyncThunk(
  "user/setPrimaryCard",
  async (cardId, { rejectWithValue }) => {
    try {
      return await profileService.setPrimaryCard(cardId);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const deleteSavedCardThunk = createAsyncThunk(
  "user/deleteSavedCard",
  async (cardId, { rejectWithValue }) => {
    try {
      await profileService.deleteSavedCard(cardId);
      return cardId;
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const changePasswordThunk = createAsyncThunk(
  "user/changePassword",
  async (payload, { rejectWithValue }) => {
    try {
      return await profileService.changePassword(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);

export const deleteAccountThunk = createAsyncThunk(
  "user/deleteAccount",
  async (payload, { rejectWithValue }) => {
    try {
      return await profileService.deleteAccount(payload);
    } catch (error) {
      return rejectWithValue(getErrorMessage(error));
    }
  },
);
