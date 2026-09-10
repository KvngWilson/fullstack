export const selectAuth = (state) => state.auth;

export const selectUser = (state) => state.auth.user;
export const selectAuthUser = (state) => state.auth.user;

export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

export const selectIsLoading = (state) => state.auth.isLoading;
export const selectAuthIsLoading = (state) => state.auth.isLoading;

// Alias for compatibility
export const selectAuthLoading = (state) => state.auth.isLoading;

export const selectError = (state) => state.auth.error;
export const selectAuthError = (state) => state.auth.error;
export const selectUserRole = (state) => state.auth.user?.role;
export const selectUserPermissions = (state) =>
  Array.isArray(state.auth.user?.permissions) ? state.auth.user.permissions : [];
export const selectAuthIsHydrated = (state) => state.auth.isHydrated;

// Alias for compatibility
export const selectIsCustomer = (state) => state.auth.user?.role === "customer";
