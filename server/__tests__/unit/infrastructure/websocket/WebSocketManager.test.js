jest.mock("../../../../core/auth/verifyToken", () => jest.fn());

const verifyToken = require("../../../../core/auth/verifyToken");
const WebSocketManager = require("../../../../infrastructure/websocket/WebSocketManager");

describe("WebSocketManager auth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("authenticates sockets with verified cookie tokens", async () => {
    verifyToken.mockResolvedValue({ id: 42, email: "user@example.com" });

    const manager = new WebSocketManager({}, null, null);
    const useMock = jest.fn((middleware) => {
      manager.__middleware = middleware;
    });
    manager.io = { use: useMock };

    manager._setupMiddleware();

    const socket = {
      handshake: {
        headers: { cookie: "token=abc123" },
        auth: {},
      },
    };
    const next = jest.fn();

    await manager.__middleware(socket, next);

    expect(verifyToken).toHaveBeenCalledWith("abc123");
    expect(socket.userId).toBe(42);
    expect(socket.isGuest).toBe(false);
    expect(next).toHaveBeenCalledWith();
  });

  test("rejects invalid tokens", async () => {
    verifyToken.mockResolvedValue(null);

    const manager = new WebSocketManager({}, null, null);
    const useMock = jest.fn((middleware) => {
      manager.__middleware = middleware;
    });
    manager.io = { use: useMock };

    manager._setupMiddleware();

    const socket = {
      handshake: {
        headers: { cookie: "token=bad" },
        auth: {},
      },
    };
    const next = jest.fn();

    await manager.__middleware(socket, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
