/**
 * Utility Functions for Common Operations
 * Pure functions with no side effects
 */

/**
 * Safely get nested object property
 * Example: getNestedProperty(obj, 'user.profile.name')
 */
export function getNestedProperty(obj, path) {
  return path.split('.').reduce((current, prop) => current?.[prop], obj);
}

/**
 * Format price for display
 */
export function formatPrice(price, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(price);
}

/**
 * Format date for display
 */
export function formatDate(date, format = 'en-US') {
  return new Intl.DateTimeFormat(format, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

/**
 * Format date and time
 */
export function formatDateTime(date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
}

/**
 * Capitalize first letter
 */
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Pluralize word based on count
 */
export function pluralize(word, count) {
  return count === 1 ? word : `${word}s`;
}

/**
 * Debounce function execution
 */
export function debounce(func, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
}

/**
 * Throttle function execution
 */
export function throttle(func, limit = 300) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Get error message from various error types
 */
export function getErrorMessage(error) {
  if (typeof error === 'string') {
    return error;
  }

  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (error.message) {
    return error.message;
  }

  return 'An unknown error occurred';
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate password strength
 */
export function getPasswordStrength(password) {
  let strength = 0;
  const feedback = [];

  if (!password) return { score: 0, strength: 'very-weak', feedback };

  // Length check
  if (password.length >= 8) strength++;
  else feedback.push('At least 8 characters');

  if (password.length >= 12) strength++;

  // Character variety checks
  if (/[a-z]/.test(password)) strength++;
  else feedback.push('At least one lowercase letter');

  if (/[A-Z]/.test(password)) strength++;
  else feedback.push('At least one uppercase letter');

  if (/[0-9]/.test(password)) strength++;
  else feedback.push('At least one number');

  if (/[^a-zA-Z0-9]/.test(password)) strength++;
  else feedback.push('At least one special character');

  const strengthMap = {
    0: 'very-weak',
    1: 'weak',
    2: 'fair',
    3: 'good',
    4: 'strong',
    5: 'very-strong',
  };

  return {
    score: strength,
    strength: strengthMap[strength] || 'very-weak',
    feedback,
  };
}

/**
 * Generate random ID
 */
export function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Merge arrays without duplicates
 */
export function mergeUnique(arr1, arr2, key = 'id') {
  const map = new Map();
  [...arr1, ...arr2].forEach((item) => {
    map.set(item[key], item);
  });
  return Array.from(map.values());
}

/**
 * Group array by property
 */
export function groupBy(array, key) {
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
}

/**
 * Sort array of objects
 */
export function sortBy(array, key, direction = 'asc') {
  return [...array].sort((a, b) => {
    if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
    if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

/**
 * Filter out falsy values
 */
export function compact(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== null && value !== undefined && value !== '')
  );
}
