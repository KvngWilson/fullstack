/**
 * EasyshipGateway - Easyship API wrapper
 *
 * Responsibilities:
 * - Encapsulate Easyship API calls
 * - Handle API-specific error mapping
 * - Support multi-tenant (vendor-specific API keys)
 * - Normalize API responses
 * - Log all API interactions
 */

const easyship = require("@api/easyship");
const logger = require("../../shared/utils/logger");
const CircuitBreaker = require("../resilience/CircuitBreaker");
const RateLimiter = require("../resilience/RateLimiter");

class EasyshipGateway {
  constructor(defaultApiKey = null) {
    this.defaultApiKey = defaultApiKey || process.env.EASYSHIP_API_KEY;
    this.rateLimiter = new RateLimiter({
      name: "EasyshipRateLimiter",
      capacity: Number(process.env.EASYSHIP_RATE_LIMIT_CAPACITY) || 100,
      refillRate: Number(process.env.EASYSHIP_RATE_LIMIT_REFILL_RATE) || 10,
      maxWaitTime: Number(process.env.EASYSHIP_RATE_LIMIT_WAIT_MS) || 5000,
    });
    this.circuitBreaker = new CircuitBreaker({
      name: "EasyshipCircuitBreaker",
      failureThreshold: Number(process.env.EASYSHIP_CIRCUIT_FAILURE_THRESHOLD) || 5,
      successThreshold: Number(process.env.EASYSHIP_CIRCUIT_SUCCESS_THRESHOLD) || 2,
      timeout: Number(process.env.EASYSHIP_CIRCUIT_TIMEOUT_MS) || 60000,
    });

    if (this.defaultApiKey) {
      easyship.auth(this.defaultApiKey);
    }
  }

  /**
   * Request shipping rates from Easyship
   *
   * @param {object} params - Rate request parameters
   * @param {object} params.destination - Destination address
   * @param {array} params.items - Shipment items
   * @param {object} params.origin - Origin address (optional, uses default)
   * @param {string} params.vendorId - Vendor ID (for logging/tracking)
   * @param {string} params.apiKey - Override API key if vendor-specific
   * @returns {Promise<array>} - Normalized rates array
   * @throws {EasyshipError} - API-specific error
   */
  async getRates(params) {
    const { destination, items, origin, vendorId, apiKey } = params;

    try {
      // Support vendor-specific API keys
      if (apiKey && apiKey !== this.defaultApiKey) {
        easyship.auth(apiKey);
      }

      const requestPayload = this._buildRateRequest({
        destination,
        items,
        origin,
      });

      logger.debug("Easyship rate request", {
        vendorId,
        itemCount: items.length,
        destination: destination.country_code,
      });

      const response = await this.circuitBreaker.execute(async () => {
        await this.rateLimiter.acquireToken();
        return easyship.rates_request(requestPayload);
      });

      const normalizedRates = this._normalizeRates(
        response.data?.rates || [],
        destination.country_code,
      );

      logger.debug("Easyship rate response", {
        vendorId,
        rateCount: normalizedRates.length,
      });

      return normalizedRates;
    } catch (error) {
      logger.error("Easyship API error", {
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
   * Build Easyship API rate request payload
   * Ensures consistent formatting and required fields
   */
  _buildRateRequest({ destination, items, origin }) {
    return {
      destination_address: {
        country_alpha2: destination.country_code || "US",
        city: destination.city,
        postal_code: destination.postal_code,
        state: destination.state,
      },
      origin_address: {
        country_alpha2: origin?.country_code || "US",
        city: origin?.city || "San Francisco",
        postal_code: origin?.postal_code || "94102",
        state: origin?.state || "CA",
      },
      incoterms: "DDU",
      insurance: { is_insured: false },
      courier_settings: {
        show_courier_logo_url: true,
        apply_shipping_rules: true,
      },
      shipping_settings: {
        units: { weight: "kg", dimensions: "cm" },
      },
      parcels: [
        {
          items: items.map((item) => ({
            actual_weight: item.weight || 0.5,
            height: item.height || 10,
            width: item.width || 10,
            length: item.length || 10,
            category: item.category || "general",
            declared_currency: item.currency || "USD",
            declared_customs_value: item.value || 0,
            description: item.description || "Product",
            quantity: item.quantity || 1,
            origin_country_alpha2: origin?.country_code || "US",
          })),
        },
      ],
    };
  }

  /**
   * Normalize Easyship rates to standard format
   * Ensures consistent shape across API versions
   */
  _normalizeRates(easyshipRates, destinationCountry) {
    return (easyshipRates || []).map((rate) => ({
      easyshipRateId: rate.rate_id,
      courierId: rate.courier_id,
      courierName: rate.courier_name,
      serviceName: rate.service_name,
      totalChargeMinor: Math.round(parseFloat(rate.total_charge) * 100), // Minor units (cents)
      currency: rate.currency || "USD",
      minDeliveryDays: rate.min_delivery_time,
      maxDeliveryDays: rate.max_delivery_time,
      estimatedDeliveryDate: this._estimateDeliveryDate(rate.min_delivery_time),
      destinationCountry,
    }));
  }

  /**
   * Estimate delivery date from delivery days
   */
  _estimateDeliveryDate(days) {
    if (!days) return null;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  }

  /**
   * Map Easyship errors to domain-specific exceptions
   */
  _mapError(error) {
    const errorMap = {
      400: "InvalidShippingRequest",
      401: "UnauthorizedEasyship",
      403: "ForbiddenEasyship",
      404: "EasyshipNotFound",
      429: "EasyshipRateLimited",
    };

    const ErrorClass = errorMap[error.statusCode]
      ? require("../../shared/utils/errors")[errorMap[error.statusCode]]
      : require("../../shared/utils/errors").ExternalServiceError;

    const mappedError = new ErrorClass(error.message || "Easyship API error");
    mappedError.original = error;
    mappedError.statusCode = error.statusCode;

    return mappedError;
  }

  /**
   * Health check - verify API connectivity
   */
  async healthCheck() {
    try {
      // Simple test: get rates with minimal valid payload
      await this.circuitBreaker.execute(async () => {
        await this.rateLimiter.acquireToken();
        return easyship.rates_request({
          destination_address: {
            country_alpha2: "US",
            city: "New York",
            postal_code: "10001",
            state: "NY",
          },
          origin_address: {
            country_alpha2: "US",
            city: "San Francisco",
            postal_code: "94102",
            state: "CA",
          },
          parcels: [{ items: [] }],
        });
      });

      return { healthy: true, gateway: "easyship" };
    } catch (error) {
      logger.warn("Easyship health check failed", {
        error: error.message,
      });
      return { healthy: false, gateway: "easyship", error: error.message };
    }
  }
}

module.exports = EasyshipGateway;
