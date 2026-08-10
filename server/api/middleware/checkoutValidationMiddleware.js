/**
 * checkoutValidationMiddleware - Validate orders before finalization
 * 
 * Usage: router.post('/checkout', checkoutValidationMiddleware, checkoutController)
 * 
 * Validates:
 * - selectedRateId matches cached rates
 * - Shipping cost hasn't been manipulated
 * - Cart integrity (items haven't changed)
 * - Address is valid
 * - Order state permits checkout
 * 
 * Sets req.checkout.validation = { isValid, rate, error }
 */

const logger = require('../../shared/utils/logger');

/**
 * Factory function to create checkout validation middleware
 * @param {CheckoutValidationService} validationService
 * @returns {Function} Express middleware
 */
function createCheckoutValidationMiddleware(validationService) {
  return async (req, res, next) => {
    try {
      const { orderId, selectedRateId } = req.body;

      if (!req.user) {
        logger.warn('Checkout validation: missing user context', {
          orderId,
        });

        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      const vendorId = req.user.vendor_id || req.user.id;

      if (!vendorId) {
        logger.warn('Checkout validation: missing vendor context', {
          orderId,
        });

        return res.status(401).json({
          error: 'Authentication required',
        });
      }

      // Validate order state first
      const orderValidation = await validationService.validateOrderState(
        orderId,
        vendorId
      );

      if (!orderValidation.isValid) {
        logger.warn('Order state validation failed', {
          orderId,
          error: orderValidation.error,
        });

        return res.status(400).json({
          error: orderValidation.error,
        });
      }

      const order = orderValidation.order;

      // Validate complete checkout
      const checkoutValidation = await validationService.validateCheckout(
        order,
        selectedRateId,
        vendorId
      );

      // Store validation result in request for controller to access
      if (!req.checkout) {
        req.checkout = {};
      }

      req.checkout.validation = checkoutValidation;

      // If validation failed, return error immediately
      if (!checkoutValidation.isValid) {
        logger.warn('Checkout validation failed', {
          orderId,
          error: checkoutValidation.error,
        });

        return res.status(400).json({
          error: checkoutValidation.error,
        });
      }

      // Validation passed, continue to next middleware/controller
      next();
    } catch (error) {
      logger.error('Checkout validation middleware error', {
        error: error.message,
        body: req.body,
      });

      return res.status(500).json({
        error: 'Checkout validation failed',
      });
    }
  };
}

module.exports = createCheckoutValidationMiddleware;
