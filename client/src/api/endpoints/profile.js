import apiClient from '../client';

export const profileApi = {
  getProfile: async () => apiClient.get('/profile'),
  updateProfile: async (data) => apiClient.put('/profile', data),
  changePassword: async (payload) => apiClient.post('/profile/change-password', payload),
  deleteAccount: async (payload) => apiClient.delete('/profile', { data: payload }),
  getAddresses: async () => apiClient.get('/profile/addresses'),
  addAddress: async (payload) => apiClient.post('/profile/addresses', payload),
  updateAddress: async (addressId, payload) => apiClient.put(`/profile/addresses/${addressId}`, payload),
  deleteAddress: async (addressId) => apiClient.delete(`/profile/addresses/${addressId}`),
  getSavedCards: async () => apiClient.get('/profile/cards'),
  addSavedCard: async (payload) => apiClient.post('/profile/cards', payload),
  setPrimaryCard: async (cardId) => apiClient.put(`/profile/cards/${cardId}/primary`),
  deleteSavedCard: async (cardId) => apiClient.delete(`/profile/cards/${cardId}`),
};
