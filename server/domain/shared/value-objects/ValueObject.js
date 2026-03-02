/**
 * ValueObject - Base class for immutable value objects
 * 
 * Value Objects:
 * - Have no identity, only value matters
 * - Are immutable
 * - Are compared by value, not reference
 * - Example: Money, Address, Email
 * 
 * Usage: Extend this class and implement equals() and getValue()
 */
class ValueObject {
	constructor(value) {
		this._value = value;
		Object.freeze(this); // Make immutable
	}

	/**
	 * Get the underlying value
	 */
	getValue() {
		return this._value;
	}

	/**
	 * Compare two value objects by value
	 * Override in subclasses for custom comparison
	 */
	equals(other) {
		if (!(other instanceof this.constructor)) {
			return false;
		}
		return JSON.stringify(this._value) === JSON.stringify(other._value);
	}

	/**
	 * Serialize value object
	 */
	toJSON() {
		return this._value;
	}

	/**
	 * String representation
	 */
	toString() {
		return JSON.stringify(this._value);
	}
}

module.exports = ValueObject;
// Base Class