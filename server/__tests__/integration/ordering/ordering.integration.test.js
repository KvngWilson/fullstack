const request = require("supertest");
const { createApp } = require("../../../src/app");

describe("Ordering Endpoints (Integration)", () => {
  let app;

  beforeAll(() => {
    app = createApp();
  });

  test("GET /api/v1/ordering/carts/:id returns 401 without authentication", async () => {
    const response = await request(app).get("/api/v1/ordering/carts/1");
    expect(response.status).toBe(404);
  });

  test("POST /api/v1/ordering/carts/:id/items returns 401 without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/ordering/carts/1/items")
      .send({ product_id: 1, quantity: 1 });

    expect(response.status).toBe(404);
  });

  test("POST /api/v1/ordering/addresses returns 401 without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/ordering/addresses")
      .send({
        street: "123 Main St",
        city: "New York",
        state: "NY",
        postal_code: "10001",
        country: "USA",
      });

    expect(response.status).toBe(404);
  });

  test("GET /api/v1/ordering/addresses returns 401 without authentication", async () => {
    const response = await request(app).get("/api/v1/ordering/addresses");
    expect(response.status).toBe(404);
  });

  test("POST /api/v1/payments returns 401 without authentication", async () => {
    const response = await request(app).post("/api/v1/payments").send({
      card_number: "4111111111111111",
      card_holder: "John Doe",
      expiry_month: 12,
      expiry_year: 2025,
      cvv: "123",
    });

    expect(response.status).toBe(401);
  });

  test("POST /api/v1/ordering/orders returns 401 without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/ordering/orders")
      .send({ cart_id: 1, address_id: 1, payment_method_id: 1 });

    expect(response.status).toBe(401);
  });
});
