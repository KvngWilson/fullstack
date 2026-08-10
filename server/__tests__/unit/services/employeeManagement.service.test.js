jest.mock("../../../config/db", () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock("../../../services/invitation", () => ({
  createInvitation: jest.fn(),
  getInvitationPreview: jest.fn(),
  acceptInvitation: jest.fn(),
  getPendingInvitations: jest.fn(),
  resendInvitation: jest.fn(),
}));

jest.mock("../../../api/middleware/rbac", () => ({
  PermissionChecker: {
    getEmployeeRole: jest.fn(),
  },
  invalidateEmployeeLookup: jest.fn(),
}));

jest.mock("../../../shared/core/PermissionService", () => ({
  invalidateEmployeePermissions: jest.fn(),
}));

jest.mock("../../../shared/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const { pool } = require("../../../config/db");
const InvitationService = require("../../../services/invitation");
const {
  PermissionChecker,
  invalidateEmployeeLookup,
} = require("../../../api/middleware/rbac");
const PermissionService = require("../../../shared/core/PermissionService");
const EmployeeManagementService = require("../../../services/employeeManagement");

describe("EmployeeManagementService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("inviteEmployee resolves roleCode and delegates invitation creation", async () => {
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 9, code: "manager", name: "Manager", hierarchy_level: 20 }],
    });
    InvitationService.createInvitation.mockResolvedValue({
      id: 22,
      email: "hire@example.com",
      role_id: 9,
      status: "pending",
      expires_at: "2026-08-10T00:00:00.000Z",
    });

    const result = await EmployeeManagementService.inviteEmployee({
      email: "hire@example.com",
      roleCode: "manager",
      invitedByUserId: 5,
      expiryHours: 72,
    });

    expect(InvitationService.createInvitation).toHaveBeenCalledWith(
      "hire@example.com",
      9,
      5,
      72,
    );
    expect(result.id).toBe(22);
  });

  test("updateEmployeeRole applies role change and invalidates permission cache", async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);
    PermissionChecker.getEmployeeRole.mockResolvedValue({
      id: 4,
      hierarchy_level: 50,
    });

    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ role_id: 2, user_id: 88 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          { id: 3, code: "manager", name: "Manager", hierarchy_level: 40 },
        ],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 7 }],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const result = await EmployeeManagementService.updateEmployeeRole({
      employeeId: 7,
      roleCode: "manager",
      actorEmployeeId: 4,
      actorUserId: 99,
      reason: "promotion",
    });

    expect(PermissionChecker.getEmployeeRole).toHaveBeenCalledWith(4);
    expect(
      PermissionService.invalidateEmployeePermissions,
    ).toHaveBeenCalledWith(7);
    expect(client.query).toHaveBeenNthCalledWith(
      5,
      "UPDATE users SET role = $1, updated_at = now() WHERE id = $2",
      ["manager", 88],
    );
    expect(client.release).toHaveBeenCalled();
    expect(result).toEqual({ id: 7, roleId: 3, roleCode: "manager" });
  });

  test("updateEmployeeStatus invalidates permission and employee lookup caches", async () => {
    const client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ user_id: 123, employment_status: "active" }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: 10, employment_status: "suspended" }],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    const result = await EmployeeManagementService.updateEmployeeStatus({
      employeeId: 10,
      status: "suspended",
      actorEmployeeId: 3,
      actorUserId: 55,
      reason: "policy violation",
      allowedStatuses: ["active", "suspended"],
    });

    expect(
      PermissionService.invalidateEmployeePermissions,
    ).toHaveBeenCalledWith(10);
    expect(invalidateEmployeeLookup).toHaveBeenCalledWith(123);
    expect(client.release).toHaveBeenCalled();
    expect(result).toEqual({ id: 10, employment_status: "suspended" });
  });
});
