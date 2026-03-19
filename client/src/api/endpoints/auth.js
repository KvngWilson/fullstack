import apiClient from "../client";

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
      role: payload.role || "customer",
    },
    token: payload.token,
    refresh_token: payload.refresh_token || null,
  };
};

export const authApi = {
  login: async (credentials) => {
    const response = await apiClient.post("/identity/users/login", credentials);
    return normalizeAuthPayload(response);
  },

  register: async (data) => {
    const response = await apiClient.post("/identity/users/register", data);
    return normalizeAuthPayload(response);
  },

  getProfile: async () => {
    return apiClient.get("/identity/profile");
  },

  updateProfile: async (data) => {
    return apiClient.put("/identity/profile", data);
  },

  requestPasswordReset: async (email) => {
    return apiClient.post("/identity/users/password-reset", { email });
  },

  resetPassword: async (token, newPassword) => {
    return apiClient.post("/identity/users/password-reset/confirm", {
      token,
      password: newPassword,
    });
  },

  verifyEmail: async (token) => {
    return apiClient.get(`/identity/users/verify-email/${token}`);
  },

  refreshToken: async (refreshToken) => {
    return apiClient.post("/identity/users/refresh-token", {
      refresh_token: refreshToken,
    });
  },

  me: async () => {
    return apiClient.get("/identity/profile");
  },

  logout: async () => {
    return apiClient.post("/identity/logout", {});
  },
};
