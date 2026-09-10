import apiClient from "../client";

export const employeeApi = {
  listRoles: (params = {}) => apiClient.get("/admin/roles", { params }),
  listEmployees: (params = {}) => apiClient.get("/identity/employees", { params }),
  updateEmployeeRole: (employeeId, payload) =>
    apiClient.patch(`/identity/employees/${employeeId}/role`, payload),
  updateEmployeeStatus: (employeeId, payload) =>
    apiClient.patch(`/identity/employees/${employeeId}/status`, payload),
  inviteEmployee: (payload) => apiClient.post("/identity/employees/invite", payload),
  listPendingInvitations: (params = {}) =>
    apiClient.get("/identity/employees/invitations", { params }),
  resendInvitation: (invitationId) =>
    apiClient.post(`/identity/employees/resend-invitation/${invitationId}`),
  validateInvitation: (token) =>
    apiClient.get("/identity/employees/accept-invitation", {
      params: { token },
    }),
  acceptInvitation: (payload) =>
    apiClient.post("/identity/employees/accept-invitation", payload),
};

export default employeeApi;
