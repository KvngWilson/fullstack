/**
 * Vendor Domain
 * 
 * Handles vendor applications and management.
 * 
 * Services:
 * - VendorApplicationService: Vendor application processing
 */

module.exports = {
  services: {
    VendorApplicationService: require("./services/VendorApplicationService"),
  },
};
