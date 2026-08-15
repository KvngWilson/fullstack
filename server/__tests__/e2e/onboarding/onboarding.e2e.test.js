const request = require("supertest");
const { pool } = require("../../../config/db");
const { createApp } = require("../../../src/app");
const {
  createDbInfraGuard,
  createTestUser,
  generateToken,
  grantPermissionOverride,
} = require("../../helpers/testHelpers");
const PERMISSIONS = require("../../../shared/constants/permissions");

const app = createApp();

describe("Employee Onboarding API E2E Tests", () => {
  const { disable, isReady, dbTest } = createDbInfraGuard();

  let managerUser;
  let observerUser;
  let hireUser;
  let managerToken;
  let observerToken;
  let managerEmployeeId;
  let hireEmployeeId;
  let managerRoleId;
  let onboardingId;

  async function createEmployeeForUser(userId, roleId, overrides = {}) {
    const result = await pool.query(
      `INSERT INTO employees (user_id, role_id, department, manager_id, employment_status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, user_id, role_id, department, manager_id, employment_status`,
      [
        userId,
        roleId,
        overrides.department ?? "Engineering",
        overrides.manager_id ?? null,
        overrides.employment_status ?? "active",
      ],
    );

    return result.rows[0];
  }

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    try {
      const uniqueSuffix = Date.now();

      managerUser = await createTestUser({
        email: `onboarding-manager-${uniqueSuffix}@example.com`,
        username: `onboarding-manager-${uniqueSuffix}`,
        first_name: "Jane",
        last_name: "Manager",
        role: "support",
      });

      observerUser = await createTestUser({
        email: `onboarding-observer-${uniqueSuffix}@example.com`,
        username: `onboarding-observer-${uniqueSuffix}`,
        first_name: "Olivia",
        last_name: "Observer",
        role: "customer",
      });

      hireUser = await createTestUser({
        email: `onboarding-hire-${uniqueSuffix}@example.com`,
        username: `onboarding-hire-${uniqueSuffix}`,
        first_name: "Sarah",
        last_name: "Johnson",
        role: "customer",
      });

      await grantPermissionOverride(
        managerUser.id,
        PERMISSIONS.ONBOARDING.CREATE,
      );
      await grantPermissionOverride(
        managerUser.id,
        PERMISSIONS.ONBOARDING.READ,
      );
      await grantPermissionOverride(
        managerUser.id,
        PERMISSIONS.ONBOARDING.UPDATE,
      );
      await grantPermissionOverride(
        managerUser.id,
        PERMISSIONS.ONBOARDING.BUDGET_OVERRIDE,
      );

      const managerEmployeeResult = await pool.query(
        "SELECT id, role_id FROM employees WHERE user_id = $1 LIMIT 1",
        [managerUser.id],
      );
      managerEmployeeId = managerEmployeeResult.rows[0].id;
      managerRoleId = managerEmployeeResult.rows[0].role_id;

      const hireEmployee = await createEmployeeForUser(
        hireUser.id,
        managerRoleId,
        {
          department: "Engineering",
          manager_id: managerEmployeeId,
        },
      );
      hireEmployeeId = hireEmployee.id;

      managerToken = generateToken(managerUser.id);
      observerToken = generateToken(observerUser.id);
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;

    if (managerUser?.id || hireUser?.id) {
      await pool.query(
        `DELETE FROM onboardings
         WHERE employee_id IN (
           SELECT id FROM employees WHERE user_id = ANY($1::bigint[])
         )
         OR manager_id IN (
           SELECT id FROM employees WHERE user_id = ANY($1::bigint[])
         )`,
        [[managerUser?.id, hireUser?.id].filter(Boolean)],
      );
    }

    if (observerUser?.id) {
      await pool.query("DELETE FROM users WHERE id = $1", [observerUser.id]);
    }
    if (hireUser?.id) {
      await pool.query("DELETE FROM users WHERE id = $1", [hireUser.id]);
    }
    if (managerUser?.id) {
      await pool.query("DELETE FROM users WHERE id = $1", [managerUser.id]);
    }
    if (managerRoleId) {
      await pool.query("DELETE FROM roles WHERE id = $1", [managerRoleId]);
    }
  });

  describe("Authorization", () => {
    dbTest(
      "rejects onboarding access without the required permission",
      async () => {
        const response = await request(app)
          .get("/api/v1/identity/onboarding")
          .set("Authorization", `Bearer ${observerToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error || response.body.message).toContain(
          "Forbidden",
        );
      },
    );
  });

  describe("Full onboarding workflow", () => {
    dbTest(
      "creates, manages, and completes an onboarding plan through the API",
      async () => {
        const createResponse = await request(app)
          .post("/api/v1/identity/onboarding")
          .set("Authorization", `Bearer ${managerToken}`)
          .send({
            employeeId: hireEmployeeId,
            managerId: managerEmployeeId,
            startDate: "2026-08-11",
            budget: 5500,
            notes: "Prepare engineering onboarding for first week",
          })
          .expect(201);

        expect(createResponse.body.success).toBe(true);
        expect(Number(createResponse.body.data.employee_id)).toBe(
          Number(hireEmployeeId),
        );
        expect(Number(createResponse.body.data.manager_id)).toBe(
          Number(managerEmployeeId),
        );
        expect(createResponse.body.data.status).toBe("not_started");
        onboardingId = createResponse.body.data.id;

        const listResponse = await request(app)
          .get(`/api/v1/identity/onboarding?managerId=${managerEmployeeId}`)
          .set("Authorization", `Bearer ${managerToken}`)
          .expect(200);

        expect(listResponse.body.success).toBe(true);
        expect(Array.isArray(listResponse.body.data)).toBe(true);
        expect(
          listResponse.body.data.some((row) => row.id === onboardingId),
        ).toBe(true);
        expect(listResponse.body.meta.total).toBeGreaterThanOrEqual(1);

        const detailResponse = await request(app)
          .get(`/api/v1/identity/onboarding/${onboardingId}`)
          .set("Authorization", `Bearer ${managerToken}`)
          .expect(200);

        expect(detailResponse.body.success).toBe(true);
        expect(detailResponse.body.data.id).toBe(onboardingId);
        expect(Number(detailResponse.body.data.employee_user_id)).toBe(
          Number(hireUser.id),
        );
        expect(Array.isArray(detailResponse.body.data.tasks)).toBe(true);
        expect(detailResponse.body.data.tasks).toHaveLength(0);

        const setupTaskResponse = await request(app)
          .post(`/api/v1/identity/onboarding/${onboardingId}/tasks`)
          .set("Authorization", `Bearer ${managerToken}`)
          .send({
            name: "Set up laptop and peripherals",
            category: "it",
            description: "Prepare laptop, MFA, VPN, and dev tools",
            dueDay: 0,
            assignedTo: managerEmployeeId,
          })
          .expect(201);

        const orientationTaskResponse = await request(app)
          .post(`/api/v1/identity/onboarding/${onboardingId}/tasks`)
          .set("Authorization", `Bearer ${managerToken}`)
          .send({
            name: "Complete HR orientation",
            category: "hr",
            description: "Policies, benefits, and payroll setup",
            dueDay: 1,
            assignedTo: managerEmployeeId,
          })
          .expect(201);

        const setupTaskId = setupTaskResponse.body.data.id;
        const orientationTaskId = orientationTaskResponse.body.data.id;

        const statusBeforeStartResponse = await request(app)
          .get(`/api/v1/identity/onboarding/${onboardingId}/status`)
          .set("Authorization", `Bearer ${managerToken}`)
          .expect(200);

        expect(statusBeforeStartResponse.body.data).toMatchObject({
          id: onboardingId,
          totalTasks: 2,
          completedTasks: 0,
          pendingTasks: 2,
          completionPercentage: 0,
        });
        expect(
          statusBeforeStartResponse.body.data.tasksByCategory.it.total,
        ).toBe(1);
        expect(
          statusBeforeStartResponse.body.data.tasksByCategory.hr.total,
        ).toBe(1);

        const updateResponse = await request(app)
          .put(`/api/v1/identity/onboarding/${onboardingId}`)
          .set("Authorization", `Bearer ${managerToken}`)
          .send({
            budget: 6200,
            notes: "Include additional setup budget for equipment",
          })
          .expect(200);

        expect(updateResponse.body.success).toBe(true);
        expect(Number(updateResponse.body.data.budget)).toBe(6200);
        expect(updateResponse.body.data.notes).toBe(
          "Include additional setup budget for equipment",
        );

        const budgetOverrideResponse = await request(app)
          .post(`/api/v1/identity/onboarding/${onboardingId}/budget-override`)
          .set("Authorization", `Bearer ${managerToken}`)
          .send({
            newBudget: 7000,
            reason: "Approved for premium workstation and onboarding stipend",
          })
          .expect(200);

        expect(Number(budgetOverrideResponse.body.data.budget)).toBe(7000);
        expect(budgetOverrideResponse.body.data.budget_overridden).toBe(true);
        expect(budgetOverrideResponse.body.data.budget_override_reason).toBe(
          "Approved for premium workstation and onboarding stipend",
        );

        const startResponse = await request(app)
          .put(`/api/v1/identity/onboarding/${onboardingId}/start`)
          .set("Authorization", `Bearer ${managerToken}`)
          .expect(200);

        expect(startResponse.body.success).toBe(true);
        expect(startResponse.body.data.status).toBe("in_progress");

        const blockedCompleteResponse = await request(app)
          .put(`/api/v1/identity/onboarding/${onboardingId}/complete`)
          .set("Authorization", `Bearer ${managerToken}`);

        expect(blockedCompleteResponse.status).toBe(400);
        expect(blockedCompleteResponse.body.message).toContain("pending tasks");

        await request(app)
          .put(
            `/api/v1/identity/onboarding/${onboardingId}/tasks/${setupTaskId}/complete`,
          )
          .set("Authorization", `Bearer ${managerToken}`)
          .expect(200);

        await request(app)
          .put(
            `/api/v1/identity/onboarding/${onboardingId}/tasks/${orientationTaskId}/complete`,
          )
          .set("Authorization", `Bearer ${managerToken}`)
          .expect(200);

        const statusAfterTasksResponse = await request(app)
          .get(`/api/v1/identity/onboarding/${onboardingId}/status`)
          .set("Authorization", `Bearer ${managerToken}`)
          .expect(200);

        expect(statusAfterTasksResponse.body.data).toMatchObject({
          id: onboardingId,
          totalTasks: 2,
          completedTasks: 2,
          pendingTasks: 0,
          completionPercentage: 100,
        });

        const completeResponse = await request(app)
          .put(`/api/v1/identity/onboarding/${onboardingId}/complete`)
          .set("Authorization", `Bearer ${managerToken}`)
          .expect(200);

        expect(completeResponse.body.success).toBe(true);
        expect(completeResponse.body.data.status).toBe("completed");
        expect(completeResponse.body.data.end_date).toBeDefined();

        const finalDetailResponse = await request(app)
          .get(`/api/v1/identity/onboarding/${onboardingId}`)
          .set("Authorization", `Bearer ${managerToken}`)
          .expect(200);

        expect(finalDetailResponse.body.data.status).toBe("completed");
        expect(finalDetailResponse.body.data.tasks).toHaveLength(2);
        expect(
          finalDetailResponse.body.data.tasks.every(
            (task) => task.is_completed,
          ),
        ).toBe(true);

        const persistedOnboarding = await pool.query(
          `SELECT status, budget, budget_overridden, budget_override_reason
         FROM onboardings
         WHERE id = $1`,
          [onboardingId],
        );

        expect(persistedOnboarding.rows[0]).toMatchObject({
          status: "completed",
          budget_overridden: true,
          budget_override_reason:
            "Approved for premium workstation and onboarding stipend",
        });
        expect(Number(persistedOnboarding.rows[0].budget)).toBe(7000);
      },
    );
  });
});
