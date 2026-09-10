const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};
jest.mock("../../../shared/utils/logger", () => {
  const logger = mockLogger;
  logger.logger = logger;
  logger.requestLoggerMiddleware = jest.fn();
  return logger;
});

jest.mock("../../../config/db", () => ({
  pool: {
    query: jest.fn().mockResolvedValue({ rows: [] }),
    connect: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn(),
    }),
    on: jest.fn(),
    end: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockCreateGuestCart = jest.fn();
const mockGetGuestSession = jest.fn();

jest.mock("../../../domain/ordering/services/GuestCartService", () => {
  return jest.fn().mockImplementation(() => ({
    createGuestCart: mockCreateGuestCart,
    getGuestSession: mockGetGuestSession,
  }));
});

const mockVerifyToken = jest.fn();
jest.mock("../../../config/auth", () => ({
  verifyToken: (...args) => mockVerifyToken(...args),
}));

const guestCheckout = require("../../../api/controllers/v1/ordering/guest-checkout");

describe("Guest entry session endpoint", () => {
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      headers: {},
      cookies: {},
    };

    res = {
      cookie: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test("returns authenticated session when auth token is valid", async () => {
    req.cookies.token = "valid-token";
    mockVerifyToken.mockReturnValue({ id: 11, email: "user@example.com", role: "customer" });

    await guestCheckout.getGuestEntrySession(req, res);

    expect(res.status).not.toHaveBeenCalledWith(201);
    expect(mockCreateGuestCart).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        authenticated: true,
        guest: false,
        user: expect.objectContaining({ id: 11 }),
      }),
    );
  });

  test("reuses existing guest token when session exists", async () => {
    req.cookies.guestToken = "existing-guest-token";
    mockVerifyToken.mockReturnValue(null);
    mockGetGuestSession.mockResolvedValue({ token: "existing-guest-token", createdAt: new Date().toISOString() });

    await guestCheckout.getGuestEntrySession(req, res);

    expect(mockCreateGuestCart).not.toHaveBeenCalled();
    expect(res.cookie).toHaveBeenCalledWith(
      "guestToken",
      "existing-guest-token",
      expect.objectContaining({
        httpOnly: true,
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        authenticated: false,
        guest: true,
        existing: true,
        token: "existing-guest-token",
      }),
    );
  });

  test("creates a guest token for first-time unauthenticated user", async () => {
    mockVerifyToken.mockReturnValue(null);
    mockCreateGuestCart.mockResolvedValue({
      token: "new-guest-token",
      cartId: "guest_cart:new-guest-token",
    });

    await guestCheckout.getGuestEntrySession(req, res);

    expect(mockCreateGuestCart).toHaveBeenCalledTimes(1);
    expect(res.cookie).toHaveBeenCalledWith(
      "guestToken",
      "new-guest-token",
      expect.objectContaining({
        httpOnly: true,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        authenticated: false,
        guest: true,
        existing: false,
        token: "new-guest-token",
      }),
    );
  });
});
