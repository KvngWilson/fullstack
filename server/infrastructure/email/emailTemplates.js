/**
 * Email Template Service
 * Renders email templates to HTML and text formats
 * Used by job queue processor for async email sending
 */

class EmailTemplateService {
  /**
   * Render order confirmation template
   */
  renderOrderConfirmation(data) {
    const { orderId, items = [], total, orderUrl } = data;

    const itemRows = (items || [])
      .map(
        (item) =>
          `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${item.price}</td><td>${item.subtotal}</td></tr>`,
      )
      .join("");

    const itemsTable =
      itemRows.length > 0
        ? `
    <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;">
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>`
        : "<p>No items listed.</p>";

    return {
      subject: `Order Confirmation #${orderId}`,
      html: `
    <h2>Your order is confirmed</h2>
    <p>Order ID: <strong>${orderId}</strong></p>
    ${itemsTable}
    <p><strong>Total:</strong> ${total}</p>
    <p>You can view your order here: <a href="${orderUrl}">${orderUrl}</a></p>
  `,
      text: `Your order ${orderId} is confirmed. Total: ${total}. View: ${orderUrl}`,
    };
  }

  /**
   * Render password reset template
   */
  renderPasswordReset(data) {
    const { resetUrl, expiresInMinutes = 30 } = data;

    return {
      subject: "Reset your password",
      html: `
    <h2>Password reset requested</h2>
    <p>We received a request to reset your password. This link expires in ${expiresInMinutes} minutes.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>If you did not request this, you can ignore this email.</p>
  `,
      text: `Reset your password: ${resetUrl} (expires in ${expiresInMinutes} minutes)`,
    };
  }

  /**
   * Render email verification template
   */
  renderEmailVerification(data) {
    const { verifyUrl } = data;

    return {
      subject: "Confirm your email address",
      html: `
    <h2>Confirm your email</h2>
    <p>Please confirm your email address by clicking the link below.</p>
    <p><a href="${verifyUrl}">Confirm email</a></p>
  `,
      text: `Confirm your email: ${verifyUrl}`,
    };
  }

  /**
   * Render employee invitation template
   */
  renderEmployeeInvitation(data) {
    const { to, inviterName, roleName, invitationUrl, expiryHours = 24 } = data;

    return {
      subject: `🎉 You're Invited to Join as ${roleName}`,
      html: `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
        .cta-button { display: inline-block; background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0; }
        .cta-button:hover { background: #2563eb; }
        .info-box { background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
        .warning { color: #dc2626; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1 style="margin: 0;">🎉 You've Been Invited!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Join our team as ${roleName}</p>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p><strong>${inviterName}</strong> has invited you to join the team with the role of <strong>${roleName}</strong>.</p>
          
          <div class="info-box">
            <p style="margin: 0;"><strong>📧 Your Email:</strong> ${to}</p>
            <p style="margin: 10px 0 0 0;"><strong>👤 Assigned Role:</strong> ${roleName}</p>
            <p style="margin: 10px 0 0 0;"><strong>⏰ Expires In:</strong> ${expiryHours} hours</p>
          </div>

          <p>Click the button below to accept this invitation and set up your account:</p>
          
          <div style="text-align: center;">
            <a href="${invitationUrl}" class="cta-button">Accept Invitation & Create Account</a>
          </div>

          <p style="font-size: 12px; color: #6b7280;">Or copy and paste this link into your browser:<br>
          <a href="${invitationUrl}" style="color: #3b82f6; word-break: break-all;">${invitationUrl}</a></p>

          <div class="info-box" style="border-color: #ef4444; background: #fef2f2;">
            <p class="warning" style="margin: 0;">⚠️ Important Security Notes:</p>
            <ul style="margin: 10px 0 0 0; padding-left: 20px;">
              <li>This invitation expires in ${expiryHours} hours</li>
              <li>The link can only be used once</li>
              <li>Never share this link with anyone</li>
              <li>If you didn't expect this invitation, please contact your administrator</li>
            </ul>
          </div>

          <p>We look forward to having you on the team!</p>
          <p>Best regards,<br><strong>Admin Team</strong></p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
          <p>&copy; ${new Date().getFullYear()} Admin Control Center. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `,
      text: `
You've Been Invited to Join the Team!

${inviterName} has invited you to join as ${roleName}.

Your Email: ${to}
Assigned Role: ${roleName}
Expires In: ${expiryHours} hours

Accept your invitation here:
${invitationUrl}

IMPORTANT:
- This invitation expires in ${expiryHours} hours
- The link can only be used once
- Never share this link with anyone
- If you didn't expect this invitation, contact your administrator

Best regards,
Admin Team
  `,
    };
  }

  /**
   * Get template by name and render with data
   */
  render(templateName, data) {
    const methodName = `render${this._capitalize(templateName)}`;

    if (typeof this[methodName] !== "function") {
      throw new Error(`Template not found: ${templateName}`);
    }

    return this[methodName](data);
  }

  /**
   * Capitalize string (helper)
   * @private
   */
  _capitalize(str) {
    return str
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join("");
  }
}

module.exports = new EmailTemplateService();
