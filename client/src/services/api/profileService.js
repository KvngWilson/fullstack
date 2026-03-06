import { profileApi } from '@/api/endpoints/profile';

export const profileService = {
  getProfile: () => profileApi.getProfile(),
  updateProfile: (data) => profileApi.updateProfile(data),
  changePassword: (payload) => profileApi.changePassword(payload),
  deleteAccount: (payload) => profileApi.deleteAccount(payload),
  getAddresses: () => profileApi.getAddresses(),
  addAddress: (payload) => profileApi.addAddress(payload),
  updateAddress: (addressId, payload) => profileApi.updateAddress(addressId, payload),
  deleteAddress: (addressId) => profileApi.deleteAddress(addressId),
  getSavedCards: () => profileApi.getSavedCards(),
  addSavedCard: (payload) => profileApi.addSavedCard(payload),
  setPrimaryCard: (cardId) => profileApi.setPrimaryCard(cardId),
  deleteSavedCard: (cardId) => profileApi.deleteSavedCard(cardId),
};

export default profileService;
