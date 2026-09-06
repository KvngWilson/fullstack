/**
 * Employee Invitation Integration Test Suite
 * Tests employee invitation endpoints with email job dispatching.
 */

const request = require("supertest");
const argon2 = require("argon2");
const { pool } = require("../../../config/db");
const { createApp } = require("../../../src/app");
const {
  createDbInfraGuard,
  grantPermissionOverride,
  getCookieValue,
} = require("../../helpers/testHelpers");

jest.mock("../../../infrastructure/email/email", () => ({
  sendEmailJob: jest.fn().mockResolvedValue({
    success: true,
    messageId: "test-message-id",
  }),
}));

const { sendEmailJob } = require("../../../infrastructure/email/email");

const app = createApp();
const INVITE_TEST_SUFFIX = "@invite-test.example.com";
const { disable, isReady, dbTest } = createDbInfraGuard();

describe("Employee Invitation Integration Tests", () => {
  let adminToken;
  let adminUser;
  let inviteTestRoleId;
  let createdInviteTestRole = false;

  const cleanupInvitations = async () => {
    await pool.query(`DELETE FROM employee_invitations WHERE email LIKE $1`, [
      `%${INVITE_TEST_SUFFIX}`,
    ]);

    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [
      `%${INVITE_TEST_SUFFIX}`,
    ]);
  };

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    let roleResult = await pool.query(
      `SELECT id
       FROM roles
       WHERE code = 'admin' AND is_active = true
       ORDER BY id
       LIMIT 1`,
    );

    if (roleResult.rowCount === 0) {
      roleResult = await pool.query(
        `INSERT INTO roles (vendor_id, code, name, description, hierarchy_level, is_system, is_active)
         VALUES (NULL, $1, $2, $3, 0, false, true)
         RETURNING id`,
        [
          "admin",
          "Administrator",
          "Generated admin role for employee invitation integration tests",
        ],
      );
      createdInviteTestRole = true;
    }

    inviteTestRoleId = roleResult.rows[0].id;

    const adminEmail = `admin-${Date.now()}@company.example.com`;
    const hashedPassword = await argon2.hash("Test123!@#");

    const adminResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role`,
      [adminEmail, hashedPassword, "admin", true],
    );

    adminUser = adminResult.rows[0];
    await grantPermissionOverride(adminUser.id, "employee:invite");

    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: adminEmail,
      password: "Test123!@#",
    });

    adminToken = getCookieValue(loginResponse.headers["set-cookie"], "token");
  });

  beforeEach(async () => {
    if (!isReady()) {
      return;
    }

    jest.clearAllMocks();
    await cleanupInvitations();
  });

  afterAll(async () => {
    if (!isReady()) {
      return;
    }

    await cleanupInvitations();
    if (adminUser?.email) {
      await pool.query("DELETE FROM users WHERE email = $1", [adminUser.email]);
    }
    if (createdInviteTestRole && inviteTestRoleId) {
      await pool.query("DELETE FROM roles WHERE id = $1", [inviteTestRoleId]);
    }
  });

  describe("POST /api/v1/identity/employees/invite", () => {
    dbTest("invites employee and dispatches invitation email job", async () => {
      const inviteEmail = `newemployee-${Date.now()}${INVITE_TEST_SUFFIX}`;

      const response = await request(app)
        .post("/api/v1/identity/employees/invite")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: inviteTestRoleId,
        });

      expect(response.status).toBe(201);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.email).toBe(inviteEmail);
      expect(response.body.data.status).toBe("pending");

      expect(sendEmailJob).toHaveBeenCalledWith(
        expect.objectContaining({
          to: inviteEmail,
          templateName: "employeeInvitation",
          templateData: expect.objectContaining({
            to: inviteEmail,
            invitationUrl: expect.stringContaining("/accept-invitation?token="),
          }),
        }),
      );
    });

    dbTest(
      "includes a valid invitation token in the acceptance URL",
      async () => {
        const inviteEmail = `newemp-${Date.now()}${INVITE_TEST_SUFFIX}`;

        await request(app)
          .post("/api/v1/identity/employees/invite")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            email: inviteEmail,
            roleId: inviteTestRoleId,
          });

        expect(sendEmailJob).toHaveBeenCalledWith(
          expect.objectContaining({
            templateData: expect.objectContaining({
              invitationUrl: expect.stringContaining("/accept-invitation"),
              invitationUrl: expect.stringContaining("token="),
            }),
          }),
        );
      },
    );

    dbTest("includes inviter name in invitation email data", async () => {
      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      await request(app)
        .post("/api/v1/identity/employees/invite")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: inviteTestRoleId,
        });

      expect(sendEmailJob).toHaveBeenCalledWith(
        expect.objectContaining({
          templateData: expect.objectContaining({
            inviterName: expect.any(String),
            expiryHours: 24,
          }),
        }),
      );
    });

    dbTest(
      "handles email failure without blocking invitation creation",
      async () => {
        sendEmailJob.mockRejectedValueOnce(new Error("SMTP connection failed"));

        const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

        const response = await request(app)
          .post("/api/v1/identity/employees/invite")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({
            email: inviteEmail,
            roleId: inviteTestRoleId,
          });

        expect(response.status).toBe(201);
        expect(response.body.data.id).toBeDefined();
        expect(sendEmailJob).toHaveBeenCalled();
      },
    );

    dbTest("creates invitation with 24-hour expiration", async () => {
      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      const response = await request(app)
        .post("/api/v1/identity/employees/invite")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: inviteTestRoleId,
        });

      const invitationId = response.body.data.id;

      const inviteResult = await pool.query(
        `SELECT expires_at FROM employee_invitations WHERE id = $1`,
        [invitationId],
      );

      const expiresAt = new Date(inviteResult.rows[0].expires_at);
      const hoursDiff = (expiresAt - new Date()) / (1000 * 60 * 60);

      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThanOrEqual(24);
    });

    dbTest("requires admin authentication", async () => {
      const response = await request(app)
        .post("/api/v1/identity/employees/invite")
        .send({
          email: `emp-${Date.now()}${INVITE_TEST_SUFFIX}`,
          roleId: inviteTestRoleId,
        });

      expect(response.status).toBe(401);
    });

    dbTest("rejects duplicate invitations to same email", async () => {
      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      await request(app)
        .post("/api/v1/identity/employees/invite")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: inviteTestRoleId,
        });

      sendEmailJob.mockClear();

      const response = await request(app)
        .post("/api/v1/identity/employees/invite")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: inviteTestRoleId,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain(
        "Pending invitation already exists for this email",
      );
    });

    dbTest("creates acceptance route preview and accepts token", async () => {
      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      const inviteResponse = await request(app)
        .post("/api/v1/identity/employees/invite")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: inviteTestRoleId,
        });

      const invitationId = inviteResponse.body.data.id;

      const inviteRecord = await pool.query(
        `SELECT invitation_token FROM employee_invitations WHERE id = $1`,
        [invitationId],
      );

      const token = inviteRecord.rows[0].invitation_token;

      const previewResponse = await request(app)
        .get("/api/v1/identity/employees/accept-invitation")
        .query({ token });

      expect(previewResponse.status).toBe(200);
      expect(previewResponse.body.data.email).toBe(inviteEmail);

      const acceptResponse = await request(app)
        .post("/api/v1/identity/employees/accept-invitation")
        .send({
          token,
          firstName: "New",
          lastName: "Employee",
          password: "NewEmployee123!@#",
          confirmPassword: "NewEmployee123!@#",
        });

      expect(acceptResponse.status).toBe(201);
      expect(acceptResponse.body.data.email).toBe(inviteEmail);
    });
  });

  describe("Invitation Email Content", () => {
    dbTest("sends email job with proper template data", async () => {
      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      await request(app)
        .post("/api/v1/identity/employees/invite")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: inviteTestRoleId,
        });

      const emailCall = sendEmailJob.mock.calls[0][0];

      expect(emailCall).toMatchObject({
        to: inviteEmail,
        templateName: "employeeInvitation",
        templateData: {
          invitationUrl: expect.stringMatching(/^http/),
          inviterName: expect.any(String),
          expiryHours: 24,
        },
      });

      expect(emailCall.templateData.inviterName).toBeTruthy();
    });
  });
});
