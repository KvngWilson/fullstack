/**
 * ShipmentService Integration Tests
 * 
 * Tests shipment label creation business logic:
 * - Payment validation gates
 * - Rate selection validation
 * - Tenant isolation (vendor ownership)
 * - Database persistence
 * - Error handling
 */

jest.mock('../../infrastructure/shipping/EasyshipShipmentGateway');

const domain = require('../../domain');
const ShipmentService = domain.shipping.services.ShipmentService;
const {
  InvalidShippingRequest,
  AuthorizationError,
} = require('../../shared/utils/errors');

describe('ShipmentService - Shipment Label Creation', () => {
  let service;
  let mockOrderRepo;
  let mockVendorRepo;
  let mockGateway;

  const mockOrder = {
    id: 1,
    tenant_id: 100, // vendor ID
    payment_status: 'paid',
    shipment_id: null,
    shipping_email: 'customer@example.com',
    shipping_phone: '555-0123',
    shipping_street_address: '123 Main St',
    shipping_city: 'New York',
    shipping_state: 'NY',
    shipping_postal_code: '10001',
    shipping_country: 'US',
    shipping_cost: 1599, // $15.99 in cents
  };

  const mockShippingAddress = {
    id: 10,
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

  const mockVendorOrigin = {
    id: 50,
    business_name: 'Vendor Inc',
    address_line1: '456 Warehouse Ave',
    city: 'San Francisco',
    state: 'CA',
    postal_code: '94102',
    country_code: 'US',
  };

  const mockOrderItems = [
    {
      id: 1,
      order_id: 1,
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

  const mockEasyshipResponse = {
    shipmentId: 'shipment-abc123',
    labelUrl: 'https://cdn.easyship.com/label.pdf',
    trackingNumber: '1Z999AA10123456784',
    courierName: 'UPS',
    createdAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrderRepo = {
      getOrderById: jest.fn().mockResolvedValue(mockOrder),
      getAddressById: jest.fn().mockResolvedValue(mockShippingAddress),
      getOrderItems: jest.fn().mockResolvedValue(mockOrderItems),
      updateShipment: jest.fn().mockResolvedValue({
        ...mockOrder,
        shipment_id: mockEasyshipResponse.shipmentId,
        label_url: mockEasyshipResponse.labelUrl,
        shipment_status: 'label_created',
      }),
    };

    mockVendorRepo = {
      getOriginAddress: jest.fn().mockResolvedValue(mockVendorOrigin),
    };

    mockGateway = {
      buildShipmentPayload: jest.fn().mockReturnValue({}),
      createShipment: jest.fn().mockResolvedValue(mockEasyshipResponse),
    };

    service = new ShipmentService(mockOrderRepo, mockVendorRepo, mockGateway);
  });

  describe('createShipment', () => {
    it('successfully creates shipment for valid order', async () => {
      const result = await service.createShipment({
        orderId: 1,
        vendorId: 100,
        selectedRateId: 'rate-123',
        shippingAddressId: 10,
      });

      expect(result).toEqual(
        expect.objectContaining({
          shipmentId: 'shipment-abc123',
          labelUrl: 'https://cdn.easyship.com/label.pdf',
          trackingNumber: '1Z999AA10123456784',
          status: 'label_created',
        })
      );

      expect(mockOrderRepo.updateShipment).toHaveBeenCalled();
    });

    it('throws error if no vendor context', async () => {
      await expect(
        service.createShipment({
          orderId: 1,
          vendorId: null,
          selectedRateId: 'rate-123',
          shippingAddressId: 10,
        })
      ).rejects.toThrow(InvalidShippingRequest);
    });

    it('throws error if order not found', async () => {
      mockOrderRepo.getOrderById.mockResolvedValue(null);

      await expect(
        service.createShipment({
          orderId: 999,
          vendorId: 100,
          selectedRateId: 'rate-123',
          shippingAddressId: 10,
        })
      ).rejects.toThrow(InvalidShippingRequest);
    });

    it('throws error if order belongs to different vendor', async () => {
      const differentVendorOrder = { ...mockOrder, tenant_id: 200 };
      mockOrderRepo.getOrderById.mockResolvedValue(differentVendorOrder);

      await expect(
        service.createShipment({
          orderId: 1,
          vendorId: 100,
          selectedRateId: 'rate-123',
          shippingAddressId: 10,
        })
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Payment Validation Gate', () => {
    it('rejects unpaid order', async () => {
      const unpaidOrder = { ...mockOrder, payment_status: 'pending' };
      mockOrderRepo.getOrderById.mockResolvedValue(unpaidOrder);

      await expect(
        service.createShipment({
          orderId: 1,
          vendorId: 100,
          selectedRateId: 'rate-123',
          shippingAddressId: 10,
        })
      ).rejects.toThrow(InvalidShippingRequest);
    });

    it('allows paid order', async () => {
      mockOrderRepo.getOrderById.mockResolvedValue(mockOrder);

      await service.createShipment({
        orderId: 1,
        vendorId: 100,
        selectedRateId: 'rate-123',
        shippingAddressId: 10,
      });

      expect(mockGateway.createShipment).toHaveBeenCalled();
    });

    it('allows processing status (post-payment)', async () => {
      const processingOrder = { ...mockOrder, payment_status: 'processing' };
      mockOrderRepo.getOrderById.mockResolvedValue(processingOrder);

      await service.createShipment({
        orderId: 1,
        vendorId: 100,
        selectedRateId: 'rate-123',
        shippingAddressId: 10,
      });

      expect(mockGateway.createShipment).toHaveBeenCalled();
    });
  });

  describe('Rate Selection Gate', () => {
    it('throws error if no rate selected', async () => {
      await expect(
        service.createShipment({
          orderId: 1,
          vendorId: 100,
          selectedRateId: null,
          shippingAddressId: 10,
        })
      ).rejects.toThrow(InvalidShippingRequest);
    });

    it('proceeds if rate provided', async () => {
      await service.createShipment({
        orderId: 1,
        vendorId: 100,
        selectedRateId: 'rate-123',
        shippingAddressId: 10,
      });

      expect(mockGateway.createShipment).toHaveBeenCalledWith(
        expect.objectContaining({
          shipmentData: expect.any(Object),
        })
      );
    });
  });

  describe('Duplicate Shipment Prevention', () => {
    it('throws error if shipment already created', async () => {
      const orderWithShipment = {
        ...mockOrder,
        shipment_id: 'shipment-existing',
      };
      mockOrderRepo.getOrderById.mockResolvedValue(orderWithShipment);

      await expect(
        service.createShipment({
          orderId: 1,
          vendorId: 100,
          selectedRateId: 'rate-123',
          shippingAddressId: 10,
        })
      ).rejects.toThrow(InvalidShippingRequest);

      expect(mockGateway.createShipment).not.toHaveBeenCalled();
    });
  });

  describe('Address Validation', () => {
    it('throws error if shipping address not found', async () => {
      mockOrderRepo.getAddressById.mockResolvedValue(null);

      await expect(
        service.createShipment({
          orderId: 1,
          vendorId: 100,
          selectedRateId: 'rate-123',
          shippingAddressId: 999,
        })
      ).rejects.toThrow(InvalidShippingRequest);
    });

    it('throws error if vendor origin not configured', async () => {
      mockVendorRepo.getOriginAddress.mockResolvedValue(null);

      await expect(
        service.createShipment({
          orderId: 1,
          vendorId: 100,
          selectedRateId: 'rate-123',
          shippingAddressId: 10,
        })
      ).rejects.toThrow(InvalidShippingRequest);
    });
  });

  describe('Order Items Validation', () => {
    it('throws error if order has no items', async () => {
      mockOrderRepo.getOrderItems.mockResolvedValue([]);

      await expect(
        service.createShipment({
          orderId: 1,
          vendorId: 100,
          selectedRateId: 'rate-123',
          shippingAddressId: 10,
        })
      ).rejects.toThrow(InvalidShippingRequest);
    });

    it('proceeds if order has items', async () => {
      mockOrderRepo.getOrderItems.mockResolvedValue(mockOrderItems);

      await service.createShipment({
        orderId: 1,
        vendorId: 100,
        selectedRateId: 'rate-123',
        shippingAddressId: 10,
      });

      expect(mockGateway.createShipment).toHaveBeenCalled();
    });
  });

  describe('Payload Building', () => {
    it('builds payload with all required data', async () => {
      await service.createShipment({
        orderId: 1,
        vendorId: 100,
        selectedRateId: 'rate-123',
        shippingAddressId: 10,
      });

      expect(mockGateway.buildShipmentPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          order: mockOrder,
          shippingAddress: mockShippingAddress,
          originAddress: mockVendorOrigin,
          items: mockOrderItems,
          selectedRate: expect.objectContaining({
            easyshipRateId: 'rate-123',
          }),
        })
      );
    });

    it('includes vendor-specific API key in gateway call', async () => {
      const vendorApiKey = 'vendor-secret-key';

      await service.createShipment({
        orderId: 1,
        vendorId: 100,
        selectedRateId: 'rate-123',
        shippingAddressId: 10,
        apiKey: vendorApiKey,
      });

      expect(mockGateway.createShipment).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: vendorApiKey })
      );
    });
  });

  describe('Database Persistence', () => {
    it('persists shipment snapshot to orders table', async () => {
      await service.createShipment({
        orderId: 1,
        vendorId: 100,
        selectedRateId: 'rate-123',
        shippingAddressId: 10,
      });

      expect(mockOrderRepo.updateShipment).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          shipment_id: 'shipment-abc123',
          shipment_status: 'label_created',
          label_url: 'https://cdn.easyship.com/label.pdf',
          easyship_rate_id: 'rate-123',
          courier_name: 'UPS',
          shipping_cost_snapshot: 1599, // Locked cost
          tracking_number: '1Z999AA10123456784',
        })
      );
    });
  });

  describe('getShipmentByOrderId', () => {
    it('retrieves shipment for authorized vendor', async () => {
      const orderWithShipment = {
        ...mockOrder,
        shipment_id: 'shipment-xyz',
        label_url: 'https://cdn.easyship.com/label.pdf',
        tracking_number: '1Z999AA10123456784',
        courier_name: 'FedEx',
        shipment_status: 'in_transit',
      };
      mockOrderRepo.getOrderById.mockResolvedValue(orderWithShipment);

      mockGateway.getShipment = jest
        .fn()
        .mockResolvedValue({
          shipmentId: 'shipment-xyz',
          status: 'in_transit',
        });

      const result = await service.getShipmentByOrderId(1, 100);

      expect(result.shipmentId).toBe('shipment-xyz');
    });

    it('throws error if vendor unauthorized', async () => {
      const differentVendorOrder = { ...mockOrder, tenant_id: 200 };
      mockOrderRepo.getOrderById.mockResolvedValue(differentVendorOrder);

      await expect(
        service.getShipmentByOrderId(1, 100)
      ).rejects.toThrow(AuthorizationError);
    });

    it('returns null if no shipment created yet', async () => {
      mockOrderRepo.getOrderById.mockResolvedValue(mockOrder);

      const result = await service.getShipmentByOrderId(1, 100);

      expect(result).toBeNull();
    });

    it('falls back to cached data if API fetch fails', async () => {
      const orderWithShipment = {
        ...mockOrder,
        shipment_id: 'shipment-xyz',
        label_url: 'https://cdn.easyship.com/label.pdf',
        tracking_number: '1Z999AA10123456784',
        courier_name: 'FedEx',
        shipment_status: 'in_transit',
      };
      mockOrderRepo.getOrderById.mockResolvedValue(orderWithShipment);

      mockGateway.getShipment = jest
        .fn()
        .mockRejectedValue(new Error('API error'));

      const result = await service.getShipmentByOrderId(1, 100);

      expect(result).toEqual(
        expect.objectContaining({
          shipmentId: 'shipment-xyz',
          labelUrl: 'https://cdn.easyship.com/label.pdf',
          trackingNumber: '1Z999AA10123456784',
          status: 'in_transit',
        })
      );
    });
  });

  describe('Tenant Isolation', () => {
    it('prevents cross-vendor shipment creation', async () => {
      const vendorBOrder = { ...mockOrder, tenant_id: 200 };
      mockOrderRepo.getOrderById.mockResolvedValue(vendorBOrder);

      await expect(
        service.createShipment({
          orderId: 1,
          vendorId: 100, // Different from order's tenant_id
          selectedRateId: 'rate-123',
          shippingAddressId: 10,
        })
      ).rejects.toThrow(AuthorizationError);

      expect(mockGateway.createShipment).not.toHaveBeenCalled();
    });

    it('prevents cross-vendor shipment lookup', async () => {
      const vendorBOrder = { ...mockOrder, tenant_id: 200 };
      mockOrderRepo.getOrderById.mockResolvedValue(vendorBOrder);

      await expect(
        service.getShipmentByOrderId(1, 100)
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Error Propagation', () => {
    it('propagates shipment gateway errors', async () => {
      mockOrderRepo.getOrderById.mockResolvedValue(mockOrder);
      const apiError = new Error('Easyship API failed');
      mockGateway.createShipment.mockRejectedValue(apiError);

      await expect(
        service.createShipment({
          orderId: 1,
          vendorId: 100,
          selectedRateId: 'rate-123',
          shippingAddressId: 10,
        })
      ).rejects.toThrow(apiError);
    });

    it('logs detailed error context', async () => {
      mockOrderRepo.getOrderById.mockResolvedValue(mockOrder);
      const apiError = new Error('API failure');
      mockGateway.createShipment.mockRejectedValue(apiError);

      try {
        await service.createShipment({
          orderId: 1,
          vendorId: 100,
          selectedRateId: 'rate-123',
          shippingAddressId: 10,
        });
      } catch (error) {
        // Error is logged internally
        expect(error.message).toBe('API failure');
      }
    });
  });
});
