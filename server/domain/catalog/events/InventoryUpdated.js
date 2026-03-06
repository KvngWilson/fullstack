class InventoryUpdated {
	constructor({
		productId,
		variantId = null,
		previousStock = 0,
		currentStock = 0,
		occurredAt = new Date(),
	} = {}) {
		this.type = "catalog.inventory.updated";
		this.productId = productId;
		this.variantId = variantId;
		this.previousStock = Number(previousStock) || 0;
		this.currentStock = Number(currentStock) || 0;
		this.occurredAt = occurredAt;
	}
}

module.exports = InventoryUpdated;
