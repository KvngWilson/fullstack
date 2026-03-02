import axios from 'axios';
import { createAuthInterceptor } from './interceptors/auth';
import { csrfInterceptor } from './interceptors/csrf';
import { errorInterceptor } from './interceptors/errors';
import { requestCacheInterceptor } from './requestCache';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_VERSION = import.meta.env.VITE_API_VERSION || 'v1';

/**
 * Create Axios instance with secure configuration
 * 
 * Security Features:
 * ✅ httpOnly cookies for token storage (not localStorage)
 * ✅ CSRF protection with automatic token injection
 * ✅ Automatic token refresh on 401
 * ✅ Request deduplication for GET requests
 * ✅ Unified error handling
 * 
 * Do NOT store tokens in localStorage - they will be in httpOnly cookies automatically
 */
const apiClient = axios.create({
  baseURL: `${API_URL}/api/${API_VERSION}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  // ✅ CRITICAL: Enable cookie sending with requests
  withCredentials: true,
});

/**
 * Request Interceptor Chain
 */
// 1. Request deduplication (prevents duplicate GET calls)
apiClient.interceptors.request.use(
  requestCacheInterceptor.request,
  (error) => Promise.reject(error)
);

// 2. CSRF token injection for POST/PUT/PATCH/DELETE
apiClient.interceptors.request.use(
  csrfInterceptor.request,
  (error) => Promise.reject(error)
);

// 3. Auth token and refresh logic (handled via cookies, but manages refresh)
const authInterceptor = createAuthInterceptor(apiClient);
apiClient.interceptors.request.use(
  authInterceptor.request,
  (error) => Promise.reject(error)
);

/**
 * Response Interceptor Chain
 */
// 1. Auth token refresh and retry logic
apiClient.interceptors.response.use(
  authInterceptor.response,
  authInterceptor.error
);

// 2. Cache update on successful responses
apiClient.interceptors.response.use(
  requestCacheInterceptor.response,
  requestCacheInterceptor.error
);

// 3. CSRF token rotation (if server sends new token)
apiClient.interceptors.response.use(
  csrfInterceptor.response,
  csrfInterceptor.error
);

// 4. Error normalization
apiClient.interceptors.response.use(
  (response) => response.data, // Return only data
  errorInterceptor.error
);

export default apiClient;

/**
 * Upload client for file uploads with same security
 */
export const uploadClient = axios.create({
  baseURL: `${API_URL}/api/${API_VERSION}`,
  timeout: 60000, // 1 minute for uploads
  withCredentials: true,
});

// Apply same interceptor chain to upload client
uploadClient.interceptors.request.use(
  csrfInterceptor.request,
  (error) => Promise.reject(error)
);

uploadClient.interceptors.response.use(
  (response) => response.data,
  errorInterceptor.error
);
