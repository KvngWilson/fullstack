class ProductCreated {
	constructor({ productId, name, categoryId = null, occurredAt = new Date() } = {}) {
		this.type = "catalog.product.created";
		this.productId = productId;
		this.name = name;
		this.categoryId = categoryId;
		this.occurredAt = occurredAt;
	}
}

module.exports = ProductCreated;
