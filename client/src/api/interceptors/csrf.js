/**
 * CSRF Protection Interceptor
 * Automatically includes CSRF token in state-changing requests
 *
 * Backend should:
 * 1. Generate CSRF token on GET requests
 * 2. Validate CSRF token in X-CSRF-Token header for POST/PUT/PATCH/DELETE
 */

let csrfToken = null;
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const API_VERSION = import.meta.env.VITE_API_VERSION || "v1";

/**
 * Fetch CSRF token from backend
 */
async function fetchCSRFToken() {
  try {
    // Make a HEAD request to trigger backend CSRF token generation
    // This is a lightweight request that only fetches the token
    const response = await fetch(
      `${API_URL}/api/${API_VERSION}/auth/csrf-token`,
      {
        method: "GET",
        credentials: "include", // Include cookies
      },
    );

    if (response.ok) {
      const data = await response.json();
      csrfToken = data.token;
    }
  } catch (error) {
    console.warn("Failed to fetch CSRF token:", error);
    // App can still work without CSRF token, but validation will fail
  }
}

/**
 * Ensure CSRF token is available
 */
async function ensureCSRFToken() {
  if (!csrfToken) {
    await fetchCSRFToken();
  }
  return csrfToken;
}

/**
 * CSRF interceptor for Axios
 */
export const csrfInterceptor = {
  request: async (config) => {
    // Only add CSRF token to state-changing requests
    const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(
      config.method?.toUpperCase(),
    );

    if (isStateChanging) {
      const token = await ensureCSRFToken();
      if (token && config.headers) {
        config.headers["X-CSRF-Token"] = token;
      }
    }

    return config;
  },

  response: (response) => {
    // Update CSRF token if provided in response (server rotation)
    const newToken = response.headers["x-csrf-token"];
    if (newToken) {
      csrfToken = newToken;
    }
    return response;
  },

  error: (error) => {
    // On 403 Forbidden, try to refresh CSRF token
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === "CSRF_TOKEN_INVALID"
    ) {
      csrfToken = null; // Clear stale token
      // Return rejection to trigger retry logic in auth interceptor
    }
    return Promise.reject(error);
  },
};

/**
 * Initialize CSRF token on app startup
 */
export async function initCSRFToken() {
  await fetchCSRFToken();
}

/**
 * Clear CSRF token (on logout)
 */
export function clearCSRFToken() {
  csrfToken = null;
}
