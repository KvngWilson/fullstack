/**
 * Employee Invitation Integration Test Suite
 * Tests employee invitation endpoint with email delivery
 */

const request = require('supertest');
const { pool } = require('../../../config/db');
const argon2 = require('argon2');
const { createApp } = require('../../../src/app');

// Mock email service
jest.mock('../../../infrastructure/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({
    success: true,
    messageId: 'test-message-id',
  }),
}));

const { sendEmail } = require('../../../infrastructure/email');

const app = createApp();
const INVITE_TEST_SUFFIX = '@invite-test.local';

// Note: Requires setting up permissions/roles tables and RBAC system
// Enable with: RUN_LEGACY_EMPLOYEE_INVITATION_TESTS=true npm run test:integration
const describeEmployeeInvitation = process.env.RUN_LEGACY_EMPLOYEE_INVITATION_TESTS === 'true' && global.__TEST_DB_AVAILABLE
  ? describe
  : describe.skip;

describeEmployeeInvitation('Employee Invitation Integration Tests', () => {
  let adminToken;
  let adminUser;
  let inviteTestRole;

  const cleanupInvitations = async () => {
    await pool.query(
      `DELETE FROM employee_invitations WHERE email LIKE $1`,
      [`%${INVITE_TEST_SUFFIX}`]
    );

    await pool.query(
      `DELETE FROM users WHERE email LIKE $1`,
      [`%${INVITE_TEST_SUFFIX}`]
    );
  };

  beforeAll(async () => {
    // Create admin user for invitations
    const adminEmail = `admin-${Date.now()}@company.test`;
    const hashedPassword = await argon2.hash('Test123!@#');

    const adminResult = await pool.query(
      `INSERT INTO users (email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, role`,
      [adminEmail, hashedPassword, 'admin', true]
    );

    adminUser = adminResult.rows[0];

    // Login and get token
    const loginResponse = await request(app)
      .post('/api/v1/identity/users/login')
      .send({
        email: adminEmail,
        password: 'Test123!@#',
      });

    adminToken = loginResponse.body.data?.token || loginResponse.body.token;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await cleanupInvitations();
  });

  afterAll(async () => {
    await cleanupInvitations();
    await pool.query('DELETE FROM users WHERE email = $1', [adminUser.email]);
    await pool.end();
  });

  describe('POST /api/v1/identity/employees/invite', () => {
    it('invites employee and sends invitation email', async () => {
      const inviteEmail = `newemployee-${Date.now()}${INVITE_TEST_SUFFIX}`;

      const response = await request(app)
        .post('/api/v1/identity/employees/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: 2, // Standard employee role
        });

      expect(response.status).toBe(201);
      expect(response.body.data.invitationId).toBeDefined();
      expect(response.body.data.email).toBe(inviteEmail);

      // Verify email was sent
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: inviteEmail,
          subject: expect.stringContaining('Join Our Team'),
          template: 'employee-invitation',
        })
      );
    });

    it('includes valid invitation token in email URL', async () => {
      const inviteEmail = `newemp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      await request(app)
        .post('/api/v1/identity/employees/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: 2,
        });

      // Verify email call includes URL with token
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            invitationUrl: expect.stringContaining('/accept-invitation'),
            invitationUrl: expect.stringContaining('token='),
          }),
        })
      );
    });

    it('includes inviter name in invitation email', async () => {
      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      await request(app)
        .post('/api/v1/identity/employees/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: 2,
        });

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            inviterName: expect.any(String),
            expiresIn: '24 hours',
          }),
        })
      );
    });

    it('handles email failure without blocking invitation creation', async () => {
      sendEmail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      const response = await request(app)
        .post('/api/v1/identity/employees/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: 2,
        });

      // Invitation should still be created
      expect(response.status).toBe(201);
      expect(response.body.data.invitationId).toBeDefined();

      // Verify email was attempted
      expect(sendEmail).toHaveBeenCalled();
    });

    it('creates invitation with 24-hour expiration', async () => {
      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      const response = await request(app)
        .post('/api/v1/identity/employees/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: 2,
        });

      const { invitationId } = response.body.data;

      // Query database to verify expiration
      const inviteResult = await pool.query(
        `SELECT expires_at FROM invitations WHERE id = $1`,
        [invitationId]
      );

      const invitation = inviteResult.rows[0];
      const expiresAt = new Date(invitation.expires_at);
      const now = new Date();
      const hoursDiff = (expiresAt - now) / (1000 * 60 * 60);

      // Should expire in approximately 24 hours
      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThanOrEqual(24);
    });

    it('requires admin authentication', async () => {
      const response = await request(app)
        .post('/api/v1/identity/employees/invite')
        .send({
          email: `emp-${Date.now()}${INVITE_TEST_SUFFIX}`,
          roleId: 2,
        });

      expect(response.status).toBe(401);
    });

    it('rejects duplicate invitations to same email', async () => {
      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      // First invitation
      await request(app)
        .post('/api/v1/identity/employees/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: 2,
        });

      sendEmail.mockClear();

      // Second invitation to same email
      const response = await request(app)
        .post('/api/v1/identity/employees/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: 2,
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already invited');
    });

    it('creates acceptance route and verifies token', async () => {
      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;

      // Send invitation
      const inviteResponse = await request(app)
        .post('/api/v1/identity/employees/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: 2,
        });

      const { invitationId } = inviteResponse.body.data;

      // Get invitation to extract token
      const inviteRecord = await pool.query(
        `SELECT invitation_token FROM invitations WHERE id = $1`,
        [invitationId]
      );

      const token = inviteRecord.rows[0].invitation_token;

      // Verify acceptance with token
      const acceptResponse = await request(app)
        .post('/api/auth/accept-invitation')
        .send({
          token,
          password: 'NewEmployee123!@#',
          name: 'New Employee',
        });

      expect(acceptResponse.status).toBe(200);
      expect(acceptResponse.body.data.email).toBe(inviteEmail);
    });
  });

  describe('Invitation Email Content', () => {
    it('sends email with proper template context', async () => {
      const inviteEmail = `emp-${Date.now()}${INVITE_TEST_SUFFIX}`;
      const inviterName = adminUser.name || 'Admin';

      await request(app)
        .post('/api/v1/identity/employees/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: inviteEmail,
          roleId: 2,
        });

      const emailCall = sendEmail.mock.calls[0][0];

      expect(emailCall).toMatchObject({
        to: inviteEmail,
        subject: 'Join Our Team - Employee Invitation',
        template: 'employee-invitation',
        context: {
          invitationUrl: expect.stringMatching(/^http/),
          inviterName: expect.any(String),
          expiresIn: '24 hours',
        },
      });

      // Verify inviter name is included
      expect(emailCall.context.inviterName).toBeTruthy();
    });
  });
});
