const nodemailer = require("nodemailer");
const logger = require("../../utils/logger");

const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_SECURE,
  EMAIL_SERVICE,
  EMAIL_USER,
  EMAIL_PASS,
  EMAIL_FROM,
} = process.env;

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT ? Number(EMAIL_PORT) : 587,
  secure: EMAIL_SECURE === "true", // false for STARTTLS
  service: EMAIL_SERVICE || undefined,
  auth: EMAIL_USER && EMAIL_PASS ? { user: EMAIL_USER, pass: EMAIL_PASS } : undefined,
});

const fromAddress = EMAIL_FROM || EMAIL_USER || "no-reply@example.com";

const sendEmail = async ({ to, subject, html, text }) => {
  const mailOptions = {
    from: fromAddress,
    to,
    subject,
    text: text || "",
    html,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info("Email sent successfully", { to, subject });
    return { success: true };
  } catch (error) {
    logger.error("Error sending email", { to, subject, error });
    return { success: false, error };
  }
};

const renderOrderItems = (items = []) => {
  if (!items.length) return "<p>No items listed.</p>";
  const rows = items
    .map(
      (item) =>
        `<tr><td>${item.name}</td><td>${item.quantity}</td><td>${item.price}</td><td>${item.subtotal}</td></tr>`
    )
    .join("");

  return `
    <table cellpadding="8" cellspacing="0" border="1" style="border-collapse:collapse;">
      <thead>
        <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
};

const sendOrderConfirmationEmail = async ({ to, orderId, total, items = [], orderUrl }) => {
  const html = `
    <h2>Your order is confirmed</h2>
    <p>Order ID: <strong>${orderId}</strong></p>
    ${renderOrderItems(items)}
    <p><strong>Total:</strong> ${total}</p>
    <p>You can view your order here: <a href="${orderUrl}">${orderUrl}</a></p>
  `;

  return sendEmail({
    to,
    subject: `Order Confirmation #${orderId}`,
    html,
    text: `Your order ${orderId} is confirmed. Total: ${total}. View: ${orderUrl}`,
  });
};

const sendPasswordResetEmail = async ({ to, resetUrl, expiresInMinutes = 30 }) => {
  const html = `
    <h2>Password reset requested</h2>
    <p>We received a request to reset your password. This link expires in ${expiresInMinutes} minutes.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>If you did not request this, you can ignore this email.</p>
  `;

  return sendEmail({
    to,
    subject: "Reset your password",
    html,
    text: `Reset your password: ${resetUrl} (expires in ${expiresInMinutes} minutes)`,
  });
};

const sendEmailVerification = async ({ to, verifyUrl }) => {
  const html = `
    <h2>Confirm your email</h2>
    <p>Please confirm your email address by clicking the link below.</p>
    <p><a href="${verifyUrl}">Confirm email</a></p>
  `;

  return sendEmail({
    to,
    subject: "Confirm your email address",
    html,
    text: `Confirm your email: ${verifyUrl}`,
  });
};

const sendEmployeeInvitation = async ({ to, inviterName, roleName, invitationUrl, expiryHours = 24 }) => {
  const html = `
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
  `;

  const text = `
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
  `;

  return sendEmail({
    to,
    subject: `🎉 You're Invited to Join as ${roleName}`,
    html,
    text,
  });
};

module.exports = {
  sendEmail,
  sendOrderConfirmationEmail,
  sendPasswordResetEmail,
  sendEmailVerification,
  sendEmployeeInvitation,
};