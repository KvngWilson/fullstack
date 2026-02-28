import { createSlice } from '@reduxjs/toolkit';
import {
  fetchUserProfileThunk,
  updateUserProfileThunk,
  fetchAddressesThunk,
  addAddressThunk,
  updateAddressThunk,
  deleteAddressThunk,
  fetchSavedCardsThunk,
  addSavedCardThunk,
  setPrimaryCardThunk,
  deleteSavedCardThunk,
} from './userThunks';

const initialState = {
  profile: null,
  addresses: [],
  savedCards: [],
  isLoading: false,
  error: null,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    clearUserProfile: (state) => {
      state.profile = null;
    },
    clearUserError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfileThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserProfileThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.profile = action.payload || null;
      })
      .addCase(fetchUserProfileThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to fetch user profile';
      })
      .addCase(updateUserProfileThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateUserProfileThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.profile = action.payload || state.profile;
      })
      .addCase(updateUserProfileThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to update user profile';
      })
      .addCase(fetchAddressesThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAddressesThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.addresses = action.payload || [];
      })
      .addCase(fetchAddressesThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to fetch addresses';
      })
      .addCase(addAddressThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.addresses = [action.payload, ...state.addresses];
        }
      })
      .addCase(updateAddressThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.addresses = state.addresses.map((address) =>
            address.id === action.payload.id ? action.payload : address
          );
        }
      })
      .addCase(deleteAddressThunk.fulfilled, (state, action) => {
        state.addresses = state.addresses.filter((address) => address.id !== action.payload);
      })
      .addCase(fetchSavedCardsThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSavedCardsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.savedCards = action.payload || [];
      })
      .addCase(fetchSavedCardsThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Failed to fetch saved cards';
      })
      .addCase(addSavedCardThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.savedCards = [action.payload, ...state.savedCards];
        }
      })
      .addCase(setPrimaryCardThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.savedCards = state.savedCards.map((card) => ({
            ...card,
            is_primary: card.id === action.payload.id,
          }));
        }
      })
      .addCase(deleteSavedCardThunk.fulfilled, (state, action) => {
        state.savedCards = state.savedCards.filter((card) => card.id !== action.payload);
      });
  },
});

export const { clearUserProfile, clearUserError } = userSlice.actions;

export default userSlice.reducer;
