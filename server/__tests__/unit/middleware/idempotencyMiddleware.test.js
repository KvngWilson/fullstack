/**
 * Idempotency Middleware Unit Tests
 *
 * Tests the Idempotency-Key middleware added in Sprint 2:
 * - Requests without a key pass through (or 400 when required)
 * - First request inserts a record and stores the JSON response
 * - Retries replay the stored response with Idempotency-Replayed header
 * - Same key with a different payload → 422
 * - Same key while original is processing → 409
 * - 5xx responses release the key
 * - Storage failures fail open
 */

jest.mock("../../../shared/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../../../config/db", () => ({
  pool: { query: jest.fn() },
}));

const { pool } = require("../../../config/db");
const { idempotency } = require("../../../api/middleware/idempotency");

function createRes() {
  const res = {
    statusCode: 200,
    headers: {},
    finishHandlers: [],
    status: jest.fn(function (code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function (payload) {
      this.body = payload;
      return this;
    }),
    set: jest.fn(function (name, value) {
      this.headers[name] = value;
      return this;
    }),
    on: jest.fn(function (event, handler) {
      if (event === "finish") this.finishHandlers.push(handler);
    }),
  };
  return res;
}

function createReq({ key, body = { amount: 100 }, method = "POST" } = {}) {
  return {
    method,
    baseUrl: "/api/v1/payments",
    path: "/",
    ip: "127.0.0.1",
    user: { id: 42 },
    body,
    get: jest.fn((name) =>
      name === "Idempotency-Key" ? key : undefined,
    ),
  };
}

describe("idempotency middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("passes through when no Idempotency-Key header is present", async () => {
    const req = createReq({ key: undefined });
    const res = createRes();
    const next = jest.fn();

    await idempotency()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("rejects missing keys when required", async () => {
    const req = createReq({ key: undefined });
    const res = createRes();
    const next = jest.fn();

    await idempotency({ required: true })(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(400);
  });

  it("ignores non-mutating methods", async () => {
    const req = createReq({ key: "abc", method: "GET" });
    const res = createRes();
    const next = jest.fn();

    await idempotency()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it("executes the first request and persists the response", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // expiry purge
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // insert succeeds
      .mockResolvedValueOnce({ rows: [] }); // response persist

    const req = createReq({ key: "key-1" });
    const res = createRes();
    const next = jest.fn();

    await idempotency()(req, res, next);
    expect(next).toHaveBeenCalled();

    // Simulate the controller responding
    res.status(201).json({ success: true, paymentId: 7 });

    // Allow the fire-and-forget persist to run
    await new Promise(process.nextTick);

    const persistCall = pool.query.mock.calls[2];
    expect(persistCall[0]).toMatch(/status = 'completed'/);
    expect(persistCall[1]).toContain(201);
  });

  it("replays the stored response for a completed duplicate", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // expiry purge
      .mockResolvedValueOnce({ rows: [] }) // insert conflicts
      .mockResolvedValueOnce({
        rows: [
          {
            request_hash: hashOf({ amount: 100 }),
            status: "completed",
            response_status: 201,
            response_body: { success: true, paymentId: 7 },
          },
        ],
      });

    const req = createReq({ key: "key-1" });
    const res = createRes();
    const next = jest.fn();

    await idempotency()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.headers["Idempotency-Replayed"]).toBe("true");
    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({ success: true, paymentId: 7 });
  });

  it("rejects reuse of a key with a different payload", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            request_hash: hashOf({ amount: 999 }),
            status: "completed",
            response_status: 201,
            response_body: {},
          },
        ],
      });

    const req = createReq({ key: "key-1", body: { amount: 100 } });
    const res = createRes();
    const next = jest.fn();

    await idempotency()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(422);
  });

  it("returns 409 while the original request is still processing", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          {
            request_hash: hashOf({ amount: 100 }),
            status: "processing",
            response_status: null,
            response_body: null,
          },
        ],
      });

    const req = createReq({ key: "key-1" });
    const res = createRes();
    const next = jest.fn();

    await idempotency()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
  });

  it("releases the key on 5xx responses so clients can retry", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] }) // expiry purge
      .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // insert
      .mockResolvedValueOnce({ rows: [] }); // delete on 5xx

    const req = createReq({ key: "key-1" });
    const res = createRes();
    const next = jest.fn();

    await idempotency()(req, res, next);
    res.status(500).json({ error: "boom" });
    await new Promise(process.nextTick);

    const releaseCall = pool.query.mock.calls[2];
    expect(releaseCall[0]).toMatch(/DELETE FROM idempotency_keys/);
  });

  it("fails open when the idempotency store is unavailable", async () => {
    pool.query.mockRejectedValue(new Error("connection refused"));

    const req = createReq({ key: "key-1" });
    const res = createRes();
    const next = jest.fn();

    await idempotency()(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

function hashOf(body) {
  return require("crypto")
    .createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
}
