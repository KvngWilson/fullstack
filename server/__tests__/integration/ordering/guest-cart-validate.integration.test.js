const request = require("supertest");

const mockValidateGuestCart = jest.fn();

jest.mock("../../../api/decorators/guest", () => ({
  guestOnly: () => [
    (req, _res, next) => {
      req.guest = { token: "test-guest-token" };
      next();
    },
  ],
}));

jest.mock("../../../domain/ordering/services/GuestCartService", () => {
  return jest.fn().mockImplementation(() => ({
    validateGuestCart: mockValidateGuestCart,
  }));
});

const { createApp } = require("../../../src/app");

describe("Guest Cart Validate API", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it("returns 400 with error details when cart validation fails", async () => {
    mockValidateGuestCart.mockResolvedValueOnce({
      valid: false,
      error: "Cart validation failed",
      details: [
        {
          type: "price_changed",
          variantId: 101,
          previousPrice: 10,
          currentPrice: 12.5,
        },
      ],
    });

    const response = await request(app)
      .post("/api/v1/guest/cart/validate")
      .set("x-guest-token", "test-guest-token")
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        error: "Cart validation failed",
        details: expect.arrayContaining([
          expect.objectContaining({
            type: "price_changed",
            variantId: 101,
          }),
        ]),
      }),
    );
  });

  it("returns 200 when cart validation succeeds", async () => {
    mockValidateGuestCart.mockResolvedValueOnce({ valid: true });

    const response = await request(app)
      .post("/api/v1/guest/cart/validate")
      .set("x-guest-token", "test-guest-token")
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        valid: true,
        message: "Cart is valid",
      }),
    );
  });
});
