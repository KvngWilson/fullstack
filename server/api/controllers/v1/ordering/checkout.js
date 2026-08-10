/**
 * CheckoutController - Handle order finalization and payment processing
 *
 * Uses checkoutValidationMiddleware to ensure:
 * - selectedRateId is valid
 * - Shipping cost hasn't changed
 * - Cart is intact
 * - Address is valid
 *
 * Then processes payment with validated order
 */

const logger = require("../../../../shared/utils/logger");

/**
 * Factory function to create checkout controller
 * @param {PaymentService} paymentService - Service to process payments
 * @returns {object} - Controller functions
 */
function createCheckoutController(paymentService) {
  return {
    /**
     * POST /api/v1/checkout
     * Finalize order and process payment
     *
     * Expected request body:
     * {
     *   orderId: number,
     *   selectedRateId: string,
     *   paymentIntentId?: string,
     *   paymentMethod?: object
     * }
     *
     * Response:
     * {
     *   success: true,
     *   orderId: number,
     *   paymentId: string,
     *   shipmentId?: string
     * }
     */
    async finalizeCheckout(req, res) {
      try {
        const { orderId, selectedRateId } = req.body;
        const vendorId = req.user?.vendor_id || req.user?.id;

        // Validation middleware should have already validated everything
        if (!req.checkout?.validation?.isValid) {
          return res.status(400).json({
            error: req.checkout?.validation?.error || "Validation failed",
          });
        }

        const quotedRate = req.checkout.validation.rate;

        logger.info("Finalizing checkout", {
          orderId,
          vendorId,
          selectedRateId,
          shippingCost: quotedRate.rate,
        });

        // Process payment
        const paymentResult = await paymentService.processCheckout({
          orderId,
          vendorId,
          selectedRateId,
          shippingCost: quotedRate.rate,
          courierName: quotedRate.courier_name,
          easyshipRateId: quotedRate.rate_id,
        });

        if (!paymentResult.success) {
          logger.warn("Checkout payment processing failed", {
            orderId,
            error: paymentResult.error,
          });

          return res.status(400).json({
            error: paymentResult.error || "Payment processing failed",
          });
        }

        logger.info("Checkout finalized successfully", {
          orderId,
          paymentId: paymentResult.paymentId,
          shipmentId: paymentResult.shipmentId,
        });

        return res.status(200).json({
          success: true,
          orderId,
          paymentId: paymentResult.paymentId,
          shipmentId: paymentResult.shipmentId,
          message: "Order finalized and payment processed",
        });
      } catch (error) {
        logger.error("Checkout finalization error", {
          orderId: req.body?.orderId,
          error: error.message,
        });

        return res.status(500).json({
          error: "Checkout finalization failed",
        });
      }
    },

    /**
     * POST /api/v1/checkout/validate
     * Validate checkout without finalizing (used for UI feedback)
     *
     * Expected request body:
     * {
     *   orderId: number,
     *   selectedRateId: string
     * }
     *
     * Response:
     * {
     *   isValid: boolean,
     *   error?: string,
     *   rate?: object
     * }
     */
    async validateCheckoutOnly(req, res) {
      try {
        // Middleware already validated, just return result
        const validation = req.checkout?.validation;

        if (!validation) {
          return res.status(500).json({
            error: "Validation not performed",
          });
        }

        return res.status(200).json({
          isValid: validation.isValid,
          error: validation.error,
          rate: validation.isValid
            ? {
                rate_id: validation.rate.rate_id,
                rate: validation.rate.rate,
                courier_name: validation.rate.courier_name,
              }
            : null,
        });
      } catch (error) {
        logger.error("Checkout validation error", {
          error: error.message,
        });

        return res.status(500).json({
          error: "Validation failed",
        });
      }
    },
  };
}

module.exports = createCheckoutController;
