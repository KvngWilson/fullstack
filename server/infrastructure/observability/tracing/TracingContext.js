/**
 * Tracing Context
 *
 * Tracks:
 * - Request correlation IDs
 * - Distributed trace context
 * - Span lifecycle
 */

const crypto = require('crypto');

class TracingContext {
  constructor(context = {}) {
    if (typeof context === 'string') {
      context = { correlationId: context };
    }

    this.correlationId = context.correlationId || this._generateCorrelationId();
    this.traceId = context.traceId || this._generateTraceId();
    this.parentSpanId = context.parentSpanId || null;
    this.spans = [];
  }

  _generateCorrelationId() {
    return `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  }

  _generateTraceId() {
    return crypto.randomBytes(16).toString('hex');
  }

  _generateSpanId() {
    return crypto.randomBytes(8).toString('hex');
  }

  startSpan(name, options = {}) {
    const span = {
      name,
      traceId: this.traceId,
      spanId: this._generateSpanId(),
      parentSpanId: options.parentSpanId || this.parentSpanId || null,
      startTime: Date.now(),
      startHrTime: process.hrtime.bigint(),
      tags: {},
      logs: [],
      status: 'ok',
    };
    this.spans.push(span);
    return span;
  }

  endSpan(span) {
    span.endTime = Date.now();
    span.durationMs = Number(process.hrtime.bigint() - span.startHrTime) / 1_000_000;
    delete span.startHrTime;
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
      traceId: this.traceId,
      spans: this.spans,
    };
  }

  toTraceparent(span) {
    const spanId = span?.spanId || this._generateSpanId();
    return `00-${this.traceId}-${spanId}-01`;
  }

  static parseTraceparent(headerValue) {
    const normalizedValue = String(headerValue || '').trim();
    const match = normalizedValue.match(/^00-([a-f0-9]{32})-([a-f0-9]{16})-[a-f0-9]{2}$/i);
    if (!match) {
      return null;
    }

    return {
      traceId: match[1].toLowerCase(),
      parentSpanId: match[2].toLowerCase(),
    };
  }
}

module.exports = TracingContext;
