/**
 * AggregateRoot - Base class for all domain aggregates
 * 
 * In DDD, an Aggregate Root:
 * - Protects invariants within its boundaries
 * - Is the only entity directly accessible from outside
 * - Controls all access to its sub-entities
 * - Is transaction boundary
 * - Is the only object persisted (represents aggregate)
 */
class AggregateRoot {
	constructor(id) {
		this.id = id;
		this._domainEvents = [];
		this._version = 0;
		this._createdAt = new Date();
		this._updatedAt = new Date();
	}

	getDomainEvents() {
		return this._domainEvents;
	}

	addDomainEvent(event) {
		if (!event) throw new Error('Domain event cannot be null');
		this._domainEvents.push(event);
	}

	clearDomainEvents() {
		this._domainEvents = [];
	}

	getVersion() {
		return this._version;
	}

	incrementVersion() {
		this._version++;
		this._updatedAt = new Date();
	}

	getCreatedAt() {
		return this._createdAt;
	}

	getUpdatedAt() {
		return this._updatedAt;
	}

	markAsModified() {
		this.incrementVersion();
	}
}

module.exports = AggregateRoot;