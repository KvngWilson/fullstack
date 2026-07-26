/**
 * Auth Interceptor with Token Refresh Queue
 *
 * Implements automatic token refresh when 401 is encountered
 * Uses request queue to prevent simultaneous refresh calls
 * Automatically retries failed requests after token refresh
 */

let isRefreshing = false;
let failedQueue = [];

/**
 * Process queued requests after token refresh
 */
function processQueue(error) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve();
    }
  });
  failedQueue = [];
}

/**
 * Refresh auth token using refresh token stored in httpOnly cookie
 */
async function refreshAuthToken(apiClient) {
  try {
    // Backend will use refresh token from httpOnly cookie automatically.
    await apiClient.post(
      "/auth/refresh-token",
      {},
      {
        skipAuthRefresh: true,
        skipAuthRedirect: true,
        skipErrorLogging: true,
      },
    );
    return true;
  } catch (_error) {
    // Refresh failed - user must login again
    return false;
  }
}

function isAuthPage(pathname) {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  );
}

function isProtectedRoute(pathname) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/account") ||
    pathname.startsWith("/vendor") ||
    pathname.startsWith("/admin")
  );
}

function shouldRedirectToExpiredLogin(pathname, shouldSkipRedirect) {
  if (shouldSkipRedirect || isAuthPage(pathname)) {
    return false;
  }

  // Avoid bouncing public routes to /login?expired=true on first load.
  return isProtectedRoute(pathname);
}

/**
 * Auth interceptor for Axios
 */
export const createAuthInterceptor = (apiClient) => ({
  request: (config) => {
    // Token is automatically sent via httpOnly cookie
    // No need to manually add Authorization header
    return config;
  },

  response: (response) => {
    return response;
  },

  error: async (error) => {
    const originalRequest = error.config;
    const shouldSkipRefresh = Boolean(originalRequest?.skipAuthRefresh);
    const shouldSkipRedirect = Boolean(originalRequest?.skipAuthRedirect);

    // Check for 401 and ensure we don't retry the same request infinitely
    if (error.response?.status === 401 && !originalRequest._retried && !shouldSkipRefresh) {
      if (isRefreshing) {
        // Token refresh is already in progress
        // Queue this request to retry after refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => apiClient(originalRequest));
      }

      // Start token refresh
      isRefreshing = true;
      originalRequest._retried = true;

      try {
        const refreshed = await refreshAuthToken(apiClient);

        if (refreshed) {
          // Process queued requests
          processQueue(null);
          // Retry original request with new token
          return apiClient(originalRequest);
        } else {
          // Token refresh failed - logout user
          processQueue(error);
          if (
            shouldRedirectToExpiredLogin(
              window.location.pathname,
              shouldSkipRedirect,
            )
          ) {
            window.location.href = "/login?expired=true";
          }
          return Promise.reject(error);
        }
      } catch (refreshError) {
        processQueue(refreshError);
        if (
          shouldRedirectToExpiredLogin(
            window.location.pathname,
            shouldSkipRedirect,
          )
        ) {
          window.location.href = "/login?expired=true";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
});
