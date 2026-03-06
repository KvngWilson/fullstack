class Product {
	constructor({
		id = null,
		name,
		description = "",
		basePrice = 0,
		categoryId = null,
		isActive = true,
		variants = [],
	} = {}) {
		if (!name) {
			throw new Error("name is required");
		}

		this.id = id;
		this.name = name;
		this.description = description;
		this.basePrice = Number(basePrice) || 0;
		this.categoryId = categoryId;
		this.isActive = Boolean(isActive);
		this.variants = Array.isArray(variants) ? [...variants] : [];
	}

	activate() {
		this.isActive = true;
		return this;
	}

	deactivate() {
		this.isActive = false;
		return this;
	}

	setBasePrice(price) {
		const normalized = Number(price);
		if (!Number.isFinite(normalized) || normalized < 0) {
			throw new Error("base price must be a non-negative number");
		}
		this.basePrice = normalized;
		return this;
	}
}

module.exports = Product;
