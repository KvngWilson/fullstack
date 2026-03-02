const inventoryRepository = require("../repositories/InventoryRepository");

/**
 * Inventory Service.
 * Manages stock reads, updates, and availability checks.
 */
class InventoryService {
  async getByVariantId(variantId) {
    return inventoryRepository.findById(variantId);
  }

  async getByProductId(productId) {
    return inventoryRepository.findByProductId(productId);
  }

  async updateStock(variantId, newStock) {
    if (newStock < 0) {
      throw new Error("Stock cannot be negative");
    }
    return inventoryRepository.updateStock(variantId, newStock);
  }

  async decrementStock(variantId, quantity) {
    if (quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

    const result = await inventoryRepository.decrementStock(variantId, quantity);
    if (!result) {
      throw new Error("Insufficient stock");
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
