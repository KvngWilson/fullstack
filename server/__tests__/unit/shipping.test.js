const mockGetShippingRates = jest.fn();

jest.mock("../../domain/shipping/services/ShippingCacheService", () => {
  return jest.fn().mockImplementation(() => ({
    getShippingRates: mockGetShippingRates,
  }));
});

jest.mock("../../infrastructure/cache/ShippingCacheClient", () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock("../../infrastructure/shipping/EasyshipGateway", () => {
  return jest.fn().mockImplementation(() => ({}));
});

jest.mock("../../config/redis", () => ({
  redisClient: {},
}));

const {
  getShippingRates,
} = require("../../domain/ordering/services/ShippingService");

describe("Shipping Service - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getShippingRates", () => {
    const destination = {
      country_code: "US",
      city: "New York",
      postal_code: "10001",
      state: "NY",
    };

    const items = [
      {
        product_variant_id: 1,
        quantity: 1,
        weight: 0.5,
      },
    ];

    it("returns success with rates from ShippingCacheService", async () => {
      const rates = [
        {
          courierId: "ups-ground",
          courierName: "UPS",
          serviceName: "Ground",
          totalChargeMinor: 1599,
          currency: "USD",
          minDeliveryDays: 3,
          maxDeliveryDays: 5,
        },
      ];

      mockGetShippingRates.mockResolvedValueOnce(rates);

      const result = await getShippingRates({
        destination,
        items,
        vendorId: 12,
      });

      expect(result.success).toBe(true);
      expect(result.rates).toEqual(rates);
      expect(mockGetShippingRates).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorId: 12,
          cartItems: items,
          address: destination,
          currency: "USD",
        }),
      );
    });

    it("defaults vendorId when none is provided", async () => {
      mockGetShippingRates.mockResolvedValueOnce([]);

      const result = await getShippingRates({ destination, items });

      expect(result.success).toBe(true);
      expect(mockGetShippingRates).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorId: 1,
        }),
      );
    });

    it("returns failure when destination is missing", async () => {
      const result = await getShippingRates({ items });

      expect(result.success).toBe(false);
      expect(result.rates).toEqual([]);
      expect(result.message).toContain("Destination address is required");
    });

    it("returns failure when ShippingCacheService throws", async () => {
      mockGetShippingRates.mockRejectedValueOnce(
        new Error("shipping backend failure"),
      );

      const result = await getShippingRates({
        destination,
        items,
        vendorId: 12,
      });

      expect(result.success).toBe(false);
      expect(result.rates).toEqual([]);
      expect(result.message).toContain("shipping backend failure");
    });
  });
});
