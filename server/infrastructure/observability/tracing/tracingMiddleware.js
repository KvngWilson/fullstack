const TracingContext = require("./TracingContext");
const logger = require("../../../shared/utils/logger");
const http = require("http");
const https = require("https");
const { runWithTracingContext } = require("./tracingScope");

function postJson(urlString, payload) {
  const url = new URL(urlString);
  const transport = url.protocol === "https:" ? https : http;
  const serialized = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(serialized),
        },
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          if ((response.statusCode || 500) >= 300) {
            reject(
              new Error(
                `Trace export failed with status ${response.statusCode || 500}`,
              ),
            );
            return;
          }
          resolve();
        });
      },
    );
    request.on("error", reject);
    request.write(serialized);
    request.end();
  });
}

function createTraceExporter(options = {}) {
  const exporterType = String(
    options.exporterType || process.env.TRACING_EXPORTER || "none",
  ).toLowerCase();
  const exporterUrl = options.exporterUrl || process.env.TRACING_EXPORT_URL;

  if (exporterType === "http" && exporterUrl) {
    return (traceData, requestLogger = logger) =>
      postJson(exporterUrl, traceData).catch((error) => {
        requestLogger.warn("Trace export failed", {
          error: error.message,
          exporterType,
          exporterUrl,
        });
      });
  }

  if (exporterType === "logger") {
    return async (traceData, requestLogger = logger) => {
      requestLogger.info("Trace export", { trace: traceData });
    };
  }

  return null;
}

/**
 * Factory for request tracing middleware.
 */
function createTracingMiddleware(options = {}) {
  const headerName = options.headerName || "x-correlation-id";
  const traceExporter = createTraceExporter(options);

  return function tracingMiddleware(req, res, next) {
    const incomingCorrelationId =
      req.headers[headerName]
      || req.headers[headerName.toLowerCase()]
      || req.headers["x-request-id"];
    const incomingTraceContext = TracingContext.parseTraceparent(
      req.headers["traceparent"],
    );
    const tracingContext = new TracingContext({
      correlationId: incomingCorrelationId,
      traceId: incomingTraceContext?.traceId,
      parentSpanId: incomingTraceContext?.parentSpanId,
    });

    req.tracingContext = tracingContext;
    req.correlationId = tracingContext.correlationId;
    req.traceId = tracingContext.traceId;
    res.setHeader("X-Correlation-ID", tracingContext.correlationId);
    res.setHeader("X-Trace-ID", tracingContext.traceId);

    const requestSpan = tracingContext.startSpan("http.request", {
      parentSpanId: incomingTraceContext?.parentSpanId,
    });
    res.setHeader("traceparent", tracingContext.toTraceparent(requestSpan));

    tracingContext.addTag(requestSpan, "http.method", req.method);
    tracingContext.addTag(requestSpan, "http.path", req.originalUrl || req.url);
    tracingContext.addTag(
      requestSpan,
      "http.user_agent",
      req.headers["user-agent"] || "unknown",
    );
    tracingContext.addTag(requestSpan, "net.peer.ip", req.ip || "unknown");
    tracingContext.addTag(requestSpan, "trace.active", true);

    if (req.logger) {
      req.logger = req.logger.child({
        correlationId: tracingContext.correlationId,
        traceId: tracingContext.traceId,
        spanId: requestSpan.spanId,
      });
    }

    res.on("finish", async () => {
      tracingContext.addTag(requestSpan, "http.status_code", res.statusCode);
      requestSpan.status = res.statusCode >= 500 ? "error" : "ok";
      tracingContext.endSpan(requestSpan);

      if (traceExporter) {
        try {
          await traceExporter(tracingContext.getTraceData(), req.logger);
        } catch (error) {
          (req.logger || logger).warn("Trace exporter threw an error", {
            error: error.message,
          });
        }
      }
    });

    runWithTracingContext(
      {
        tracingContext,
        correlationId: tracingContext.correlationId,
        traceId: tracingContext.traceId,
      },
      () => next(),
    );
  };
}

module.exports = {
  createTracingMiddleware,
};
