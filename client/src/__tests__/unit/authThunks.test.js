import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loginThunk, registerThunk, logoutThunk, refreshTokenThunk, fetchCurrentUserThunk } from '@/features/auth/authThunks';

const authApiMock = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshToken: vi.fn(),
  me: vi.fn(),
}));

vi.mock('@/services/api/authService', () => ({
  authService: authApiMock,
}));

describe('authThunks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns user payload from loginThunk on success', async () => {
    authApiMock.login.mockResolvedValueOnce({ user: { id: 1, role: 'customer' } });

    const thunk = loginThunk({ email: 'user@example.com', password: 'pass' });
    const result = await thunk(vi.fn(), vi.fn(), undefined);

    expect(result.type).toBe('auth/login/fulfilled');
    expect(result.payload).toEqual({ user: { id: 1, role: 'customer' } });
    expect(authApiMock.login).toHaveBeenCalledWith({ email: 'user@example.com', password: 'pass' });
  });

  it('returns reject payload from loginThunk on API error', async () => {
    authApiMock.login.mockRejectedValueOnce(new Error('Invalid credentials'));

    const thunk = loginThunk({ email: 'user@example.com', password: 'wrong' });
    const result = await thunk(vi.fn(), vi.fn(), undefined);

    expect(result.type).toBe('auth/login/rejected');
    expect(result.payload).toBe('Invalid credentials');
  });

  it('returns reject payload from registerThunk on API error', async () => {
    authApiMock.register.mockRejectedValueOnce(new Error('Register denied'));

    const thunk = registerThunk({ email: 'user@example.com', password: 'pass' });
    const result = await thunk(vi.fn(), vi.fn(), undefined);

    expect(result.type).toBe('auth/register/rejected');
    expect(result.payload).toBe('Register denied');
  });

  it('returns user payload from registerThunk on success', async () => {
    authApiMock.register.mockResolvedValueOnce({ user: { id: 2, role: 'customer' } });

    const thunk = registerThunk({ email: 'new@example.com', password: 'pass1234' });
    const result = await thunk(vi.fn(), vi.fn(), undefined);

    expect(result.type).toBe('auth/register/fulfilled');
    expect(result.payload).toEqual({ user: { id: 2, role: 'customer' } });
  });

  it('returns null from logoutThunk on success', async () => {
    authApiMock.logout.mockResolvedValueOnce({ success: true });

    const thunk = logoutThunk();
    const result = await thunk(vi.fn(), vi.fn(), undefined);

    expect(result.type).toBe('auth/logout/fulfilled');
    expect(result.payload).toBeNull();
  });

  it('returns reject payload from logoutThunk when API fails', async () => {
    authApiMock.logout.mockRejectedValueOnce(new Error('Logout failed')); 

    const thunk = logoutThunk();
    const result = await thunk(vi.fn(), vi.fn(), undefined);

    expect(result.type).toBe('auth/logout/rejected');
    expect(result.payload).toBe('Logout failed');
  });

  it('returns null payload from refreshTokenThunk when response has no user', async () => {
    authApiMock.refreshToken.mockResolvedValueOnce({});

    const thunk = refreshTokenThunk();
    const result = await thunk(vi.fn(), vi.fn(), undefined);

    expect(result.type).toBe('auth/refreshToken/fulfilled');
    expect(result.payload).toBeNull();
  });

  it('returns user payload from refreshTokenThunk on success and reject payload on error', async () => {
    authApiMock.refreshToken.mockResolvedValueOnce({ user: { id: 3, role: 'admin' } });

    const okThunk = refreshTokenThunk();
    const okResult = await okThunk(vi.fn(), vi.fn(), undefined);

    expect(okResult.type).toBe('auth/refreshToken/fulfilled');
    expect(okResult.payload).toEqual({ user: { id: 3, role: 'admin' } });

    authApiMock.refreshToken.mockRejectedValueOnce(new Error('Refresh failed'));

    const failThunk = refreshTokenThunk();
    const failResult = await failThunk(vi.fn(), vi.fn(), undefined);

    expect(failResult.type).toBe('auth/refreshToken/rejected');
    expect(failResult.payload).toBe('Refresh failed');
  });

  it('returns user payload from fetchCurrentUserThunk and reject payload on failure', async () => {
    authApiMock.me.mockResolvedValueOnce({ user: { id: 11, role: 'admin' } });

    const okThunk = fetchCurrentUserThunk();
    const okResult = await okThunk(vi.fn(), vi.fn(), undefined);

    expect(okResult.type).toBe('auth/fetchCurrentUser/fulfilled');
    expect(okResult.payload).toEqual({ user: { id: 11, role: 'admin' } });

    authApiMock.me.mockRejectedValueOnce(new Error('Session expired'));

    const failThunk = fetchCurrentUserThunk();
    const failResult = await failThunk(vi.fn(), vi.fn(), undefined);

    expect(failResult.type).toBe('auth/fetchCurrentUser/rejected');
    expect(failResult.payload).toBe('Session expired');
  });
});