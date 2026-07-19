/**
 * Identity Domain
 *
 * Handles authentication, authorization, users, roles, and permissions.
 *
 * Services:
 * - AuthenticationService: Unified authentication (all authentication operations)
 * - UserService: User management
 * - PermissionService: Permission resolution
 * - AdminAuthService: Admin-specific authentication
 */

module.exports = {
  services: {
    // Unified authentication service - recommended for all code
    AuthenticationService: require("./services/AuthenticationService"),

    UserService: require("./services/UserService"),
    PermissionService: require("./services/PermissionService"),
    AdminAuthService: require("../admin/AdminAuthService"),
  },
  repositories: require("./repositories"),
  policies: {
    PermissionMatrix: require("./policies/PermissionMatrix"),
  },
};
