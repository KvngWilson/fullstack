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
    const fullName = `${data?.first_name || data?.firstName || ""} ${data?.last_name || data?.lastName || ""}`.trim();
    const [derivedFirstName, ...derivedLastName] = fullName.split(" ");

    const first_name =
      data?.first_name || data?.firstName || derivedFirstName || "User";
    const last_name =
      data?.last_name ||
      data?.lastName ||
      derivedLastName.join(" ") ||
      "User";
    const password = data?.password || "";
    const confirm_password =
      data?.confirm_password || data?.confirmPassword || password;

    const payload = {
      email: data?.email,
      password,
      confirm_password,
      first_name,
      last_name,
      accept_terms: data?.accept_terms ?? true,
      subscribe_newsletter: data?.subscribe_newsletter ?? false,
    };

    const response = await apiClient.post("/identity/users/register", payload);
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

  me: async (config = {}) => {
    return apiClient.get("/identity/profile", config);
  },

  logout: async () => {
    return apiClient.post("/identity/logout", {});
  },
};
