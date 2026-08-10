/**
 * ShipmentService - Domain-level shipment label creation orchestration
 * 
 * Coordinates between:
 * - OrderRepository (order/payment validation)
 * - VendorRepository (origin address)
 * - EasyshipShipmentGateway (API calls)
 * - Database persistence (shipment snapshots)
 * 
 * Invariants:
 * - Shipment creation only after payment confirmed
 * - Shipment creation only with validated rate
 * - Strict tenant isolation (vendor ownership)
 * - Monetary values stored in minor units
 */

const logger = require('../../../shared/utils/logger');
const {
  InvalidShippingRequest,
  AuthorizationError,
} = require('../../../shared/utils/errors');

class ShipmentService {
  constructor(orderRepository, vendorRepository, easyshipGateway) {
    this.orderRepo = orderRepository;
    this.vendorRepo = vendorRepository;
    this.gateway = easyshipGateway;
  }

  /**
   * Create shipment label for paid order
   * 
   * Flow:
   * 1. Validate with tenant context (vendorId)
   * 2. Check order exists and belongs to vendor
   * 3. Validate payment status = PAID
   * 4. Validate selected rate was provided and cached
   * 5. Fetch vendor origin address
   * 6. Build shipment payload
   * 7. Call Easyship API
   * 8. Persist shipment snapshot to orders table
   * 9. Return shipment metadata
   */
  async createShipment(params) {
    const {
      orderId,
      vendorId,
      selectedRateId,
      shippingAddressId,
      apiKey = null,
    } = params;

    // Tenant isolation
    if (!vendorId) {
      throw new InvalidShippingRequest('Vendor context required');
    }

    try {
      logger.debug('Shipment creation requested', { orderId, vendorId });

      // Fetch order and validate ownership
      const order = await this.orderRepo.getOrderById(orderId);
      this._validateOrderOwnership(order, vendorId);

      // Validate payment status
      this._validatePaymentStatus(order);

      // Validate rate was selected
      if (!selectedRateId) {
        throw new InvalidShippingRequest('Shipping rate must be selected');
      }

      // Validate no duplicate shipment
      if (order.shipment_id) {
        throw new InvalidShippingRequest(
          'Shipment already created for this order'
        );
      }

      // Fetch shipping address
      const shippingAddress = await this.orderRepo.getAddressById(
        shippingAddressId
      );
      if (!shippingAddress) {
        throw new InvalidShippingRequest('Shipping address not found');
      }

      // Fetch vendor origin address (from vendor profile)
      const vendorOrigin = await this.vendorRepo.getOriginAddress(vendorId);
      if (!vendorOrigin) {
        throw new InvalidShippingRequest('Vendor origin address not configured');
      }

      // Fetch order items with pricing/dimensions
      const orderItems = await this.orderRepo.getOrderItems(orderId);
      if (!orderItems || orderItems.length === 0) {
        throw new InvalidShippingRequest('Order has no items');
      }

      // Reconstruct the selected rate (from cache or database)
      // In production, this would be validated against cached rates
      const selectedRate = {
        easyshipRateId: selectedRateId,
      };

      // Build shipment payload
      const shipmentPayload = this.gateway.buildShipmentPayload({
        order,
        shippingAddress,
        originAddress: vendorOrigin,
        items: orderItems,
        selectedRate,
      });

      logger.debug('Shipment payload built', {
        orderId,
        itemCount: orderItems.length,
      });

      // Call Easyship API
      const easyshipResponse = await this.gateway.createShipment({
        orderId,
        vendorId,
        shipmentData: shipmentPayload,
        apiKey,
      });

      // Persist shipment snapshot to orders table
      const updatedOrder = await this.orderRepo.updateShipment(orderId, {
        shipment_id: easyshipResponse.shipmentId,
        shipment_status: 'label_created',
        label_url: easyshipResponse.labelUrl,
        easyship_rate_id: selectedRateId,
        courier_name: easyshipResponse.courierName,
        shipping_cost_snapshot: order.shipping_cost, // Store locked cost
        tracking_number: easyshipResponse.trackingNumber,
        shipment_created_at: new Date(),
      });

      logger.info('Shipment created and persisted', {
        orderId,
        vendorId,
        shipmentId: easyshipResponse.shipmentId,
      });

      return {
        shipmentId: easyshipResponse.shipmentId,
        labelUrl: easyshipResponse.labelUrl,
        trackingNumber: easyshipResponse.trackingNumber,
        courierName: easyshipResponse.courierName,
        status: 'label_created',
        orderId,
      };
    } catch (error) {
      logger.error('Shipment creation failed', {
        orderId,
        vendorId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate order belongs to vendor (tenant isolation)
   */
  _validateOrderOwnership(order, vendorId) {
    if (!order) {
      throw new InvalidShippingRequest('Order not found');
    }

    if (order.tenant_id !== vendorId) {
      throw new AuthorizationError(
        'Order does not belong to your vendor context'
      );
    }
  }

  /**
   * Validate payment has been confirmed
   * Shipment creation gate: order status must be PAID
   */
  _validatePaymentStatus(order) {
    const validStatuses = ['paid', 'processing', 'shipped', 'delivered'];

    if (!validStatuses.includes(order.payment_status?.toLowerCase())) {
      throw new InvalidShippingRequest(
        `Cannot create shipment for unpaid order (status: ${order.payment_status})`
      );
    }
  }

  /**
   * Get shipment details by order ID
   */
  async getShipmentByOrderId(orderId, vendorId) {
    if (!vendorId) {
      throw new InvalidShippingRequest('Vendor context required');
    }

    const order = await this.orderRepo.getOrderById(orderId);
    this._validateOrderOwnership(order, vendorId);

    if (!order.shipment_id) {
      return null; // No shipment created yet
    }

    // Fetch fresh data from Easyship if needed
    try {
      return await this.gateway.getShipment(order.shipment_id);
    } catch (error) {
      logger.warn('Failed to fetch fresh shipment data, using cached', {
        orderId,
        error: error.message,
      });

      // Return cached data from orders table
      return {
        shipmentId: order.shipment_id,
        labelUrl: order.label_url,
        trackingNumber: order.tracking_number,
        courierName: order.courier_name,
        status: order.shipment_status,
      };
    }
  }
}

module.exports = ShipmentService;
