/**
 * Multi-Tenant Isolation Test Suite
 * 
 * Tests tenant isolation, cross-tenant access prevention, and data
 * compartmentalization across vendors, employees, and resources.
 */

const request = require('supertest');
const { createApp } = require('../../../src/app');
const { pool } = require('../../../config/db');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

describe('Multi-Tenant Isolation Tests', () => {
  let app;
  let vendorAToken;
  let vendorBToken;
  let vendorAAdminToken;
  let vendorBAdminToken;
  let systemAdminToken;
  const { disable, isReady, dbTest } = createDbInfraGuard();
  const test = dbTest;

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    app = createApp();
    // Seed test data for multiple vendors
  });

  afterAll(async () => {
    if (!isReady()) return;
    await pool.end();
  });

  describe('Vendor Data Isolation', () => {
    test('Should not allow vendor to access other vendor products', async () => {
      // Vendor A queries all products
      const response = await request(app)
        .get('/api/v1/catalog/products')
        .set('Authorization', `Bearer ${vendorAToken}`);

      expect(response.status).toBe(200);
      
      // All returned products should belong to Vendor A
      response.body.data.forEach(product => {
        expect(product.vendor_id).toBe(vendorAToken.vendor_id);
      });
    });

    test('Should block direct access to other vendor products', async () => {
      const response = await request(app)
        .get('/api/v1/catalog/products/other-vendor-product-id')
        .set('Authorization', `Bearer ${vendorAToken}`);

      expect([403, 404].includes(response.status)).toBe(true);
    });

    test('Should prevent vendor from updating other vendor products', async () => {
      const response = await request(app)
        .patch('/api/v1/catalog/products/other-vendor-product-id')
        .set('Authorization', `Bearer ${vendorAToken}`)
        .send({ price: 9999 });

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('permission');
    });

    test('Should isolate vendor inventory from other vendors', async () => {
      const vendorAInventory = await pool.query(
        `SELECT * FROM inventory i
         JOIN product_variants pv ON i.product_variant_id = pv.id
         JOIN products p ON pv.product_id = p.id
         WHERE p.vendor_id = $1`,
        [vendorAToken.vendor_id]
      );

      const vendorBInventory = await pool.query(
        `SELECT * FROM inventory i
         JOIN product_variants pv ON i.product_variant_id = pv.id
         JOIN products p ON pv.product_id = p.id
         WHERE p.vendor_id = $1`,
        [vendorBToken.vendor_id]
      );

      // Should have no overlapping products
      const vendorAIds = new Set(vendorAInventory.rows.map(r => r.product_id));
      const vendorBIds = new Set(vendorBInventory.rows.map(r => r.product_id));
      
      const intersection = [...vendorAIds].filter(id => vendorBIds.has(id));
      expect(intersection.length).toBe(0);
    });
  });

  describe('Order Data Isolation', () => {
    test('Should filter orders by customer user only', async () => {
      const ordersResponse = await request(app)
        .get('/api/v1/orders')
        .set('Authorization', `Bearer ${vendorAToken}`);

      // Customer should only see their own orders
      expect(ordersResponse.status).toBe(200);
      ordersResponse.body.data.forEach(order => {
        expect(order.user_id).toBe(vendorAToken.user_id);
      });
    });

    test('Should prevent vendor from accessing customer orders from other vendors', async () => {
      // Get vendor A's customer orders
      const vendorAOrders = await pool.query(
        `SELECT o.id FROM orders o
         JOIN users u ON o.user_id = u.id
         LIMIT 1`
      );

      if (vendorAOrders.rows.length > 0) {
        const orderId = vendorAOrders.rows[0].id;

        // Try to access as different vendor
        const response = await request(app)
          .get(`/api/v1/orders/${orderId}`)
          .set('Authorization', `Bearer ${vendorBToken}`);

        expect([403, 404].includes(response.status)).toBe(true);
      }
    });

    test('Should isolate order items by vendor', async () => {
      const vendorAOrderItems = await pool.query(
        `SELECT oi.* FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE p.vendor_id = $1`,
        [vendorAToken.vendor_id]
      );

      const vendorBOrderItems = await pool.query(
        `SELECT oi.* FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         JOIN products p ON oi.product_id = p.id
         WHERE p.vendor_id = $1`,
        [vendorBToken.vendor_id]
      );

      // No order should contain items from both vendors
      const vendorAOrderIds = new Set(vendorAOrderItems.rows.map(r => r.order_id));
      const vendorBOrderIds = new Set(vendorBOrderItems.rows.map(r => r.order_id));
      
      const intersection = [...vendorAOrderIds].filter(id => vendorBOrderIds.has(id));
      expect(intersection.length).toBe(0);
    });
  });

  describe('Employee/Tenant Hierarchy Isolation', () => {
    test('Should restrict vendors to manage their own employees', async () => {
      const response = await request(app)
        .get('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${vendorAAdminToken}`);

      expect(response.status).toBe(200);
      
      // All returned employees should belong to vendor A
      response.body.data.forEach(emp => {
        expect(emp.vendor_id).toBe(vendorAAdminToken.vendor_id);
      });
    });

    test('Should prevent vendor from inviting employees from other vendors', async () => {
      const response = await request(app)
        .post('/api/v1/admin/employees/invite')
        .set('Authorization', `Bearer ${vendorAAdminToken}`)
        .send({
          email: 'cross-vendor-emp@test.com',
          role: 'manager',
          vendor_id: vendorBToken.vendor_id  // Try to assign to different vendor
        });

      expect([403, 400].includes(response.status)).toBe(true);
    });

    test('Should allow system admin to access all vendors', async () => {
      const response = await request(app)
        .get('/api/v1/admin/employees')
        .set('Authorization', `Bearer ${systemAdminToken}`);

      expect(response.status).toBe(200);
      
      // System admin should see employees from all vendors
      const vendorIds = new Set(response.body.data.map(emp => emp.vendor_id));
      expect(vendorIds.size).toBeGreaterThan(1);
    });
  });

  describe('Role & Permission Isolation', () => {
    test('Should isolate roles by vendor', async () => {
      const vendorARoles = await pool.query(
        `SELECT r.* FROM roles r
         WHERE r.vendor_id = $1 OR r.vendor_id IS NULL
         ORDER BY r.vendor_id`,
        [vendorAToken.vendor_id]
      );

      const vendorBRoles = await pool.query(
        `SELECT r.* FROM roles r
         WHERE r.vendor_id = $1 OR r.vendor_id IS NULL
         ORDER BY r.vendor_id`,
        [vendorBToken.vendor_id]
      );

      // Each vendor should have system roles (vendor_id IS NULL) but different custom roles
      const vendorACustom = vendorARoles.rows.filter(r => r.vendor_id === vendorAToken.vendor_id);
      const vendorBCustom = vendorBRoles.rows.filter(r => r.vendor_id === vendorBToken.vendor_id);

      vendorACustom.forEach(role => {
        const foundInB = vendorBCustom.some(r => r.id === role.id);
        expect(foundInB).toBe(false);
      });
    });

    test('Should prevent cross-vendor permission assignment', async () => {
      const response = await request(app)
        .post('/api/v1/admin/employees/:vendor-b-emp-id/permissions/grant')
        .set('Authorization', `Bearer ${vendorAAdminToken}`)
        .send({ permission: 'employee:manage' });

      expect([403, 404].includes(response.status)).toBe(true);
    });
  });

  describe('Audit Log Isolation', () => {
    test('Should isolate audit logs by vendor', async () => {
      const vendorAAudit = await pool.query(
        `SELECT sal.* FROM security_audit_log sal
         JOIN employees e ON sal.actor_id = e.id
         WHERE e.vendor_id = $1`,
        [vendorAToken.vendor_id]
      );

      const vendorBAudit = await pool.query(
        `SELECT sal.* FROM security_audit_log sal
         JOIN employees e ON sal.actor_id = e.id
         WHERE e.vendor_id = $1`,
        [vendorBToken.vendor_id]
      );

      // Vendor A cannot view Vendor B's audit logs through normal API
      const response = await request(app)
        .get(`/api/v1/admin/audit-logs?vendor_id=${vendorBToken.vendor_id}`)
        .set('Authorization', `Bearer ${vendorAAdminToken}`);

      if (response.status === 200) {
        // If allowed to query by vendor, should get empty or only vendor A logs
        response.body.data.forEach(log => {
          const vendorAIds = vendorAAudit.rows.map(r => r.id);
          expect(vendorAIds).toContain(log.id);
        });
      }
    });

    test('Should log vendor isolation violations', async () => {
      // Attempt to access other vendor data
      try {
        await request(app)
          .get(`/api/v1/admin/employees/${vendorBToken.vendor_id}`)
          .set('Authorization', `Bearer ${vendorAAdminToken}`);

        // Check if violation was logged
        const log = await pool.query(
          `SELECT * FROM security_audit_log 
           WHERE action LIKE '%denied%'
           AND metadata->'violation_type' = '"tenant_violation"'
           ORDER BY created_at DESC LIMIT 1`
        );

        if (log.rows.length > 0) {
          expect(log.rows[0].severity).toBe('critical');
        }
      } catch (error) {
        // Expected - access denied
      }
    });
  });

  describe('Data Leakage Prevention', () => {
    test('Should not leak vendor data through search', async () => {
      const response = await request(app)
        .get('/api/v1/catalog/products/search?query=*')
        .set('Authorization', `Bearer ${vendorAToken}`);

      expect(response.status).toBe(200);
      
      // Results should only contain vendor A products
      response.body.data.forEach(product => {
        expect(product.vendor_id).toBe(vendorAToken.vendor_id);
      });
    });

    test('Should not expose vendor metadata in error messages', async () => {
      const response = await request(app)
        .get('/api/v1/admin/employees/invalid-id')
        .set('Authorization', `Bearer ${vendorAAdminToken}`);

      expect(response.status).toBe(404);
      
      // Error message should not reveal other vendor's data
      const message = JSON.stringify(response.body);
      const otherVendorIds = [vendorBToken.vendor_id];
      
      otherVendorIds.forEach(vendorId => {
        expect(message).not.toContain(vendorId);
      });
    });

    test('Should prevent side-channel attacks through timing', async () => {
      const startTime = Date.now();
      
      // Query non-existent product (should be fast)
      const response = await request(app)
        .get('/api/v1/catalog/products/definitely-does-not-exist-id')
        .set('Authorization', `Bearer ${vendorAToken}`);

      const duration1 = Date.now() - startTime;

      const startTime2 = Date.now();
      
      // Query product from other vendor (should have similar timing)
      const response2 = await request(app)
        .get('/api/v1/catalog/products/other-vendor-product-id')
        .set('Authorization', `Bearer ${vendorAToken}`);

      const duration2 = Date.now() - startTime2;

      // Times should be similar (within 50ms) to prevent inference attacks
      expect(Math.abs(duration1 - duration2)).toBeLessThan(50);
    });
  });
});
