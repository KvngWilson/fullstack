const ExchangeRateService = require("../../../../domain/ordering/services/ExchangeRateService");

describe("ExchangeRateService", () => {
  let db;
  let redis;
  let service;

  beforeEach(() => {
    db = {
      query: jest.fn(),
    };

    redis = {
      get: jest.fn(),
      set: jest.fn(),
      keys: jest.fn(),
      del: jest.fn(),
    };

    service = new ExchangeRateService(db, redis, { cacheTTL: 3600 });
  });

  test("converts minor units using precision-safe fixed-point arithmetic", async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue("OK");
    db.query.mockResolvedValue({
      rows: [{ rate: "1.23456789", expires_at: new Date(Date.now() + 5 * 60 * 1000) }],
    });

    const converted = await service.convertCurrency(1999, "usd", "eur");

    expect(converted).toBe(2468);
  });

  test("uses cached rates when available and avoids DB query", async () => {
    redis.get.mockResolvedValue("1.25000000");

    const rate = await service.getExchangeRate("usd", "eur");

    expect(rate).toBe(1.25);
    expect(db.query).not.toHaveBeenCalled();
  });

  test("writes cache with bounded TTL from expiry", async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue("OK");

    const expiresSoon = new Date(Date.now() + 90 * 1000);
    db.query.mockResolvedValue({
      rows: [{ rate: "0.87654321", expires_at: expiresSoon }],
    });

    await service.getExchangeRate("GBP", "USD");

    expect(redis.set).toHaveBeenCalled();
    const [, , options] = redis.set.mock.calls[0];
    expect(options.EX).toBeGreaterThanOrEqual(60);
    expect(options.EX).toBeLessThanOrEqual(3600);
  });
});
