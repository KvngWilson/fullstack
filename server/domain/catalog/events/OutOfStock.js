class OutOfStock {
	constructor({ productId, variantId = null, occurredAt = new Date() } = {}) {
		this.type = "catalog.inventory.out_of_stock";
		this.productId = productId;
		this.variantId = variantId;
		this.occurredAt = occurredAt;
	}
}

module.exports = OutOfStock;
