export const selectAuth = (state) => state.auth;

export const selectUser = (state) => state.auth.user;

export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

export const selectIsLoading = (state) => state.auth.isLoading;

// Alias for compatibility
export const selectAuthLoading = (state) => state.auth.isLoading;

export const selectError = (state) => state.auth.error;
export const selectUserRole = (state) => state.auth.user?.role;

// Alias for compatibility
export const selectIsCustomer = (state) => state.auth.user?.role === 'customer';
