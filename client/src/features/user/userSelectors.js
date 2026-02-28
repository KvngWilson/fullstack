export const selectUserState = (state) => state.user;

export const selectUserProfile = (state) => state.user.profile;

export const selectUserAddresses = (state) => state.user.addresses;

export const selectUserSavedCards = (state) => state.user.savedCards;

export const selectUserIsLoading = (state) => state.user.isLoading;

export const selectUserError = (state) => state.user.error;
