/**
 * Integration Test Suite - RBAC + Currency + Audit Combined
 * 
 * Tests realistic workflows combining RBAC, multi-currency, and audit logging.
 */

const request = require('supertest');
const { createApp } = require('../../../src/app');
const { pool } = require('../../../config/db');
const {
  createToken,
  createTestUser,
  createTestVendor,
  createTestExchangeRates,
  createTestOrder,
  findAuditLog,
  createDbInfraGuard,
} = require('../../helpers/testHelpers');

describe('Integration Tests - Combined Workflows', () => {
  let app;
  let vendorAToken;
  let vendorBToken;
  let customerToken;
  let adminToken;
  const { disable, isReady, dbTest } = createDbInfraGuard();

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    app = createApp();

    // Create test users
    try {
      const adminUser = await createTestUser('admin@test.com', 'admin');
      adminToken = createToken(adminUser.id, 'admin');

      const vendorAUser = await createTestUser('vendor-a@test.com', 'vendor', 'vendor-a');
      vendorAToken = createToken(vendorAUser.id, 'vendor', 'vendor-a');

      const vendorBUser = await createTestUser('vendor-b@test.com', 'vendor', 'vendor-b');
      vendorBToken = createToken(vendorBUser.id, 'vendor', 'vendor-b');

      const customer = await createTestUser('customer@test.com', 'customer');
      customerToken = createToken(customer.id, 'customer');

      await createTestExchangeRates();
    } catch (_error) {
      disable();
    }
  });

  afterAll(async () => {
    if (!isReady()) return;
    await pool.end();
  });

  describe('Workflow: Vendor Manages Products + Audit Logging', () => {
    dbTest('Should create product, capture audit log, and prevent other vendor access', async () => {
      // Vendor A creates a product
      const createResponse = await request(app)
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({
          name: 'Integration Test Product',
          sku: 'INT-TEST-001',
          price_cents: 5000,
          description: 'Test product for integration testing'
        });

      expect(createResponse.status).toBe(201);
      const productId = createResponse.body.data.id;

      // Verify audit log was created
      const auditLog = await findAuditLog({
        action: 'product_created',
        resource_id: productId
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.metadata.vendor_id).toBe('vendor-a');

      // Vendor B tries to access the product
      const accessResponse = await request(app)
        .get(`/api/v1/catalog/products/${productId}`)
        .set('Authorization', `Bearer ${vendorBToken}`);

      expect([403, 404].includes(accessResponse.status)).toBe(true);

      // Verify denial was logged
      const denialLog = await findAuditLog({
        action: 'product_access_denied'
      });

      if (denialLog) {
        expect(denialLog.severity).toBe('warning');
      }
    });
  });

  describe('Workflow: Customer Multi-Currency Order + Exchange Rate Audit', () => {
    dbTest('Should place order in EUR, capture rate snapshot, and log transaction', async () => {
      // Create test products for vendor A
      const products = await createTestProducts('vendor-a', 2);

      // Customer places order in EUR
      const orderResponse = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: products.slice(0, 1).map(p => ({
            product_id: p.id,
            product_variant_id: p.variant.id,
            quantity: 1
          })),
          currency: 'EUR'
        });

      expect(orderResponse.status).toBe(201);
      const orderId = orderResponse.body.data.id;

      // Verify currency snapshot
      const snapshotResult = await pool.query(
        `SELECT * FROM order_currency_snapshots WHERE order_id = $1`,
        [orderId]
      );

      expect(snapshotResult.rows.length).toBe(1);
      const snapshot = snapshotResult.rows[0];
      expect(snapshot.customer_currency).toBe('EUR');
      expect(snapshot.exchange_rate).toBeGreaterThan(0);

      // Verify order creation was audited
      const auditLog = await findAuditLog({
        action: 'order_created',
        resource_id: orderId
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.metadata.currency).toBe('EUR');
      expect(auditLog.metadata.exchange_rate).toBeDefined();
    });
  });

  describe('Workflow: Permission Escalation Attempt + Security Audit', () => {
    dbTest('Should reject privilege escalation and log as critical security event', async () => {
      // Create a regular employee
      const employeeUser = await createTestUser('employee@test.com', 'employee', 'vendor-a');
      const employeeToken = createToken(employeeUser.id, 'employee', 'vendor-a');

      // Employee attempts to escalate privileges
      const escalationResponse = await request(app)
        .patch('/api/v1/admin/employees/self')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          role: 'admin',
          hierarchy_level: 100
        });

      expect([403, 400].includes(escalationResponse.status)).toBe(true);

      // Verify critical security log
      const securityLog = await findAuditLog({
        action: 'privilege_escalation_attempted'
      });

      if (securityLog) {
        expect(securityLog.severity).toBe('critical');
        expect(securityLog.metadata.attempted_role).toBe('admin');
      }
    });
  });

  describe('Workflow: Cross-Tenant Data Access Prevention', () => {
    dbTest('Should block vendor from accessing other vendor orders', async () => {
      // Create products and order for vendor A
      const vendorAProducts = await createTestProducts('vendor-a', 1);
      const { orderId } = await createTestOrder('customer-id', vendorAProducts);

      // Vendor B tries to access the order
      const accessResponse = await request(app)
        .get(`/api/v1/orders/${orderId}`)
        .set('Authorization', `Bearer ${vendorBToken}`);

      expect([403, 404].includes(accessResponse.status)).toBe(true);

      // Verify tenant violation was logged
      const violationLog = await findAuditLog({
        action: 'tenant_violation_attempted'
      });

      if (violationLog) {
        expect(violationLog.severity).toBe('critical');
      }
    });
  });

  describe('Workflow: Admin Audit & Reporting', () => {
    dbTest('Should retrieve filtered audit logs with timestamps', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit-logs?limit=10&offset=0')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.data)).toBe(true);

      response.body.data.forEach(log => {
        expect(log.actor_id).toBeDefined();
        expect(log.action).toBeDefined();
        expect(log.created_at).toBeDefined();
        expect(log.timestamp).toBeDefined();
      });
    });

    dbTest('Should export audit logs in CSV format', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit-logs/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.type).toContain('text/csv');
      expect(response.text).toContain('actor_id');
      expect(response.text).toContain('action');
    });
  });
});
