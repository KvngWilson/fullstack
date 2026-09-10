const { AsyncLocalStorage } = require("async_hooks");

const tracingScope = new AsyncLocalStorage();

function runWithTracingContext(context, callback) {
  return tracingScope.run(context, callback);
}

function getTracingScope() {
  return tracingScope.getStore() || null;
}

function getTracingContext() {
  return getTracingScope()?.tracingContext || null;
}

async function withChildSpan(
  spanName,
  {
    tags = {},
    onErrorTag = "error",
    onSuccessTags = {},
  } = {},
  operation,
) {
  const tracingContext = getTracingContext();
  if (!tracingContext) {
    return operation();
  }

  const span = tracingContext.startSpan(spanName);
  Object.entries(tags).forEach(([key, value]) => {
    tracingContext.addTag(span, key, value);
  });

  try {
    const result = await operation();
    Object.entries(onSuccessTags).forEach(([key, value]) => {
      tracingContext.addTag(span, key, value);
    });
    span.status = "ok";
    tracingContext.endSpan(span);
    return result;
  } catch (error) {
    span.status = "error";
    tracingContext.addTag(span, onErrorTag, error.message || "unknown_error");
    tracingContext.addLog(span, "child span error", {
      message: error.message,
      name: error.name,
    });
    tracingContext.endSpan(span);
    throw error;
  }
}

module.exports = {
  runWithTracingContext,
  getTracingScope,
  getTracingContext,
  withChildSpan,
};
