/**
 * Failed Webhook Handler Test Suite
 * Tests webhook failure handling, monitoring integration, and ops alerts
 */

const FailedWebhookHandler = require('../../../domain/shipping/services/FailedWebhookHandler');

// Mock dependencies
jest.mock('../../../shared/utils/logger');
jest.mock("../../../infrastructure/observability/metrics/MetricsRegistry");
jest.mock('../../../infrastructure/logging/StructuredLogger');
jest.mock('../../../infrastructure/notifications/alerts');

const logger = require('../../../shared/utils/logger');
const MetricsRegistry = require("../../../infrastructure/observability/metrics/MetricsRegistry");
const StructuredLogger = require('../../../infrastructure/logging/StructuredLogger');
const { sendOpsAlert } = require('../../../infrastructure/notifications/alerts');

describe('FailedWebhookHandler - Unit Tests', () => {
  let handler;
  let mockWebhookEventRepository;
  let mockTrackingService;
  let mockMetricsRegistry;
  let mockStructuredLogger;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mocks
    mockWebhookEventRepository = {
      save: jest.fn().mockResolvedValue({}),
      findById: jest.fn(),
      getWebhookStats: jest.fn(),
    };

    mockTrackingService = {
      updateTracking: jest.fn(),
    };

    mockMetricsRegistry = {
      registerCounter: jest.fn(),
      incrementCounter: jest.fn(),
    };

    mockStructuredLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };

    MetricsRegistry.mockImplementation(() => mockMetricsRegistry);
    StructuredLogger.mockImplementation(() => mockStructuredLogger);
    sendOpsAlert.mockResolvedValue({ success: true });

    handler = new FailedWebhookHandler(mockWebhookEventRepository, mockTrackingService);
  });

  describe('alertPermanentFailure', () => {
    it('logs alert with full context', async () => {
      const testEvent = {
        provider: 'easyship',
        event_id: 'evt_12345',
        shipment_id: 'ship_67890',
        order_id: 'ord_abcde',
      };
      const testError = new Error('Max retries exceeded');

      await handler.alertPermanentFailure(testEvent, testError);

      expect(mockStructuredLogger.error).toHaveBeenCalledWith(
        'ALERT: Webhook permanently failed',
        expect.objectContaining({
          provider: 'easyship',
          eventId: 'evt_12345',
          shipmentId: 'ship_67890',
          orderId: 'ord_abcde',
          error: 'Max retries exceeded',
          action: 'MANUAL_INSPECTION_REQUIRED',
        }),
        testError
      );
    });

    it('increments webhook failure metrics', async () => {
      const testEvent = {
        provider: 'easyship',
        event_id: 'evt_12345',
        shipment_id: 'ship_67890',
        order_id: 'ord_abcde',
      };
      const testError = new Error('Webhook failed');

      await handler.alertPermanentFailure(testEvent, testError);

      // Should increment global failure counter
      expect(mockMetricsRegistry.incrementCounter).toHaveBeenCalledWith(
        'webhook_permanent_failure',
        1
      );

      // Should increment provider-specific counter
      expect(mockMetricsRegistry.incrementCounter).toHaveBeenCalledWith(
        'webhook_failure_by_provider_total',
        1,
        { provider: 'easyship' }
      );
    });

    it('sends critical alert to ops team', async () => {
      const testEvent = {
        provider: 'easyship',
        event_id: 'evt_12345',
        shipment_id: 'ship_67890',
        order_id: 'ord_abcde',
      };
      const testError = new Error('Webhook timeout');

      await handler.alertPermanentFailure(testEvent, testError);

      expect(sendOpsAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'critical',
          title: 'Webhook Permanently Failed: easyship',
          description: expect.stringMatching(/max retries/i),
          service: 'shipping-webhooks',
          actionRequired: true,
        })
      );
    });

    it('handles alert delivery failure gracefully', async () => {
      sendOpsAlert.mockRejectedValueOnce(new Error('Alert service down'));

      const testEvent = {
        provider: 'paystack',
        event_id: 'evt_xyz',
        shipment_id: 'ship_xyz',
        order_id: 'ord_xyz',
      };
      const testError = new Error('Service unavailable');

      // Should not throw
      await expect(
        handler.alertPermanentFailure(testEvent, testError)
      ).resolves.toBeUndefined();

      // Should log failure
      expect(mockStructuredLogger.error).toHaveBeenCalledWith(
        'Failed to send ops alert',
        expect.objectContaining({
          originalError: 'Service unavailable',
          alertError: 'Alert service down',
        })
      );
    });

    it('tracks different provider types in metrics', async () => {
      const providers = ['easyship', 'paystack', 'custom-gateway'];

      for (const provider of providers) {
        mockMetricsRegistry.incrementCounter.mockClear();

        const event = {
          provider,
          event_id: `evt_${provider}`,
          shipment_id: 'ship_123',
          order_id: 'ord_123',
        };

        await handler.alertPermanentFailure(event, new Error('Test'));

        expect(mockMetricsRegistry.incrementCounter).toHaveBeenCalledWith(
          'webhook_failure_by_provider_total',
          1,
          { provider }
        );
      }
    });

    it('includes timestamp in alert context', async () => {
      const beforeTime = new Date();

      const event = {
        provider: 'easyship',
        event_id: 'evt_123',
        shipment_id: 'ship_123',
        order_id: 'ord_123',
      };

      await handler.alertPermanentFailure(event, new Error('Test'));

      const alertCall = mockStructuredLogger.error.mock.calls[0];
      const context = alertCall[1];
      const alertTime = new Date(context.timestamp);

      expect(alertTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(alertTime.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });
  });

  describe('getFailureStats', () => {
    it('returns webhook stats from repository', async () => {
      const mockStats = {
        easyship: 5,
        paystack: 2,
        custom: 1,
      };

      mockWebhookEventRepository.getWebhookStats.mockResolvedValueOnce(mockStats);

      const result = await handler.getFailureStats();

      expect(result.byProvider).toEqual(mockStats);
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp)).toBeInstanceOf(Date);
    });

    it('handles repository errors gracefully', async () => {
      mockWebhookEventRepository.getWebhookStats.mockRejectedValueOnce(
        new Error('Database connection failed')
      );

      const result = await handler.getFailureStats();

      expect(result.byProvider).toEqual([]);
      expect(result.error).toEqual('Database connection failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
