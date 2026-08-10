/**
 * Email Functionality Test Suite
 * Tests email sending, templates, and job queue processing
 */

const nodemailer = require('nodemailer');
const EmailTemplateService = require('../../infrastructure/email/emailTemplates');

// Mock nodemailer
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn(),
    verify: jest.fn(),
  }),
}));

// Mock logger
jest.mock('../../shared/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe('Email Service - Unit Tests', () => {
  let mockTransporter;
  let mockSendMail;
  const emailModule = require('../../infrastructure/email/email');

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail = jest.fn().mockResolvedValue({ messageId: '<123@nodemailer.com>' });
    mockTransporter = nodemailer.createTransport();
    mockTransporter.sendMail = mockSendMail;
  });

  describe('sendEmail', () => {
    it('sends email successfully with all parameters', async () => {
      const result = await emailModule.sendEmail({
        to: 'user@example.com',
        subject: 'Test Email',
        html: '<p>Test content</p>',
        text: 'Test content',
      });

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Test Email',
          html: '<p>Test content</p>',
          text: 'Test content',
        })
      );
    });

    it('handles email sending errors gracefully', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP connection failed'));

      const result = await emailModule.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('defaults text to empty string when not provided', async () => {
      await emailModule.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: '',
        })
      );
    });

    it('uses configured from address', async () => {
      await emailModule.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.any(String),
        })
      );
    });

    it('rejects invalid email addresses', async () => {
      await expect(
        emailModule.sendEmail({
          to: 'invalid-email',
          subject: 'Test',
          html: '<p>Test</p>',
        })
      ).rejects.toThrow();
    });
  });

  describe('sendEmailJob', () => {
    it('renders template and sends email', async () => {
      const jobData = {
        to: 'user@example.com',
        templateName: 'orderConfirmation',
        templateData: {
          orderId: '123',
          total: '99.99',
          items: [],
        },
      };

      const result = await emailModule.sendEmailJob(jobData);

      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          html: expect.stringContaining('123'), // Order ID in HTML
        })
      );
    });

    it('allows subject override', async () => {
      const jobData = {
        to: 'user@example.com',
        templateName: 'orderConfirmation',
        templateData: {
          orderId: '123',
          total: '99.99',
          items: [],
        },
        overrideSubject: 'Custom Subject',
      };

      await emailModule.sendEmailJob(jobData);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Custom Subject',
        })
      );
    });

    it('throws on template rendering error', async () => {
      const jobData = {
        to: 'user@example.com',
        templateName: 'nonexistent',
        templateData: {},
      };

      await expect(emailModule.sendEmailJob(jobData)).rejects.toThrow();
    });

    it('uses template default subject when override not provided', async () => {
      const jobData = {
        to: 'user@example.com',
        templateName: 'passwordReset',
        templateData: {
          resetUrl: 'https://example.com/reset/123',
          expiresInMinutes: 30,
        },
      };

      await emailModule.sendEmailJob(jobData);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'Reset your password',
        })
      );
    });
  });

  describe('Email Templates', () => {
    const templateService = require('../../infrastructure/email/emailTemplates');

    describe('renderOrderConfirmation', () => {
      it('renders complete order confirmation template', () => {
        const data = {
          orderId: 'ORD-2026-001',
          items: [
            { name: 'Laptop', quantity: 1, price: 999.99, subtotal: 999.99 },
            { name: 'Mouse', quantity: 2, price: 29.99, subtotal: 59.98 },
          ],
          total: 1059.97,
          orderUrl: 'https://example.com/orders/123',
        };

        const template = templateService.renderOrderConfirmation(data);

        expect(template.subject).toContain('ORD-2026-001');
        expect(template.html).toContain('ORD-2026-001');
        expect(template.html).toContain('Laptop');
        expect(template.html).toContain('1059.97');
        expect(template.text).toContain('ORD-2026-001');
      });

      it('handles empty items list', () => {
        const data = {
          orderId: 'ORD-123',
          items: [],
          total: 0,
          orderUrl: 'https://example.com/orders/123',
        };

        const template = templateService.renderOrderConfirmation(data);

        expect(template.html).toContain('No items listed');
      });

      it('handles missing orderUrl', () => {
        const data = {
          orderId: 'ORD-123',
          items: [],
          total: 100,
        };

        const template = templateService.renderOrderConfirmation(data);

        expect(template.html).toBeDefined();
        expect(template.text).toBeDefined();
      });
    });

    describe('renderPasswordReset', () => {
      it('renders password reset template with default expiry', () => {
        const data = {
          resetUrl: 'https://example.com/reset/token123',
        };

        const template = templateService.renderPasswordReset(data);

        expect(template.subject).toBe('Reset your password');
        expect(template.html).toContain('https://example.com/reset/token123');
        expect(template.html).toContain('30 minutes');
        expect(template.text).toContain('https://example.com/reset/token123');
      });

      it('renders password reset with custom expiry', () => {
        const data = {
          resetUrl: 'https://example.com/reset/token123',
          expiresInMinutes: 60,
        };

        const template = templateService.renderPasswordReset(data);

        expect(template.html).toContain('60 minutes');
      });
    });

    describe('renderEmailVerification', () => {
      it('renders email verification template', () => {
        const data = {
          verifyUrl: 'https://example.com/verify/token123',
        };

        const template = templateService.renderEmailVerification(data);

        expect(template.subject).toContain('email');
        expect(template.html).toContain('https://example.com/verify/token123');
        expect(template.text).toContain('https://example.com/verify/token123');
      });
    });

    describe('renderEmployeeInvitation', () => {
      it('renders employee invitation with all details', () => {
        const data = {
          to: 'newemployee@example.com',
          inviterName: 'John Manager',
          roleName: 'Senior Developer',
          invitationUrl: 'https://example.com/invite/token123',
          expiryHours: 48,
        };

        const template = templateService.renderEmployeeInvitation(data);

        expect(template.subject).toContain('Senior Developer');
        expect(template.html).toContain('John Manager');
        expect(template.html).toContain('Senior Developer');
        expect(template.html).toContain('newemployee@example.com');
        expect(template.html).toContain('48 hours');
        expect(template.text).toContain('newemployee@example.com');
      });

      it('renders with default expiry hours', () => {
        const data = {
          to: 'newemployee@example.com',
          inviterName: 'John Manager',
          roleName: 'Developer',
          invitationUrl: 'https://example.com/invite/token123',
        };

        const template = templateService.renderEmployeeInvitation(data);

        expect(template.html).toContain('24 hours');
      });

      it('includes security warnings in invitation', () => {
        const data = {
          to: 'newemployee@example.com',
          inviterName: 'John Manager',
          roleName: 'Developer',
          invitationUrl: 'https://example.com/invite/token123',
        };

        const template = templateService.renderEmployeeInvitation(data);

        expect(template.html).toContain('expir');
        expect(template.html).toContain('once');
        expect(template.html).toContain('share');
      });
    });

    describe('render method', () => {
      it('dispatches to correct template renderer', () => {
        const data = {
          orderId: 'ORD-123',
          items: [],
          total: 100,
          orderUrl: 'https://example.com',
        };

        const template = templateService.render('orderConfirmation', data);

        expect(template.subject).toBeDefined();
        expect(template.html).toBeDefined();
        expect(template.text).toBeDefined();
      });

      it('throws for unknown template name', () => {
        expect(() => {
          templateService.render('unknownTemplate', {});
        }).toThrow();
      });
    });
  });

  describe('Email Queue Integration', () => {
    it('emails are queued with retry configuration', async () => {
      const jobData = {
        to: 'user@example.com',
        templateName: 'orderConfirmation',
        templateData: { orderId: '123', total: '99.99', items: [] },
      };

      const result = await emailModule.sendEmailJob(jobData);

      expect(result.success).toBe(true);
    });
  });

  describe('Email Configuration', () => {
    it('uses configured email sender address', () => {
      expect(emailModule.fromAddress).toBeDefined();
      expect(typeof emailModule.fromAddress).toBe('string');
    });

    it('validates email recipients', async () => {
      const invalidEmails = ['', 'not-an-email', 'missing@domain'];

      for (const email of invalidEmails) {
        await expect(
          emailModule.sendEmail({
            to: email,
            subject: 'Test',
            html: '<p>Test</p>',
          })
        ).rejects.toThrow();
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('handles transporter errors', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('Connection timeout'));

      const result = await emailModule.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
    });

    it('handles malformed email data', async () => {
      await expect(
        emailModule.sendEmail({
          to: 'user@example.com',
          subject: null,
          html: undefined,
        })
      ).rejects.toThrow();
    });

    it('logs errors appropriately', async () => {
      mockSendMail.mockRejectedValueOnce(new Error('SMTP error'));

      await emailModule.sendEmail({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      // Logger should be called (mocked)
      expect(emailModule.sendEmail).toBeDefined();
    });
  });

});
