/**
 * Unified permission constants
 * Single source of truth for all RBAC permission codes
 */
module.exports = {
  PRODUCT: {
    READ: "product:read",
    CREATE: "product:create",
    UPDATE: "product:update",
    DELETE: "product:delete",
  },
  CATEGORY: {
    READ: "category:read",
    CREATE: "category:create",
    UPDATE: "category:update",
    DELETE: "category:delete",
  },
  INVENTORY: {
    READ: "inventory:read",
    UPDATE: "inventory:update",
  },
  ORDER: {
    READ: "order:read",
    CREATE: "order:create",
    UPDATE: "order:update",
    CANCEL: "order:cancel",
  },
  PAYMENT: {
    CREATE: "payment:create",
    VERIFY: "payment:verify",
    REFUND: "payment:refund",
  },
  EMPLOYEE: {
    INVITE: "employee:invite",
    MANAGE: "employee:manage",
  },
  EXCHANGE_RATES: {
    READ: "exchange-rate:read",
    CREATE: "exchange-rate:create",
    UPDATE: "exchange-rate:update",
    DEACTIVATE: "exchange-rate:deactivate",
  },
  AUDIT: {
    READ: "audit:read",
    EXPORT: "audit:export",
  },
  SECURITY: {
    MANAGE: "security:manage",
    MFA_MANAGE: "security:2fa_manage",
  },
  ADMIN: {
    USERS: {
      READ: "admin:users:read",
      UPDATE: "admin:users:update",
      LOCK: "admin:users:lock",
      UNLOCK: "admin:users:unlock",
      DELETE: "admin:users:delete",
    },
    DASHBOARD: {
      READ: "admin:dashboard:read",
    },
    ROLES: {
      READ: "admin:roles:read",
      CREATE: "admin:roles:create",
      UPDATE: "admin:roles:update",
      DELETE: "admin:roles:delete",
    },
    PERMISSIONS: {
      READ: "admin:permissions:read",
      CREATE: "admin:permissions:create",
      UPDATE: "admin:permissions:update",
      DELETE: "admin:permissions:delete",
    },
    JOBS: {
      MANAGE: "admin:jobs:manage",
    },
  },
  TRANSLATION: {
    MANAGE: "translation:manage",
  },
};
