/**
 * Operational Alerts Infrastructure
 *
 * Sends critical alerts to operations team via configured channels:
 * - Slack (via webhook)
 * - PagerDuty (via API)
 * - Email (critical alerts)
 * - Logging (fallback)
 *
 * Environment Variables:
 * - SLACK_WEBHOOK_URL: Slack incoming webhook URL
 * - PAGERDUTY_API_KEY: PagerDuty integration key
 * - PAGERDUTY_ROUTING_KEY: PagerDuty routing key
 * - OPS_ALERT_EMAIL: Email address for critical alerts
 * - ALERT_ENABLED: Enable/disable alerts (default: true in productSion)
 */

const logger = require("../../shared/utils/logger");
const StructuredLogger = require("../logging/StructuredLogger");

const structuredLogger = new StructuredLogger("alerts");

// Configuration
const config = {
  enabled: process.env.ALERT_ENABLED !== "false",
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
  pagerDutyApiKey: process.env.PAGERDUTY_API_KEY,
  pagerDutyRoutingKey: process.env.PAGERDUTY_ROUTING_KEY,
  opsAlertEmail: process.env.OPS_ALERT_EMAIL,
  environment: process.env.NODE_ENV || "development",
};

/**
 * Format alert for Slack
 */
function formatSlackMessage(alert) {
  const color =
    alert.severity === "critical"
      ? "danger"
      : alert.severity === "warning"
        ? "warning"
        : "good";

  const fields = [];

  if (alert.service) {
    fields.push({
      title: "Service",
      value: alert.service,
      short: true,
    });
  }

  if (alert.actionRequired) {
    fields.push({
      title: "Action Required",
      value: "Yes - Manual Intervention Needed",
      short: true,
    });
  }

  if (alert.context) {
    fields.push({
      title: "Context",
      value: "```" + JSON.stringify(alert.context, null, 2) + "```",
      short: false,
    });
  }

  return {
    username: "Operations Alert",
    icon_emoji: "",
    attachments: [
      {
        color,
        title: alert.title,
        text: alert.description,
        fields,
        footer: `Environment: ${config.environment}`,
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

/**
 * Send alert to Slack
 */
async function sendSlackAlert(alert) {
  if (!config.slackWebhookUrl) {
    structuredLogger.debug(
      "Slack webhook URL not configured, skipping Slack alert",
    );
    return { success: false, reason: "not_configured" };
  }

  try {
    const payload = formatSlackMessage(alert);

    const response = await fetch(config.slackWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Slack API error: ${response.status} ${response.statusText}`,
      );
    }

    structuredLogger.info("Slack alert sent successfully", {
      title: alert.title,
      severity: alert.severity,
    });

    return { success: true, channel: "slack" };
  } catch (error) {
    structuredLogger.error("Failed to send Slack alert", {
      error: error.message,
      title: alert.title,
    });
    return { success: false, channel: "slack", error: error.message };
  }
}

/**
 * Send alert to PagerDuty
 */
async function sendPagerDutyAlert(alert) {
  if (!config.pagerDutyRoutingKey) {
    structuredLogger.debug(
      "PagerDuty routing key not configured, skipping PagerDuty alert",
    );
    return { success: false, reason: "not_configured" };
  }

  // Only send critical alerts to PagerDuty
  if (alert.severity !== "critical") {
    return { success: false, reason: "not_critical" };
  }

  try {
    const payload = {
      routing_key: config.pagerDutyRoutingKey,
      event_action: "trigger",
      payload: {
        summary: alert.title,
        severity: alert.severity,
        source: alert.service || "unknown",
        custom_details: {
          description: alert.description,
          context: alert.context,
          action_required: alert.actionRequired,
          environment: config.environment,
        },
      },
    };

    const response = await fetch("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`PagerDuty API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    structuredLogger.info("PagerDuty alert sent successfully", {
      title: alert.title,
      dedup_key: result.dedup_key,
    });

    return { success: true, channel: "pagerduty", dedup_key: result.dedup_key };
  } catch (error) {
    structuredLogger.error("Failed to send PagerDuty alert", {
      error: error.message,
      title: alert.title,
    });
    return { success: false, channel: "pagerduty", error: error.message };
  }
}

/**
 * Send alert via email (requires email infrastructure)
 */
async function sendEmailAlert(alert) {
  if (!config.opsAlertEmail) {
    structuredLogger.debug(
      "Ops alert email not configured, skipping email alert",
    );
    return { success: false, reason: "not_configured" };
  }

  // Only send critical alerts via email
  if (alert.severity !== "critical") {
    return { success: false, reason: "not_critical" };
  }

  try {
    // Lazy-load email module to avoid circular dependencies
    const { sendEmail } = require("../email");

    const emailBody = `
    <h2>${alert.title}</h2>
    <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
    <p><strong>Service:</strong> ${alert.service || "Unknown"}</p>
    <p><strong>Action Required:</strong> ${alert.actionRequired ? "YES" : "No"}</p>
    
    <h3>Description</h3>
    <p>${alert.description}</p>
    
    ${
      alert.context
        ? `
      <h3>Context</h3>
      <pre>${JSON.stringify(alert.context, null, 2)}</pre>
    `
        : ""
    }
    
    <hr>
    <p><small>Environment: ${config.environment} | Timestamp: ${new Date().toISOString()}</small></p>
    `;

    await sendEmail({
      to: config.opsAlertEmail,
      subject: ` ${alert.title}`,
      html: emailBody,
    });

    structuredLogger.info("Email alert sent successfully", {
      title: alert.title,
      recipient: config.opsAlertEmail,
    });

    return { success: true, channel: "email" };
  } catch (error) {
    structuredLogger.error("Failed to send email alert", {
      error: error.message,
      title: alert.title,
    });
    return { success: false, channel: "email", error: error.message };
  }
}

/**
 * Main function to send operational alerts
 *
 * @param {Object} alert - Alert configuration
 * @param {string} alert.severity - Alert severity ('critical', 'warning', 'info')
 * @param {string} alert.title - Alert title
 * @param {string} alert.description - Alert description
 * @param {Object} [alert.context] - Additional context data
 * @param {string} [alert.service] - Service identifier
 * @param {boolean} [alert.actionRequired] - Whether manual action is required
 * @returns {Promise<Object>} - Result with success status and channels
 */
async function sendOpsAlert(alert) {
  // Validate required fields
  if (!alert.title || !alert.description || !alert.severity) {
    throw new Error("Alert must include title, description, and severity");
  }

  // Log alert locally for audit trail
  const logLevel =
    alert.severity === "critical"
      ? "error"
      : alert.severity === "warning"
        ? "warn"
        : "info";

  logger[logLevel](" OPERATIONAL ALERT", {
    title: alert.title,
    description: alert.description,
    severity: alert.severity,
    service: alert.service,
    actionRequired: alert.actionRequired,
    context: alert.context,
  });

  // If alerts are disabled, just log and return
  if (!config.enabled) {
    structuredLogger.info("Alerts disabled, logged only", {
      title: alert.title,
    });
    return { success: true, channels: ["log"], alertsDisabled: true };
  }

  // Send to all configured channels in parallel
  const results = await Promise.allSettled([
    sendSlackAlert(alert),
    sendPagerDutyAlert(alert),
    sendEmailAlert(alert),
  ]);

  const channels = results
    .filter((r) => r.status === "fulfilled" && r.value.success)
    .map((r) => r.value.channel);

  const failures = results
    .filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !r.value.success),
    )
    .map((r) => (r.status === "rejected" ? r.reason : r.value));

  const allFailed =
    channels.length === 0 &&
    failures.some((f) => f.reason !== "not_configured");

  if (allFailed) {
    structuredLogger.error("All alert channels failed", {
      title: alert.title,
      failures,
    });
  }

  return {
    success: channels.length > 0 || !allFailed,
    channels: channels.length > 0 ? channels : ["log"],
    failures: failures.length > 0 ? failures : undefined,
  };
}

module.exports = {
  sendOpsAlert,
  sendSlackAlert,
  sendPagerDutyAlert,
  sendEmailAlert,
};
