/**
 * Identity Domain Test Fixtures
 * Provides pre-configured test data and factories for identity/auth testing
 */

const testHelpers = require("../helpers/testHelpers");

// ===== FIXTURE DEFAULTS =====

const CUSTOMER_USER_DEFAULTS = {
  first_name: "John",
  last_name: "Customer",
  role: "customer",
  is_verified: true,
};

const ADMIN_USER_DEFAULTS = {
  first_name: "Admin",
  last_name: "User",
  role: "admin",
  is_verified: true,
};

const UNVERIFIED_USER_DEFAULTS = {
  first_name: "Unverified",
  last_name: "User",
  role: "customer",
  is_verified: false,
};

// ===== FIXTURE FACTORIES =====

/**
 * Create standard customer user
 */
async function createCustomerUser(overrides = {}) {
  return testHelpers.createTestUser({
    ...CUSTOMER_USER_DEFAULTS,
    ...overrides,
  });
}

/**
 * Create admin user
 */
async function createAdminUser(overrides = {}) {
  return testHelpers.createTestAdmin({
    ...ADMIN_USER_DEFAULTS,
    ...overrides,
  });
}

/**
 * Create unverified user (for email verification tests)
 */
async function createUnverifiedUser(overrides = {}) {
  return testHelpers.createTestUser({
    ...UNVERIFIED_USER_DEFAULTS,
    ...overrides,
  });
}

/**
 * Create multiple users
 */
async function createMultipleUsers(count = 3, overrides = {}) {
  const users = [];
  for (let i = 0; i < count; i++) {
    const user = await createCustomerUser({
      first_name: `User${i + 1}`,
      ...overrides,
    });
    users.push(user);
  }
  return users;
}

/**
 * Create user with auth tokens
 */
async function createAuthenticatedUser(overrides = {}) {
  const user = await createCustomerUser(overrides);
  const accessToken = testHelpers.generateToken(user.id);
  const refreshToken = testHelpers.generateRefreshToken(user.id);

  return {
    ...user,
    accessToken,
    refreshToken,
    authHeader: `Bearer ${accessToken}`,
  };
}

// ===== FIXTURE PRESETS =====

/**
 * Preset: Complete admin user
 */
const adminUserPreset = {
  factory: createAdminUser,
  defaults: ADMIN_USER_DEFAULTS,
};

/**
 * Preset: Standard customer
 */
const customerUserPreset = {
  factory: createCustomerUser,
  defaults: CUSTOMER_USER_DEFAULTS,
};

/**
 * Preset: Authenticated customer
 */
const authenticatedUserPreset = {
  factory: createAuthenticatedUser,
  defaults: CUSTOMER_USER_DEFAULTS,
};

/**
 * Preset: Unverified customer (email not confirmed)
 */
const unverifiedUserPreset = {
  factory: createUnverifiedUser,
  defaults: UNVERIFIED_USER_DEFAULTS,
};

// ===== MOCK DATA FOR TESTING =====

/**
 * Valid registration payload
 */
const validRegistrationPayload = {
  email: "newuser@example.com",
  password: "SecurePassword123!",
  first_name: "John",
  last_name: "Doe",
};

/**
 * Valid login payload
 */
const validLoginPayload = {
  email: "customer@example.com",
  password: "SecurePassword123!",
};

/**
 * Invalid registration payloads for validation test
 */
const invalidRegistrationPayloads = {
  missingEmail: {
    password: "SecurePassword123!",
    first_name: "John",
    last_name: "Doe",
  },
  missingPassword: {
    email: "newuser@example.com",
    first_name: "John",
    last_name: "Doe",
  },
  invalidEmail: {
    email: "not-an-email",
    password: "SecurePassword123!",
    first_name: "John",
    last_name: "Doe",
  },
  weakPassword: {
    email: "newuser@example.com",
    password: "weak",
    first_name: "John",
    last_name: "Doe",
  },
};

/**
 * Common authentication scenarios for testing
 */
const authScenarios = {
  // Valid auth scenarios
  validCustomer: {
    user: CUSTOMER_USER_DEFAULTS,
    expectedRole: "customer",
    hasToken: true,
  },
  validAdmin: {
    user: ADMIN_USER_DEFAULTS,
    expectedRole: "admin",
    hasToken: true,
  },

  // Invalid auth scenarios
  invalidToken: {
    token: "invalid.jwt.token",
    expectedError: "Invalid token",
  },
  expiredToken: {
    token: "expired.jwt.token", // Would be actual expired token in real test
    expectedError: "Token expired",
  },
  missingToken: {
    token: null,
    expectedError: "No token provided",
  },
};

module.exports = {
  // Factories
  createCustomerUser,
  createAdminUser,
  createUnverifiedUser,
  createMultipleUsers,
  createAuthenticatedUser,

  // Presets
  adminUserPreset,
  customerUserPreset,
  authenticatedUserPreset,
  unverifiedUserPreset,

  // Mock data
  validRegistrationPayload,
  validLoginPayload,
  invalidRegistrationPayloads,
  authScenarios,

  // Constants for testing
  CUSTOMER_USER_DEFAULTS,
  ADMIN_USER_DEFAULTS,
  UNVERIFIED_USER_DEFAULTS,
};
