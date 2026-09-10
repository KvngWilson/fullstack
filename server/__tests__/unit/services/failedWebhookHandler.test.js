/**
 * FailedWebhookHandler Unit Tests
 * 
 * Tests webhook retry logic:
 * - Processing pending failed events
 * - Exponential backoff retry
 * - Max 3 retry limit
 * - Moving to permanent failure
 * - Statistics tracking
 */

const domain = require('../../../domain');
const FailedWebhookHandler = domain.shipping.services.FailedWebhookHandler;

describe('FailedWebhookHandler', () => {
  let handler;
  let mockRepository;
  let mockTrackingService;

  const mockEvent = {
    event_id: 'evt-123',
    provider: 'easyship',
    shipment_id: 'ship-456',
    order_id: 1,
    payload: JSON.stringify({
      event_id: 'evt-123',
      shipment_id: 'ship-456',
      status: 'in_transit',
      tracking_number: 'track-789',
    }),
    retry_count: 0,
    status: 'pending',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRepository = {
      getPendingEvents: jest.fn(),
      incrementRetryCount: jest.fn().mockResolvedValue(undefined),
      markProcessed: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
      getWebhookStats: jest.fn(),
    };

    mockTrackingService = {
      processWebhookEvent: jest.fn(),
    };

    handler = new FailedWebhookHandler(mockRepository, mockTrackingService);
  });

  describe('processPendingEvents', () => {
    it('processes pending events successfully', async () => {
      mockRepository.getPendingEvents.mockResolvedValue([mockEvent]);
      mockTrackingService.processWebhookEvent.mockResolvedValue({
        success: true,
      });

      const result = await handler.processPendingEvents(10);

      expect(result.processed).toBe(1);
      expect(result.succeeded).toBe(1);
      expect(mockTrackingService.processWebhookEvent).toHaveBeenCalled();
      expect(mockRepository.markProcessed).toHaveBeenCalled();
    });

    it('returns zero when no pending events', async () => {
      mockRepository.getPendingEvents.mockResolvedValue([]);

      const result = await handler.processPendingEvents(10);

      expect(result.processed).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('counts successful and failed events', async () => {
      const event1 = { ...mockEvent, event_id: 'evt-1', retry_count: 0 };
      const event2 = { ...mockEvent, event_id: 'evt-2', retry_count: 1 };

      mockRepository.getPendingEvents.mockResolvedValue([event1, event2]);

      mockTrackingService.processWebhookEvent
        .mockResolvedValueOnce({ success: true })
        .mockRejectedValueOnce(new Error('processing failed'));

      const result = await handler.processPendingEvents(10);

      expect(result.processed).toBe(2);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
    });

    it('respects limit parameter', async () => {
      const events = Array.from({ length: 20 }, (_, i) => ({
        ...mockEvent,
        event_id: `evt-${i}`,
      }));

      mockRepository.getPendingEvents.mockResolvedValue(events.slice(0, 5));

      await handler.processPendingEvents(5);

      expect(mockRepository.getPendingEvents).toHaveBeenCalledWith(5);
    });
  });

  describe('retryEvent', () => {
    it('marks event as processed on success', async () => {
      mockTrackingService.processWebhookEvent.mockResolvedValue({
        success: true,
      });

      const result = await handler.retryEvent(mockEvent);

      expect(result.succeeded).toBe(true);
      expect(mockRepository.markProcessed).toHaveBeenCalledWith(
        'evt-123',
        'ship-456'
      );
    });

    it('schedules retry on transient failure', async () => {
      mockTrackingService.processWebhookEvent.mockRejectedValue(
        new Error('temporary failure')
      );

      const result = await handler.retryEvent(mockEvent);

      expect(result.succeeded).toBe(false);
      expect(result.permanent).toBe(false);
      expect(result.nextRetryIn).toBeGreaterThan(0);
      expect(mockRepository.incrementRetryCount).toHaveBeenCalledWith('evt-123');
    });

    it('marks as failed after max retries', async () => {
      const maxRetriesEvent = {
        ...mockEvent,
        retry_count: 3, // Already at max
      };

      mockTrackingService.processWebhookEvent.mockRejectedValue(
        new Error('permanent failure')
      );

      const result = await handler.retryEvent(maxRetriesEvent);

      expect(result.succeeded).toBe(false);
      expect(result.permanent).toBe(true);
      expect(mockRepository.markFailed).toHaveBeenCalledWith(
        'evt-123',
        expect.stringContaining('Permanent failure')
      );
    });

    it('implements exponential backoff', async () => {
      mockTrackingService.processWebhookEvent.mockRejectedValue(
        new Error('fail')
      );

      const event1 = { ...mockEvent, retry_count: 0 };
      const result1 = await handler.retryEvent(event1);

      const event2 = { ...mockEvent, retry_count: 1 };
      const result2 = await handler.retryEvent(event2);

      // Second retry should have longer delay
      expect(result2.nextRetryIn).toBeGreaterThan(result1.nextRetryIn);
    });

    it('parses string payload correctly', async () => {
      mockTrackingService.processWebhookEvent.mockResolvedValue({
        success: true,
      });

      const eventWithStringPayload = {
        ...mockEvent,
        payload: JSON.stringify({
          event_id: 'evt-456',
          shipment_id: 'ship-789',
          status: 'delivered',
        }),
      };

      const result = await handler.retryEvent(eventWithStringPayload);

      expect(result.succeeded).toBe(true);
      expect(mockTrackingService.processWebhookEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          externalEventId: 'evt-456',
          shipmentId: 'ship-789',
          status: 'delivered',
        })
      );
    });

    it('handles handler errors gracefully', async () => {
      mockTrackingService.processWebhookEvent.mockRejectedValue(
        new Error('service unavailable')
      );

      const result = await handler.retryEvent(mockEvent);

      expect(result.succeeded).toBe(false);
      expect(result.error).toBe('service unavailable');
    });
  });

  describe('Retry scheduling', () => {
    it('calculates correct delay for retry 1', async () => {
      mockTrackingService.processWebhookEvent.mockRejectedValue(
        new Error('fail')
      );

      const event = { ...mockEvent, retry_count: 0 };
      const result = await handler.retryEvent(event);

      // baseDelay * 2^(retryCount-1) = 5000 * 2^0 = 5000
      expect(result.nextRetryIn).toBe(5000);
    });

    it('calculates correct delay for retry 2', async () => {
      mockTrackingService.processWebhookEvent.mockRejectedValue(
        new Error('fail')
      );

      const event = { ...mockEvent, retry_count: 1 };
      const result = await handler.retryEvent(event);

      // baseDelay * 2^(retryCount-1) = 5000 * 2^1 = 10000
      expect(result.nextRetryIn).toBe(10000);
    });
  });

  describe('Failure statistics', () => {
    it('retrieves webhook stats', async () => {
      const stats = [
        { provider: 'easyship', status: 'processed', count: 100 },
        { provider: 'easyship', status: 'failed', count: 5 },
      ];

      mockRepository.getWebhookStats.mockResolvedValue(stats);

      const result = await handler.getFailureStats();

      expect(result.byProvider).toEqual(stats);
      expect(result.timestamp).toBeDefined();
    });

    it('returns empty on repository error', async () => {
      mockRepository.getWebhookStats.mockRejectedValue(
        new Error('DB error')
      );

      const result = await handler.getFailureStats();

      expect(result.error).toBeDefined();
      expect(result.byProvider).toEqual([]);
    });
  });

  describe('Integration scenarios', () => {
    it('processes batch of mixed success/failure events', async () => {
      const events = [
        { ...mockEvent, event_id: 'evt-1', retry_count: 0 },
        { ...mockEvent, event_id: 'evt-2', retry_count: 1 },
        { ...mockEvent, event_id: 'evt-3', retry_count: 2 },
      ];

      mockRepository.getPendingEvents.mockResolvedValue(events);

      mockTrackingService.processWebhookEvent
        .mockResolvedValueOnce({ success: true }) // evt-1 succeeds
        .mockRejectedValueOnce(new Error('retry')) // evt-2 fails, will retry
        .mockRejectedValueOnce(new Error('permanent')); // evt-3 permanent failure

      const result = await handler.processPendingEvents(10);

      expect(result.processed).toBe(3);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.permanent).toBe(1);
    });

  });
});
