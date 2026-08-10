jest.mock("../../shared/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock("../../config/db", () => ({
  pool: {
    connect: jest.fn(),
    query: jest.fn(),
  },
}));

jest.mock("argon2", () => ({
  hash: jest.fn(async () => "hashed-password"),
}));

const { pool } = require("../../config/db");
const guestCheckout = require("../../api/controllers/v1/ordering/guest-checkout");

describe("Guest checkout conversion", () => {
  let client;
  let req;
  let res;

  beforeEach(() => {
    jest.clearAllMocks();

    client = {
      query: jest.fn(),
      release: jest.fn(),
    };

    pool.connect.mockResolvedValue(client);

    req = {
      body: {
        orderId: 42,
        email: "guest@example.com",
        password: "SecurePass123",
        confirmPassword: "SecurePass123",
      },
      guest: {
        session: {
          email: "guest@example.com",
        },
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  test("creates account and links only requested guest order", async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 42, guest_email: "guest@example.com", user_id: null }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 777 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await guestCheckout.convertGuestToAccount(req, res);

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE orders"),
      [777, 42, "guest@example.com"],
    );
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        userId: 777,
      }),
    );
  });

  test("does not reset password when account already exists", async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: 42, guest_email: "guest@example.com", user_id: null }] })
      .mockResolvedValueOnce({ rows: [{ id: 999 }] })
      .mockResolvedValueOnce({});

    await guestCheckout.convertGuestToAccount(req, res);

    expect(client.query).toHaveBeenCalledWith("BEGIN");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("Account already exists"),
      }),
    );
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE users"),
      expect.anything(),
    );
  });
});
