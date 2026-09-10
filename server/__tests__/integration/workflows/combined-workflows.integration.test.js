/**
 * Integration Test Suite - Current Combined Workflows
 *
 * Covers real cross-feature workflows across admin access control,
 * order currency snapshots, and audit reporting.
 */

const request = require("supertest");
const { createApp } = require("../../../src/app");
const { pool } = require("../../../config/db");
const domain = require("../../../domain");
const PERMISSIONS = require("../../../shared/constants/permissions");
const {
  addToCart,
  createDbInfraGuard,
  createTestAddress,
  createTestExchangeRates,
  createTestOrder,
  createTestProduct,
  createTestUser,
  createTestVariant,
  createTestVendor,
  grantPermissionOverride,
} = require("../../helpers/testHelpers");

describe("Integration Tests - Combined Workflows", () => {
  const AuthenticationService = domain.identity.services.AuthenticationService;
  let app;
  let adminUser;
  let adminToken;
  let vendorA;
  let vendorAToken;
  let vendorB;
  let customerA;
  let customerAToken;
  let customerB;
  let customerBToken;
  let orderSnapshotAddressId;
  let protectedOrderAddressId;
  let originalDefaultCurrency;
  let originalBaseCurrency;
  const { disable, isReady, dbTest } = createDbInfraGuard();

  const issueToken = (user) =>
    AuthenticationService.generateJWT({
      id: user.id,
      email: user.email,
      role: user.role,
    });

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    originalDefaultCurrency = process.env.DEFAULT_CURRENCY;
    originalBaseCurrency = process.env.BASE_CURRENCY;
    process.env.DEFAULT_CURRENCY = "EUR";
    process.env.BASE_CURRENCY = "USD";

    app = createApp();

    try {
      adminUser = await createTestUser({
        email: `combined-admin-${Date.now()}@example.com`,
        role: "admin",
      });
      adminToken = issueToken(adminUser);

      vendorA = await createTestVendor(
        `Combined Vendor A ${Date.now()}`,
        `combined-vendor-a-${Date.now()}@example.com`,
      );
      vendorAToken = issueToken(vendorA.admin);

      vendorB = await createTestVendor(
        `Combined Vendor B ${Date.now()}`,
        `combined-vendor-b-${Date.now()}@example.com`,
      );

      customerA = await createTestUser({
        email: `combined-customer-a-${Date.now()}@example.com`,
        role: "customer",
      });
      customerAToken = issueToken(customerA);

      customerB = await createTestUser({
        email: `combined-customer-b-${Date.now()}@example.com`,
        role: "customer",
      });
      customerBToken = issueToken(customerB);

      await createTestExchangeRates();
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (originalDefaultCurrency === undefined) {
      delete process.env.DEFAULT_CURRENCY;
    } else {
      process.env.DEFAULT_CURRENCY = originalDefaultCurrency;
    }

    if (originalBaseCurrency === undefined) {
      delete process.env.BASE_CURRENCY;
    } else {
      process.env.BASE_CURRENCY = originalBaseCurrency;
    }

    if (!isReady()) return;
    await pool.end();
  });

  describe("Workflow: Admin Vendor Directory Access", () => {
    dbTest("lists vendors for admins and denies vendor access", async () => {
      const adminResponse = await request(app)
        .get("/api/v1/admin/products/vendors")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.success).toBe(true);
      expect(Array.isArray(adminResponse.body.data)).toBe(true);
      expect(adminResponse.body.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ slug: vendorA.vendor.slug }),
          expect.objectContaining({ slug: vendorB.vendor.slug }),
        ]),
      );

      const vendorResponse = await request(app)
        .get("/api/v1/admin/products/vendors")
        .set("Authorization", `Bearer ${vendorAToken}`);

      expect(vendorResponse.status).toBe(403);
      expect(vendorResponse.body.success).toBe(false);
    });
  });

  describe("Workflow: Order Creation + Currency Snapshot", () => {
    dbTest("creates an order and captures the configured EUR to USD snapshot", async () => {
      orderSnapshotAddressId ??= (
        await createTestAddress(customerA.id, {
          type: "shipping",
          is_primary: true,
        })
      ).id;

      const billingAddressId = (
        await createTestAddress(customerA.id, {
          type: "billing",
        })
      ).id;

      const product = await createTestProduct({
        name: `Combined Workflow Product ${Date.now()}`,
        category: "Combined Workflow Category",
      });
      const variant = await createTestVariant(product.id, {
        sku: `COMBINED-${Date.now()}`,
        price: 49.99,
        stock: 25,
      });

      await addToCart(customerA.id, variant.id, 2);

      const orderResponse = await request(app)
        .post("/api/v1/ordering/orders")
        .set("Authorization", `Bearer ${customerAToken}`)
        .send({
          shipping_address_id: orderSnapshotAddressId,
          billing_address_id: billingAddressId,
        });

      expect(orderResponse.status).toBe(201);
      expect(orderResponse.body.success).toBe(true);

      const orderId = orderResponse.body.data.id;
      const snapshotResult = await pool.query(
        `SELECT customer_currency, base_currency, exchange_rate, customer_total_cents, base_total_cents
         FROM order_currency_snapshots
         WHERE order_id = $1`,
        [orderId],
      );

      expect(snapshotResult.rows).toHaveLength(1);
      expect(snapshotResult.rows[0]).toEqual(
        expect.objectContaining({
          customer_currency: "EUR",
          base_currency: "USD",
        }),
      );
      expect(Number(snapshotResult.rows[0].exchange_rate)).toBeGreaterThan(0);
      expect(Number(snapshotResult.rows[0].customer_total_cents)).toBeGreaterThan(0);
      expect(Number(snapshotResult.rows[0].base_total_cents)).toBeGreaterThan(0);
    });
  });

  describe("Workflow: Admin Surface Misuse Prevention", () => {
    dbTest("rejects a customer from employee-management routes", async () => {
      const response = await request(app)
        .get("/api/v1/admin/employees")
        .set("Authorization", `Bearer ${customerAToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe("Workflow: Cross-Customer Order Access Prevention", () => {
    dbTest("blocks one customer from reading another customer's order", async () => {
      protectedOrderAddressId ??= (
        await createTestAddress(customerA.id, {
          type: "shipping",
        })
      ).id;

      const protectedOrder = await createTestOrder(customerA.id, protectedOrderAddressId);

      const response = await request(app)
        .get(`/api/v1/ordering/orders/${protectedOrder.id}`)
        .set("Authorization", `Bearer ${customerBToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Cannot read another user's order");
    });
  });

  describe("Workflow: Admin Audit & Reporting", () => {
    dbTest("returns audit logs for admins using the current default permission matrix", async () => {
      const response = await request(app)
        .get("/api/v1/admin/audit-logs?limit=10&offset=0")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.logs)).toBe(true);
      expect(response.body).toEqual(
        expect.objectContaining({
          total: expect.any(Number),
          count: expect.any(Number),
          limit: 10,
          offset: 0,
        }),
      );

      if (response.body.logs.length > 0) {
        expect(response.body.logs[0]).toEqual(
          expect.objectContaining({
            action: expect.any(String),
            created_at: expect.any(String),
          }),
        );
      }
    });

    dbTest("requires audit export permission before exporting CSV", async () => {
      const deniedResponse = await request(app)
        .get("/api/v1/admin/audit-logs/export?format=csv")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(deniedResponse.status).toBe(403);
      expect(deniedResponse.body.success).toBe(false);

      await grantPermissionOverride(adminUser.id, PERMISSIONS.AUDIT.EXPORT);

      const allowedResponse = await request(app)
        .get("/api/v1/admin/audit-logs/export?format=csv")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(allowedResponse.status).toBe(200);
      expect(allowedResponse.type).toContain("text/csv");
      expect(allowedResponse.text).toContain("ID,Employee,Action");
      expect(allowedResponse.text).toContain("Timestamp");
    });
  });
});
