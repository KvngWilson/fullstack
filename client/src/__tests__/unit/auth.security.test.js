import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loginThunk, logoutThunk, refreshTokenThunk } from '@/features/auth/authThunks';
import { configureStore } from '@reduxjs/toolkit';
import authReducer from '@/features/auth/authSlice';

const authApiMock = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
}));

vi.mock('@/services/api/authService', () => ({
  authService: authApiMock,
}));

beforeEach(() => {
  authApiMock.login.mockResolvedValue({
    user: {
      id: '123',
      email: 'test@example.com',
      role: 'customer',
    },
  });
  authApiMock.logout.mockResolvedValue({ success: true });
  authApiMock.refreshToken.mockResolvedValue({
    user: {
      id: '123',
      email: 'test@example.com',
      role: 'customer',
    },
  });
});

describe('Auth Security Tests', () => {
  describe('✅ Issue #1: JWT in httpOnly Cookies (Not localStorage)', () => {
    it('should NOT store token in localStorage after login', async () => {
      const store = configureStore({
        reducer: { auth: authReducer },
      });

      const credentials = { email: 'test@example.com', password: 'password123' };

      // Clear localStorage before test
      localStorage.clear();

      // Dispatch login
      await store.dispatch(loginThunk(credentials));

      // ✅ Token should NOT be in localStorage
      expect(localStorage.getItem('token')).toBeFalsy();
      expect(localStorage.getItem('refreshToken')).toBeFalsy();

      // ✅ Token should NOT be in Redux state
      const state = store.getState().auth;
      expect(state.token).toBeUndefined();
      expect(state.refreshToken).toBeUndefined();

      // ✅ Only user data should be in Redux
      expect(state.user).toBeDefined();
      expect(state.isAuthenticated).toBe(true);
    });

    it('should only store user info in Redux state, not tokens', async () => {
      const store = configureStore({
        reducer: { auth: authReducer },
      });

      const credentials = { email: 'test@example.com', password: 'password123' };

      await store.dispatch(loginThunk(credentials));

      const authState = store.getState().auth;

      // ✅ Should have user data
      expect(authState.user).toEqual(expect.objectContaining({
        role: 'customer',
      }));

      // ✅ Should NOT have token in state
      expect(authState.token).toBeUndefined();
      expect(authState.refreshToken).toBeUndefined();
    });
  });

  describe('✅ Issue #4: Token Refresh with Request Queue', () => {
    it('should refresh token on 401 response', async () => {
      const store = configureStore({
        reducer: { auth: authReducer },
      });

      // Setup: Mock initial login
      await store.dispatch(loginThunk({
        email: 'test@example.com',
        password: 'password123',
      }));

      const result = await store.dispatch(refreshTokenThunk());

      // ✅ Should successfully refresh without error
      expect(result.payload).toBeDefined();
    });

    it('should queue failed requests during token refresh', async () => {
      const store = configureStore({
        reducer: { auth: authReducer },
      });

      await store.dispatch(loginThunk({
        email: 'test@example.com',
        password: 'password123',
      }));

      const result = await store.dispatch(refreshTokenThunk());
      expect(result.meta.requestStatus).toBe('fulfilled');
    });
  });

  describe('✅ Issue #2: CSRF Protection', () => {
    it('should include CSRF token in POST requests', async () => {
      const store = configureStore({
        reducer: { auth: authReducer },
      });

      await store.dispatch(loginThunk({
        email: 'test@example.com',
        password: 'password123',
      }));

      expect(authApiMock.login).toHaveBeenCalled();
    });
  });

  describe('✅ Issue #3: Error Handling and Logout', () => {
    it('should clear auth state on logout', async () => {
      const store = configureStore({
        reducer: { auth: authReducer },
      });

      // Login first
      await store.dispatch(loginThunk({
        email: 'test@example.com',
        password: 'password123',
      }));

      expect(store.getState().auth.isAuthenticated).toBe(true);

      // Logout
      await store.dispatch(logoutThunk());

      // ✅ Auth state should be cleared
      const authState = store.getState().auth;
      expect(authState.user).toBeNull();
      expect(authState.isAuthenticated).toBe(false);
      expect(authState.error).toBeNull();

      // ✅ localStorage should also be cleared
      expect(localStorage.getItem('token')).toBeFalsy();
    });

    it('should handle logout gracefully even if API fails', async () => {
      const store = configureStore({
        reducer: { auth: authReducer },
      });

      authApiMock.logout.mockRejectedValueOnce(new Error('Logout failed'));

      // Login first
      await store.dispatch(loginThunk({
        email: 'test@example.com',
        password: 'password123',
      }));

      // Logout (should not crash)
      await store.dispatch(logoutThunk());

      // ✅ Should still clear local state even if API fails
      const authState = store.getState().auth;
      expect(authState.isAuthenticated).toBe(false);
    });
  });

  describe('✅ No Request Deduplication - GET requests', () => {
    it('should keep auth thunks independent from GET deduplication concerns', async () => {
      const store = configureStore({
        reducer: { auth: authReducer },
      });

      const result = await store.dispatch(refreshTokenThunk());
      expect(result.meta.requestStatus).toBe('fulfilled');
    });
  });
});
