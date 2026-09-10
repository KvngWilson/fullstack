import apiClient from "../client";

export const vendorApi = {
  apply: (payload) => apiClient.post("/vendors/apply", payload),
  getMyProfile: () => apiClient.get("/vendors/me"),
  updateMyProfile: (payload) => apiClient.patch("/vendors/me", payload),
  saveOnboardingStep: (step, data) =>
    apiClient.patch("/vendors/me/onboarding", { step, data }),
  listApplications: (params = {}) =>
    apiClient.get("/vendors/applications", { params }),
  getApplication: (applicationId) =>
    apiClient.get(`/vendors/applications/${applicationId}`),
  approveApplication: (applicationId, payload = {}) =>
    apiClient.post(`/vendors/applications/${applicationId}/approve`, payload),
  rejectApplication: (applicationId, payload) =>
    apiClient.post(`/vendors/applications/${applicationId}/reject`, payload),
  requestMoreInfo: (applicationId, payload) =>
    apiClient.post(
      `/vendors/applications/${applicationId}/request-info`,
      payload,
    ),
};

export default vendorApi;
