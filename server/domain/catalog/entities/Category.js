class Category {
	constructor({ id = null, name, description = "", isActive = true } = {}) {
		if (!name) {
			throw new Error("name is required");
		}

		this.id = id;
		this.name = name;
		this.description = description;
		this.isActive = Boolean(isActive);
	}
}

module.exports = Category;
