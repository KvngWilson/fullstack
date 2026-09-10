const USER_ROLES = {
  CUSTOMER: "customer",
  VENDOR: "vendor",
  EMPLOYEE: "employee",
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  MANAGER: "manager",
  SUPPORT: "support",
  WAREHOUSE: "warehouse",
  FINANCE: "finance",
  READONLY: "readonly",
};

const INTERNAL_ADMIN_ROLES = [
  USER_ROLES.EMPLOYEE,
  USER_ROLES.SUPER_ADMIN,
  USER_ROLES.ADMIN,
  USER_ROLES.MANAGER,
  USER_ROLES.SUPPORT,
  USER_ROLES.WAREHOUSE,
  USER_ROLES.FINANCE,
  USER_ROLES.READONLY,
];

function isInternalAdminRole(role) {
  return INTERNAL_ADMIN_ROLES.includes(String(role || "").toLowerCase());
}

module.exports = {
  USER_ROLES,
  INTERNAL_ADMIN_ROLES,
  isInternalAdminRole,
};
