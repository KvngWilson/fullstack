/**
 * EasyshipShipmentGateway Unit Tests
 * 
 * Tests shipment label creation API wrapper:
 * - Shipment payload building
 * - API response normalization
 * - Vendor-specific API keys
 * - Error mapping
 */

jest.mock('@api/easyship', () => ({
  auth: jest.fn(),
  shipments: jest.fn(),
  shipment_id: jest.fn(),
  rates_request: jest.fn(),
}));

const EasyshipShipmentGateway = require('../../infrastructure/shipping/EasyshipShipmentGateway');
const easyship = require('@api/easyship');

describe('EasyshipShipmentGateway - Shipment API Wrapper', () => {
  let gateway;

  const mockOrder = {
    id: 1,
    currency: 'USD',
    shipping_email: 'customer@example.com',
    shipping_phone: '555-0123',
    shipping_street_address: '123 Main St',
    shipping_city: 'New York',
    shipping_state: 'NY',
    shipping_postal_code: '10001',
    shipping_country: 'US',
  };

  const mockShippingAddress = {
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@example.com',
    phone: '555-0123',
    street_address: '123 Main St',
    city: 'New York',
    state: 'NY',
    postal_code: '10001',
    country_code: 'US',
  };

  const mockOriginAddress = {
    business_name: 'Vendor Inc',
    address_line1: '456 Warehouse Ave',
    city: 'San Francisco',
    state: 'CA',
    postal_code: '94102',
    country_code: 'US',
  };

  const mockItems = [
    {
      product_name: 'Widget A',
      sku: 'WIDGET-A-001',
      quantity: 2,
      weight: 0.5,
      height: 10,
      width: 10,
      length: 10,
      value_per_unit: 50,
    },
  ];

  const mockRate = {
    easyshipRateId: 'rate-123',
    courierId: 'ups-ground',
    courierName: 'UPS',
  };

  const mockEasyshipResponse = {
    data: {
      id: 'shipment-abc123',
      reference_id: 'ORDER-1',
      label_download: { href: 'https://cdn.easyship.com/label-abc123.pdf' },
      label_format: 'pdf',
      tracking_number: '1Z999AA10123456784',
      courier: { id: 'ups-ground', name: 'UPS' },
      shipping_method: { id: 'rate-123', name: 'UPS Ground' },
      status: 'created',
      estimated_delivery_date: '2026-03-10',
      created_at: '2026-03-01T12:00:00Z',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    gateway = new EasyshipShipmentGateway('default-api-key');
  });

  describe('buildShipmentPayload', () => {
    it('builds complete shipment payload', () => {
      const payload = gateway.buildShipmentPayload({
        order: mockOrder,
        shippingAddress: mockShippingAddress,
        originAddress: mockOriginAddress,
        items: mockItems,
        selectedRate: mockRate,
      });

      expect(payload).toHaveProperty('reference_id', 'ORDER-1');
      expect(payload).toHaveProperty('to_address');
      expect(payload).toHaveProperty('from_address');
      expect(payload).toHaveProperty('parcels');
    });

    it('maps recipient address correctly', () => {
      const payload = gateway.buildShipmentPayload({
        order: mockOrder,
        shippingAddress: mockShippingAddress,
        originAddress: mockOriginAddress,
        items: mockItems,
        selectedRate: mockRate,
      });

      expect(payload.to_address).toEqual(
        expect.objectContaining({
          name: 'John Doe',
          email: 'john@example.com',
          phone_number: '555-0123',
          line_1: '123 Main St',
          city: 'New York',
          state: 'NY',
          postal_code: '10001',
          country_alpha2: 'US',
        })
      );
    });

    it('maps origin address correctly', () => {
      const payload = gateway.buildShipmentPayload({
        order: mockOrder,
        shippingAddress: mockShippingAddress,
        originAddress: mockOriginAddress,
        items: mockItems,
        selectedRate: mockRate,
      });

      expect(payload.from_address).toEqual(
        expect.objectContaining({
          name: 'Vendor Inc',
          line_1: '456 Warehouse Ave',
          city: 'San Francisco',
          state: 'CA',
          postal_code: '94102',
          country_alpha2: 'US',
        })
      );
    });

    it('maps order items to parcels', () => {
      const payload = gateway.buildShipmentPayload({
        order: mockOrder,
        shippingAddress: mockShippingAddress,
        originAddress: mockOriginAddress,
        items: mockItems,
        selectedRate: mockRate,
      });

      expect(payload.parcels[0].items).toHaveLength(1);
      expect(payload.parcels[0].items[0]).toEqual(
        expect.objectContaining({
          description: 'Widget A',
          quantity: 2,
          actual_weight: 0.5,
          declared_customs_value: 100, // 50 * 2
        })
      );
    });

    it('uses fallback values when optional address fields missing', () => {
      const minimalAddress = { country_code: 'US' };

      const payload = gateway.buildShipmentPayload({
        order: mockOrder,
        shippingAddress: minimalAddress,
        originAddress: mockOriginAddress,
        items: mockItems,
        selectedRate: mockRate,
      });

      expect(payload.to_address.country_alpha2).toBe('US');
    });

    it('includes selected rate ID in payload', () => {
      const payload = gateway.buildShipmentPayload({
        order: mockOrder,
        shippingAddress: mockShippingAddress,
        originAddress: mockOriginAddress,
        items: mockItems,
        selectedRate: mockRate,
      });

      expect(payload.shipping_method.id).toBe('rate-123');
    });
  });

  describe('createShipment', () => {
    it('successfully creates shipment', async () => {
      easyship.shipments.mockResolvedValue(mockEasyshipResponse);

      const result = await gateway.createShipment({
        orderId: 1,
        vendorId: 123,
        shipmentData: {},
      });

      expect(result).toEqual(
        expect.objectContaining({
          shipmentId: 'shipment-abc123',
          labelUrl: 'https://cdn.easyship.com/label-abc123.pdf',
          trackingNumber: '1Z999AA10123456784',
          courierName: 'UPS',
          status: 'created',
        })
      );
    });

    it('handles vendor-specific API keys', async () => {
      const vendorApiKey = 'vendor-secret-key';
      easyship.shipments.mockResolvedValue(mockEasyshipResponse);

      await gateway.createShipment({
        orderId: 1,
        vendorId: 123,
        shipmentData: {},
        apiKey: vendorApiKey,
      });

      // First call: auth with vendor key
      expect(easyship.auth).toHaveBeenCalledWith(vendorApiKey);
      // Last call: reset to default
      expect(easyship.auth).toHaveBeenLastCalledWith('default-api-key');
    });

    it('normalizes shipment response correctly', async () => {
      easyship.shipments.mockResolvedValue(mockEasyshipResponse);

      const result = await gateway.createShipment({
        orderId: 1,
        vendorId: 123,
        shipmentData: {},
      });

      expect(result.easyshipShipmentId).toBe('shipment-abc123');
      expect(result.referenceId).toBe('ORDER-1');
      expect(result.labelFormat).toBe('pdf');
    });

    it('handles missing label URL', async () => {
      const responseWithoutLabel = {
        data: { ...mockEasyshipResponse.data, label_download: null },
      };
      easyship.shipments.mockResolvedValue(responseWithoutLabel);

      const result = await gateway.createShipment({
        orderId: 1,
        vendorId: 123,
        shipmentData: {},
      });

      expect(result.labelUrl).toBeNull();
    });

    it('logs API errors', async () => {
      const apiError = new Error('API failure');
      apiError.statusCode = 500;
      easyship.shipments.mockRejectedValue(apiError);

      await expect(
        gateway.createShipment({
          orderId: 1,
          vendorId: 123,
          shipmentData: {},
        })
      ).rejects.toThrow();
    });

    it('maps Easyship errors to ExternalServiceError', async () => {
      const apiError = new Error('Shipment creation failed');
      apiError.statusCode = 400;
      easyship.shipments.mockRejectedValue(apiError);

      try {
        await gateway.createShipment({
          orderId: 1,
          vendorId: 123,
          shipmentData: {},
        });
        fail('Should have thrown');
      } catch (error) {
        expect(error.statusCode).toBe(400);
      }
    });
  });

  describe('getShipment', () => {
    it('fetches shipment by ID', async () => {
      easyship.shipment_id.mockResolvedValue(mockEasyshipResponse);

      const result = await gateway.getShipment('shipment-abc123');

      expect(result.shipmentId).toBe('shipment-abc123');
      expect(easyship.shipment_id).toHaveBeenCalledWith('shipment-abc123');
    });

    it('supports vendor-specific API keys', async () => {
      const vendorApiKey = 'vendor-secret-key';
      easyship.shipment_id.mockResolvedValue(mockEasyshipResponse);

      await gateway.getShipment('shipment-abc123', vendorApiKey);

      expect(easyship.auth).toHaveBeenCalledWith(vendorApiKey);
    });
  });

  describe('Health Check', () => {
    it('returns healthy status on success', async () => {
      easyship.rates_request.mockResolvedValue({ data: {} });

      const result = await gateway.healthCheck();

      expect(result.healthy).toBe(true);
      expect(result.gateway).toBe('easyship-shipment');
    });

    it('returns unhealthy status on failure', async () => {
      easyship.rates_request.mockRejectedValue(
        new Error('Connection failed')
      );

      const result = await gateway.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Connection failed');
    });
  });
});
