jest.mock("../../../../config/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

jest.mock("../../../../shared/utils/logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const { pool } = require("../../../../config/db");
const BaseService = require("../../../../domain/base/BaseService");

describe("BaseService.auditLog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pool.query.mockResolvedValue({ rows: [] });
  });

  it("persists normalized resource metadata for audit log filtering", async () => {
    const service = new BaseService();

    await service.auditLog(7, "update", "order", 42, { newStatus: "shipped" });

    const metadata = JSON.parse(pool.query.mock.calls[0][1][3]);
    expect(metadata).toEqual({
      newStatus: "shipped",
      resource_type: "order",
      resource_id: "42",
    });
  });
});
