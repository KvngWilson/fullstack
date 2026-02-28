const {
  calculateShippingRates,
  getDeliveryEstimates,
  validateAddress,
} = require('../../services/shipping');

// Mock the Easyship API
jest.mock('@api/easyship', () => ({
  auth: jest.fn(),
  rates_request: jest.fn(),
}));

const easyship = require('@api/easyship');

describe('Shipping Service - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateShippingRates', () => {
    const validParams = {
      destination: {
        country_code: 'US',
        city: 'New York',
        postal_code: '10001',
        state: 'NY',
      },
      origin: {
        country_code: 'US',
        city: 'San Francisco',
        postal_code: '94102',
        state: 'CA',
      },
      items: [
        {
          description: 'Test Product',
          quantity: 1,
          value: 100,
          weight: 0.5,
          height: 10,
          width: 10,
          length: 10,
          currency: 'USD',
          category: 'general',
        },
      ],
    };

    it('should successfully calculate shipping rates', async () => {
      const mockRates = [
        {
          courier_id: 'ups-ground',
          courier_name: 'UPS',
          service_name: 'Ground',
          total_charge: '15.99',
          currency: 'USD',
          min_delivery_time: 3,
          max_delivery_time: 5,
        },
      ];

      easyship.rates_request.mockResolvedValue({
        data: { rates: mockRates },
      });

      const result = await calculateShippingRates(validParams);

      expect(result.success).toBe(true);
      expect(result.rates).toHaveLength(1);
      expect(result.rates[0].courier_name).toBe('UPS');
      expect(easyship.rates_request).toHaveBeenCalledTimes(1);
    });

    it('should handle API errors gracefully', async () => {
      easyship.rates_request.mockRejectedValue(
        new Error('API Error')
      );

      const result = await calculateShippingRates(validParams);

      expect(result.success).toBe(false);
      expect(result.rates).toEqual([]);
      expect(result.message).toContain('API Error');
    });

    it('should use default origin if not provided', async () => {
      const paramsWithoutOrigin = {
        destination: validParams.destination,
        items: validParams.items,
      };

      easyship.rates_request.mockResolvedValue({
        data: { rates: [] },
      });

      await calculateShippingRates(paramsWithoutOrigin);

      const callArgs = easyship.rates_request.mock.calls[0][0];
      expect(callArgs.origin_address.country_alpha2).toBe('US');
    });

    it('should format request payload correctly', async () => {
      easyship.rates_request.mockResolvedValue({
        data: { rates: [] },
      });

      await calculateShippingRates(validParams);

      const payload = easyship.rates_request.mock.calls[0][0];
      expect(payload).toHaveProperty('destination_address');
      expect(payload).toHaveProperty('origin_address');
      expect(payload).toHaveProperty('parcels');
      expect(payload.incoterms).toBe('DDU');
    });

    it('should map item properties correctly', async () => {
      easyship.rates_request.mockResolvedValue({
        data: { rates: [] },
      });

      await calculateShippingRates(validParams);

      const payload = easyship.rates_request.mock.calls[0][0];
      const item = payload.parcels[0].items[0];
      
      expect(item.actual_weight).toBe(0.5);
      expect(item.description).toBe('Test Product');
      expect(item.declared_customs_value).toBe(100);
    });

    it('should handle empty rates response', async () => {
      easyship.rates_request.mockResolvedValue({
        data: { rates: [] },
      });

      const result = await calculateShippingRates(validParams);

      expect(result.success).toBe(true);
      expect(result.rates).toEqual([]);
    });

    it('should apply default values for missing item properties', async () => {
      const minimalParams = {
        destination: validParams.destination,
        items: [
          {
            quantity: 1,
            value: 50,
          },
        ],
      };

      easyship.rates_request.mockResolvedValue({
        data: { rates: [] },
      });

      await calculateShippingRates(minimalParams);

      const payload = easyship.rates_request.mock.calls[0][0];
      const item = payload.parcels[0].items[0];
      
      expect(item.actual_weight).toBe(0.5); // default
      expect(item.height).toBe(10); // default
      expect(item.width).toBe(10); // default
      expect(item.length).toBe(10); // default
    });
  });

  describe('getDeliveryEstimates', () => {
    it('should return delivery estimates', async () => {
      const result = await getDeliveryEstimates('US');

      expect(result.success).toBe(true);
      expect(result.estimates).toBeInstanceOf(Array);
      expect(result.estimates.length).toBeGreaterThan(0);
    });

    it('should include standard shipping methods', async () => {
      const result = await getDeliveryEstimates('US');

      const methods = result.estimates.map(e => e.method);
      expect(methods).toContain('standard');
      expect(methods).toContain('express');
      expect(methods).toContain('overnight');
    });

    it('should handle errors gracefully', async () => {
      // Force an error by passing invalid input
      const result = await getDeliveryEstimates(null);

      expect(result.success).toBeDefined();
    });
  });

  describe('validateAddress', () => {
    const validAddress = {
      street: '123 Main St',
      city: 'New York',
      postal_code: '10001',
      country: 'US',
    };

    it('should validate complete address', async () => {
      const result = await validateAddress(validAddress);

      expect(result.valid).toBe(true);
      expect(result.message).toBe('Address is valid');
    });

    it('should reject address missing street', async () => {
      const { street, ...incomplete } = validAddress;
      const result = await validateAddress(incomplete);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('street');
    });

    it('should reject address missing city', async () => {
      const { city, ...incomplete } = validAddress;
      const result = await validateAddress(incomplete);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('city');
    });

    it('should reject address missing postal code', async () => {
      const { postal_code, ...incomplete } = validAddress;
      const result = await validateAddress(incomplete);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('postal_code');
    });

    it('should reject address missing country', async () => {
      const { country, ...incomplete } = validAddress;
      const result = await validateAddress(incomplete);

      expect(result.valid).toBe(false);
      expect(result.message).toContain('country');
    });

    it('should identify all missing fields', async () => {
      const result = await validateAddress({ street: '123 Main' });

      expect(result.valid).toBe(false);
      expect(result.message).toContain('city');
      expect(result.message).toContain('postal_code');
      expect(result.message).toContain('country');
    });

    it('should handle null address', async () => {
      const result = await validateAddress(null);

      expect(result.valid).toBe(false);
    });

    it('should handle empty address object', async () => {
      const result = await validateAddress({});

      expect(result.valid).toBe(false);
    });
  });
});
