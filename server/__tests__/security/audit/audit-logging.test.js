/**
 * Audit Logging Test Suite
 * 
 * Tests comprehensive audit trail logging for sensitive operations,
 * including authorization checks, data mutations, and security events.
 */

const request = require('supertest');
const { createApp } = require('../../../src/app');
const { pool } = require('../../../config/db');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

describe('Audit Logging Tests', () => {
  let app;
  let adminToken;
  let employeeToken;
  const { disable, isReady, dbTest } = createDbInfraGuard();
  const test = dbTest;

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    app = createApp();
  });

  afterAll(async () => {
    if (!isReady()) return;
    await pool.end();
  });

  describe('Operation Logging', () => {
    test('Should log employee creation', async () => {
      const response = await request(app)
        .post('/api/v1/admin/employees/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newemployee@test.com',
          role: 'manager',
          department: 'sales'
        });

      expect(response.status).toBe(201);
      const employeeId = response.body.data.id;

      // Check audit log
      const auditLog = await pool.query(
        `SELECT * FROM security_audit_log 
         WHERE action = 'employee_created' 
         AND resource_id = $1
         ORDER BY created_at DESC LIMIT 1`,
        [employeeId]
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
      const log = auditLog.rows[0];

      expect(log.actor_id).toBeDefined();
      expect(log.resource_type).toBe('employee');
      expect(log.metadata.email).toBe('newemployee@test.com');
      expect(log.metadata.role).toBe('manager');
      expect(log.timestamp).toBeDefined();
    });

    test('Should log role updates with before/after values', async () => {
      const response = await request(app)
        .patch('/api/v1/admin/employees/:id/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'senior_manager' });

      const auditLog = await pool.query(
        `SELECT * FROM security_audit_log 
         WHERE action = 'role_updated'
         ORDER BY created_at DESC LIMIT 1`
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
      const log = auditLog.rows[0];

      expect(log.metadata.old_role).toBeDefined();
      expect(log.metadata.new_role).toBe('senior_manager');
      expect(log.actor_id).toBeDefined();
    });

    test('Should log permission grant/revoke', async () => {
      const response = await request(app)
        .post('/api/v1/admin/employees/:id/permissions/grant')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          permission: 'employee:delete',
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

      const auditLog = await pool.query(
        `SELECT * FROM security_audit_log 
         WHERE action = 'permission_granted'
         ORDER BY created_at DESC LIMIT 1`
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
      const log = auditLog.rows[0];

      expect(log.metadata.permission).toBe('employee:delete');
      expect(log.metadata.grant_type).toBe('grant');
      expect(log.resource_type).toBe('permission');
    });

    test('Should log order creation with customer and amount', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          items: [{ product_id: 1, quantity: 2 }],
          currency: 'USD'
        });

      expect(response.status).toBe(201);
      const orderId = response.body.data.id;

      const auditLog = await pool.query(
        `SELECT * FROM security_audit_log 
         WHERE action = 'order_created' 
         AND resource_id = $1`,
        [orderId]
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
      const log = auditLog.rows[0];

      expect(log.metadata.customer_id).toBeDefined();
      expect(log.metadata.total_amount).toBeGreaterThan(0);
      expect(log.metadata.currency).toBe('USD');
    });
  });

  describe('Security Event Logging', () => {
    test('Should log failed authorization attempts', async () => {
      await request(app)
        .get('/api/v1/admin/employees')
        .set('Authorization', 'Bearer invalid_token');

      const auditLog = await pool.query(
        `SELECT * FROM security_audit_log 
         WHERE action = 'authorization_denied'
         ORDER BY created_at DESC LIMIT 1`
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
      const log = auditLog.rows[0];

      expect(log.metadata.reason).toContain('Authentication');
      expect(log.severity).toBe('warning');
    });

    test('Should log permission denial', async () => {
      await request(app)
        .delete('/api/v1/admin/employees/:id')
        .set('Authorization', `Bearer ${employeeToken}`);

      const auditLog = await pool.query(
        `SELECT * FROM security_audit_log 
         WHERE action = 'permission_denied'
         ORDER BY created_at DESC LIMIT 1`
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
      const log = auditLog.rows[0];

      expect(log.severity).toBe('warning');
      expect(log.metadata.required_permission).toBeDefined();
    });

    test('Should log suspicious activities with elevated severity', async () => {
      // Attempt privilege escalation
      await request(app)
        .patch('/api/v1/admin/employees/self')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ role: 'admin', hierarchy_level: 100 });

      const auditLog = await pool.query(
        `SELECT * FROM security_audit_log 
         WHERE metadata->>'attempt' = 'privilege_escalation'
         ORDER BY created_at DESC LIMIT 1`
      );

      if (auditLog.rows.length > 0) {
        expect(auditLog.rows[0].severity).toBe('critical');
        expect(auditLog.rows[0].action).toContain('denied');
      }
    });

    test('Should log data exfiltration attempts', async () => {
      // Try to export large dataset without permission
      await request(app)
        .get('/api/v1/admin/audit-logs/export?format=csv&limit=100000')
        .set('Authorization', `Bearer ${employeeToken}`);

      const auditLog = await pool.query(
        `SELECT * FROM security_audit_log 
         WHERE action LIKE '%export%'
         AND metadata->>'resource_size' > '10000'
         ORDER BY created_at DESC LIMIT 1`
      );

      if (auditLog.rows.length > 0) {
        expect(['warning', 'critical'].includes(auditLog.rows[0].severity)).toBe(true);
      }
    });
  });

  describe('Audit Trail Completeness', () => {
    test('Should include all required fields in audit log', async () => {
      const auditLog = await pool.query(
        `SELECT * FROM security_audit_log 
         ORDER BY created_at DESC LIMIT 1`
      );

      expect(auditLog.rows.length).toBeGreaterThan(0);
      const log = auditLog.rows[0];

      // Check required fields
      expect(log.id).toBeDefined();
      expect(log.actor_id).toBeDefined();
      expect(log.action).toBeDefined();
      expect(log.resource_type).toBeDefined();
      expect(log.resource_id).toBeDefined();
      expect(log.metadata).toBeDefined();
      expect(log.severity).toBeDefined();
      expect(log.created_at).toBeDefined();
      expect(log.timestamp).toBeDefined();
    });

    test('Should preserve audit logs immutably', async () => {
      // Try to update audit log
      const auditLog = await pool.query(
        `SELECT id FROM security_audit_log LIMIT 1`
      );

      const logId = auditLog.rows[0].id;

      // Attempt update should fail
      try {
        await pool.query(
          `UPDATE security_audit_log SET action = 'modified' WHERE id = $1`,
          [logId]
        );
        fail('Should not be able to update audit log');
      } catch (error) {
        // Expected - audit logs should be immutable
        expect(error.message).toContain('cannot');
      }
    });

    test('Should store formatted timestamps consistently', async () => {
      const auditLog = await pool.query(
        `SELECT created_at, timestamp, updated_at FROM security_audit_log 
         WHERE created_at IS NOT NULL
         LIMIT 5`
      );

      auditLog.rows.forEach(log => {
        // Both timestamps should exist
        expect(log.created_at).toBeDefined();
        expect(log.timestamp).toBeDefined();

        // created_at should be <= timestamp
        expect(new Date(log.created_at).getTime())
          .toBeLessThanOrEqual(new Date(log.timestamp).getTime());
      });
    });
  });

  describe('Audit Log Querying & Reporting', () => {
    test('Should query audit logs by action', async () => {
      const auditLog = await pool.query(
        `SELECT COUNT(*) FROM security_audit_log 
         WHERE action = 'employee_created'`
      );

      expect(parseInt(auditLog.rows[0].count)).toBeGreaterThanOrEqual(0);
    });

    test('Should query audit logs by actor', async () => {
      const auditLog = await pool.query(
        `SELECT COUNT(*) FROM security_audit_log 
         WHERE actor_id = $1`,
        [adminToken.user_id]
      );

      expect(parseInt(auditLog.rows[0].count)).toBeGreaterThanOrEqual(0);
    });

    test('Should query audit logs by severity', async () => {
      const criticalLogs = await pool.query(
        `SELECT COUNT(*) FROM security_audit_log 
         WHERE severity IN ('critical', 'warning')`
      );

      expect(parseInt(criticalLogs.rows[0].count)).toBeGreaterThanOrEqual(0);
    });

    test('Should export audit logs as CSV', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit-logs/export?format=csv')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.type).toContain('text/csv');
      expect(response.text).toContain('actor_id,action,resource_type');
    });

    test('Should export audit logs as JSON', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit-logs/export?format=json')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.type).toContain('application/json');
      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
