const inventoryRepository = require("../repositories/InventoryRepository");
const BaseService = require("../../base/BaseService");
const PERMISSIONS = require("../../../shared/constants/permissions");

/**
 * Inventory Service.
 * Manages stock reads, updates, and availability checks.
 */
class InventoryService extends BaseService {
  constructor() {
    super();
  }

  async getByVariantId(variantId) {
    return inventoryRepository.findById(variantId);
  }

  async getByProductId(productId) {
    return inventoryRepository.findByProductId(productId);
  }

  async updateStock(variantId, newStock, employeeId = null) {
    if (newStock < 0) {
      throw new Error("Stock cannot be negative");
    }

    if (employeeId) {
      await this.validatePermission(employeeId, PERMISSIONS.INVENTORY.UPDATE);
    }

    const updated = await inventoryRepository.updateStock(variantId, newStock);

    if (employeeId && updated) {
      await this.auditLog(employeeId, "inventory:update", "inventory", variantId, {
        newStock,
      });
    }

    return updated;
  }

  async decrementStock(variantId, quantity, employeeId = null) {
    if (quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

    if (employeeId) {
      await this.validatePermission(employeeId, PERMISSIONS.INVENTORY.UPDATE);
    }

    const result = await inventoryRepository.decrementStock(variantId, quantity);
    if (!result) {
      throw new Error("Insufficient stock");
    }

    if (employeeId) {
      await this.auditLog(employeeId, "inventory:decrement", "inventory", variantId, {
        quantity,
      });
    }

    return result;
  }

  async checkAvailability(variantId, quantity) {
    const variant = await inventoryRepository.findById(variantId);
    if (!variant) return false;
    return variant.stock >= quantity;
  }
}

module.exports = new InventoryService();
