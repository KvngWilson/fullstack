class Inventory {
	constructor({ productId, variantId = null, stock = 0, reserved = 0 } = {}) {
		if (!productId) {
			throw new Error("productId is required");
		}

		this.productId = productId;
		this.variantId = variantId;
		this.stock = Number(stock) || 0;
		this.reserved = Number(reserved) || 0;
	}

	available() {
		return Math.max(0, this.stock - this.reserved);
	}

	addStock(quantity) {
		const value = Number(quantity) || 0;
		if (value <= 0) {
			throw new Error("quantity must be greater than 0");
		}
		this.stock += value;
		return this;
	}

	reserve(quantity) {
		const value = Number(quantity) || 0;
		if (value <= 0 || value > this.available()) {
			throw new Error("insufficient stock to reserve");
		}
		this.reserved += value;
		return this;
	}
}

module.exports = Inventory;
