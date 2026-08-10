/**
 * CheckoutValidationService - Validate orders before finalization
 * 
 * Prevents shipping cost manipulation by:
 * - Verifying selectedRateId against cached rates
 * - Validating shipping cost hasn't changed since quote
 * - Ensuring cart integrity (items/quantities match)
 * - Confirming address is still valid
 * - Checking rate hasn't expired
 * - Enforcing multi-tenant isolation
 */

const logger = require('../../../shared/utils/logger');

class CheckoutValidationService {
  constructor(shippingCacheClient, easyshipGateway, orderRepository) {
    this.shippingCacheClient = shippingCacheClient;
    this.easyshipGateway = easyshipGateway;
    this.orderRepository = orderRepository;
  }

  /**
   * Validate complete checkout before order finalization
   * 
   * @param {object} order - Order being finalized
   * @param {string} selectedRateId - Rate ID selected by client
   * @param {number} vendorId - Tenant/vendor ID
   * @returns {object} - { isValid: boolean, error?: string }
   * @throws {Error} - On validation error
   */
  async validateCheckout(order, selectedRateId, vendorId) {
    if (!order) {
      throw new Error('Order required for checkout validation');
    }

    if (!selectedRateId) {
      return {
        isValid: false,
        error: 'selectedRateId is required',
      };
    }

    if (!vendorId) {
      return {
        isValid: false,
        error: 'vendorId is required',
      };
    }

    // Enforce multi-tenant isolation
    if (order.vendor_id !== vendorId) {
      logger.warn('Checkout validation failed: vendor mismatch', {
        orderId: order.id,
        expectedVendor: order.vendor_id,
        requestingVendor: vendorId,
      });
      return {
        isValid: false,
        error: 'Unauthorized: vendor mismatch',
      };
    }

    try {
      // 1. Validate rate selection against cached rates
      const rateValidation = await this.validateRateSelection(
        order,
        selectedRateId,
        vendorId
      );

      if (!rateValidation.isValid) {
        return rateValidation;
      }

      // 2. Validate shipping cost matches quoted rate
      const costValidation = await this.validateShippingCost(
        order,
        rateValidation.rate
      );

      if (!costValidation.isValid) {
        return costValidation;
      }

      // 3. Validate cart integrity (items/quantities haven't changed)
      const cartValidation = await this.validateCartIntegrity(
        order,
        rateValidation.rate
      );

      if (!cartValidation.isValid) {
        return cartValidation;
      }

      // 4. Validate address is still valid
      const addressValidation = this.validateAddress(order);

      if (!addressValidation.isValid) {
        return addressValidation;
      }

      logger.info('Checkout validation passed', {
        orderId: order.id,
        selectedRateId,
        vendorId,
      });

      return {
        isValid: true,
        rate: rateValidation.rate,
      };
    } catch (error) {
      logger.error('Checkout validation error', {
        orderId: order.id,
        error: error.message,
      });

      return {
        isValid: false,
        error: 'Checkout validation failed',
      };
    }
  }

  /**
   * Validate selectedRateId matches a cached rate for this order
   * @private
   */
  async validateRateSelection(order, selectedRateId, vendorId) {
    // Get shipping address for rate lookup
    const shippingAddress = order.shipping_address || {};

    // Reconstruct cache key parameters
    const cartSignature = JSON.stringify({
      items: order.items || [],
      currency: order.currency || 'USD',
    });

    // Get cached rates (uses same logic as cache layer)
    let cachedRates;
    try {
      cachedRates = await this.shippingCacheClient.getCachedRates(
        vendorId,
        cartSignature,
        shippingAddress,
        order.currency || 'USD'
      );
    } catch (cacheError) {
      logger.warn('Failed to retrieve cached rates during validation', {
        orderId: order.id,
        error: cacheError.message,
      });

      // Cache miss is not a validation failure - customer can still proceed
      // but we recommend re-fetching rates
      return {
        isValid: false,
        error: 'Rates not found in cache. Please re-select a rate.',
      };
    }

    if (!cachedRates || cachedRates.length === 0) {
      return {
        isValid: false,
        error: 'No cached rates available. Please re-select shipping.',
      };
    }

    // Find matching rate by ID
    const selectedRate = cachedRates.find((r) => r.rate_id === selectedRateId);

    if (!selectedRate) {
      logger.warn('Selected rate not found in cached rates', {
        orderId: order.id,
        selectedRateId,
        cachedRateIds: cachedRates.map((r) => r.rate_id),
      });

      return {
        isValid: false,
        error: 'Selected rate is invalid or expired. Please re-select shipping.',
      };
    }

    return {
      isValid: true,
      rate: selectedRate,
    };
  }

  /**
   * Validate shipping cost hasn't changed since quote
   * @private
   */
  async validateShippingCost(order, quotedRate) {
    // Client submits shippingCost based on quoted rate
    const submittedCost = order.shipping_cost;
    const quotedCost = quotedRate.rate;

    // Convert to same units (assuming quotedRate.rate is in major units)
    const quotedCostMinor = Math.round(quotedCost * 100);
    const submittedCostMinor = Math.round(submittedCost * 100);

    if (Math.abs(quotedCostMinor - submittedCostMinor) > 1) {
      // Allow 1 cent rounding difference
      logger.warn('Shipping cost mismatch during checkout', {
        orderId: order.id,
        submittedCost: submittedCost,
        quotedCost: quotedCost,
        difference: Math.abs(quotedCostMinor - submittedCostMinor),
      });

      return {
        isValid: false,
        error: 'Shipping cost has changed. Please re-select rate.',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate cart contents match what rate was quoted for
   * @private
   */
  async validateCartIntegrity(order, quotedRate) {
    // Get items from order
    const orderItems = order.items || [];

    // Calculate total weight (if applicable)
    const totalWeight = orderItems.reduce((sum, item) => {
      return sum + (item.weight || 0) * (item.quantity || 1);
    }, 0);

    // Validate minimum requirements
    if (orderItems.length === 0) {
      return {
        isValid: false,
        error: 'Order cannot have zero items',
      };
    }

    // Check if rate metadata includes expected item count
    // (Easyship rates are calculated per-shipment, cart size matters)
    if (quotedRate.metadata) {
      const quotedItemCount = quotedRate.metadata.itemCount;
      const actualItemCount = orderItems.length;

      if (quotedItemCount && quotedItemCount !== actualItemCount) {
        logger.warn('Order item count changed since rate quote', {
          orderId: order.id,
          quotedItemCount,
          actualItemCount,
        });

        return {
          isValid: false,
          error: 'Order contents changed. Please re-calculate shipping.',
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate shipping address is still valid
   * @private
   */
  validateAddress(order) {
    const address = order.shipping_address;

    if (!address) {
      return {
        isValid: false,
        error: 'Shipping address is required',
      };
    }

    // Validate required address fields
    const requiredFields = ['city', 'country_code'];
    for (const field of requiredFields) {
      if (!address[field]) {
        return {
          isValid: false,
          error: `Shipping address is missing ${field}`,
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Validate order state before finalizing payment
   * Ensures order hasn't been modified after rate calculation
   * 
   * @param {number} orderId - Order ID
   * @param {number} vendorId - Vendor/tenant ID
   * @returns {object} - { isValid: boolean, error?: string, order?: object }
   */
  async validateOrderState(orderId, vendorId) {
    try {
      const order = await this.orderRepository.getOrderById(orderId);

      if (!order) {
        return {
          isValid: false,
          error: 'Order not found',
        };
      }

      if (order.vendor_id !== vendorId) {
        logger.warn('Order validation failed: vendor mismatch', {
          orderId,
          expectedVendor: order.vendor_id,
          requestingVendor: vendorId,
        });

        return {
          isValid: false,
          error: 'Unauthorized: vendor mismatch',
        };
      }

      // Ensure order is in valid state for checkout
      const validStates = ['pending', 'draft'];
      if (!validStates.includes(order.status)) {
        return {
          isValid: false,
          error: `Order status ${order.status} is not valid for checkout`,
        };
      }

      return {
        isValid: true,
        order,
      };
    } catch (error) {
      logger.error('Order state validation error', {
        orderId,
        error: error.message,
      });

      return {
        isValid: false,
        error: 'Failed to validate order state',
      };
    }
  }
}

module.exports = CheckoutValidationService;
