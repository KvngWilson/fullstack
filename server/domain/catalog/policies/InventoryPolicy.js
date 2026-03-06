class InventoryPolicy {
	static hasSufficientStock(currentStock, requestedQty) {
		const stock = Number(currentStock) || 0;
		const qty = Number(requestedQty) || 0;
		return qty > 0 && stock >= qty;
	}

	static stockStatus(currentStock) {
		const stock = Number(currentStock) || 0;

		if (stock <= 0) {
			return "out_of_stock";
		}

		if (stock <= 5) {
			return "low_stock";
		}

		return "in_stock";
	}
}

module.exports = InventoryPolicy;
