import apiClient from '@/api/client';

const GUEST_TOKEN_STORAGE_KEY = 'guest.checkout.token';

const readStoredGuestToken = () => {
  try {
    return localStorage.getItem(GUEST_TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const storeGuestToken = (token) => {
  if (!token) return;
  try {
    localStorage.setItem(GUEST_TOKEN_STORAGE_KEY, token);
  } catch {
    // Ignore storage failures.
  }
};

const clearGuestToken = () => {
  try {
    localStorage.removeItem(GUEST_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};

const ensureGuestToken = async () => {
  const existingToken = readStoredGuestToken();
  if (existingToken) {
    return existingToken;
  }

  const response = await apiClient.post('/checkout/guest/init');
  const token = response?.token || response?.data?.token || '';

  if (!token) {
    throw new Error('Unable to initialize guest checkout session');
  }

  storeGuestToken(token);
  return token;
};

const getGuestHeaders = async (headers = {}) => {
  const guestToken = await ensureGuestToken();
  return {
    ...headers,
    'x-guest-token': guestToken,
  };
};

export const guestSessionService = {
  readStoredGuestToken,
  ensureGuestToken,
  getGuestHeaders,
  clearGuestToken,
};

export default guestSessionService;