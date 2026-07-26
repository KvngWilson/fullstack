/**
 * Exchange Rate Refresh Job
 * Periodically fetches latest exchange rates from external provider
 * and updates the database. Runs hourly to ensure rates stay fresh.
 */

const { pool } = require('../../../config/db');
const logger = require('../../../shared/utils/logger');

/**
 * Exchange Rate Providers
 */
const PROVIDERS = {  
  // Mock provider for development
  MOCK: 'mock'
};


// Currency pairs to track
const CURRENCY_PAIRS = [
  { from: 'USD', to: 'EUR' },
  { from: 'EUR', to: 'USD' },
  { from: 'USD', to: 'GBP' },
  { from: 'GBP', to: 'USD' },
  { from: 'USD', to: 'JPY' },
  { from: 'JPY', to: 'USD' },
  { from: 'EUR', to: 'GBP' },
  { from: 'GBP', to: 'EUR' },
  { from: 'USD', to: 'NGN' },
  { from: 'NGN', to: 'USD' },
  { from: 'USD', to: 'CAD' },
  { from: 'CAD', to: 'USD' },
];

/**
 * Fetch exchange rates from external API
 * @param {string} provider - Provider name (FIXER, ALPHA_VANTAGE, MOCK)
 * @returns {Promise<Object>} - { rates: { EUR: 0.92, GBP: 0.79, ... }, timestamp }
 */
async function fetchExchangeRates(provider = 'MOCK') {
  const startTime = Date.now();

  try {
    if (provider === 'MOCK') {
      // Mock data for development/testing
      logger.info('Using mock exchange rate provider');
      return {
        rates: {
          USD: 1.0,
          EUR: 0.92,
          GBP: 0.79,
          JPY: 149.50,
          CAD: 1.35,
          AUD: 1.52,
          CHF: 0.88,
          NGN: 460.00,
        },
        timestamp: new Date().toISOString(),
        provider: 'MOCK',
      };
    }

    throw new Error(`Unknown provider: ${provider}`);
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Failed to fetch exchange rates', {
      provider,
      error: error.message,
      duration,
    });
    throw error;
  }
}

/**
 * Calculate inverse exchange rate
 * @param {number} rate - Original rate (e.g., USD->EUR = 0.92)
 * @returns {number} - Inverse rate (e.g., EUR->USD = 1.087)
 */
function calculateInverseRate(rate) {
  if (rate === 0) {
    throw new Error('Cannot calculate inverse of zero rate');
  }
  return parseFloat((1 / rate).toFixed(8));
}

/**
 * Update exchange rate in database
 * @param {Pool.Client} client - Database client
 * @param {Object} params - Rate parameters
 * @returns {Promise<Object>} - Result { inserted, updated }
 */
async function upsertExchangeRate(client, { fromCurrency, toCurrency, rate, provider }) {
  const effectiveDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

  try {
    // Check if rate already exists for today
    const existing = await client.query(
      `SELECT id, rate FROM exchange_rates
       WHERE from_currency = $1 AND to_currency = $2 AND effective_date = $3`,
      [fromCurrency, toCurrency, effectiveDate]
    );

    if (existing.rows.length > 0) {
      // Update existing rate
      await client.query(
        `UPDATE exchange_rates
         SET rate = $1, provider = $2, expires_at = $3, created_at = now()
         WHERE from_currency = $4 AND to_currency = $5 AND effective_date = $6`,
        [rate, provider, expiresAt, fromCurrency, toCurrency, effectiveDate]
      );

      return { action: 'updated', existing: existing.rows[0].rate, new: rate };
    } else {
      // Insert new rate
      await client.query(
        `INSERT INTO exchange_rates (from_currency, to_currency, rate, provider, effective_date, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [fromCurrency, toCurrency, rate, provider, effectiveDate, expiresAt]
      );

      return { action: 'inserted', new: rate };
    }
  } catch (error) {
    logger.error('Failed to upsert exchange rate', {
      fromCurrency,
      toCurrency,
      rate,
      code: error.code,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Log sync job result to database
 * @param {Pool.Client} client - Database client
 * @param {Object} result - Job result
 */
async function logSyncResult(client, result) {
  try {
    // Check if table exists first
    const tableCheck = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'exchange_rate_sync_log'
      )`
    );

    if (!tableCheck.rows[0].exists) {
      // Create table if it doesn't exist
      await client.query(`
        CREATE TABLE exchange_rate_sync_log (
          id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          sync_time TIMESTAMPTZ NOT NULL DEFAULT now(),
          currencies_affected TEXT,
          rates_updated INTEGER DEFAULT 0,
          rates_inserted INTEGER DEFAULT 0,
          rates_failed INTEGER DEFAULT 0,
          status VARCHAR(20) NOT NULL DEFAULT 'success',
          error_message TEXT,
          triggered_by VARCHAR(100) DEFAULT 'scheduled_job',
          duration_seconds INTEGER,
          provider VARCHAR(100) DEFAULT 'fixer',
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_exchange_rate_sync_log_time ON exchange_rate_sync_log(sync_time DESC);
        CREATE INDEX IF NOT EXISTS idx_exchange_rate_sync_log_status ON exchange_rate_sync_log(status);
      `);
      logger.info('Created exchange_rate_sync_log table');
    }

    const currenciesAffected = JSON.stringify(
      result.pairs.map(p => `${p.from}→${p.to}`)
    );

    await client.query(
      `INSERT INTO exchange_rate_sync_log (
        sync_time, currencies_affected, rates_updated, rates_inserted, 
        rates_failed, status, error_message, duration_seconds, provider
      ) VALUES (now(), $1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        currenciesAffected,
        result.updated,
        result.inserted,
        result.failed,
        result.status,
        result.errorMessage,
        Math.round(result.duration / 1000),
        result.provider,
      ]
    );
  } catch (error) {
    logger.error('Failed to log sync result', { error: error.message });
    // Don't throw - logging failure shouldn't fail the job
  }
}

/**
 * Execute the exchange rate refresh job
 * @param {Object} options - Job options
 * @returns {Promise<Object>} - Job result
 */
async function refreshExchangeRates(options = {}) {
  const startTime = Date.now();
  const provider = options.provider || process.env.EXCHANGE_RATE_PROVIDER || 'MOCK';

  logger.info('Starting exchange rate refresh job', { provider });

  const result = {
    provider,
    pairs: [],
    inserted: 0,
    updated: 0,
    failed: 0,
    status: 'success',
    errorMessage: null,
    duration: 0,
  };

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Fetch rates from provider
    const { rates: baseRates, timestamp } = await fetchExchangeRates(provider);

    logger.info('Fetched exchange rates', {
      provider,
      rateCount: Object.keys(baseRates).length,
      timestamp,
    });

    // Process all currency pairs
    for (const pair of CURRENCY_PAIRS) {
      try {
        let rate;

        if (pair.from === 'USD') {
          // USD is the base currency in most providers
          rate = baseRates[pair.to];
        } else if (pair.to === 'USD') {
          // Calculate inverse (e.g., EUR->USD from USD->EUR)
          const inverseRate = baseRates[pair.from];
          if (inverseRate) {
            rate = calculateInverseRate(inverseRate);
          }
        } else {
          // Cross rate (e.g., EUR->GBP = (USD->GBP) / (USD->EUR))
          const toRate = baseRates[pair.to];
          const fromRate = baseRates[pair.from];
          if (toRate && fromRate) {
            rate = parseFloat((toRate / fromRate).toFixed(8));
          }
        }

        if (!rate || isNaN(rate)) {
          logger.warn('Rate not available for pair', { pair });
          result.failed++;
          continue;
        }

        // Upsert rate
        const upsertResult = await upsertExchangeRate(client, {
          fromCurrency: pair.from,
          toCurrency: pair.to,
          rate,
          provider,
        });

        result.pairs.push({ ...pair, rate, action: upsertResult.action });

        if (upsertResult.action === 'inserted') {
          result.inserted++;
        } else {
          result.updated++;
        }

        logger.debug('Exchange rate processed', {
          from: pair.from,
          to: pair.to,
          rate,
          action: upsertResult.action,
        });
      } catch (error) {
        logger.error('Failed to process currency pair', {
          pair,
          code: error.code,
          error: error.message,
        });

        if (error.code === '42P01') {
          throw new Error('exchange_rates table is missing; run database migrations before exchange-rate refresh job');
        }

        result.failed++;
      }
    }

    // Determine overall status
    if (result.failed === CURRENCY_PAIRS.length) {
      result.status = 'failed';
      result.errorMessage = 'All currency pairs failed to update';
    } else if (result.failed > 0) {
      result.status = 'partial';
      result.errorMessage = `${result.failed} out of ${CURRENCY_PAIRS.length} pairs failed`;
    }

    result.duration = Date.now() - startTime;

    // Log to database
    await logSyncResult(client, result);

    await client.query('COMMIT');

    logger.info('Exchange rate refresh job completed', {
      provider,
      inserted: result.inserted,
      updated: result.updated,
      failed: result.failed,
      status: result.status,
      duration: `${result.duration}ms`,
    });

    return result;
  } catch (error) {
    await client.query('ROLLBACK');

    result.status = 'failed';
    result.errorMessage = error.message;
    result.duration = Date.now() - startTime;
    result.failed = CURRENCY_PAIRS.length;

    logger.error('Exchange rate refresh job failed', {
      provider,
      error: error.message,
      duration: result.duration,
    });

    // Try to log failure (without transaction)
    try {
      await logSyncResult(client, result);
    } catch (logError) {
      logger.error('Failed to log sync failure', { error: logError.message });
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Job processor for Bull queue
 * @param {Object} job - Bull job object
 */
async function processJob(job) {
  logger.info('Processing exchange rate refresh job', { jobId: job.id });

  try {
    const result = await refreshExchangeRates(job.data);
    return result;
  } catch (error) {
    logger.error('Exchange rate job failed', {
      jobId: job.id,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  refreshExchangeRates,
  processJob,
  CURRENCY_PAIRS,
  PROVIDERS,
};
