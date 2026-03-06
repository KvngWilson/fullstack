class PricingPolicy {
	static validatePrice(price) {
		const normalized = Number(price);

		if (!Number.isFinite(normalized)) {
			return { valid: false, message: "Price must be numeric" };
		}

		if (normalized < 0) {
			return { valid: false, message: "Price cannot be negative" };
		}

		return { valid: true };
	}

	static computeDisplayPrice(basePrice, adjustment = 0) {
		const base = Number(basePrice) || 0;
		const delta = Number(adjustment) || 0;
		return Math.max(0, base + delta);
	}
}

module.exports = PricingPolicy;
