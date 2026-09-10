import apiClient from "../client";

export const adminPortalApi = {
  getDashboardOverview: () => apiClient.get("/admin/dashboard"),
  getAdminProfile: () => apiClient.get("/admin/dashboard/profile"),
  listCustomers: (params = {}) => apiClient.get("/admin/users", { params }),
  updateCustomerRole: (userId, payload) =>
    apiClient.patch(`/admin/users/${userId}/role`, payload),
  deleteCustomer: (userId) => apiClient.delete(`/admin/users/${userId}`),
  listOrders: (params = {}) => apiClient.get("/admin/orders", { params }),
  updateOrderStatus: (orderId, payload) =>
    apiClient.patch(`/admin/orders/${orderId}/status`, payload),
};

export default adminPortalApi;
