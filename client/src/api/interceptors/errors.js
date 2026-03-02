/**
 * Error Interceptor
 * Normalizes error responses and formats error messages
 */

/**
 * Extract meaningful error message from different error types
 */
function getErrorMessage(error) {
  // Server error response
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  // Network error
  if (!error.response) {
    if (error.message === 'Network Error') {
      return 'Network error. Please check your connection.';
    }
    return error.message || 'An unexpected error occurred';
  }

  // Default message by status code
  const statusMessages = {
    400: 'Invalid request. Please check your input.',
    403: 'Access denied. You do not have permission.',
    404: 'Resource not found.',
    429: 'Too many requests. Please try again later.',
    500: 'Server error. Please try again later.',
    503: 'Service unavailable. Please try again later.',
  };

  return statusMessages[error.response.status] || 'An error occurred. Please try again.';
}

/**
 * Normalize error format
 */
function normalizeError(error) {
  const normalizedError = new Error(getErrorMessage(error));
  normalizedError.status = error.response?.status;
  normalizedError.data = error.response?.data;
  normalizedError.originalError = error;
  return normalizedError;
}

/**
 * Error interceptor for Axios
 */
export const errorInterceptor = {
  response: (response) => {
    return response;
  },

  error: (error) => {
    // Normalize and enhance error
    const normalizedError = normalizeError(error);

    // Log for debugging
    if (import.meta.env.DEV) {
      console.error('API Error:', {
        status: normalizedError.status,
        message: normalizedError.message,
        data: normalizedError.data,
      });
    }

    return Promise.reject(normalizedError);
  },
};
