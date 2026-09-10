/**
 * EasyshipGateway Unit Tests
 * 
 * Tests API wrapper functionality:
 * - Rate request building
 * - Response normalization
 * - Error mapping
 * - Vendor-specific API keys
 */

jest.mock('@api/easyship', () => ({
  auth: jest.fn(),
  rates_request: jest.fn(),
}));

const EasyshipGateway = require('../../../infrastructure/shipping/EasyshipGateway');
const easyship = require('@api/easyship');

describe('EasyshipGateway - API Wrapper', () => {
  let gateway;

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new EasyshipGateway('default-api-key');
  });

  const mockDestination = {
    country_code: 'US',
    city: 'New York',
    postal_code: '10001',
    state: 'NY',
  };

  const mockItems = [
    {
      weight: 0.5,
      height: 10,
      width: 10,
      length: 10,
      description: 'Product A',
      quantity: 1,
      value: 100,
      currency: 'USD',
    },
  ];

  const mockEasyshipRates = [
    {
      rate_id: 'rate-123',
      courier_id: 'ups-ground',
      courier_name: 'UPS',
      service_name: 'Ground',
      total_charge: '15.99',
      currency: 'USD',
      min_delivery_time: 3,
      max_delivery_time: 5,
    },
  ];

  describe('getRates', () => {
    it('successfully fetches and normalizes rates', async () => {
      easyship.rates_request.mockResolvedValue({ data: { rates: mockEasyshipRates } });

      const result = await gateway.getRates({
        destination: mockDestination,
        items: mockItems,
        vendorId: 123,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(
        expect.objectContaining({
          easyshipRateId: 'rate-123',
          courierId: 'ups-ground',
          courierName: 'UPS',
          totalChargeMinor: 1599, // $15.99 in cents
          currency: 'USD',
          minDeliveryDays: 3,
          maxDeliveryDays: 5,
        })
      );
    });

    it('handles empty rates response', async () => {
      easyship.rates_request.mockResolvedValue({ data: { rates: [] } });

      const result = await gateway.getRates({
        destination: mockDestination,
        items: mockItems,
        vendorId: 123,
      });

      expect(result).toEqual([]);
    });

    it('supports vendor-specific API keys', async () => {
      const vendorApiKey = 'vendor-secret-key';
      easyship.rates_request.mockResolvedValue({ data: { rates: [] } });

      await gateway.getRates({
        destination: mockDestination,
        items: mockItems,
        vendorId: 123,
        apiKey: vendorApiKey,
      });

      // First call: auth with vendor key
      expect(easyship.auth).toHaveBeenCalledWith(vendorApiKey);
      // Last call: reset to default
      expect(easyship.auth).toHaveBeenLastCalledWith('default-api-key');
    });

    it('builds request with all destination fields', async () => {
      easyship.rates_request.mockResolvedValue({ data: { rates: [] } });

      await gateway.getRates({
        destination: mockDestination,
        items: mockItems,
        vendorId: 123,
      });

      const callArg = easyship.rates_request.mock.calls[0][0];
      expect(callArg.destination_address).toEqual({
        country_alpha2: 'US',
        city: 'New York',
        postal_code: '10001',
        state: 'NY',
      });
    });

    it('uses default origin if not provided', async () => {
      easyship.rates_request.mockResolvedValue({ data: { rates: [] } });

      await gateway.getRates({
        destination: mockDestination,
        items: mockItems,
        vendorId: 123,
      });

      const callArg = easyship.rates_request.mock.calls[0][0];
      expect(callArg.origin_address).toEqual({
        country_alpha2: 'US',
        city: 'San Francisco',
        postal_code: '94102',
        state: 'CA',
      });
    });

    it('uses custom origin if provided', async () => {
      const customOrigin = {
        country_code: 'CA',
        city: 'Toronto',
        postal_code: 'M5V 3A8',
        state: 'ON',
      };

      easyship.rates_request.mockResolvedValue({ data: { rates: [] } });

      await gateway.getRates({
        destination: mockDestination,
        items: mockItems,
        origin: customOrigin,
        vendorId: 123,
      });

      const callArg = easyship.rates_request.mock.calls[0][0];
      expect(callArg.origin_address).toEqual({
        country_alpha2: 'CA',
        city: 'Toronto',
        postal_code: 'M5V 3A8',
        state: 'ON',
      });
    });

    it('normalizes monetary values to minor units', async () => {
      const rates = [
        { ...mockEasyshipRates[0], total_charge: '99.99' },
        { ...mockEasyshipRates[0], total_charge: '0.50' },
        { ...mockEasyshipRates[0], total_charge: '1000.00' },
      ];

      easyship.rates_request.mockResolvedValue({ data: { rates } });

      const result = await gateway.getRates({
        destination: mockDestination,
        items: mockItems,
        vendorId: 123,
      });

      expect(result[0].totalChargeMinor).toBe(9999); // $99.99
      expect(result[1].totalChargeMinor).toBe(50); // $0.50
      expect(result[2].totalChargeMinor).toBe(100000); // $1000.00
    });

    it('logs API errors and maps to domain exceptions', async () => {
      const apiError = new Error('Rate request failed');
      apiError.statusCode = 400;

      easyship.rates_request.mockRejectedValue(apiError);

      await expect(
        gateway.getRates({
          destination: mockDestination,
          items: mockItems,
          vendorId: 123,
        })
      ).rejects.toThrow();
    });

    it('includes destination country in normalized rate', async () => {
      easyship.rates_request.mockResolvedValue({ data: { rates: mockEasyshipRates } });

      const result = await gateway.getRates({
        destination: mockDestination,
        items: mockItems,
        vendorId: 123,
      });

      expect(result[0].destinationCountry).toBe('US');
    });
  });

  describe('Request Payload Building', () => {
    it('builds minimal valid request', async () => {
      easyship.rates_request.mockResolvedValue({ data: { rates: [] } });

      const minimalItems = [
        {
          description: 'Item',
          quantity: 1,
        },
      ];

      await gateway.getRates({
        destination: mockDestination,
        items: minimalItems,
        vendorId: 123,
      });

      const callArg = easyship.rates_request.mock.calls[0][0];
      expect(callArg).toHaveProperty('destination_address');
      expect(callArg).toHaveProperty('origin_address');
      expect(callArg).toHaveProperty('parcels');
      expect(callArg.parcels[0].items).toHaveLength(1);
    });

    it('includes all item properties in request', async () => {
      easyship.rates_request.mockResolvedValue({ data: { rates: [] } });

      await gateway.getRates({
        destination: mockDestination,
        items: mockItems,
        vendorId: 123,
      });

      const callArg = easyship.rates_request.mock.calls[0][0];
      const item = callArg.parcels[0].items[0];

      expect(item).toEqual(
        expect.objectContaining({
          actual_weight: 0.5,
          height: 10,
          width: 10,
          length: 10,
          description: 'Product A',
          quantity: 1,
          declared_customs_value: 100,
        })
      );
    });
  });

  describe('Response Normalization', () => {
    it('estimates delivery date from min delivery days', async () => {
      const rates = [
        { ...mockEasyshipRates[0], min_delivery_time: 5 },
      ];

      easyship.rates_request.mockResolvedValue({ data: { rates } });

      const result = await gateway.getRates({
        destination: mockDestination,
        items: mockItems,
        vendorId: 123,
      });

      // Should be approximately 5 days from now
      const estimatedDate = new Date(result[0].estimatedDeliveryDate);
      const today = new Date();
      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() + 4); // Allow 1 day variance
      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 6);

      expect(estimatedDate.getTime()).toBeGreaterThanOrEqual(minDate.getTime());
      expect(estimatedDate.getTime()).toBeLessThanOrEqual(maxDate.getTime());
    });
  });

  describe('Error Mapping', () => {
    it('maps 400 errors to InvalidShippingRequest', async () => {
      const error = new Error('Bad Request');
      error.statusCode = 400;
      easyship.rates_request.mockRejectedValue(error);

      await expect(
        gateway.getRates({
          destination: mockDestination,
          items: mockItems,
          vendorId: 123,
        })
      ).rejects.toThrow();
    });

    it('includes original error in mapped exception', async () => {
      const originalError = new Error('API Error');
      originalError.statusCode = 500;
      easyship.rates_request.mockRejectedValue(originalError);

      try {
        await gateway.getRates({
          destination: mockDestination,
          items: mockItems,
          vendorId: 123,
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error.original).toBe(originalError);
      }
    });
  });

  describe('Health Check', () => {
    it('returns healthy status on successful request', async () => {
      easyship.rates_request.mockResolvedValue({ data: {} });

      const result = await gateway.healthCheck();

      expect(result).toEqual({
        healthy: true,
        gateway: 'easyship',
      });
    });

    it('returns unhealthy status on failure', async () => {
      easyship.rates_request.mockRejectedValue(new Error('Connection failed'));

      const result = await gateway.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.gateway).toBe('easyship');
      expect(result.error).toContain('Connection failed');
    });
  });
});
