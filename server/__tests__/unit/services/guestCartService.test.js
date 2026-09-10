jest.mock("../../../config/redis", () => ({
  redisClient: {
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock("../../../config/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock("../../../shared/utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const GuestCartService = require("../../../domain/ordering/services/GuestCartService");
const { redisClient } = require("../../../config/redis");
const { pool } = require("../../../config/db");

describe("GuestCartService.validateGuestCart", () => {
  let service;
  const token = "abcdef1234567890abcdef1234567890";

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GuestCartService();
  });

  it("returns invalid when cart is empty", async () => {
    redisClient.get.mockResolvedValueOnce(
      JSON.stringify({ token, items: [], createdAt: new Date().toISOString() }),
    );

    const result = await service.validateGuestCart(token);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Cart is empty");
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("returns invalid when item price changed", async () => {
    redisClient.get.mockResolvedValueOnce(
      JSON.stringify({
        token,
        items: [
          {
            productVariantId: 101,
            productId: 11,
            name: "Item A",
            price: 10.0,
            quantity: 2,
          },
        ],
      }),
    );

    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 101,
          product_id: 11,
          price: 12.5,
          stock: 20,
          sku: "SKU-101",
          name: "Item A",
        },
      ],
    });

    const result = await service.validateGuestCart(token);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Cart validation failed");
    expect(result.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "price_changed",
          variantId: 101,
          previousPrice: 10,
          currentPrice: 12.5,
        }),
      ]),
    );
  });

  it("returns invalid when stock is insufficient", async () => {
    redisClient.get.mockResolvedValueOnce(
      JSON.stringify({
        token,
        items: [
          {
            productVariantId: 202,
            productId: 22,
            name: "Item B",
            price: 19.99,
            quantity: 5,
          },
        ],
      }),
    );

    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 202,
          product_id: 22,
          price: 19.99,
          stock: 3,
          sku: "SKU-202",
          name: "Item B",
        },
      ],
    });

    const result = await service.validateGuestCart(token);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Cart validation failed");
    expect(result.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "insufficient_stock",
          variantId: 202,
          requested: 5,
          available: 3,
        }),
      ]),
    );
  });

  it("returns valid when all items are available and unchanged", async () => {
    redisClient.get.mockResolvedValueOnce(
      JSON.stringify({
        token,
        items: [
          {
            productVariantId: 303,
            productId: 33,
            name: "Item C",
            price: 49.99,
            quantity: 1,
          },
        ],
      }),
    );

    pool.query.mockResolvedValueOnce({
      rows: [
        {
          id: 303,
          product_id: 33,
          price: 49.99,
          stock: 12,
          sku: "SKU-303",
          name: "Item C",
        },
      ],
    });

    const result = await service.validateGuestCart(token);

    expect(result).toEqual({ valid: true });
  });
});
