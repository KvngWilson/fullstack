const path = require("path");
const request = require("supertest");

function registerAppBootstrapCoverageTests() {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const projectRoot = path.resolve(__dirname, "..", "..");

  function restoreNodeEnv() {
    if (ORIGINAL_NODE_ENV === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    }
  }

  function requireFromRoot(relativePath) {
    return path.resolve(projectRoot, relativePath);
  }

  function loadAdminApp({ nodeEnv = "test", queuesRuntime = null, runtimeError = null } = {}) {
    process.env.NODE_ENV = nodeEnv;
    jest.resetModules();

    const csrfProtection = jest.fn(() => (_req, _res, next) => next());
    const applySessionMiddleware = jest.fn((app) => app.use((_req, _res, next) => next()));
    const getSecurityMiddleware = jest.fn(() => [(_req, _res, next) => next()]);
    const getCorsOptions = jest.fn(() => ({ origin: true }));
    const getJobQueuesRuntime = jest.fn(() => {
      if (runtimeError) {
        throw runtimeError;
      }
      return queuesRuntime;
    });

    let createAdminApp;

    jest.isolateModules(() => {
      jest.doMock(requireFromRoot("config/session"), () => ({ applySessionMiddleware }));
      jest.doMock(requireFromRoot("api/middleware/csrf"), () => ({ csrfProtection }));
      jest.doMock(requireFromRoot("config/security"), () => ({
        getSecurityMiddleware,
        getCorsOptions,
      }));
      jest.doMock(requireFromRoot("api/middleware/requestContext"), () => ({
        correlationIdMiddleware: (_req, _res, next) => next(),
        requestTimingMiddleware: (_req, _res, next) => next(),
      }));
      jest.doMock(requireFromRoot("api/middleware/error"), () => ({
        notFoundHandler: (_req, res) => res.status(404).json({ error: "Not found" }),
        errorHandler: (err, _req, res, _next) =>
          res.status(err?.status || 500).json({ error: err?.message || "error" }),
      }));
      jest.doMock(requireFromRoot("api/controllers/health"), () => ({
        healthCheck: (_req, res) => res.status(200).json({ status: "ok" }),
        detailedHealthCheck: (_req, res) => res.status(200).json({ status: "detailed" }),
        readinessCheck: (_req, res) => res.status(200).json({ status: "ready" }),
        livenessCheck: (_req, res) => res.status(200).json({ status: "live" }),
      }));
      jest.doMock(requireFromRoot("api/routes/admin"), () => {
        const express = require("express");
        const router = express.Router();
        router.get("/auth", (_req, res) => res.status(200).json({ ok: true }));
        return router;
      });
      jest.doMock(requireFromRoot("infrastructure/jobs/runtime"), () => ({ getJobQueuesRuntime }));

      ({ createAdminApp } = require(requireFromRoot("src/admin-app")));
    });

    return {
      app: createAdminApp(),
      csrfProtection,
      applySessionMiddleware,
      getJobQueuesRuntime,
    };
  }

  function buildRouterMock(pathname) {
    const express = require("express");
    const router = express.Router();
    router.get("/", (_req, res) => res.status(200).json({ path: pathname }));
    return router;
  }

  function loadApp({ nodeEnv = "test" } = {}) {
    process.env.NODE_ENV = nodeEnv;
    jest.resetModules();

    const setupSwagger = jest.fn();
    const csrfProtection = jest.fn(() => (_req, _res, next) => next());
    const applySessionMiddleware = jest.fn((app) => app.use((_req, _res, next) => next()));
    const createAdminApp = jest.fn(() => {
      const express = require("express");
      return express();
    });

    let createApp;

    jest.isolateModules(() => {
      jest.doMock(requireFromRoot("config/swagger"), () => setupSwagger);
      jest.doMock(requireFromRoot("config/passport"), () => ({
        initialize: () => (_req, _res, next) => next(),
      }));
      jest.doMock(requireFromRoot("api/middleware/error"), () => ({
        notFoundHandler: (_req, res) => res.status(404).json({ error: "Not found" }),
        errorHandler: (err, _req, res, _next) =>
          res.status(err?.status || 500).json({ error: err?.message || "error" }),
      }));
      jest.doMock(requireFromRoot("api/middleware/csrf"), () => ({ csrfProtection }));
      jest.doMock(requireFromRoot("api/middleware/cache-headers"), () => ({
        etagSupport: (_req, _res, next) => next(),
        lastModifiedSupport: (_req, _res, next) => next(),
      }));
      jest.doMock(requireFromRoot("api/controllers/v1/payments"), () => ({
        payment: {
          handleStripeWebhook: (_req, res) => res.status(200).json({ ok: true }),
        },
      }));
      jest.doMock(requireFromRoot("config/session"), () => ({ applySessionMiddleware }));
      jest.doMock(requireFromRoot("config/security"), () => ({
        getSecurityMiddleware: () => [(_req, _res, next) => next()],
        getCorsOptions: () => ({ origin: true }),
      }));
      jest.doMock(requireFromRoot("api/middleware/requestContext"), () => ({
        correlationIdMiddleware: (_req, _res, next) => next(),
        requestTimingMiddleware: (_req, _res, next) => next(),
      }));
      jest.doMock(requireFromRoot("api/middleware/metrics"), () => ({
        metricsMiddleware: (_req, _res, next) => next(),
        metricsEndpoint: (_req, res) => res.status(200).json({ metrics: true }),
      }));
      jest.doMock(requireFromRoot("api/controllers/health"), () => ({
        healthCheck: (_req, res) => res.status(200).json({ status: "ok" }),
        detailedHealthCheck: (_req, res) => res.status(200).json({ status: "detailed" }),
        readinessCheck: (_req, res) => res.status(200).json({ status: "ready" }),
        livenessCheck: (_req, res) => res.status(200).json({ status: "live" }),
      }));
      jest.doMock(requireFromRoot("src/admin-app"), () => ({ createAdminApp }));
      jest.doMock(requireFromRoot("api/routes/v1/admin"), () => buildRouterMock("admin"));
      jest.doMock(requireFromRoot("api/routes/v1/auth"), () => buildRouterMock("auth"));
      jest.doMock(requireFromRoot("api/routes/v1/identity"), () => buildRouterMock("identity"));
      jest.doMock(requireFromRoot("api/routes/v1/catalog"), () => buildRouterMock("catalog"));
      jest.doMock(requireFromRoot("api/routes/v1/ordering"), () => buildRouterMock("ordering"));
      jest.doMock(requireFromRoot("api/routes/v1/payments"), () => buildRouterMock("payments"));
      jest.doMock(requireFromRoot("api/routes/v1/vendor"), () => buildRouterMock("vendors"));
      jest.doMock(requireFromRoot("api/routes/v1/wishlist"), () => buildRouterMock("wishlist"));
      jest.doMock(requireFromRoot("api/routes/v1/guest/cart"), () => buildRouterMock("guest-cart"));
      jest.doMock(requireFromRoot("api/routes/v1/checkout/guest"), () => buildRouterMock("guest-checkout"));
      jest.doMock("vhost", () => jest.fn(() => (_req, _res, next) => next()));

      ({ createApp } = require(requireFromRoot("src/app")));
    });

    return {
      app: createApp(),
      createAdminApp,
      csrfProtection,
      applySessionMiddleware,
      setupSwagger,
    };
  }

  describe("app bootstrap coverage", () => {
    afterEach(() => {
      jest.resetModules();
      jest.clearAllMocks();
      jest.unmock(requireFromRoot("config/session"));
      jest.unmock(requireFromRoot("api/middleware/csrf"));
      jest.unmock(requireFromRoot("config/security"));
      jest.unmock(requireFromRoot("api/middleware/requestContext"));
      jest.unmock(requireFromRoot("api/middleware/error"));
      jest.unmock(requireFromRoot("api/controllers/health"));
      jest.unmock(requireFromRoot("api/routes/admin"));
      jest.unmock(requireFromRoot("infrastructure/jobs/runtime"));
      jest.unmock(requireFromRoot("config/swagger"));
      jest.unmock(requireFromRoot("config/passport"));
      jest.unmock(requireFromRoot("api/middleware/cache-headers"));
      jest.unmock(requireFromRoot("api/controllers/v1/payments"));
      jest.unmock(requireFromRoot("api/middleware/metrics"));
      jest.unmock(requireFromRoot("src/admin-app"));
      jest.unmock(requireFromRoot("api/routes/v1/admin"));
      jest.unmock(requireFromRoot("api/routes/v1/auth"));
      jest.unmock(requireFromRoot("api/routes/v1/identity"));
      jest.unmock(requireFromRoot("api/routes/v1/catalog"));
      jest.unmock(requireFromRoot("api/routes/v1/ordering"));
      jest.unmock(requireFromRoot("api/routes/v1/payments"));
      jest.unmock(requireFromRoot("api/routes/v1/vendor"));
      jest.unmock(requireFromRoot("api/routes/v1/wishlist"));
      jest.unmock(requireFromRoot("api/routes/v1/guest/cart"));
      jest.unmock(requireFromRoot("api/routes/v1/checkout/guest"));
      jest.unmock("vhost");
      restoreNodeEnv();
    });

    test("createAdminApp enables CSRF outside test env", async () => {
      const { app, csrfProtection, applySessionMiddleware } = loadAdminApp({
        nodeEnv: "production",
      });

      const response = await request(app).get("/health");

      expect(response.status).toBe(200);
      expect(applySessionMiddleware).toHaveBeenCalledTimes(1);
      expect(csrfProtection).toHaveBeenCalledWith({
        excludePaths: ["/auth"],
        headerName: "x-admin-csrf-token",
        tokenKeyPrefix: "admin-csrf-token",
      });
    });

    test("admin jobs health returns unavailable when queues are not initialized", async () => {
      const { app, getJobQueuesRuntime } = loadAdminApp({
        queuesRuntime: null,
      });

      const response = await request(app).get("/health/jobs");

      expect(response.status).toBe(503);
      expect(response.body).toEqual({
        status: "unavailable",
        message: "Job queues not initialized",
      });
      expect(getJobQueuesRuntime).toHaveBeenCalledTimes(1);
    });

    test("admin jobs health returns queue stats when queues are available", async () => {
      const queuesRuntime = {
        emailJobQueue: { getStats: jest.fn().mockResolvedValue({ waiting: 1 }) },
        webhookJobQueue: { getStats: jest.fn().mockResolvedValue({ active: 2 }) },
        exchangeRateJobQueue: { getStats: jest.fn().mockResolvedValue({ delayed: 3 }) },
      };
      const { app } = loadAdminApp({ queuesRuntime });

      const response = await request(app).get("/health/jobs");

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: "ok",
        queues: {
          email: { waiting: 1 },
          webhooks: { active: 2 },
          "exchange-rates": { delayed: 3 },
        },
        note: "Jobs are processed by the Bull worker service. See /health/jobs/queue/{name} for details.",
      });
    });

    test("admin jobs health returns server error on runtime failure", async () => {
      const { app } = loadAdminApp({
        runtimeError: new Error("runtime unavailable"),
      });

      const response = await request(app).get("/health/jobs");

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        status: "error",
        error: "runtime unavailable",
      });
    });

    test("createApp enables API CSRF outside test env", async () => {
      const { app, createAdminApp, csrfProtection, applySessionMiddleware, setupSwagger } =
        loadApp({ nodeEnv: "production" });

      const healthResponse = await request(app).get("/health");
      const metricsResponse = await request(app).get("/metrics");

      expect(healthResponse.status).toBe(200);
      expect(metricsResponse.status).toBe(200);
      expect(setupSwagger).toHaveBeenCalledTimes(1);
      expect(createAdminApp).toHaveBeenCalledTimes(1);
      expect(applySessionMiddleware).toHaveBeenCalledTimes(1);
      expect(csrfProtection).toHaveBeenCalledTimes(1);
    });
  });
}

module.exports = {
  registerAppBootstrapCoverageTests,
};
