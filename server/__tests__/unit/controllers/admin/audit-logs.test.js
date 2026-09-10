jest.mock("../../../../config/db", () => ({
  pool: {
    query: jest.fn(),
  },
}));

const { pool } = require("../../../../config/db");
const auditLogsController = require("../../../../api/controllers/v1/admin/audit-logs");

describe("admin audit logs controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses event-type fallback when filtering by resource", async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [{ count: "1" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: 1,
            actor_id: 99,
            action: "order:update",
            resource_type: "order",
            resource_id: "42",
            metadata: { newStatus: "shipped" },
            created_at: new Date().toISOString(),
          },
        ],
      });

    const req = {
      query: {
        resource: "order",
        limit: "10",
        offset: "0",
      },
    };
    const res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };

    await auditLogsController.listAuditLogs(req, res);

    expect(pool.query.mock.calls[1][0]).toContain("split_part(sal.event_type, ':', 1)");
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 1,
        count: 1,
        logs: [
          expect.objectContaining({
            resource_type: "order",
            resource_id: "42",
          }),
        ],
      }),
    );
  });
});
