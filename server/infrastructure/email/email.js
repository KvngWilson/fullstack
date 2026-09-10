const nodemailer = require("nodemailer");
const logger = require("../../shared/utils/logger");
const emailTemplates = require("./emailTemplates");
const { withChildSpan } = require("../observability/tracing/tracingScope");

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
  secure: EMAIL_SECURE === "true",
  service: EMAIL_SERVICE || undefined,
  auth:
    EMAIL_USER && EMAIL_PASS ? { user: EMAIL_USER, pass: EMAIL_PASS } : undefined,
});

const fromAddress = EMAIL_FROM || EMAIL_USER || "no-reply@example.com";


// Validate email address format
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || typeof email !== 'string' || !emailRegex.test(email.trim())) {
    throw new Error(`Invalid email address: ${email}`);
  }
  return email.trim();
};

// Core email sending function
// Used internally by queue processors and directly for simple sends (e.g. password reset)
const sendEmail = async ({ to, subject, html, text }) => {
  if (!to || !subject || !html) {
    throw new Error('Email requires: to, subject, html');
  }

  const validatedEmail = validateEmail(to);

  const mailOptions = {
    from: fromAddress,
    to: validatedEmail,
    subject,
    text: text || "",
    html,
  };

  try {
    await withChildSpan(
      "external.email.send",
      {
        tags: {
          "external.system": "smtp",
          "external.operation": "sendMail",
          "email.to": validatedEmail,
        },
      },
      () => transporter.sendMail(mailOptions),
    );
    logger.info("Email sent successfully", { to: validatedEmail, subject });
    return { success: true };
  } catch (error) {
    logger.error("Error sending email", { to: validatedEmail, subject, error: error.message });
    return { success: false, error };
  }
};


// Queue processor function
// Receives template name and data, renders template, then sends 
const sendEmailJob = async (jobData) => {
  try {
    const { to, templateName, templateData = {}, overrideSubject } = jobData;

    if (!to || !templateName) {
      throw new Error('Email job requires: to, templateName');
    }

    // Render template with data
    const templateContent = emailTemplates.render(templateName, templateData);

    // Allow override of subject if provided
    const subject = overrideSubject || templateContent.subject;

    // Send email
    return await sendEmail({
      to,
      subject,
      html: templateContent.html,
      text: templateContent.text,
    });
  } catch (error) {
    logger.error("Email job processing failed", {
      error: error.message,
      jobData,
    });
    throw error;
  }
};

module.exports = {
  sendEmail,
  sendEmailJob,
  fromAddress,
  validateEmail,
};