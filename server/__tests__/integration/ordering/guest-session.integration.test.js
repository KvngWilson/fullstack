const request = require("supertest");

const mockVerifyToken = jest.fn();
const mockCreateGuestCart = jest.fn();
const mockGetGuestSession = jest.fn();

jest.mock("../../../config/auth", () => {
  const actual = jest.requireActual("../../../config/auth");
  return {
    ...actual,
    verifyToken: (...args) => mockVerifyToken(...args),
  };
});

jest.mock("../../../domain/ordering/services/GuestCartService", () => {
  return jest.fn().mockImplementation(() => ({
    createGuestCart: mockCreateGuestCart,
    getGuestSession: mockGetGuestSession,
    saveGuestSession: jest.fn(),
    getGuestCartSnapshot: jest.fn(),
    getGuestCartItemsForOrder: jest.fn(),
    validateGuestCart: jest.fn(),
    clearGuestCart: jest.fn(),
  }));
});

const { createApp } = require("../../../src/app");

describe("Guest Entry Session API", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  it("returns authenticated session when token is valid", async () => {
    mockVerifyToken.mockReturnValueOnce({
      id: 101,
      email: "auth@example.com",
      role: "customer",
    });

    const response = await request(app)
      .get("/api/v1/checkout/guest/session")
      .set("Cookie", ["token=valid-auth-token"]);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        authenticated: true,
        guest: false,
        user: expect.objectContaining({
          id: 101,
          email: "auth@example.com",
        }),
      }),
    );
    expect(mockCreateGuestCart).not.toHaveBeenCalled();
  });

  it("reuses guest token when valid guest session exists", async () => {
    mockVerifyToken.mockReturnValueOnce(null);
    mockGetGuestSession.mockResolvedValueOnce({
      token: "existing-guest-token",
      createdAt: new Date().toISOString(),
    });

    const response = await request(app)
      .get("/api/v1/checkout/guest/session")
      .set("x-guest-token", "existing-guest-token");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        authenticated: false,
        guest: true,
        token: "existing-guest-token",
        existing: true,
      }),
    );
    expect(mockCreateGuestCart).not.toHaveBeenCalled();
  });

  it("creates guest token for first-time unauthenticated request", async () => {
    mockVerifyToken.mockReturnValueOnce(null);
    mockCreateGuestCart.mockResolvedValueOnce({
      token: "new-guest-token",
      cartId: "guest_cart:new-guest-token",
    });

    const response = await request(app).get("/api/v1/checkout/guest/session");

    expect(response.status).toBe(201);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        authenticated: false,
        guest: true,
        token: "new-guest-token",
        existing: false,
      }),
    );
    expect(mockCreateGuestCart).toHaveBeenCalledTimes(1);

    const setCookieHeader = response.headers["set-cookie"] || [];
    expect(setCookieHeader.join(";")).toContain("guestToken=new-guest-token");
  });
});
