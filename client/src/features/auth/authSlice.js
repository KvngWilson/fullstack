import { createSlice } from '@reduxjs/toolkit';
import { loginThunk, registerThunk, refreshTokenThunk, logoutThunk, fetchCurrentUserThunk } from './authThunks';

/**
 * SECURITY IMPROVEMENT: Do NOT store tokens in state or localStorage
 * 
 * Tokens are now automatically stored in httpOnly cookies by the backend
 * and sent automatically with each request (via withCredentials: true)
 * 
 * httpOnly cookies are:
 * ✅ Not accessible from JavaScript (prevents XSS)
 * ✅ Not visible in localStorage
 * ✅ Automatically included in requests
 * ✅ Can be cleared by backend on logout
 * 
 * We only store non-sensitive user information in Redux state
 */
const initialState = {
  user: null, // Only store user info, NOT tokens
  isAuthenticated: false,
  isLoading: false,
  isHydrated: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Set user info after login/register
     * Tokens are automatically in httpOnly cookies
     */
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isHydrated = true;
      state.error = null;
    },

    /**
     * Clear user info and logout
     * Backend will clear httpOnly cookies
     */
    clearUser: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isHydrated = true;
      state.error = null;
    },

    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Login
    builder
      .addCase(loginThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.isHydrated = true;
        // ✅ Token is in httpOnly cookie, not in state
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Login failed';
        state.isAuthenticated = false;
        state.isHydrated = true;
      });

    // Register
    builder
      .addCase(registerThunk.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(registerThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.isHydrated = true;
        // ✅ Token is in httpOnly cookie, not in state
      })
      .addCase(registerThunk.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || 'Registration failed';
        state.isAuthenticated = false;
        state.isHydrated = true;
      });

    // Logout
    builder
      .addCase(logoutThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logoutThunk.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.isHydrated = true;
        state.error = null;
        // ✅ Backend clears httpOnly cookies
      })
      .addCase(logoutThunk.rejected, (state) => {
        state.isLoading = false;
        // Still clear local state even if logout API fails
        state.user = null;
        state.isAuthenticated = false;
        state.isHydrated = true;
      });

    // Refresh token
    builder
      .addCase(refreshTokenThunk.fulfilled, (state, action) => {
        // Token is already in httpOnly cookie
        // Just ensure user data is current
        if (action.payload?.user) {
          state.user = action.payload.user;
        }
      })
      .addCase(refreshTokenThunk.rejected, (state) => {
        // Token refresh failed - logout user
        state.user = null;
        state.isAuthenticated = false;
      });

    // Initial auth hydration
    builder
      .addCase(fetchCurrentUserThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchCurrentUserThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload?.user || null;
        state.isAuthenticated = Boolean(action.payload?.user);
        state.isHydrated = true;
      })
      .addCase(fetchCurrentUserThunk.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.isAuthenticated = false;
        state.isHydrated = true;
      });
  },
});

export const { setUser, clearUser, clearError } = authSlice.actions;
export default authSlice.reducer;
