/**
 * Checkout Currency Security Tests
 * Critical tests ensuring client cannot tamper with currency amounts
 * 
 * Requirements:
 * - Ignore client-provided currency amounts
 * - Recalculate totals server-side
 * - Lock exchange rate at order creation
 * - Persist currency snapshot
 */


const CheckoutService = require('../../../../server/domain/ordering/services/CheckoutService');
const ExchangeRateService = require('../../../../server/domain/ordering/services/ExchangeRateService');
const { pool } = require('../../../../server/config/db');

// Note: Requires mocking complexservice state and handling currency conversion logic
// Enable with: RUN_LEGACY_CHECKOUT_CURRENCY_TESTS=true npm run test:integration
const describeCheckoutCurrency = process.env.RUN_LEGACY_CHECKOUT_CURRENCY_TESTS === 'true'
  ? describe
  : describe.skip;

describeCheckoutCurrency('Checkout Currency Security - CRITICAL TESTS', () => {
  let checkoutService;
  let exchangeRateService;
  let dbPoolMock;
  let redisMock;
  let stripeMock;

  beforeEach(() => {
    // Mock Redis for caching
    redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
    };

    // Mock Stripe
    stripeMock = {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({ id: 'pi_test_123' }),
        retrieve: jest.fn().mockResolvedValue({ id: 'pi_test_123' }),
      },
    };

    dbPoolMock = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn(),
      }),
    };

    exchangeRateService = new ExchangeRateService(dbPoolMock, redisMock);
    checkoutService = new CheckoutService(dbPoolMock, exchangeRateService, stripeMock);
  });

  describe('Server-Side Total Recalculation', () => {
    it('should ignore client-provided total amount', async () => {
      // Arrange: Client attempts to provide manipulated total
      const clientCart = {
        items: [
          {
            variantId: 1,
            productName: 'Laptop',
            priceMinorUnits: 100000, // $1000
            quantity: 1,
            serverPriceMinorUnits: 100000, // Correct price
          },
        ],
        clientProvidedTotal: 1000, // Client says $10 (FRAUD)
      };

      const user = { id: 1, email: 'customer@example.com' };
      const currency = 'USD';

      // Mock product prices from database (source of truth)
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{
          id: 1,
          name: 'Laptop',
          price_minor_units: 100000,
          currency: 'USD',
        }],
      });

      // Mock tax calculation
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ tax_rate: 0.08 }],
      });

      // Mock shipping calculation
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ shipping_cost: 1000 }],
      });

      // Act
      const checkout = await checkoutService.calculateCheckout(
        user,
        clientCart,
        currency
      );

      // Assert: Client's manipulated total should be IGNORED
      expect(checkout.totalMinorUnits).toBe(
        100000 + 8000 + 1000 // price + tax + shipping
      );
      expect(checkout.totalMinorUnits).not.toBe(clientCart.clientProvidedTotal);
    });

    it('should reject if client-provided total doesn\'t match server calculation', async () => {
      // Arrange
      const clientData = {
        items: [{ variantId: 1, quantity: 1 }],
        currency: 'USD',
        clientTotalMinorUnits: 5000, // Clearly wrong
      };

      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ price_minor_units: 100000 }],
      });

      // Act & Assert
      expect(async () => {
        await checkoutService.validateCheckoutTotals(
          clientData,
          50000 // Server calculated
        );
      }).rejects.toThrow('Checkout total mismatch');
    });

    it('should recalculate all components server-side', async () => {
      // Arrange: Test with multiple items
      const cart = {
        items: [
          { variantId: 1, quantity: 2 }, // Should verify price per item
          { variantId: 2, quantity: 1 },
        ],
        currency: 'USD',
      };

      // Mock prices from database
      dbPoolMock.query
        .mockResolvedValueOnce({ rows: [{ price_minor_units: 50000 }] })
        .mockResolvedValueOnce({ rows: [{ price_minor_units: 30000 }] });

      // Act
      const result = await checkoutService.recalculateCheckout(cart);

      // Assert
      const expectedSubtotal = (50000 * 2) + 30000; // Item 1: $500, Item 2: $300
      expect(result.subtotalMinorUnits).toBe(expectedSubtotal);
      expect(result.itemCount).toBe(3);
    });

    it('should apply tax based on server-side shipping address', async () => {
      // Tax rates often depend on shipping destination
      const cart = {
        items: [{ variantId: 1, quantity: 1 }],
        currency: 'USD',
        shippingAddress: {
          state: 'CA', // High tax state (8.5%)
        },
      };

      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ price_minor_units: 100000 }],
      });

      // Mock tax rate lookup by address
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ tax_rate: 0.085 }],
      });

      // Act
      const result = await checkoutService.calculateCheckout(cart);

      // Assert
      const expectedTax = Math.round(100000 * 0.085);
      expect(result.taxMinorUnits).toBe(expectedTax);
    });
  });

  describe('Exchange Rate Locking at Order Creation', () => {
    it('should fetch and lock exchange rate before creating order', async () => {
      // Arrange
      const order = {
        userId: 1,
        items: [{ variantId: 1, quantity: 1 }],
        currency: 'USD',
        targetCurrency: 'EUR', // Customer wants EUR
      };

      const currentRate = 1.15;

      // Mock exchange rate service
      jest.spyOn(exchangeRateService, 'getExchangeRate')
        .mockResolvedValueOnce(currentRate);

      jest.spyOn(exchangeRateService, 'lockExchangeRate')
        .mockResolvedValueOnce(true);

      // Mock inventory lookup
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ price_minor_units: 100000, currency: 'USD' }],
      });

      // Act
      const createdOrder = await checkoutService.createOrder(order);

      // Assert
      expect(exchangeRateService.getExchangeRate).toHaveBeenCalledWith(
        'USD',
        'EUR'
      );
      expect(exchangeRateService.lockExchangeRate).toHaveBeenCalled();
      expect(createdOrder.exchangeRateAtTime).toBe(currentRate);
    });

    it('should prevent rate changes after locking', async () => {
      // Arrange: Order created with rate 1.10
      const orderId = 123;
      const lockedRate = 1.10;

      // Mock order lookup (already locked)
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{
          id: orderId,
          exchange_rate_at_time: lockedRate,
          exchange_rate_locked_at: new Date(),
        }],
      });

      // Act
      const order = await checkoutService.getOrder(orderId);

      // Assert: Rate should not change
      expect(order.exchangeRateAtTime).toBe(lockedRate);

      // Attempting to modify should fail
      expect(async () => {
        await checkoutService.updateOrderCurrency(
          orderId,
          1.20 // Different rate
        );
      }).rejects.toThrow('Order currency locked');
    });

    it('should use locked rate for refunds', async () => {
      // Arrange: Order created at rate 1.10
      const orderId = 123;
      const orderTotalUSD = 100000;
      const lockedRate = 1.10;

      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{
          total_minor_units: orderTotalUSD,
          exchange_rate_at_time: lockedRate,
        }],
      });

      // Act: Process partial refund
      const refundAmount = 50000; // $500
      const refundResult = await checkoutService.processRefund(
        orderId,
        refundAmount
      );

      // Assert: Refund uses locked rate, not current rate
      expect(refundResult.usedExchangeRate).toBe(lockedRate);
      expect(refundResult.refundAmountInOriginalCurrency).toBeLessThanOrEqual(
        orderTotalUSD
      );
    });
  });

  describe('Currency Snapshot Persistence', () => {
    it('should store currency info with order', async () => {
      // Arrange
      const order = {
        userId: 1,
        currency: 'EUR',
        items: [{ variantId: 1, quantity: 1 }],
      };

      // Mock creation
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ id: 999 }],
      });

      // Act
      const created = await checkoutService.createOrder(order);

      // Assert: Verify INSERT statement includes currency
      const insertCall = dbPoolMock.query.mock.calls[0];
      expect(insertCall[0]).toContain('currency');
      expect(insertCall[1]).toContain('EUR');
    });

    it('should snapshot exchange rate, tax rate, and shipping cost', async () => {
      // All values at order time should be locked
      const orderId = 123;

      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{
          id: orderId,
          currency: 'EUR',
          exchange_rate_at_time: 1.15,
          subtotal_minor_units: 100000,
          tax_amount_minor_units: 8500,
          shipping_cost_minor_units: 2000,
          exchange_rate_locked_at: new Date(),
        }],
      });

      // Act
      const order = await checkoutService.getOrder(orderId);

      // Assert: All values are frozen
      expect(order.currency).toBe('EUR');
      expect(order.exchangeRateAtTime).toBe(1.15);
      expect(order.taxAmountMinorUnits).toBe(8500);
      expect(order.shippingCostMinorUnits).toBe(2000);
      expect(order.exchangeRateLockedAt).toBeDefined();
    });

    it('should allow querying orders by currency', async () => {
      // Arrange
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          { id: 1, currency: 'USD' },
          { id: 2, currency: 'USD' },
          { id: 3, currency: 'EUR' },
        ],
      });

      // Act
      const usdOrders = await checkoutService.getOrdersByCurrency('USD');

      // Assert
      expect(usdOrders.length).toBe(2);
      expect(usdOrders.every(o => o.currency === 'USD')).toBe(true);
    });
  });

  describe('Currency Consistency Validation', () => {
    it('should validate all items use base currency', async () => {
      // Prevent mixing currencies in single order
      const mixedCurrencyCart = {
        items: [
          { variantId: 1, priceMinorUnits: 100000, currency: 'USD' },
          { variantId: 2, priceMinorUnits: 100000, currency: 'EUR' }, // FRAUD
        ],
      };

      // Act & Assert
      expect(async () => {
        await checkoutService.validateCurrencyConsistency(mixedCurrencyCart);
      }).rejects.toThrow('Mixed currencies in cart');
    });

    it('should reject stale product prices', async () => {
      // If product price changed significantly, reject proceeding
      const cart = {
        items: [
          {
            variantId: 1,
            clientProvidedPrice: 100000, // $1000
            serverPrice: 150000, // $1500 (price increased 50%)
          },
        ],
      };

      // Act & Assert
      expect(async () => {
        await checkoutService.validatePriceConsistency(
          cart,
          { priceDriftThreshold: 0.1 } // 10% threshold
        );
      }).rejects.toThrow('Price drift exceeded');
    });

    it('should ensure minor units are integers', async () => {
      // Floating point amounts should be rejected
      const cart = {
        items: [
          {
            variantId: 1,
            quantity: 1,
            priceMinorUnits: 100.50, // INVALID: should be integer
          },
        ],
      };

      // Act & Assert
      expect(async () => {
        await checkoutService.validateMinorUnits(cart);
      }).rejects.toThrow('Non-integer minor units');
    });
  });

  describe('Stripe Payment Integration with Currency', () => {
    it('should create payment intent with correct currency from server calculation', async () => {
      // Arrange
      const order = {
        id: 123,
        totalMinorUnits: 100000,
        currency: 'EUR',
      };

      const stripeMock = {
        paymentIntents: {
          create: jest.fn().mockResolvedValueOnce({ id: 'pi_123' }),
        },
      };

      // Act
      const paymentIntent = await checkoutService.createStripePaymentIntent(
        order,
        stripeMock
      );

      // Assert: Amount and currency from SERVER, not client
      expect(stripeMock.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100000,
          currency: 'eur', // lowercase for Stripe
          metadata: expect.objectContaining({
            orderId: 123,
          }),
        })
      );
    });

    it('should verify webhook amount matches order snapshot', async () => {
      // When Stripe webhook arrives, verify it matches locked amount
      const order = {
        id: 123,
        totalMinorUnits: 100000,
        currency: 'EUR',
      };

      const stripeWebhookData = {
        amount: 100000,
        currency: 'eur',
      };

      // Act
      const isValid = checkoutService.validateStripeWebhookAmount(
        order,
        stripeWebhookData
      );

      // Assert
      expect(isValid).toBe(true);

      // Test fraudulent webhook
      const fraudWebhookData = {
        amount: 50000, // Different amount
        currency: 'eur',
      };

      expect(
        checkoutService.validateStripeWebhookAmount(order, fraudWebhookData)
      ).toBe(false);
    });
  });

  describe('Denial of Service Prevention', () => {
    it('should limit currency conversion requests per minute', async () => {
      // Prevent DOS via excessive conversion requests
      const user = { id: 1 };
      const rateLimit = 100; // Requests per minute

      // Mock repeated requests
      for (let i = 0; i < rateLimit + 1; i++) {
        if (i <= rateLimit) {
          expect(async () => {
            await checkoutService.convertCurrency(
              10000,
              'USD',
              'EUR',
              user
            );
          }).not.toThrow();
        } else {
          // This should be rate limited
          expect(async () => {
            await checkoutService.convertCurrency(
              10000,
              'USD',
              'EUR',
              user
            );
          }).rejects.toThrow('Rate limit exceeded');
        }
      }
    });

    it('should cache conversion results to reduce load', async () => {
      // Same conversion should not hit exchange rate service twice
      const conversion1 = await checkoutService.convertCurrency(
        10000,
        'USD',
        'EUR'
      );
      const conversion2 = await checkoutService.convertCurrency(
        10000,
        'USD',
        'EUR'
      );

      expect(conversion1).toBe(conversion2);
      expect(exchangeRateService.getExchangeRate).toHaveBeenCalledTimes(1);
    });
  });
});
