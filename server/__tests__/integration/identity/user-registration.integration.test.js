const request = require("supertest");
const { pool } = require("../../../config/db");
const argon2 = require("argon2");
const { createApp } = require("../../../src/app");
const {
  createDbInfraGuard,
  getCookieValue,
} = require("../../helpers/testHelpers");

const app = createApp();

describe("Identity Profile Flow (Integration)", () => {
  // Setup database hooks at module level before any tests run
  // PostgreSQL running at localhost:5445 (test port)
  // with user 'postgres' and password 'postgres', and a test database 'fullstack_test'
  // To run: npm run test:integration

  const TEST_EMAIL_SUFFIX = "@user-reg-test.example.com";
  const { disable, isReady, dbTest } = createDbInfraGuard();
  const it = dbTest;

  const cleanupTestUsers = async () => {
    await pool.query(
      `DELETE FROM order_items
       WHERE order_id IN (
         SELECT o.id FROM orders o
         JOIN users u ON o.user_id = u.id
         WHERE u.email LIKE $1
       )`,
      [`%${TEST_EMAIL_SUFFIX}`],
    );

    await pool.query(
      `DELETE FROM payments
       WHERE order_id IN (
         SELECT o.id FROM orders o
         JOIN users u ON o.user_id = u.id
         WHERE u.email LIKE $1
       )`,
      [`%${TEST_EMAIL_SUFFIX}`],
    );

    await pool.query(
      `DELETE FROM orders
       WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
      [`%${TEST_EMAIL_SUFFIX}`],
    );

    await pool.query(
      `DELETE FROM cart_items
       WHERE cart_id IN (
         SELECT c.id FROM carts c
         JOIN users u ON c.user_id = u.id
         WHERE u.email LIKE $1
       )`,
      [`%${TEST_EMAIL_SUFFIX}`],
    );

    await pool.query(
      `DELETE FROM carts
       WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)`,
      [`%${TEST_EMAIL_SUFFIX}`],
    );

    await pool.query(`DELETE FROM users WHERE email LIKE $1`, [
      `%${TEST_EMAIL_SUFFIX}`,
    ]);
  };

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;
    await cleanupTestUsers();
  });

  beforeEach(async () => {
    if (!isReady()) return;
    try {
      await cleanupTestUsers();
    } catch (_error) {
      disable();
    }
  });

  describe("POST /api/v1/auth/login", () => {
    it("should reject login with invalid credentials", async () => {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: `nonexistent${TEST_EMAIL_SUFFIX}`,
          password: "WrongPassword123",
        });

      expect(response.status).toBe(401);
    });

    it("should successfully login with valid credentials", async () => {
      // Create test user
      const testEmail = `login-test-${Date.now()}${TEST_EMAIL_SUFFIX}`;
      const testPassword = "Test@Password123";
      const hashedPassword = await argon2.hash(testPassword);

      await pool.query(
        `INSERT INTO users (email, password_hash, is_active)
         VALUES ($1, $2, $3)`,
        [testEmail, hashedPassword, true],
      );

      // Attempt login
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      const token = getCookieValue(response.headers["set-cookie"], "token");
      expect(token).toBeDefined();
      expect(response.body.user?.email).toBe(testEmail);
    });
  });

  describe("GET /api/v1/identity/profile", () => {
    it("should reject request without authentication", async () => {
      const response = await request(app).get("/api/v1/identity/profile");
      expect(response.status).toBe(401);
    });

    it("should retrieve authenticated user profile", async () => {
      // Create test user
      const testEmail = `profile-test-${Date.now()}${TEST_EMAIL_SUFFIX}`;
      const testPassword = "Test@Password123";
      const hashedPassword = await argon2.hash(testPassword);

      const userResult = await pool.query(
        `INSERT INTO users (email, password_hash, is_active)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [testEmail, hashedPassword, true],
      );

      const userId = userResult.rows[0].id;

      // Use canonical auth login for bootstrap; this suite still exercises the
      // legacy profile route, but legacy login contract is covered elsewhere.
      const loginResponse = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: testEmail,
          password: testPassword,
        })
        .expect(200);

      const token = getCookieValue(
        loginResponse.headers["set-cookie"],
        "token",
      );
      expect(token).toBeDefined();

      const response = await request(app)
        .get("/api/v1/identity/profile")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(testEmail);
    });
  });

  describe("POST /api/v1/identity/profile/change-password", () => {
    it("should reject without authentication", async () => {
      const response = await request(app)
        .post("/api/v1/identity/profile/change-password")
        .send({
          old_password: "OldPassword123",
          new_password: "NewPassword123",
          confirm_password: "NewPassword123",
        });

      expect(response.status).toBe(401);
    });

    it("should reject invalid password change request", async () => {
      const testEmail = `pwd-test-${Date.now()}${TEST_EMAIL_SUFFIX}`;
      const testPassword = "Test@Password123";
      const hashedPassword = await argon2.hash(testPassword);

      const userResult = await pool.query(
        `INSERT INTO users (email, password_hash, is_active)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [testEmail, hashedPassword, true],
      );

      const userId = userResult.rows[0].id;
      const jwt = require("jsonwebtoken");
      const token = jwt.sign(
        { id: userId, email: testEmail },
        process.env.JWT_SECRET || "test-secret",
      );

      const response = await request(app)
        .post("/api/v1/identity/profile/change-password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          current_password: "WrongPassword",
          new_password: "NewPassword123",
          confirm_password: "NewPassword123",
        });

      expect(response.status).toBe(401);
    });
  });
});
