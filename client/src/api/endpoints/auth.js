import apiClient from "../client";

const unwrapApiResponse = (response) => response?.data ?? response;

const normalizeAuthPayload = (payload) => {
  if (!payload) {
    return {
      user: null,
      token: null,
      refresh_token: null,
      message: null,
      success: false,
    };
  }

  const normalizedUser =
    payload.user ||
    (payload.data && (payload.data.id || payload.data.email) ? payload.data : null) ||
    (payload.id || payload.email
      ? {
          id: payload.id,
          email: payload.email,
          role: payload.role || "customer",
        }
      : null);

  return {
    user: normalizedUser,
    token: payload.token || null,
    refresh_token: payload.refresh_token || null,
    message: payload.message || null,
    success: payload.success ?? true,
    data: payload.data,
  };
};

export const authApi = {
  login: async (credentials) => {
    const response = await apiClient.post("/auth/login", credentials);
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

    const response = await apiClient.post("/auth/register", payload);
    return normalizeAuthPayload(response);
  },

  getProfile: async () => {
    const response = await apiClient.get("/identity/profile");
    return unwrapApiResponse(response);
  },

  updateProfile: async (data) => {
    const response = await apiClient.put("/identity/profile", data);
    return unwrapApiResponse(response);
  },

  requestPasswordReset: async (email) => {
    return apiClient.post("/auth/forgot-password", { email });
  },

  resetPassword: async (token, newPassword) => {
    return apiClient.post("/auth/reset-password", {
      token,
      password: newPassword,
      confirm_password: newPassword,
    });
  },

  verifyEmail: async (token) => {
    return apiClient.get("/auth/verify-email", {
      params: { token },
    });
  },

  refreshToken: async () => {
    const response = await apiClient.post("/auth/refresh-token", {});
    return normalizeAuthPayload(response);
  },

  me: async (config = {}) => {
    const response = await apiClient.get("/identity/profile", config);
    return unwrapApiResponse(response);
  },

  logout: async () => {
    return apiClient.post("/auth/logout", {});
  },
};
