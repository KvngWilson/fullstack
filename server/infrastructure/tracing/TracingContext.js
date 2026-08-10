/**
 * Tracing Context - For distributed tracing (Phase 5)
 * 
 * Tracks:
 * - Request correlation IDs
 * - Distributed trace context
 * - Span lifecycle
 * 
 * For now: stub for migration compatibility
 */

class TracingContext {
  constructor(correlationId) {
    this.correlationId = correlationId || this._generateId();
    this.spans = [];
  }

  _generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  startSpan(name) {
    const span = {
      name,
      startTime: Date.now(),
      tags: {},
      logs: [],
    };
    this.spans.push(span);
    return span;
  }

  endSpan(span) {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
  }

  addTag(span, key, value) {
    span.tags[key] = value;
  }

  addLog(span, message, fields = {}) {
    span.logs.push({ timestamp: Date.now(), message, fields });
  }

  getTraceData() {
    return {
      correlationId: this.correlationId,
      spans: this.spans,
    };
  }
}

module.exports = TracingContext;
