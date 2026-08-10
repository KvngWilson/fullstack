const request = require("supertest");
const { pool } = require("../../../config/db");
const { redisClient } = require("../../../config/redis");
const GuestCartService = require("../../../domain/ordering/services/GuestCartService");
const { createApp } = require("../../../src/app");

const shouldRun = process.env.RUN_E2E_GUEST_CART_VALIDATE_TESTS === "true";
const describeE2E = shouldRun ? describe : describe.skip;

describeE2E("Guest Cart Validate (E2E)", () => {
  const app = createApp();
  const service = new GuestCartService();
  const runId = Date.now();

  let productId;
  let variantPriceChangeId;
  let variantStockId;
  let infraReady = true;

  const tokenPrice = `guest-price-${runId}`;
  const tokenStock = `guest-stock-${runId}`;

  const cleanupRedis = async () => {
    const keys = [
      `guest_cart:${tokenPrice}`,
      `guest_session:${tokenPrice}`,
      `guest_cart:${tokenStock}`,
      `guest_session:${tokenStock}`,
    ];

    for (const key of keys) {
      try {
        await redisClient.del(key);
      } catch (error) {
      }
    }
  };

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      infraReady = false;
      return;
    }

    try {
      await redisClient.setEx(`guest_session:probe-${runId}`, 10, JSON.stringify({ ok: true }));
      await redisClient.del(`guest_session:probe-${runId}`);

      const productResult = await pool.query(
        "INSERT INTO products (name, description, base_price, category) VALUES ($1, $2, $3, $4) RETURNING id",
        ["Guest E2E Product", "Guest validation product", 99.99, "electronics"],
      );
      productId = productResult.rows[0].id;

      const variantPriceResult = await pool.query(
        "INSERT INTO product_variants (product_id, sku, price, stock, attributes) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [productId, `GUEST-PRICE-${runId}`, 99.99, 20, JSON.stringify({ size: "M" })],
      );
      variantPriceChangeId = variantPriceResult.rows[0].id;

      const variantStockResult = await pool.query(
        "INSERT INTO product_variants (product_id, sku, price, stock, attributes) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [productId, `GUEST-STOCK-${runId}`, 49.99, 1, JSON.stringify({ size: "L" })],
      );
      variantStockId = variantStockResult.rows[0].id;

      await service.createGuestCart(tokenPrice);
      await service.createGuestCart(tokenStock);
    } catch (error) {
      infraReady = false;
    }
  });

  afterAll(async () => {
    if (!infraReady) return;

    await cleanupRedis();

    if (variantPriceChangeId) {
      await pool.query("DELETE FROM product_variants WHERE id = $1", [variantPriceChangeId]);
    }
    if (variantStockId) {
      await pool.query("DELETE FROM product_variants WHERE id = $1", [variantStockId]);
    }
    if (productId) {
      await pool.query("DELETE FROM products WHERE id = $1", [productId]);
    }
  });

  test("returns price_changed detail when DB price differs from cart price", async () => {
    if (!infraReady) return;

    await request(app)
      .post("/api/v1/guest/cart/add")
      .set("x-guest-token", tokenPrice)
      .send({
        productVariantId: variantPriceChangeId,
        quantity: 1,
        price: 70.0,
        name: "Guest E2E Product",
        sku: `GUEST-PRICE-${runId}`,
      })
      .expect(201);

    const response = await request(app)
      .post("/api/v1/guest/cart/validate")
      .set("x-guest-token", tokenPrice)
      .send({})
      .expect(400);

    expect(response.body.error).toBe("Cart validation failed");
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "price_changed",
          variantId: variantPriceChangeId,
        }),
      ]),
    );
  });

  test("returns insufficient_stock detail when requested quantity exceeds stock", async () => {
    if (!infraReady) return;

    await request(app)
      .post("/api/v1/guest/cart/add")
      .set("x-guest-token", tokenStock)
      .send({
        productVariantId: variantStockId,
        quantity: 3,
        price: 49.99,
        name: "Guest E2E Product",
        sku: `GUEST-STOCK-${runId}`,
      })
      .expect(201);

    const response = await request(app)
      .post("/api/v1/guest/cart/validate")
      .set("x-guest-token", tokenStock)
      .send({})
      .expect(400);

    expect(response.body.error).toBe("Cart validation failed");
    expect(response.body.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "insufficient_stock",
          variantId: variantStockId,
        }),
      ]),
    );
  });
});
