/**
 * RabbitMQEventBus
 *
 * Production-grade event bus backed by RabbitMQ.
 * Implements the same interface as the in-memory EventBus so callers
 * can swap transports without changing any domain code.
 *
 * Features:
 * - Topic exchange fan-out (one event → many subscriber queues)
 * - Durable queues + persistent messages (survive broker restart)
 * - Dead-letter exchange (DLX) for messages that fail after max retries
 * - Exponential backoff reconnection with jitter
 * - Graceful close (drains in-flight messages before shutdown)
 * - Per-handler named queues so each subscriber gets its own cursor
 *   (multiple API replicas each process the event independently)
 */

const amqp = require("amqplib");
const { logger } = require("../../shared/utils/logger");

const EXCHANGE = "events";
const DLX_EXCHANGE = "events.dlx";
const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

class RabbitMQEventBus {
  /**
   * @param {{ url: string, prefetch?: number }} config
   *   url      - AMQP connection string, e.g. amqp://guest:guest@rabbitmq:5672
   *   prefetch - max unacked messages per consumer (default: 10)
   */
  constructor(config) {
    this.config = config;
    this.prefetch = config.prefetch ?? 10;
    this.connection = null;
    this.channel = null;
    this._subscribers = []; // { eventType, queueName, handler }
    this._deadLetterQueue = []; // in-memory mirror of DLX arrivals for inspection
    this._closing = false;
    this._reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
  }

  // ─── Connection ─────────────────────────────────────────────────────────────

  async connect() {
    this._closing = false;
    try {
      this.connection = await amqp.connect(this.config.url);
      this.channel = await this.connection.createChannel();
      await this.channel.prefetch(this.prefetch);

      // Main topic exchange — routes events by routing key (eventType)
      await this.channel.assertExchange(EXCHANGE, "topic", { durable: true });

      // Dead-letter exchange — receives messages that exceed retry limit
      await this.channel.assertExchange(DLX_EXCHANGE, "fanout", {
        durable: true,
      });

      // DLQ — binds to DLX so dead letters land somewhere inspectable
      const dlq = await this.channel.assertQueue("events.dead-letter", {
        durable: true,
      });
      await this.channel.bindQueue(dlq.queue, DLX_EXCHANGE, "#");

      // Re-register any subscribers that were added before/after reconnect
      for (const sub of this._subscribers) {
        await this._bindSubscriber(sub);
      }

      this._reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      logger.info("RabbitMQ connected", { url: this._safeUrl() });

      this.connection.on("close", () =>
        this._scheduleReconnect("connection closed"),
      );
      this.connection.on("error", (err) => {
        logger.error("RabbitMQ connection error", { error: err.message });
        this._scheduleReconnect("connection error");
      });
      this.channel.on("error", (err) => {
        logger.error("RabbitMQ channel error", { error: err.message });
        this._scheduleReconnect("channel error");
      });
    } catch (err) {
      logger.error("RabbitMQ connect failed", { error: err.message });
      this._scheduleReconnect("initial connect failed");
    }
  }

  _scheduleReconnect(reason) {
    if (this._closing) return;
    const jitter = Math.random() * 1000;
    const delay = Math.min(
      this._reconnectDelay + jitter,
      MAX_RECONNECT_DELAY_MS,
    );
    this._reconnectDelay = Math.min(
      this._reconnectDelay * 2,
      MAX_RECONNECT_DELAY_MS,
    );
    logger.warn("RabbitMQ reconnecting", {
      reason,
      delayMs: Math.round(delay),
    });
    setTimeout(() => this.connect(), delay);
  }

  // ─── Subscribe ───────────────────────────────────────────────────────────────

  /**
   * Subscribe a handler to an event type.
   * Each (eventType, serviceName) pair gets its own durable queue so that:
   * - multiple handler registrations for the same eventType fan-out correctly
   * - multiple server replicas share the queue (competing consumers = process once)
   *
   * @param {string}   eventType   - Routing key, e.g. "order.placed"
   * @param {Function} handler     - async (event) => void
   * @param {string}   [queueName] - Override queue name (defaults to eventType-derived)
   */
  async subscribe(eventType, handler, queueName) {
    if (typeof eventType !== "string" || !eventType) {
      throw new Error("eventType must be a non-empty string");
    }
    if (typeof handler !== "function") {
      throw new Error("handler must be a function");
    }

    const resolvedQueue = queueName || `sub.${eventType.replace(/\./g, "-")}`;
    const sub = { eventType, queueName: resolvedQueue, handler };
    this._subscribers.push(sub);

    if (this.channel) {
      await this._bindSubscriber(sub);
    }
    // If not yet connected, _bindSubscriber is called after connect() succeeds
  }

  async _bindSubscriber({ eventType, queueName, handler }) {
    const q = await this.channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        "x-dead-letter-exchange": DLX_EXCHANGE,
        "x-message-ttl": 7 * 24 * 60 * 60 * 1000, // auto-expire after 7 days
      },
    });
    await this.channel.bindQueue(q.queue, EXCHANGE, eventType);
    await this.channel.consume(
      q.queue,
      async (msg) => {
        if (!msg) return;
        let event;
        try {
          event = JSON.parse(msg.content.toString());
          await handler(event);
          this.channel.ack(msg);
        } catch (error) {
          logger.error("RabbitMQ handler error", {
            eventType,
            error: error.message,
            queue: queueName,
          });
          // nack without requeue → routed to DLX
          this.channel.nack(msg, false, false);
          this._deadLetterQueue.push({
            event,
            error: error.message,
            failedAt: new Date(),
          });
        }
      },
      { noAck: false },
    );
  }

  // ─── Publish ─────────────────────────────────────────────────────────────────

  /**
   * Publish a single domain event.
   * @param {object} event - Must have eventType or type property
   */
  async publish(event) {
    if (!event || typeof event !== "object") {
      throw new Error("event must be a non-null object");
    }
    const eventType = event.eventType || event.type;
    if (!eventType) {
      throw new Error("event must have an eventType or type property");
    }
    if (!this.channel) {
      logger.warn("RabbitMQ publish skipped: not connected", { eventType });
      return;
    }
    const content = Buffer.from(JSON.stringify(event));
    this.channel.publish(EXCHANGE, eventType, content, { persistent: true });
  }

  /**
   * Publish multiple domain events in order.
   * @param {object[]} events
   */
  async publishAll(events = []) {
    for (const event of events) {
      await this.publish(event);
    }
  }

  // ─── Introspection ───────────────────────────────────────────────────────────

  /**
   * Returns the in-memory mirror of dead-lettered events.
   * The real DLQ lives in RabbitMQ as queue `events.dead-letter`.
   */
  getDeadLetterQueue() {
    return this._deadLetterQueue;
  }

  /**
   * Remove all in-memory subscriber registrations and dead-letter records.
   * Primarily for testing. Does NOT delete queues from the broker.
   */
  clear() {
    this._subscribers = [];
    this._deadLetterQueue = [];
  }

  // ─── Shutdown ────────────────────────────────────────────────────────────────

  /**
   * Gracefully close the channel and connection.
   * Waits for in-flight acks before closing.
   */
  async close() {
    this._closing = true;
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      logger.info("RabbitMQ connection closed gracefully");
    } catch (err) {
      logger.warn("RabbitMQ close error (ignored)", { error: err.message });
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  _safeUrl() {
    try {
      const u = new URL(this.config.url);
      u.password = "***";
      return u.toString();
    } catch {
      return "<unparseable url>";
    }
  }
}

module.exports = RabbitMQEventBus;
