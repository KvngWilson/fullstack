import {
  selectAuth,
  selectUser,
  selectAuthUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectAuthIsLoading,
  selectAuthLoading,
  selectError,
  selectAuthError,
  selectUserRole,
  selectAuthIsHydrated,
  selectIsCustomer,
} from '@/features/auth/authSelectors';

describe('authSelectors', () => {
  const state = {
    auth: {
      user: { id: 1, role: 'customer', email: 'user@example.com' },
      isAuthenticated: true,
      isLoading: false,
      isHydrated: true,
      error: null,
    },
  };

  it('selects auth subtree and aliases consistently', () => {
    expect(selectAuth(state)).toEqual(state.auth);
    expect(selectUser(state)).toEqual(state.auth.user);
    expect(selectAuthUser(state)).toEqual(state.auth.user);
    expect(selectError(state)).toBeNull();
    expect(selectAuthError(state)).toBeNull();
  });

  it('selects auth status flags and aliases consistently', () => {
    expect(selectIsAuthenticated(state)).toBe(true);
    expect(selectIsLoading(state)).toBe(false);
    expect(selectAuthIsLoading(state)).toBe(false);
    expect(selectAuthLoading(state)).toBe(false);
    expect(selectAuthIsHydrated(state)).toBe(true);
  });

  it('selects user role and customer role predicate', () => {
    expect(selectUserRole(state)).toBe('customer');
    expect(selectIsCustomer(state)).toBe(true);
  });

  it('handles missing user values', () => {
    const anonymousState = {
      auth: {
        user: null,
        isAuthenticated: false,
        isLoading: true,
        isHydrated: false,
        error: 'boom',
      },
    };

    expect(selectUserRole(anonymousState)).toBeUndefined();
    expect(selectIsCustomer(anonymousState)).toBe(false);
    expect(selectError(anonymousState)).toBe('boom');
  });
});
