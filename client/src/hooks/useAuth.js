/**
 * useAuth Hook
 * Encapsulates all authentication logic and state
 * Reduces boilerplate in components
 * 
 * Usage:
 * const { user, isAuthenticated, login, logout, isLoading, error } = useAuth();
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  selectUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
} from '@/features/auth/authSelectors';
import {
  loginThunk,
  registerThunk,
  logoutThunk,
  refreshTokenThunk,
} from '@/features/auth/authThunks';
import { clearError } from '@/features/auth/authSlice';

export function useAuth() {
  const dispatch = useAppDispatch();

  // Selectors
  const user = useAppSelector(selectUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isLoading = useAppSelector(selectAuthLoading);
  const error = useAppSelector(selectAuthError);

  // Action creators
  const login = useCallback(
    async (email, password) => {
      const result = await dispatch(
        loginThunk({ email, password })
      );
      return result.payload;
    },
    [dispatch]
  );

  const register = useCallback(
    async (data) => {
      const result = await dispatch(registerThunk(data));
      return result.payload;
    },
    [dispatch]
  );

  const logout = useCallback(async () => {
    await dispatch(logoutThunk());
  }, [dispatch]);

  const refreshToken = useCallback(async () => {
    const result = await dispatch(refreshTokenThunk());
    return result.payload;
  }, [dispatch]);

  const clearAuthError = useCallback(() => {
    dispatch(clearError());
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
    login,
    register,
    logout,
    refreshToken,
    clearError: clearAuthError,
  };
}
