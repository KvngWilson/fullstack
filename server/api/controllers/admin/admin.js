const adminService = require("../../../services/admin");
const { pool } = require("../../../config/db");
const fs = require("fs");
const path = require("path");
const { successResponse, errorResponse } = require("../../../shared/utils/response");
const logger = require("../../../shared/utils/logger");
const PERMISSIONS = require("../../../shared/constants/permissions");
const { checkDatabase, checkRedis } = require("../health");
const { getMetricsSnapshot } = require("../../middleware/metrics");
const { getJobQueuesRuntime } = require("../../../infrastructure/jobs/runtime");
const { enqueueManualJob } = require("./jobsController");
const {
  renderOperationsView,
  renderAdminViewError,
} = require("../../../views/admin/rendering");
const domain = require("../../../domain");
const permissionService = domain.identity.services.PermissionService;
const REPO_ROOT = path.resolve(__dirname, "../../../..");
const SERVER_ROOT = path.resolve(__dirname, "../../..");

function getFrontendAdminUrl(pathname = "") {
  const baseUrl = (
    process.env.FRONTEND_URL ||
    process.env.API_URL ||
    "http://localhost:5173"
  ).replace(/\/$/, "");

  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${baseUrl}${normalizedPath}`;
}

function redirectToCsrAdmin(res, pathname, message) {
  const target = new URL(getFrontendAdminUrl(pathname));

  if (message) {
    target.searchParams.set("notice", message);
  }

  return res.redirect(target.toString());
}

function fileExists(targetPath) {
  return fs.existsSync(targetPath);
}

function buildObservabilityData() {
  const telemetryRoot = path.join(REPO_ROOT, "telemetry");
  const observabilityRoot = path.join(SERVER_ROOT, "infrastructure", "observability");
  const tracingRoot = path.join(observabilityRoot, "tracing");

  const monitoringAssets = [
    {
      label: "Telemetry index",
      relativePath: "telemetry/README.md",
      exists: fileExists(path.join(telemetryRoot, "README.md")),
    },
    {
      label: "Monitoring guide",
      relativePath: "telemetry/MONITORING.md",
      exists: fileExists(path.join(telemetryRoot, "MONITORING.md")),
    },
    {
      label: "Compose stack",
      relativePath: "telemetry/docker-compose.monitoring.yml",
      exists: fileExists(path.join(telemetryRoot, "docker-compose.monitoring.yml")),
    },
    {
      label: "Deploy script",
      relativePath: "telemetry/deploy-monitoring.sh",
      exists: fileExists(path.join(telemetryRoot, "deploy-monitoring.sh")),
    },
    {
      label: "Monitoring config index",
      relativePath: "telemetry/monitoring/README.md",
      exists: fileExists(path.join(telemetryRoot, "monitoring", "README.md")),
    },
    {
      label: "Prometheus config",
      relativePath: "telemetry/monitoring/prometheus.yml",
      exists: fileExists(path.join(telemetryRoot, "monitoring", "prometheus.yml")),
    },
    {
      label: "Alert rules",
      relativePath: "telemetry/monitoring/rules.yml",
      exists: fileExists(path.join(telemetryRoot, "monitoring", "rules.yml")),
    },
    {
      label: "Grafana provisioning",
      relativePath: "telemetry/monitoring/grafana",
      exists: fileExists(path.join(telemetryRoot, "monitoring", "grafana")),
    },
  ];

  const tracingAssets = [
    {
      label: "Observability index",
      relativePath: "server/infrastructure/observability/README.md",
      exists: fileExists(path.join(observabilityRoot, "README.md")),
    },
    {
      label: "Tracing context",
      relativePath: "server/infrastructure/observability/tracing/TracingContext.js",
      exists: fileExists(path.join(tracingRoot, "TracingContext.js")),
    },
    {
      label: "Tracing middleware",
      relativePath: "server/infrastructure/observability/tracing/tracingMiddleware.js",
      exists: fileExists(path.join(tracingRoot, "tracingMiddleware.js")),
    },
    {
      label: "Tracing rollout notes",
      relativePath: "server/infrastructure/observability/tracing/README.md",
      exists: fileExists(path.join(tracingRoot, "README.md")),
    },
  ];

  return {
    monitoring: {
      available: monitoringAssets.every((asset) => asset.exists),
      assets: monitoringAssets,
      endpoints: {
        grafana: process.env.GRAFANA_URL || "http://localhost:3000",
        prometheus: process.env.PROMETHEUS_URL || "http://localhost:9091",
      },
      notes: {
        dashboardPanels: 12,
        alertRules: 6,
        defaultGrafanaCredentials: "admin / admin123",
      },
    },
    tracing: {
      enabled: true,
      rolloutApproved: true,
      assets: tracingAssets,
      activeHeaders: ["X-Correlation-ID", "X-Response-Time"],
      correlationIdsActive: true,
      requestTimingActive: true,
      requestSpansActive: true,
      exporterActive: false,
      nextStep:
        "Trace context and request spans are active in app bootstrap. Export traces to a collector when Jaeger/Zipkin or OpenTelemetry ingestion is ready.",
    },
  };
}

async function getQueueStats() {
  const queuesRuntime = getJobQueuesRuntime();
  const queueStats = {};

  if (queuesRuntime?.emailJobQueue) {
    queueStats.email = await queuesRuntime.emailJobQueue.getStats();
  }
  if (queuesRuntime?.webhookJobQueue) {
    queueStats.webhooks = await queuesRuntime.webhookJobQueue.getStats();
  }
  if (queuesRuntime?.exchangeRateJobQueue) {
    queueStats["exchange-rate-refresh"] =
      await queuesRuntime.exchangeRateJobQueue.getStats();
  }

  return queueStats;
}

async function getAuditSummary(canReadAudit) {
  if (!canReadAudit) {
    return { available: false, summary: null, recent: [] };
  }

  const [summaryResult, recentResult] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*)::int AS total_events,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '24 hours'
        )::int AS events_24h,
        COUNT(*) FILTER (
          WHERE created_at >= NOW() - INTERVAL '7 days'
        )::int AS events_7d,
        COUNT(*) FILTER (
          WHERE COALESCE(metadata->>'severity', '') IN ('high', 'critical')
            OR event_type ILIKE '%security%'
            OR event_type ILIKE '%fraud%'
            OR event_type ILIKE '%denied%'
        )::int AS high_priority_events
      FROM security_audit_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `),
    pool.query(`
      SELECT
        id,
        event_type,
        description,
        actor_id,
        target_id,
        created_at,
        COALESCE(metadata->>'severity', 'normal') AS severity
      FROM security_audit_log
      ORDER BY created_at DESC
      LIMIT 8
    `),
  ]);

  return {
    available: true,
    summary: summaryResult.rows[0] || {
      total_events: 0,
      events_24h: 0,
      events_7d: 0,
      high_priority_events: 0,
    },
    recent: recentResult.rows || [],
  };
}

async function getExchangeRateSummary(canReadExchangeRates) {
  if (!canReadExchangeRates) {
    return { available: false, summary: null, recent: [] };
  }

  const [summaryResult, recentResult] = await Promise.all([
    pool.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE is_active = TRUE
            AND (expires_at IS NULL OR expires_at > NOW())
        )::int AS active_rates,
        COUNT(*) FILTER (
          WHERE is_active = TRUE
            AND expires_at IS NOT NULL
            AND expires_at <= NOW() + INTERVAL '24 hours'
        )::int AS expiring_soon,
        MAX(effective_date) AS latest_effective_at,
        MAX(updated_at) AS last_updated_at
      FROM exchange_rates
    `),
    pool.query(`
      SELECT
        from_currency,
        to_currency,
        rate,
        provider,
        effective_date,
        expires_at,
        is_active
      FROM exchange_rates
      WHERE is_active = TRUE
      ORDER BY effective_date DESC, updated_at DESC
      LIMIT 8
    `),
  ]);

  return {
    available: true,
    summary: summaryResult.rows[0] || {
      active_rates: 0,
      expiring_soon: 0,
      latest_effective_at: null,
      last_updated_at: null,
    },
    recent: recentResult.rows || [],
  };
}

async function buildOperationsData(user) {
  const [database, redis, permissions, queueStats] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    permissionService.resolvePermissionsForUser(user),
    getQueueStats(),
  ]);
  const metrics = getMetricsSnapshot();

  const canReadAudit = permissions.includes(PERMISSIONS.AUDIT.READ);
  const canReadExchangeRates = permissions.includes(PERMISSIONS.EXCHANGE_RATES.READ);
  const canManageJobs = permissions.includes(PERMISSIONS.ADMIN.JOBS.MANAGE);

  const [audit, exchangeRates] = await Promise.all([
    getAuditSummary(canReadAudit),
    getExchangeRateSummary(canReadExchangeRates),
  ]);

  return {
    timestamp: new Date().toISOString(),
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      environment: process.env.NODE_ENV || "development",
      nodeVersion: process.version,
      memory: process.memoryUsage(),
    },
    dependencies: {
      database,
      redis,
    },
    metrics,
    queues: queueStats,
    permissions,
    audit,
    exchangeRates,
    observability: buildObservabilityData(),
    controls: {
      canManageJobs,
      availableJobs: [
        {
          key: "exchange-rate-refresh",
          label: "Refresh exchange rates",
          description: "Enqueue an immediate exchange-rate sync using the configured provider.",
        },
      ],
    },
    csrAdminUrl: getFrontendAdminUrl("/admin"),
  };
}

const renderDashboard = async (req, res) => {
  try {
    return renderOperationsView(res, {
      user: req.user,
      operationsData: await buildOperationsData(req.user),
      feedback: {
        success: req.query.success || "",
        error: req.query.error || "",
      },
    });
  } catch (error) {
    logger.error("Failed to render operations dashboard", { error });
    return renderAdminViewError(res, "Failed to load operations dashboard");
  }
};

async function triggerOperationsJob(req, res) {
  try {
    const payload = req.body || {};
    await enqueueManualJob(req.params.jobName, payload, req.user);
    return res.redirect("/dashboard?success=Job%20queued%20successfully");
  } catch (error) {
    logger.error("Failed to trigger operations job", {
      jobName: req.params.jobName,
      userId: req.user?.id,
      error: error.message,
    });
    return res.redirect(
      `/dashboard?error=${encodeURIComponent(
        error.message || "Failed to queue job",
      )}`,
    );
  }
}

async function getDashboardStats(req, res) {
  try {
    const result = await adminService.getOverview();
    return successResponse(res, { data: result });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

async function getUsers(req, res) {
  try {
    const result = await adminService.getUsers(req.query);
    return successResponse(res, {
      data: {
        users: result.data,
        summary: result.summary,
      },
      meta: result.pagination,
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

const renderUsers = async (req, res) => {
  return redirectToCsrAdmin(
    res,
    "/admin/users",
    "Customer management moved to the CSR admin.",
  );
};

const postUserRoleUpdate = async (req, res) => {
  return redirectToCsrAdmin(
    res,
    "/admin/users",
    "Customer role updates now run through the CSR admin.",
  );
};

async function updateUserRole(req, res) {
  try {
    const result = await adminService.updateUserRole(
      req.params.id,
      req.body.role,
    );
    return successResponse(res, {
      data: result,
      message: "User role updated successfully",
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

async function deleteUser(req, res) {
  try {
    const result = await adminService.deleteUser(req.params.id, req.user?.id);
    return successResponse(res, {
      data: result,
      message: "User deleted successfully",
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

const postUserDelete = async (req, res) => {
  return redirectToCsrAdmin(
    res,
    "/admin/users",
    "Customer deletion now runs through the CSR admin.",
  );
};

async function getOrders(req, res) {
  try {
    const result = await adminService.getOrders(req.query);
    return successResponse(res, {
      data: {
        orders: result.data,
        summary: result.summary,
        filter: result.filter,
      },
      meta: result.pagination,
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

async function getAdminProfile(req, res) {
  try {
    const permissions = await permissionService.resolvePermissionsForUser(req.user);

    return successResponse(res, {
      data: {
        profile: {
          id: req.user?.id,
          email: req.user?.email,
          role: req.user?.role,
          first_name: req.user?.first_name || "",
          last_name: req.user?.last_name || "",
          phone: req.user?.phone || "",
          country: req.user?.country || "",
          city: req.user?.city || "",
        },
        permissions,
      },
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

async function updateOrderStatus(req, res) {
  try {
    const result = await adminService.updateOrderStatus(
      req.params.id,
      req.body.status,
    );
    return successResponse(res, {
      data: result,
      message: "Order status updated successfully",
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

const postOrderStatusUpdate = async (req, res) => {
  return redirectToCsrAdmin(
    res,
    "/admin/orders",
    "Order updates now run through the CSR admin.",
  );
};

const renderOrders = async (req, res) => {
  return redirectToCsrAdmin(
    res,
    "/admin/orders",
    "Order operations moved to the CSR admin.",
  );
};

const renderCategories = async (req, res) => {
  return redirectToCsrAdmin(
    res,
    "/admin/products",
    "Category management moved to the CSR admin.",
  );
};

const renderTransactions = async (req, res) => {
  return redirectToCsrAdmin(
    res,
    "/admin/orders",
    "Transaction reporting moved to the CSR admin.",
  );
};

const renderAddProduct = async (req, res) => {
  return redirectToCsrAdmin(
    res,
    "/admin/products",
    "Product creation moved to the CSR admin.",
  );
};

const renderAdminRole = async (req, res) => {
  return redirectToCsrAdmin(
    res,
    "/admin/settings",
    "Admin role and permissions moved to the CSR admin settings view.",
  );
};

async function getProductStats(req, res) {
  try {
    const overview = await adminService.getOverview();
    return successResponse(res, {
      data: {
        activeProducts: overview.totals?.active_products ?? 0,
      },
    });
  } catch (err) {
    return errorResponse(res, { message: err });
  }
}

module.exports = {
  // API endpoints
  getDashboardStats,
  getUsers,
  updateUserRole,
  deleteUser,
  getOrders,
  updateOrderStatus,
  getProductStats,
  getAdminProfile,
  // SSR render functions
  renderDashboard,
  triggerOperationsJob,
  renderUsers,
  renderOrders,
  renderCategories,
  renderTransactions,
  renderAddProduct,
  renderAdminRole,
  // SSR form handlers
  postUserRoleUpdate,
  postUserDelete,
  postOrderStatusUpdate,
};
