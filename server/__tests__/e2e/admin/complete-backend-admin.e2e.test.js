const request = require("supertest");
const { createApp } = require("../../../src/app");
const { pool } = require("../../../config/db");
const {
  createDbInfraGuard,
  createTestProduct,
  createTestVariant,
} = require("../../helpers/testHelpers");

function getCookieValue(setCookieHeader, cookieName) {
  if (!Array.isArray(setCookieHeader)) {
    return null;
  }

  const cookie = setCookieHeader.find((entry) =>
    entry.startsWith(`${cookieName}=`),
  );
  if (!cookie) {
    return null;
  }

  return cookie.split(";")[0].slice(cookieName.length + 1);
}

describe("Complete Backend E2E - Core Smoke Flow", () => {
  const app = createApp();
  const runId = Date.now();
  const { disable, isReady, dbTest } = createDbInfraGuard();

  let customerEmail;
  let customerToken;
  let productId;
  let variantId;

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    customerEmail = `customer-${runId}@test.com`;

    try {
      const product = await createTestProduct({
        name: "Smoke Product",
        description: "Product for smoke e2e",
        base_price: 149.99,
        category: "electronics",
      });
      productId = product.id;

      const variant = await createTestVariant(productId, {
        sku: `SMOKE-SKU-${runId}`,
        price: 149.99,
        stock: 100,
        color: "black",
      });
      variantId = variant.id;
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;

    await pool.query(
      "DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))",
      [`%${runId}%`],
    );
    await pool.query(
      "DELETE FROM carts WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)",
      [`%${runId}%`],
    );
    await pool.query(
      "DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))",
      [`%${runId}%`],
    );
    await pool.query(
      "DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1))",
      [`%${runId}%`],
    );
    await pool.query(
      "DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)",
      [`%${runId}%`],
    );
    await pool.query("DELETE FROM product_variants WHERE id = $1", [variantId]);
    await pool.query("DELETE FROM products WHERE id = $1", [productId]);
    await pool.query("DELETE FROM users WHERE email LIKE $1", [`%${runId}%`]);
  });

  dbTest("customer can register and login via auth endpoints", async () => {
    const registerResponse = await request(app)
      .post("/api/v1/auth/register")
      .send({
        email: customerEmail,
        password: "SecurePass123!",
        confirm_password: "SecurePass123!",
        first_name: "Smoke",
        last_name: "Customer",
        accept_terms: true,
      });

    expect(registerResponse.status).toBe(201);
    expect(registerResponse.body.success).toBe(true);
    expect(registerResponse.body.user?.email).toBe(customerEmail);

    const loginResponse = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: customerEmail, password: "SecurePass123!" });

    expect(loginResponse.status).toBe(200);
    customerToken = getCookieValue(
      loginResponse.headers["set-cookie"],
      "token",
    );
    expect(customerToken).toBeDefined();
    expect(loginResponse.body.user?.email).toBe(customerEmail);
  });

  dbTest("catalog endpoints are reachable", async () => {
    const listResponse = await request(app).get(
      "/api/v1/catalog/products?page=1&limit=20",
    );
    expect(listResponse.status).toBe(200);
    expect(Array.isArray(listResponse.body.data)).toBe(true);

    const detailResponse = await request(app).get(
      `/api/v1/catalog/products/${productId}`,
    );
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.id).toBe(productId);
  });

  dbTest(
    "cart and ordering endpoints enforce auth and/or respond consistently",
    async () => {
      const cartNoAuth = await request(app).get("/api/v1/ordering/cart");
      expect(cartNoAuth.status).toBe(401);

      if (customerToken) {
        const addResponse = await request(app)
          .post("/api/v1/ordering/cart/items")
          .set("Authorization", `Bearer ${customerToken}`)
          .send({ product_variant_id: variantId, quantity: 1 });

        expect(addResponse.status).toBe(201);
        expect(addResponse.body.success).toBe(true);
      }

      const orderingProbe = await request(app).get("/api/v1/ordering/carts/1");
      expect(orderingProbe.status).toBe(404);
    },
  );

  dbTest("admin endpoints are protected", async () => {
    const adminRoutes = [
      "/api/v1/admin/dashboard",
      "/api/v1/admin/orders",
      "/api/v1/admin/users",
    ];

    for (const route of adminRoutes) {
      const response = await request(app).get(route);
      expect(response.status).toBe(401);
    }
  });
});
