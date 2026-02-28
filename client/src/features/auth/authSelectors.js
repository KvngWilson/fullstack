export const selectAuth = (state) => state.auth;

export const selectUser = (state) => state.auth.user;

export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;

export const selectIsLoading = (state) => state.auth.isLoading;

export const selectAuthError = (state) => state.auth.error;

export const selectUserRole = (state) => state.auth.user?.role || null;

export const selectIsAdmin = (state) => state.auth.user?.role === 'admin';

export const selectIsVendor = (state) => state.auth.user?.role === 'vendor';

export const selectIsCustomer = (state) => state.auth.user?.role === 'customer';
