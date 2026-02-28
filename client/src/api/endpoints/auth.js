import apiClient from '../client';

const normalizeAuthPayload = (payload) => {
  if (!payload) {
    return {
      user: null,
      token: null,
      refresh_token: null,
    };
  }

  if (payload.user && payload.token) {
    return {
      user: payload.user,
      token: payload.token,
      refresh_token: payload.refresh_token || null,
    };
  }

  return {
    user: {
      id: payload.id,
      email: payload.email,
      role: payload.role || 'customer',
    },
    token: payload.token,
    refresh_token: payload.refresh_token || null,
  };
};

export const authApi = {
  /**
   * Login user
   */
  login: async (credentials) => {
    const response = await apiClient.post('/users/login', credentials);
    return normalizeAuthPayload(response);
  },

  /**
   * Register new user
   */
  register: async (data) => {
    const response = await apiClient.post('/users/register', data);
    return normalizeAuthPayload(response);
  },

  /**
   * Get current user profile
   */
  getProfile: async () => {
    const response = await apiClient.get('/profile');
    return response?.data || response;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data) => {
    const response = await apiClient.put('/profile', data);
    return response?.data || response;
  },

  /**
   * Request password reset
   */
  requestPasswordReset: async (email) => {
    return apiClient.post('/users/password-reset', { email });
  },

  /**
   * Reset password with token
   */
  resetPassword: async (token, newPassword) => {
    return apiClient.post('/users/password-reset/confirm', { token, password: newPassword });
  },

  /**
   * Verify email with token
   */
  verifyEmail: async (token) => {
    return apiClient.get(`/users/verify-email/${token}`);
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshToken) => {
    return apiClient.post('/users/refresh-token', { refresh_token: refreshToken });
  },
};
