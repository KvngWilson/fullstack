import { vendorApi } from "@/api/endpoints/vendors";

export const vendorOnboardingService = {
  apply: (payload) => vendorApi.apply(payload),
  getMyProfile: () => vendorApi.getMyProfile(),
  updateMyProfile: (payload) => vendorApi.updateMyProfile(payload),
  saveOnboardingStep: (step, data) => vendorApi.saveOnboardingStep(step, data),
  listApplications: (params) => vendorApi.listApplications(params),
  getApplication: (applicationId) => vendorApi.getApplication(applicationId),
  approveApplication: (applicationId, payload) =>
    vendorApi.approveApplication(applicationId, payload),
  rejectApplication: (applicationId, payload) =>
    vendorApi.rejectApplication(applicationId, payload),
  requestMoreInfo: (applicationId, payload) =>
    vendorApi.requestMoreInfo(applicationId, payload),
};

export default vendorOnboardingService;
