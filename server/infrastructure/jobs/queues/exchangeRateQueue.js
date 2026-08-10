/**
 * Canonical exchange-rate queue API.
 *
 * Do not import from ./handlers/exchangeRateQueue or ./queues/exchangeRateQueue.
 * Use this module as the single entrypoint.
 */

const ExchangeRateQueue = require('../handlers/exchangeRateQueue');

module.exports = {
  ExchangeRateQueue,
};
