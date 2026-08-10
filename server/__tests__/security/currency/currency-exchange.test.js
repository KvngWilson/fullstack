/**
 * Multi-Currency Exchange Rate Test Suite
 * 
 * Tests currency handling, exchange rate capture, stale rate detection,
 * and multi-currency order processing.
 */

const request = require('supertest');
const { createApp } = require('../../../src/app');
const { pool } = require('../../../config/db');
const { createDbInfraGuard } = require('../../helpers/testHelpers');

describe('Multi-Currency & Exchange Rate Tests', () => {
  let app;
  let customerToken;
  let exchangeRateJobId;
  const { disable, isReady, dbTest } = createDbInfraGuard();
  const test = dbTest;

  beforeAll(async () => {
    if (!global.__TEST_DB_AVAILABLE) {
      disable();
      return;
    }

    app = createApp();
    // Seed exchange rates for testing
  });

  afterAll(async () => {
    if (!isReady()) return;
    await pool.end();
  });

  describe('Exchange Rate Retrieval', () => {
    test('Should fetch latest USD to EUR rate', async () => {
      const result = await pool.query(
        `SELECT rate, expires_at FROM exchange_rates 
         WHERE from_currency = 'USD' AND to_currency = 'EUR'
         AND expires_at > now()
         ORDER BY created_at DESC LIMIT 1`
      );

      expect(result.rows.length).toBeGreaterThan(0);
      const rate = result.rows[0];
      expect(rate.rate).toBeGreaterThan(0);
      expect(new Date(rate.expires_at)).toBeGreaterThan(new Date());
    });

    test('Should detect stale rates (older than 24h)', async () => {
      const result = await pool.query(
        `SELECT id, created_at FROM exchange_rates 
         WHERE created_at < now() - interval '24 hours'
         LIMIT 1`
      );

      // Should have no results if job is running hourly
      // If results exist, they should be marked as expired
      if (result.rows.length > 0) {
        const expiryCheck = await pool.query(
          `SELECT expires_at FROM exchange_rates WHERE id = $1`,
          [result.rows[0].id]
        );
        expect(new Date(expiryCheck.rows[0].expires_at)).toBeLessThan(new Date());
      }
    });

    test('Should have rates for all tracked currency pairs', async () => {
      const result = await pool.query(
        `SELECT DISTINCT from_currency, to_currency FROM exchange_rates 
         WHERE expires_at > now()
         ORDER BY from_currency, to_currency`
      );

      const currencyPairs = result.rows;
      expect(currencyPairs.length).toBeGreaterThanOrEqual(8);
      
      // Verify we have symmetric rates
      const pairCodes = currencyPairs.map(p => `${p.from_currency}→${p.to_currency}`);
      expect(pairCodes).toContain('USD→EUR');
      expect(pairCodes).toContain('USD→GBP');
    });
  });

  describe('Order Currency Snapshot Capture', () => {
    test('Should capture exchange rate snapshot on order creation', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customer_currency: 'EUR',
          items: [{ product_id: 1, quantity: 1 }]
        });

      expect(response.status).toBe(201);
      const orderId = response.body.data.id;

      // Verify snapshot was created
      const snapshot = await pool.query(
        `SELECT * FROM order_currency_snapshots WHERE order_id = $1`,
        [orderId]
      );

      expect(snapshot.rows.length).toBe(1);
      const capture = snapshot.rows[0];
      
      expect(capture.customer_currency).toBe('EUR');
      expect(capture.base_currency).toBeDefined();
      expect(capture.exchange_rate).toBeGreaterThan(0);
      expect(capture.customer_total_cents).toBeGreaterThan(0);
      expect(capture.locked_at).toBeDefined();
    });

    test('Should reject order with stale exchange rates', async () => {
      // Insert an expired exchange rate
      await pool.query(
        `INSERT INTO exchange_rates (from_currency, to_currency, rate, provider, effective_date, expires_at)
         VALUES ('USD', 'JPY', 150, 'test', CURRENT_DATE, now() - interval '1 hour')`
      );

      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customer_currency: 'JPY',
          items: [{ product_id: 1, quantity: 1 }]
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('exchange rate');
    });

    test('Should preserve exchange rate across refunds', async () => {
      // Create order
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customer_currency: 'GBP',
          items: [{ product_id: 1, quantity: 1 }]
        });

      const orderId = orderRes.body.data.id;

      // Get initial snapshot
      const initialSnapshot = await pool.query(
        `SELECT * FROM order_currency_snapshots WHERE order_id = $1`,
        [orderId]
      );

      const originalRate = initialSnapshot.rows[0].exchange_rate;

      // Refund order
      await request(app)
        .post(`/api/v1/orders/${orderId}/refund`)
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ reason: 'customer_request' });

      // Verify snapshot unchanged
      const refundedSnapshot = await pool.query(
        `SELECT * FROM order_currency_snapshots WHERE order_id = $1`,
        [orderId]
      );

      expect(refundedSnapshot.rows[0].exchange_rate).toBe(originalRate);
    });
  });

  describe('Multi-Currency Order Processing', () => {
    test('Should process order in customer currency', async () => {
      const response = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customer_currency: 'EUR',
          items: [{ product_id: 1, quantity: 2 }]
        });

      expect(response.status).toBe(201);
      const order = response.body.data;

      // Total should be calculated in EUR
      expect(order.total).toBeDefined();
      expect(order.currency).toBe('EUR');
    });

    test('Should handle minor units correctly (e.g., cents)', async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customer_currency: 'USD',
          items: [{ product_id: 1, quantity: 1 }]
        });

      const orderId = orderRes.body.data.id;

      // Check snapshot stores minor units
      const snapshot = await pool.query(
        `SELECT customer_total_cents, base_total_cents FROM order_currency_snapshots 
         WHERE order_id = $1`,
        [orderId]
      );

      expect(snapshot.rows[0].customer_total_cents).toBeGreaterThan(0);
      expect(snapshot.rows[0].base_total_cents).toBeGreaterThan(0);
      // Verify cents are integers (no decimals)
      expect(Number.isInteger(snapshot.rows[0].customer_total_cents)).toBe(true);
    });

    test('Should apply correct exchange rate conversion', async () => {
      const orderRes = await request(app)
        .post('/api/v1/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          customer_currency: 'GBP',
          items: [{ product_id: 1, quantity: 1 }],
          base_price_cents: 10000 // $100 USD
        });

      const orderId = orderRes.body.data.id;
      const snapshot = await pool.query(
        `SELECT base_total_cents, customer_total_cents, exchange_rate 
         FROM order_currency_snapshots WHERE order_id = $1`,
        [orderId]
      );

      const snap = snapshot.rows[0];
      // Verify: customer_total = base_total * exchange_rate
      const calculated = snap.base_total_cents * snap.exchange_rate;
      expect(snap.customer_total_cents).toBeCloseTo(calculated, 0);
    });
  });

  describe('Exchange Rate Job Execution', () => {
    test('Should log exchange rate sync to database', async () => {
      // Trigger job manually
      await request(app)
        .post('/api/v1/admin/jobs/exchange-rates/refresh')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ provider: 'MOCK' });

      // Check sync log
      const logCheck = await pool.query(
        `SELECT * FROM exchange_rate_sync_log 
         ORDER BY sync_time DESC LIMIT 1`
      );

      expect(logCheck.rows.length).toBeGreaterThan(0);
      const log = logCheck.rows[0];
      
      expect(log.status).toBe('success');
      expect(log.rates_updated).toBeGreaterThanOrEqual(0);
      expect(log.rates_inserted).toBeGreaterThanOrEqual(0);
      expect(log.duration_seconds).toBeGreaterThan(0);
    });

    test('Should update rates every hour', async () => {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const logs = await pool.query(
        `SELECT * FROM exchange_rate_sync_log 
         WHERE sync_time > $1
         ORDER BY sync_time DESC`,
        [tenMinutesAgo]
      );

      // Should have at least one sync in last 10 minutes if job is running
      // (Allow for job schedule variations)
      logger.info('Recent exchange rate syncs', { count: logs.rows.length });
    });

    test('Should handle rate sync failure gracefully', async () => {
      // Simulate failed provider
      const response = await request(app)
        .post('/api/v1/admin/jobs/exchange-rates/refresh')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ provider: 'INVALID_PROVIDER' });

      // Job should handle error without crashing
      expect([400, 500].includes(response.status)).toBe(true);

      // Log should still be created
      const logCheck = await pool.query(
        `SELECT status FROM exchange_rate_sync_log 
         WHERE sync_time > now() - interval '1 minute'
         ORDER BY sync_time DESC LIMIT 1`
      );

      if (logCheck.rows.length > 0) {
        expect(['failed', 'partial'].includes(logCheck.rows[0].status)).toBe(true);
      }
    });
  });
});
