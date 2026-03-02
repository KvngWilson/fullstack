/**
 * DomainEvent - Base class for all domain events
 * 
 * Domain events represent something significant that happened within a domain.
 * They are the communication mechanism between aggregates and the rest of the system.
 * 
 * Key principles:
 * - Immutable after creation
 * - Include timestamp and context info
 * - Can be published to event bus
 * - Subscribers are loosely coupled
 */
class DomainEvent {
	constructor(aggregateId, eventType) {
		this.aggregateId = aggregateId;
		this.eventType = eventType;
		this.timestamp = new Date();
		this.eventId = this._generateEventId();
		this.version = 1;
	}

	_generateEventId() {
		return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	getMetadata() {
		return {
			eventId: this.eventId,
			eventType: this.eventType,
			aggregateId: this.aggregateId,
			timestamp: this.timestamp,
			version: this.version,
		};
	}

	getPayload() {
		return {};
	}

	toJSON() {
		return {
			...this.getMetadata(),
			payload: this.getPayload(),
		};
	}
}

module.exports = DomainEvent;