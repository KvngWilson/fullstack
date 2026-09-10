/**
 * ShipmentTrackingService Unit Tests
 * 
 * Tests webhook event processing:
 * - Idempotency (no duplicate updates)
 * - Status mapping (external -> internal)
 * - Order and shipment validation
 * - Tenant isolation
 * - Event recording
 * - Error handling
 */

const domain = require('../../../domain');
const ShipmentTrackingService = domain.shipping.services.ShipmentTrackingService;
const { InvalidShippingRequest } = require('../../../shared/utils/errors');

describe('ShipmentTrackingService - Webhook Processing', () => {
  let service;
  let mockOrderRepo;
  let mockWebhookRepo;

  const mockOrder = {
    id: 1,
    tenant_id: 100, // vendor ID
    shipment_id: 'shipment-abc123',
    shipment_status: 'label_created',
    tracking_number: null,
    courier_name: null,
  };

  const mockEvent = {
    id: 1,
    event_id: 'evt-123',
    provider: 'easyship',
    event_type: 'shipment.in_transit',
    status: 'pending',
    shipment_id: 'shipment-abc123',
    payload: { shipment: { status: 'in_transit' } },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrderRepo = {
      getOrderByShipmentId: jest.fn().mockResolvedValue(mockOrder),
      getOrderById: jest.fn().mockResolvedValue(mockOrder),
      updateShipmentTracking: jest.fn().mockResolvedValue({
        ...mockOrder,
        shipment_status: 'in_transit',
      }),
    };

    mockWebhookRepo = {
      getEventById: jest.fn().mockResolvedValue(null),
      recordEvent: jest.fn().mockResolvedValue(mockEvent),
      incrementRetryCount: jest.fn().mockResolvedValue(),
      getEventsByOrderId: jest.fn().mockResolvedValue([]),
    };

    service = new ShipmentTrackingService(mockOrderRepo, mockWebhookRepo);
  });

  describe('processWebhookEvent', () => {
    it('successfully processes shipment status update', async () => {
      const result = await service.processWebhookEvent({
        externalEventId: 'evt-123',
        provider: 'easyship',
        eventType: 'shipment.in_transit',
        shipmentId: 'shipment-abc123',
        status: 'in_transit',
        trackingNumber: '1Z999AA10123456784',
        courierName: 'UPS',
        payload: { shipment: { status: 'in_transit' } },
      });

      expect(result.processed).toBe(true);
      expect(result.shipmentId).toBe('shipment-abc123');
      expect(result.status).toBe('in_transit');

      expect(mockOrderRepo.updateShipmentTracking).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          shipment_status: 'in_transit',
          tracking_number: '1Z999AA10123456784',
          courier_name: 'UPS',
        })
      );
    });

    it('prevents duplicate event processing (idempotency)', async () => {
      const processedEvent = {
        ...mockEvent,
        status: 'processed',
        processed_at: new Date(),
      };
      mockWebhookRepo.getEventById.mockResolvedValue(processedEvent);

      const result = await service.processWebhookEvent({
        externalEventId: 'evt-123',
        provider: 'easyship',
        eventType: 'shipment.in_transit',
        shipmentId: 'shipment-abc123',
        status: 'in_transit',
      });

      expect(result.processed).toBe(false);
      expect(result.reason).toBe('duplicate');

      // Should not update order
      expect(mockOrderRepo.updateShipmentTracking).not.toHaveBeenCalled();
    });

    it('records failed event if shipment not found', async () => {
      mockOrderRepo.getOrderByShipmentId.mockResolvedValue(null);

      await expect(
        service.processWebhookEvent({
          externalEventId: 'evt-456',
          provider: 'easyship',
          eventType: 'shipment.in_transit',
          shipmentId: 'shipment-unknown',
          status: 'in_transit',
          payload: {},
        })
      ).rejects.toThrow(InvalidShippingRequest);

      expect(mockWebhookRepo.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: 'Shipment shipment-unknown not found',
        })
      );
    });

    it('updates order with tracking number from webhook', async () => {
      await service.processWebhookEvent({
        externalEventId: 'evt-123',
        provider: 'easyship',
        eventType: 'shipment.delivered',
        shipmentId: 'shipment-abc123',
        status: 'delivered',
        trackingNumber: '1Z999AA10123456784',
        courierName: 'FedEx',
        payload: {},
      });

      expect(mockOrderRepo.updateShipmentTracking).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          tracking_number: '1Z999AA10123456784',
          courier_name: 'FedEx',
        })
      );
    });

    it('preserves existing tracking number if webhook missing it', async () => {
      const orderWithTracking = {
        ...mockOrder,
        tracking_number: '1Z999AA-EXISTING',
      };
      mockOrderRepo.getOrderByShipmentId.mockResolvedValue(orderWithTracking);

      await service.processWebhookEvent({
        externalEventId: 'evt-123',
        provider: 'easyship',
        eventType: 'shipment.in_transit',
        shipmentId: 'shipment-abc123',
        status: 'in_transit',
        trackingNumber: null, // Not provided
        payload: {},
      });

      expect(mockOrderRepo.updateShipmentTracking).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          tracking_number: '1Z999AA-EXISTING',
        })
      );
    });
  });

  describe('Status Mapping', () => {
    const testCases = [
      { external: 'created', expected: 'label_created' },
      { external: 'label_created', expected: 'label_created' },
      { external: 'shipped', expected: 'in_transit' },
      { external: 'in_transit', expected: 'in_transit' },
      { external: 'out_for_delivery', expected: 'in_transit' },
      { external: 'delivered', expected: 'delivered' },
      { external: 'failed', expected: 'failed' },
      { external: 'exception', expected: 'failed' },
      { external: 'cancelled', expected: 'cancelled' },
      { external: 'lost', expected: 'failed' },
      { external: 'damaged', expected: 'failed' },
    ];

    testCases.forEach(({ external, expected }) => {
      it(`maps '${external}' to '${expected}'`, async () => {
        await service.processWebhookEvent({
          externalEventId: `evt-${external}`,
          provider: 'easyship',
          eventType: 'shipment.updated',
          shipmentId: 'shipment-abc123',
          status: external,
          payload: {},
        });

        expect(mockOrderRepo.updateShipmentTracking).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            shipment_status: expected,
          })
        );
      });
    });

    it('defaults to in_transit for unknown status', async () => {
      await service.processWebhookEvent({
        externalEventId: 'evt-unknown',
        provider: 'easyship',
        eventType: 'shipment.updated',
        shipmentId: 'shipment-abc123',
        status: 'unknown_future_status',
        payload: {},
      });

      expect(mockOrderRepo.updateShipmentTracking).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          shipment_status: 'in_transit',
        })
      );
    });
  });

  describe('Event Recording', () => {
    it('records successful event processing', async () => {
      await service.processWebhookEvent({
        externalEventId: 'evt-123',
        provider: 'easyship',
        eventType: 'shipment.in_transit',
        shipmentId: 'shipment-abc123',
        status: 'in_transit',
        payload: { test: 'data' },
      });

      expect(mockWebhookRepo.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event_id: 'evt-123',
          provider: 'easyship',
          event_type: 'shipment.in_transit',
          status: 'processed',
          order_id: 1,
        })
      );
    });

    it('records failed event with error message', async () => {
      mockOrderRepo.getOrderByShipmentId.mockResolvedValue(null);

      try {
        await service.processWebhookEvent({
          externalEventId: 'evt-456',
          provider: 'easyship',
          eventType: 'shipment.in_transit',
          shipmentId: 'shipment-unknown',
          status: 'in_transit',
          payload: {},
        });
      } catch (error) {
        // Expected
      }

      expect(mockWebhookRepo.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failed',
          error_message: expect.any(String),
        })
      );
    });
  });

  describe('getEventHistoryForOrder', () => {
    it('retrieves event history for authorized vendor', async () => {
      mockOrderRepo.getOrderById.mockResolvedValue(mockOrder);
      mockWebhookRepo.getEventsByOrderId.mockResolvedValue([
        {
          event_id: 'evt-1',
          event_type: 'shipment.in_transit',
          status: 'processed',
          created_at: '2026-03-01T10:00:00Z',
        },
      ]);

      const result = await service.getEventHistoryForOrder(1, 100);

      expect(result).toHaveLength(1);
      expect(result[0].event_id).toBe('evt-1');
    });

    it('throws error if vendor unauthorized', async () => {
      mockOrderRepo.getOrderById.mockResolvedValue(mockOrder);

      await expect(
        service.getEventHistoryForOrder(1, 999) // Different vendor
      ).rejects.toThrow(InvalidShippingRequest);
    });

    it('throws error if no vendor context', async () => {
      await expect(
        service.getEventHistoryForOrder(1, null)
      ).rejects.toThrow(InvalidShippingRequest);
    });
  });

  describe('retryFailedEvent', () => {
    it('retries failed event', async () => {
      const failedEvent = {
        ...mockEvent,
        status: 'failed',
        retry_count: 0,
        payload: {
          shipment: {
            status: 'in_transit',
            tracking_number: '1Z999AA10123456784',
          },
        },
      };
      mockWebhookRepo.getEventById.mockResolvedValue(failedEvent);

      const result = await service.retryFailedEvent('evt-123');

      expect(result.processed).toBe(true);
      expect(mockWebhookRepo.incrementRetryCount).toHaveBeenCalledWith('evt-123');
    });

    it('throws error if event not found', async () => {
      mockWebhookRepo.getEventById.mockResolvedValue(null);

      await expect(
        service.retryFailedEvent('evt-unknown')
      ).rejects.toThrow(InvalidShippingRequest);
    });

    it('throws error if retry limit exceeded', async () => {
      const limitedEvent = {
        ...mockEvent,
        retry_count: 3,
      };
      mockWebhookRepo.getEventById.mockResolvedValue(limitedEvent);

      await expect(
        service.retryFailedEvent('evt-123')
      ).rejects.toThrow('exceeded retry limit');
    });

    it('increments retry count on failure', async () => {
      const failedEvent = {
        ...mockEvent,
        retry_count: 1,
        payload: { shipment: { status: 'in_transit' } },
      };
      mockWebhookRepo.getEventById.mockResolvedValue(failedEvent);
      mockOrderRepo.getOrderByShipmentId.mockResolvedValue(null); // Force failure

      try {
        await service.retryFailedEvent('evt-123');
      } catch (error) {
        // Expected
      }

      expect(mockWebhookRepo.incrementRetryCount).toHaveBeenCalledWith('evt-123');
    });
  });

  describe('Error Handling', () => {
    it('records errors with detailed context', async () => {
      mockOrderRepo.getOrderByShipmentId.mockResolvedValue(null);

      await expect(
        service.processWebhookEvent({
          externalEventId: 'evt-error',
          provider: 'easyship',
          eventType: 'shipment.in_transit',
          shipmentId: 'shipment-missing',
          status: 'in_transit',
          payload: {},
        })
      ).rejects.toThrow();

      expect(mockWebhookRepo.recordEvent).toHaveBeenCalled();
    });
  });
});
