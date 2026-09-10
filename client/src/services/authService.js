import { authApi } from "@/api/endpoints/auth";

export const authService = {
  login: (credentials) => authApi.login(credentials),
  register: (data) => authApi.register(data),
  requestPasswordReset: (email) => authApi.requestPasswordReset(email),
  resetPassword: (token, newPassword) =>
    authApi.resetPassword(token, newPassword),
  verifyEmail: (token) => authApi.verifyEmail(token),
  refreshToken: () => authApi.refreshToken(),
  me: (config) => authApi.me(config),
  logout: () => authApi.logout(),
};

export default authService;
