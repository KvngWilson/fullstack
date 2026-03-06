const adminPolicy = {
  dashboard: {
    read: "dashboard:view",
  },
  users: {
    read: "user:read",
    update: "user:update",
    delete: "user:delete",
    roleAssign: "user:role_assign",
    suspend: "user:suspend",
    lock: "user:lock",
    unlock: "user:unlock",
  },
  employees: {
    manage: "employee:manage",
    invite: "employee:invite",
  },
  roles: {
    read: "role:read",
    create: "role:create",
    update: "role:update",
    delete: "role:delete",
    permissions: "role:permissions",
  },
  permissions: {
    read: "permission:read",
    create: "permission:create",
    update: "permission:update",
    delete: "permission:delete",
  },
  translations: {
    manage: "translations:manage",
  },
  audit: {
    read: "audit:read",
    export: "audit:export",
  },
  security: {
    manage: "security:manage",
  },
  jobs: {
    manage: "jobs:manage",
  },
  exchangeRates: {
    read: "exchange-rates:read",
    create: "exchange-rates:create",
    update: "exchange-rates:update",
    deactivate: "exchange-rates:deactivate",
  },
};

module.exports = adminPolicy;
