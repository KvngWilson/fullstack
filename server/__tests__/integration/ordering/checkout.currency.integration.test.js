/**
 * Checkout Currency Security Tests
 * Verifies the current CheckoutService and ExchangeRateService contracts.
 */

jest.mock(
  "../../../../server/domain/ordering/services/ShippingService",
  () => ({
    getShippingRates: jest.fn(),
  }),
);

jest.mock("../../../../server/domain/ordering/services/TaxService", () => ({
  calculateFromMinor: jest.fn(),
}));

const CheckoutService = require("../../../../server/domain/ordering/services/CheckoutService");
const ExchangeRateService = require("../../../../server/domain/ordering/services/ExchangeRateService");
const {
  getShippingRates,
} = require("../../../../server/domain/ordering/services/ShippingService");
const taxService = require("../../../../server/domain/ordering/services/TaxService");

describe("Checkout Currency Security - CRITICAL TESTS", () => {
  let checkoutService;
  let exchangeRateService;
  let dbPoolMock;
  let redisMock;
  let stripeMock;

  beforeEach(() => {
    redisMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue("OK"),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
    };

    stripeMock = {
      createPaymentIntent: jest.fn().mockResolvedValue({ id: "pi_test_123" }),
    };

    dbPoolMock = {
      query: jest.fn(),
      connect: jest.fn().mockResolvedValue({
        query: jest.fn(),
        release: jest.fn(),
      }),
    };

    getShippingRates.mockReset();
    taxService.calculateFromMinor.mockReset();

    exchangeRateService = new ExchangeRateService(dbPoolMock, redisMock);
    checkoutService = new CheckoutService(
      dbPoolMock,
      exchangeRateService,
      stripeMock,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Server-Side Total Recalculation", () => {
    it("should ignore client-provided total amount and recalculate from server data", async () => {
      dbPoolMock.query
        .mockResolvedValueOnce({
          rows: [
            {
              city: "Los Angeles",
              state: "CA",
              postal_code: "90001",
              country: "US",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              cart_id: 1,
              item_id: 1,
              quantity: 1,
              product_id: 1,
              name: "Laptop",
              variant_id: 10,
              sku: "LAPTOP-1",
              price_minor_units: 100000,
              item_currency: "USD",
              description: "Gaming laptop",
              weight: 1.5,
            },
          ],
        });

      taxService.calculateFromMinor.mockResolvedValueOnce(8000);
      getShippingRates.mockResolvedValueOnce({
        success: true,
        rates: [{ totalChargeMinor: 1000 }],
      });

      const checkout = await checkoutService.calculateCheckout(
        { id: 1, email: "customer@example.com" },
        { clientTotalMinorUnits: 1000 },
        "USD",
        77,
      );

      expect(checkout.subtotal).toBe(100000);
      expect(checkout.tax).toBe(8000);
      expect(checkout.shipping).toBe(1000);
      expect(checkout.total).toBe(109000);
    });

    it("should reject if client-provided total does not match the server calculation", () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

      expect(() =>
        checkoutService.validateCheckoutTotals(
          { total: 5000, currency: "USD" },
          { total: 50000, currency: "USD" },
        ),
      ).toThrow(
        "Checkout totals do not match server calculation. Your cart may have changed. Please refresh.",
      );

      expect(warnSpy).toHaveBeenCalled();
    });

    it("should recalculate all components from cart items using current service fields", async () => {
      const result = await checkoutService.recalculateCheckout({
        items: [
          { priceMinorUnits: 50000, quantity: 2, weight: 1 },
          { priceMinorUnits: 30000, quantity: 1, weight: 0.5 },
        ],
      });

      expect(result.subtotal).toBe(130000);
      expect(result.tax).toBe(Math.round(130000 * 0.085));
      expect(result.shipping).toBe(0);
      expect(result.total).toBe(result.subtotal + result.tax);
    });

    it("should apply tax based on the server-side shipping address", async () => {
      dbPoolMock.query
        .mockResolvedValueOnce({
          rows: [
            {
              city: "San Diego",
              state: "CA",
              postal_code: "92101",
              country: "US",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              cart_id: 1,
              item_id: 1,
              quantity: 1,
              product_id: 1,
              name: "Laptop",
              variant_id: 10,
              sku: "LAPTOP-1",
              price_minor_units: 100000,
              item_currency: "USD",
              description: "Gaming laptop",
              weight: 1.5,
            },
          ],
        });

      taxService.calculateFromMinor.mockResolvedValueOnce(8500);
      getShippingRates.mockResolvedValueOnce({
        success: true,
        rates: [{ totalChargeMinor: 1500 }],
      });

      const result = await checkoutService.calculateCheckout(
        { id: 1 },
        { items: [{ variantId: 10, quantity: 1 }] },
        "USD",
        99,
      );

      expect(taxService.calculateFromMinor).toHaveBeenCalledWith(
        100000,
        expect.objectContaining({
          currency: "USD",
          address: expect.objectContaining({ state: "CA" }),
          userId: 1,
        }),
      );
      expect(result.tax).toBe(8500);
    });
  });

  describe("Exchange Rate Locking at Order Creation", () => {
    it("should fetch and lock the exchange rate through the exchange rate service", async () => {
      jest
        .spyOn(exchangeRateService, "getExchangeRate")
        .mockResolvedValueOnce(1.15);
      jest
        .spyOn(exchangeRateService, "lockExchangeRate")
        .mockResolvedValueOnce({
          orderId: "order-123",
          rate: 1.15,
          lockedAt: new Date("2026-01-01T00:00:00Z"),
        });

      const locked = await checkoutService.lockExchangeRate(
        "order-123",
        "EUR",
        100000,
      );

      expect(exchangeRateService.getExchangeRate).toHaveBeenCalledWith(
        "USD",
        "EUR",
      );
      expect(exchangeRateService.lockExchangeRate).toHaveBeenCalledWith(
        "order-123",
        "USD",
        "EUR",
        1.15,
        100000,
      );
      expect(locked.rate).toBe(1.15);
    });

    it("should expose the locked exchange rate from the stored order snapshot", async () => {
      const lockedAt = new Date("2026-01-01T00:00:00Z");
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          {
            id: 123,
            user_id: 1,
            currency: "EUR",
            subtotal_minor_units: 100000,
            tax_minor_units: 8500,
            shipping_minor_units: 2000,
            total_minor_units: 110500,
            exchange_rate: 1.1,
            created_at: lockedAt,
          },
        ],
      });

      const order = await checkoutService.getOrder(123);

      expect(order.exchangeRateAtTime).toBe(1.1);
      expect(order.exchangeRateLockedAt).toBe(lockedAt);
    });

    it("should use the locked rate snapshot for refunds", async () => {
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          {
            id: 123,
            user_id: 1,
            currency: "EUR",
            subtotal_minor_units: 100000,
            tax_minor_units: 8500,
            shipping_minor_units: 2000,
            total_minor_units: 110500,
            exchange_rate: 1.1,
            created_at: new Date(),
          },
        ],
      });

      const refundResult = await checkoutService.processRefund(123, 50000);

      expect(refundResult.exchangeRateUsed).toBe(1.1);
      expect(refundResult.refundAmount).toBe(50000);
      expect(refundResult.currency).toBe("EUR");
    });
  });

  describe("Currency Snapshot Persistence", () => {
    it("should store currency information with the order snapshot", async () => {
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          {
            id: 999,
            user_id: 1,
            currency: "EUR",
            subtotal_minor_units: 100000,
            tax_minor_units: 8500,
            shipping_minor_units: 2000,
            total_minor_units: 110500,
            exchange_rate: 1.15,
            created_at: new Date(),
          },
        ],
      });

      const created = await checkoutService.createOrder({
        userId: 1,
        currency: "EUR",
        subtotal: 100000,
        tax: 8500,
        shipping: 2000,
        total: 110500,
        exchangeRate: 1.15,
      });

      const insertCall = dbPoolMock.query.mock.calls[0];
      expect(insertCall[0]).toContain("currency");
      expect(insertCall[1]).toContain("EUR");
      expect(created.exchangeRateAtTime).toBe(1.15);
    });

    it("should return frozen exchange rate, tax, and shipping values from the order snapshot", async () => {
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          {
            id: 123,
            user_id: 1,
            currency: "EUR",
            subtotal_minor_units: 100000,
            tax_minor_units: 8500,
            shipping_minor_units: 2000,
            total_minor_units: 110500,
            exchange_rate: 1.15,
            created_at: new Date(),
          },
        ],
      });

      const order = await checkoutService.getOrder(123);

      expect(order.currency).toBe("EUR");
      expect(order.exchangeRateAtTime).toBe(1.15);
      expect(order.taxAmountMinorUnits).toBe(8500);
      expect(order.shippingCostMinorUnits).toBe(2000);
    });

    it("should allow querying orders by currency", async () => {
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            currency: "USD",
            subtotal_minor_units: 100,
            tax_minor_units: 8,
            shipping_minor_units: 2,
            total_minor_units: 110,
            exchange_rate: 1,
            created_at: new Date(),
          },
          {
            id: 2,
            currency: "USD",
            subtotal_minor_units: 200,
            tax_minor_units: 16,
            shipping_minor_units: 4,
            total_minor_units: 220,
            exchange_rate: 1,
            created_at: new Date(),
          },
        ],
      });

      const usdOrders = await checkoutService.getOrdersByCurrency("USD");

      expect(usdOrders).toHaveLength(2);
      expect(usdOrders.every((order) => order.currency === "USD")).toBe(true);
    });
  });

  describe("Currency Consistency Validation", () => {
    it("should reject carts containing multiple item currencies", async () => {
      dbPoolMock.query
        .mockResolvedValueOnce({
          rows: [
            {
              city: "New York",
              state: "NY",
              postal_code: "10001",
              country: "US",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              cart_id: 1,
              item_id: 1,
              quantity: 1,
              product_id: 1,
              name: "Laptop",
              variant_id: 10,
              sku: "LAPTOP-1",
              price_minor_units: 100000,
              item_currency: "USD",
              description: "Gaming laptop",
              weight: 1.5,
            },
            {
              cart_id: 1,
              item_id: 2,
              quantity: 1,
              product_id: 2,
              name: "Monitor",
              variant_id: 11,
              sku: "MONITOR-1",
              price_minor_units: 50000,
              item_currency: "EUR",
              description: "4K monitor",
              weight: 2,
            },
          ],
        });

      await expect(
        checkoutService.calculateCheckout({ id: 1 }, { items: [] }, "USD", 9),
      ).rejects.toThrow(
        "Cart contains items in multiple currencies - cannot proceed",
      );
    });

    it("should reject stale product prices above the drift threshold", async () => {
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [
          { id: 10, price_minor_units: 150000, currency: "USD", product_id: 1 },
        ],
      });

      await expect(
        checkoutService.validateCurrencyConsistency(
          [{ variant_id: 10, product_id: 1, price_minor_units: 100000 }],
          "EUR",
        ),
      ).rejects.toThrow("Price changed >10%");
    });

    it("should reject non-integer database prices during checkout calculation", async () => {
      dbPoolMock.query
        .mockResolvedValueOnce({
          rows: [
            {
              city: "New York",
              state: "NY",
              postal_code: "10001",
              country: "US",
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              cart_id: 1,
              item_id: 1,
              quantity: 1,
              product_id: 1,
              name: "Laptop",
              variant_id: 10,
              sku: "LAPTOP-1",
              price_minor_units: 100.5,
              item_currency: "USD",
              description: "Gaming laptop",
              weight: 1.5,
            },
          ],
        });

      await expect(
        checkoutService.calculateCheckout({ id: 1 }, { items: [] }, "USD", 9),
      ).rejects.toThrow("Invalid price for product 1");
    });
  });

  describe("Stripe Payment Integration with Currency", () => {
    it("should create a payment intent from the server-calculated amount and currency", async () => {
      const paymentIntent = await checkoutService.createStripePaymentIntent(
        1,
        { total: 100000, currency: "EUR" },
        { orderId: 123 },
      );

      expect(stripeMock.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 100000,
          currency: "eur",
          customer: 1,
          metadata: expect.objectContaining({
            orderId: 123,
            userId: 1,
            currency: "EUR",
          }),
        }),
      );
      expect(paymentIntent.id).toBe("pi_test_123");
    });

    it("should verify webhook amount and currency against the stored order snapshot", () => {
      expect(
        checkoutService.validateStripeWebhookAmount(
          { total_minor_units: 100000, currency: "EUR" },
          { amount: 100000, currency: "eur" },
        ),
      ).toBe(true);

      expect(() =>
        checkoutService.validateStripeWebhookAmount(
          { total_minor_units: 100000, currency: "EUR" },
          { amount: 50000, currency: "eur" },
        ),
      ).toThrow("Webhook amount mismatch - suspected fraud");
    });
  });

  describe("Denial of Service Prevention", () => {
    it("should enforce the per-user conversion rate limit", () => {
      for (let i = 0; i < 100; i++) {
        expect(checkoutService.checkConversionRateLimit(1)).toBe(true);
      }

      expect(() => checkoutService.checkConversionRateLimit(1)).toThrow(
        "Rate limit exceeded: maximum 100 conversions per minute",
      );
    });

    it("should cache exchange rate lookups to reduce load", async () => {
      const expiresAt = new Date(Date.now() + 60_000).toISOString();
      redisMock.get
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce("1.25000000");
      dbPoolMock.query.mockResolvedValueOnce({
        rows: [{ rate: 1.25, expires_at: expiresAt }],
      });

      const conversion1 = await checkoutService.convertCurrency(
        10000,
        "USD",
        "EUR",
      );
      const conversion2 = await checkoutService.convertCurrency(
        10000,
        "USD",
        "EUR",
      );

      expect(conversion1).toBe(12500);
      expect(conversion2).toBe(12500);
      expect(dbPoolMock.query).toHaveBeenCalledTimes(1);
      expect(redisMock.set).toHaveBeenCalledTimes(1);
    });
  });
});
