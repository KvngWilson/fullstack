/**
 * Identity Domain
 * 
 * Handles authentication, authorization, users, roles, and permissions.
 * 
 * Services:
 * - AuthService: Authentication logic
 * - UserService: User management
 * - PermissionService: Permission resolution
 */

module.exports = {
  services: {
    AuthService: require("./services/AuthService"),
    EnhancedAuthService: require("./services/EnhancedAuthService"),
    UserService: require("./services/UserService"),
    PermissionService: require("./services/PermissionService"),
  },
  repositories: require("./repositories"),
  policies: {
    PasswordPolicy: require("./policies/PasswordPolicy"),
    PermissionMatrix: require("./policies/PermissionMatrix"),
  },
};
