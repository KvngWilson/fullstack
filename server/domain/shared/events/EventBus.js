/**
 * EventBus - Mediates publish/subscribe of domain events
 * 
 * Pattern: Event-driven architecture
 * - Publishers don't know subscribers
 * - Subscribers register as handlers
 * - Decouples domains
 * 
 * This is a simple in-memory implementation.
 * Can be replaced with message broker (RabbitMQ, Kafka) later.
 */
class EventBus {
	constructor() {
		this._subscribers = new Map(); // eventType -> [handlers]
		this._deadLetterQueue = [];
	}

	/**
	 * Subscribe to a domain event type
	 * 
	 * @param {string} eventType - Event type to subscribe to
	 * @param {Function} handler - Handler function(event) => Promise
	 */
	subscribe(eventType, handler) {
		if (!eventType || typeof handler !== 'function') {
			throw new Error('Invalid subscription parameters');
		}

		if (!this._subscribers.has(eventType)) {
			this._subscribers.set(eventType, []);
		}

		this._subscribers.get(eventType).push(handler);
	}

	/**
	 * Publish a domain event
	 * 
	 * @param {DomainEvent} event - Event to publish
	 */
	async publish(event) {
		if (!event || !event.eventType) {
			throw new Error('Invalid event');
		}

		const handlers = this._subscribers.get(event.eventType) || [];

		const results = await Promise.allSettled(
			handlers.map(handler => handler(event))
		);

		// Track failures for deadletter handling
		results.forEach((result, index) => {
			if (result.status === 'rejected') {
				this._deadLetterQueue.push({
					event,
					handler: handlers[index],
					error: result.reason,
					timestamp: new Date(),
				});
			}
		});

		return results;
	}

	/**
	 * Publish multiple events
	 */
	async publishAll(events) {
		return Promise.all(events.map(event => this.publish(event)));
	}

	/**
	 * Get subscribers for event type
	 */
	getSubscribers(eventType) {
		return this._subscribers.get(eventType) || [];
	}

	/**
	 * Get dead letter queue (failed event deliveries)
	 */
	getDeadLetterQueue() {
		return this._deadLetterQueue;
	}

	/**
	 * Clear event bus (for testing)
	 */
	clear() {
		this._subscribers.clear();
		this._deadLetterQueue = [];
	}
}

module.exports = EventBus;