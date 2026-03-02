/**
 * Catalog Domain
 * 
 * Handles products, inventory, and categories.
 * 
 * Aggregates:
 * - Product (aggregate root)
 * - Inventory (aggregate root)
 * - Category (aggregate root)
 * 
 * Services:
 * - ProductService: Product management
 * - InventoryService: Stock management
 * - CategoryService: Category management
 */

module.exports = {
  services: {
    ProductService: require("./services/ProductService"),
    CategoryService: require("./services/CategoryService"),
    InventoryService: require("./services/InventoryService"),
  },
  repositories: require("./repositories"),
  // Policies will be added in future phases
};

