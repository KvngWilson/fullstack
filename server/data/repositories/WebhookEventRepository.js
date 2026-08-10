/**
 * WebhookEventRepository - Database operations for webhook events
 * 
 * Supports:
 * - Recording incoming webhook events
 * - Checking for duplicate/already-processed events
 * - Updating event status after processing
 * - Retrieving event history for auditing
 */

const BaseRepository = require('./BaseRepository');

class WebhookEventRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'webhook_events');
  }

  /**
   * Record incoming webhook event
   */
  async recordEvent(eventData) {
    const {
      event_id,
      provider,
      event_type,
      shipment_id,
      order_id,
      payload,
      status = 'pending',
      error_message = null,
      processed_at = null,
    } = eventData;

    try {
      const result = await this.pool.query(
        `INSERT INTO webhook_events
         (event_id, provider, event_type, shipment_id, order_id, payload, status, error_message, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (provider, event_id) 
         DO UPDATE SET
           status = $7,
           error_message = $8,
           processed_at = $9,
           updated_at = now()
         RETURNING *`,
        [
          event_id,
          provider,
          event_type,
          shipment_id,
          order_id,
          typeof payload === 'string' ? payload : JSON.stringify(payload),
          status,
          error_message,
          processed_at,
        ]
      );

      return result.rows[0];
    } catch (error) {
      this.logger.error('Failed to record webhook event', {
        event_id,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get event by external event ID
   */
  async getEventById(externalEventId) {
    const result = await this.pool.query(
      `SELECT *
       FROM webhook_events
       WHERE event_id = $1
       LIMIT 1`,
      [externalEventId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get events for order (for auditing)
   */
  async getEventsByOrderId(orderId) {
    const result = await this.pool.query(
      `SELECT id, event_id, provider, event_type, status, processed_at, error_message, created_at
       FROM webhook_events
       WHERE order_id = $1
       ORDER BY created_at DESC`,
      [orderId]
    );

    return result.rows;
  }

  /**
   * Get pending events (for retry logic)
   */
  async getPendingEvents(limit = 100) {
    const result = await this.pool.query(
      `SELECT *
       FROM webhook_events
       WHERE status = 'pending'
       AND retry_count < 3
       ORDER BY created_at ASC
       LIMIT $1`,
      [limit]
    );

    return result.rows;
  }

  /**
   * Increment retry count for event
   */
  async incrementRetryCount(externalEventId) {
    await this.pool.query(
      `UPDATE webhook_events
       SET retry_count = retry_count + 1,
           updated_at = now()
       WHERE event_id = $1`,
      [externalEventId]
    );
  }

  /**
   * Mark event as processed
   */
  async markProcessed(externalEventId, orderId = null) {
    await this.pool.query(
      `UPDATE webhook_events
       SET status = 'processed',
           order_id = COALESCE($2, order_id),
           processed_at = now(),
           updated_at = now()
       WHERE event_id = $1`,
      [externalEventId, orderId]
    );
  }

  /**
   * Mark event as failed
   */
  async markFailed(externalEventId, errorMessage) {
    await this.pool.query(
      `UPDATE webhook_events
       SET status = 'failed',
           error_message = $2,
           updated_at = now()
       WHERE event_id = $1`,
      [externalEventId, errorMessage]
    );
  }

  /**
   * Get statistics on webhook processing
   */
  async getWebhookStats(provider = null) {
    let query = `
      SELECT 
        provider,
        status,
        COUNT(*) as count,
        MAX(created_at) as last_event
      FROM webhook_events
    `;

    const params = [];

    if (provider) {
      query += ` WHERE provider = $1`;
      params.push(provider);
    }

    query += ` GROUP BY provider, status`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }
}

module.exports = WebhookEventRepository;
