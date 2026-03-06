/**
 * EasyshipShipmentGateway - Easyship Shipment API wrapper
 * 
 * Responsibilities:
 * - Encapsulate Easyship shipment creation API calls
 * - Handle API-specific error mapping
 * - Support multi-tenant (vendor-specific API keys)
 * - Normalize shipment label responses
 * - Log all shipment API interactions
 */

const easyship = require('@api/easyship');
const logger = require('../../shared/utils/logger');
const CircuitBreaker = require('../resilience/CircuitBreaker');
const RateLimiter = require('../resilience/RateLimiter');

class EasyshipShipmentGateway {
  constructor(defaultApiKey = null) {
    this.defaultApiKey = defaultApiKey || process.env.EASYSHIP_API_KEY;
    this.rateLimiter = new RateLimiter({
      name: 'EasyshipShipmentRateLimiter',
      capacity: Number(process.env.EASYSHIP_RATE_LIMIT_CAPACITY) || 100,
      refillRate: Number(process.env.EASYSHIP_RATE_LIMIT_REFILL_RATE) || 10,
      maxWaitTime: Number(process.env.EASYSHIP_RATE_LIMIT_WAIT_MS) || 5000,
    });
    this.circuitBreaker = new CircuitBreaker({
      name: 'EasyshipShipmentCircuitBreaker',
      failureThreshold: Number(process.env.EASYSHIP_CIRCUIT_FAILURE_THRESHOLD) || 5,
      successThreshold: Number(process.env.EASYSHIP_CIRCUIT_SUCCESS_THRESHOLD) || 2,
      timeout: Number(process.env.EASYSHIP_CIRCUIT_TIMEOUT_MS) || 60000,
    });
    
    if (this.defaultApiKey) {
      easyship.auth(this.defaultApiKey);
    }
  }

  /**
   * Create shipment and generate label
   * 
   * @param {object} params - Shipment creation parameters
   * @param {string} params.orderId - Order ID (for reference)
   * @param {string} params.vendorId - Vendor ID (for logging)
   * @param {object} params.shipmentData - Easyship shipment payload
   * @param {string} params.apiKey - Vendor-specific API key (optional)
   * @returns {Promise<object>} - Normalized shipment response
   * @throws {ShipmentCreationError}
   */
  async createShipment(params) {
    const {
      orderId,
      vendorId,
      shipmentData,
      apiKey,
    } = params;

    try {
      // Support vendor-specific API keys
      if (apiKey && apiKey !== this.defaultApiKey) {
        easyship.auth(apiKey);
      }

      logger.debug('Creating shipment with Easyship', {
        orderId,
        vendorId,
        destination: shipmentData.destination_address?.country_alpha2,
      });

      const response = await this.circuitBreaker.execute(async () => {
        await this.rateLimiter.acquireToken();
        return easyship.shipments(shipmentData);
      });

      const normalizedShipment = this._normalizeShipmentResponse(
        response.data || response
      );

      logger.debug('Shipment created successfully', {
        orderId,
        vendorId,
        shipmentId: normalizedShipment.shipmentId,
      });

      return normalizedShipment;
    } catch (error) {
      logger.error('Easyship shipment creation failed', {
        orderId,
        vendorId,
        error: error.message,
        statusCode: error.statusCode,
      });

      throw this._mapError(error);
    } finally {
      // Reset to default API key if it was overridden
      if (apiKey && apiKey !== this.defaultApiKey && this.defaultApiKey) {
        easyship.auth(this.defaultApiKey);
      }
    }
  }

  /**
   * Build Easyship shipment payload from order and rate data
   * 
   * @param {object} params - Payload parameters
   * @param {object} params.order - Order record
   * @param {object} params.shippingAddress - Shipping address details
   * @param {object} params.originAddress - Vendor origin/warehouse address
   * @param {array} params.items - Order items
   * @param {object} params.selectedRate - Previously cached/validated rate
   * @returns {object} - Easyship-compatible shipment payload
   */
  buildShipmentPayload({
    order,
    shippingAddress,
    originAddress,
    items,
    selectedRate,
  }) {
    return {
      reference_id: `ORDER-${order.id}`,
      to_address: {
        name: `${shippingAddress.first_name || ''} ${shippingAddress.last_name || ''}`.trim(),
        email: shippingAddress.email || order.shipping_email,
        phone_number: shippingAddress.phone || order.shipping_phone,
        line_1: shippingAddress.street_address || order.shipping_street_address,
        line_2: shippingAddress.line_2 || null,
        city: shippingAddress.city || order.shipping_city,
        state: shippingAddress.state || order.shipping_state,
        postal_code: shippingAddress.postal_code || order.shipping_postal_code,
        country_alpha2: shippingAddress.country_code || order.shipping_country,
      },
      from_address: {
        name: originAddress.business_name || 'Vendor',
        line_1: originAddress.address_line1,
        line_2: originAddress.address_line2 || null,
        city: originAddress.city,
        state: originAddress.state,
        postal_code: originAddress.postal_code,
        country_alpha2: originAddress.country_code,
        phone_number: originAddress.phone_number || null,
      },
      parcels: [
        {
          items: items.map(item => ({
            description: item.product_name || item.sku,
            quantity: item.quantity,
            category: item.category || 'general',
            actual_weight: item.weight || 0.5,
            height: item.height || 10,
            width: item.width || 10,
            length: item.length || 10,
            declared_currency: order.currency || 'USD',
            declared_customs_value: (item.value_per_unit || 0) * item.quantity,
            origin_country_alpha2: originAddress.country_code,
          })),
        },
      ],
      incoterms: 'DDU',
      insurance: { is_insured: false },
      is_document: false,
      label_format: 'pdf', // Supports: pdf, zpl, epl, png, thermal_pdf
      shipping_method: {
        id: selectedRate.easyshipRateId, // Rate ID from cache
      },
    };
  }

  /**
   * Normalize Easyship shipment response to standard format
   */
  _normalizeShipmentResponse(easyshipResponse) {
    const shipment = easyshipResponse.shipment || easyshipResponse;

    return {
      shipmentId: shipment.id,
      easyshipShipmentId: shipment.id,
      referenceId: shipment.reference_id,
      labelUrl: shipment.label_download?.href || shipment.label_url || null,
      labelFormat: shipment.label_format || 'pdf',
      trackingNumber: shipment.tracking_number || null,
      courierId: shipment.courier?.id || null,
      courierName: shipment.courier?.name || null,
      serviceId: shipment.shipping_method?.id || null,
      serviceName: shipment.shipping_method?.name || null,
      status: shipment.status || 'created',
      estimatedDeliveryDate: shipment.estimated_delivery_date || null,
      createdAt: shipment.created_at,
    };
  }

  /**
   * Retrieve shipment details by shipment ID
   */
  async getShipment(shipmentId, apiKey = null) {
    try {
      if (apiKey && apiKey !== this.defaultApiKey) {
        easyship.auth(apiKey);
      }

      const response = await this.circuitBreaker.execute(async () => {
        await this.rateLimiter.acquireToken();
        return easyship.shipment_id(shipmentId);
      });
      return this._normalizeShipmentResponse(response.data || response);
    } catch (error) {
      logger.error('Failed to fetch shipment', {
        shipmentId,
        error: error.message,
      });
      throw this._mapError(error);
    } finally {
      if (apiKey && apiKey !== this.defaultApiKey && this.defaultApiKey) {
        easyship.auth(this.defaultApiKey);
      }
    }
  }

  /**
   * Map Easyship shipment errors to domain-specific exceptions
   */
  _mapError(error) {
    const errorClass = require('../../shared/utils/errors').ExternalServiceError;
    const mappedError = new errorClass(
      error.message || 'Easyship shipment creation failed'
    );
    mappedError.original = error;
    mappedError.statusCode = error.statusCode;

    return mappedError;
  }

  /**
   * Health check - verify API connectivity
   */
  async healthCheck() {
    try {
      // Try to fetch a known shipment or use rates as health check
      await this.circuitBreaker.execute(async () => {
        await this.rateLimiter.acquireToken();
        return easyship.rates_request({
          destination_address: { country_alpha2: 'US' },
          parcels: [{ items: [] }],
        });
      });

      return { healthy: true, gateway: 'easyship-shipment' };
    } catch (error) {
      logger.warn('Easyship shipment gateway health check failed', {
        error: error.message,
      });
      return {
        healthy: false,
        gateway: 'easyship-shipment',
        error: error.message,
      };
    }
  }
}

module.exports = EasyshipShipmentGateway;
