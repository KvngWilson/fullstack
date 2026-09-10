import { employeeApi } from "@/api/endpoints/employees";

export const employeeOnboardingService = {
  listRoles: (params) => employeeApi.listRoles(params),
  listEmployees: (params) => employeeApi.listEmployees(params),
  updateEmployeeRole: (employeeId, payload) =>
    employeeApi.updateEmployeeRole(employeeId, payload),
  updateEmployeeStatus: (employeeId, payload) =>
    employeeApi.updateEmployeeStatus(employeeId, payload),
  inviteEmployee: (payload) => employeeApi.inviteEmployee(payload),
  listPendingInvitations: (params) =>
    employeeApi.listPendingInvitations(params),
  resendInvitation: (invitationId) =>
    employeeApi.resendInvitation(invitationId),
  validateInvitation: (token) => employeeApi.validateInvitation(token),
  acceptInvitation: (payload) => employeeApi.acceptInvitation(payload),
};

export default employeeOnboardingService;
