import apiClient from '../client';

const unwrapApiResponse = (response) => response?.data ?? response;

export const profileApi = {
  getProfile: async () => {
    const response = await apiClient.get('/identity/profile');
    return unwrapApiResponse(response);
  },
  updateProfile: async (data) => {
    const response = await apiClient.put('/identity/profile', data);
    return unwrapApiResponse(response);
  },
  changePassword: async (payload) => {
    const response = await apiClient.post('/identity/profile/change-password', payload);
    return unwrapApiResponse(response);
  },
  deleteAccount: async (payload) => {
    const response = await apiClient.delete('/identity/profile', { data: payload });
    return unwrapApiResponse(response);
  },
  getAddresses: async () => {
    const response = await apiClient.get('/identity/profile/addresses');
    return unwrapApiResponse(response);
  },
  addAddress: async (payload) => {
    const response = await apiClient.post('/identity/profile/addresses', payload);
    return unwrapApiResponse(response);
  },
  updateAddress: async (addressId, payload) => {
    const response = await apiClient.put(`/identity/profile/addresses/${addressId}`, payload);
    return unwrapApiResponse(response);
  },
  deleteAddress: async (addressId) => {
    const response = await apiClient.delete(`/identity/profile/addresses/${addressId}`);
    return unwrapApiResponse(response);
  },
  getSavedCards: async () => {
    const response = await apiClient.get('/identity/profile/cards');
    return unwrapApiResponse(response);
  },
  addSavedCard: async (payload) => {
    const response = await apiClient.post('/identity/profile/cards', payload);
    return unwrapApiResponse(response);
  },
  setPrimaryCard: async (cardId) => {
    const response = await apiClient.put(`/identity/profile/cards/${cardId}/primary`);
    return unwrapApiResponse(response);
  },
  deleteSavedCard: async (cardId) => {
    const response = await apiClient.delete(`/identity/profile/cards/${cardId}`);
    return unwrapApiResponse(response);
  },
};
