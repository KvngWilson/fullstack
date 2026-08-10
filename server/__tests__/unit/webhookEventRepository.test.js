/**
 * WebhookEventRepository Unit Tests
 * 
 * Tests database operations for webhook events:
 * - Recording events with upsert on duplicate
 * - Retrieving events by ID
 * - Deduplication checks
 * - Status updates and retry logic
 * - Event querying and filtering
 */

const WebhookEventRepository = require('../../data/repositories/WebhookEventRepository');

describe('WebhookEventRepository - Database Operations', () => {
  let repo;
  let mockPool;

  const mockEvent = {
    id: 1,
    event_id: 'evt-123',
    provider: 'easyship',
    event_type: 'shipment.in_transit',
    shipment_id: 'shipment-abc123',
    order_id: 1,
    status: 'processed',
    payload: { shipment: { status: 'in_transit' } },
    created_at: '2026-03-01T12:00:00Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockPool = {
      query: jest.fn(),
    };

    repo = new WebhookEventRepository(mockPool);
  });

  describe('recordEvent', () => {
    it('inserts new event', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockEvent] });

      const result = await repo.recordEvent({
        event_id: 'evt-123',
        provider: 'easyship',
        event_type: 'shipment.in_transit',
        shipment_id: 'shipment-abc123',
        order_id: 1,
        payload: { shipment: { status: 'in_transit' } },
        status: 'processed',
      });

      expect(result).toEqual(mockEvent);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO webhook_events'),
        expect.any(Array)
      );
    });

    it('upserts on duplicate provider+event_id', async () => {
      const updatedEvent = { ...mockEvent, status: 'processed' };
      mockPool.query.mockResolvedValue({ rows: [updatedEvent] });

      await repo.recordEvent({
        event_id: 'evt-123',
        provider: 'easyship',
        event_type: 'shipment.in_transit',
        status: 'processed',
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT'),
        expect.any(Array)
      );
    });

    it('handles JSON payload conversion', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockEvent] });

      const payload = { shipment: { id: 'shipment-abc' } };

      await repo.recordEvent({
        event_id: 'evt-123',
        provider: 'easyship',
        event_type: 'shipment.updated',
        payload,
        status: 'pending',
      });

      const callArgs = mockPool.query.mock.calls[0][1];
      // Payload should be stringified
      expect(typeof callArgs[5]).toBe('string');
    });

    it('handles string payload directly', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockEvent] });

      const payloadString = JSON.stringify({ test: 'data' });

      await repo.recordEvent({
        event_id: 'evt-123',
        provider: 'easyship',
        payload: payloadString,
        status: 'pending',
      });

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[5]).toBe(payloadString);
    });
  });

  describe('getEventById', () => {
    it('retrieves event by external event ID', async () => {
      mockPool.query.mockResolvedValue({ rows: [mockEvent] });

      const result = await repo.getEventById('evt-123');

      expect(result).toEqual(mockEvent);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE event_id = $1'),
        ['evt-123']
      );
    });

    it('returns null if event not found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.getEventById('evt-unknown');

      expect(result).toBeNull();
    });
  });

  describe('getEventsByOrderId', () => {
    it('retrieves all events for order in reverse chronological order', async () => {
      const events = [
        { ...mockEvent, created_at: '2026-03-01T13:00:00Z' },
        { ...mockEvent, created_at: '2026-03-01T12:00:00Z' },
      ];
      mockPool.query.mockResolvedValue({ rows: events });

      const result = await repo.getEventsByOrderId(1);

      expect(result).toEqual(events);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE order_id = $1'),
        [1]
      );
      expect(mockPool.query.mock.calls[0][0]).toContain('ORDER BY created_at DESC');
    });

    it('returns empty array if no events', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await repo.getEventsByOrderId(999);

      expect(result).toEqual([]);
    });
  });

  describe('getPendingEvents', () => {
    it('retrieves pending events with retry count < 3', async () => {
      const events = [
        { ...mockEvent, status: 'pending', retry_count: 0 },
        { ...mockEvent, status: 'pending', retry_count: 1 },
      ];
      mockPool.query.mockResolvedValue({ rows: events });

      const result = await repo.getPendingEvents(100);

      expect(result).toEqual(events);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'pending'"),
        [100]
      );
      expect(mockPool.query.mock.calls[0][0]).toContain('retry_count < 3');
    });

    it('limits results to specified count', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.getPendingEvents(50);

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[0]).toBe(50);
    });

    it('defaults to 100 limit', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.getPendingEvents();

      const callArgs = mockPool.query.mock.calls[0][1];
      expect(callArgs[0]).toBe(100);
    });
  });

  describe('incrementRetryCount', () => {
    it('increments retry count for event', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.incrementRetryCount('evt-123');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE webhook_events'),
        expect.arrayContaining(['evt-123'])
      );
      expect(mockPool.query.mock.calls[0][0]).toContain('retry_count = retry_count + 1');
    });
  });

  describe('markProcessed', () => {
    it('marks event as processed', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.markProcessed('evt-123', 1);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'processed'"),
        expect.arrayContaining(['evt-123', 1])
      );
    });

    it('handles optional order_id', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.markProcessed('evt-123', null);

      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('markFailed', () => {
    it('marks event as failed with error message', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.markFailed('evt-123', 'Shipment not found');

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("status = 'failed'"),
        expect.arrayContaining(['evt-123', 'Shipment not found'])
      );
    });
  });

  describe('getWebhookStats', () => {
    it('returns webhook statistics across all providers', async () => {
      const stats = [
        { provider: 'easyship', status: 'processed', count: 100 },
        { provider: 'easyship', status: 'failed', count: 5 },
      ];
      mockPool.query.mockResolvedValue({ rows: stats });

      const result = await repo.getWebhookStats();

      expect(result).toEqual(stats);
      expect(mockPool.query.mock.calls[0][0]).not.toContain('WHERE');
    });

    it('filters by provider', async () => {
      const stats = [
        { provider: 'easyship', status: 'processed', count: 100 },
      ];
      mockPool.query.mockResolvedValue({ rows: stats });

      const result = await repo.getWebhookStats('easyship');

      expect(result).toEqual(stats);
      expect(mockPool.query.mock.calls[0][0]).toContain('WHERE provider = $1');
      expect(mockPool.query.mock.calls[0][1]).toContain('easyship');
    });

    it('groups by provider and status', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await repo.getWebhookStats();

      expect(mockPool.query.mock.calls[0][0]).toContain('GROUP BY provider, status');
    });
  });
});
