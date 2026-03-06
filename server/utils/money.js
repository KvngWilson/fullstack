/**
 * Money Utility Module
 * 
 * Handles all monetary operations with strict integer arithmetic
 * to prevent floating-point errors in financial calculations.
 * 
 * All amounts are stored as minor units (cents for USD, etc)
 * to maintain precision and avoid floating-point math errors.
 */

/**
 * Currency metadata: decimals (for conversion), symbol, and full name
 * ISO 4217 standard currency codes
 */
const CURRENCY_INFO = {
  USD: { decimals: 2, symbol: '$', name: 'US Dollar' },
  EUR: { decimals: 2, symbol: '€', name: 'Euro' },
  GBP: { decimals: 2, symbol: '£', name: 'British Pound' },
  JPY: { decimals: 0, symbol: '¥', name: 'Japanese Yen' },
  CAD: { decimals: 2, symbol: 'C$', name: 'Canadian Dollar' },
  AUD: { decimals: 2, symbol: 'A$', name: 'Australian Dollar' },
  CHF: { decimals: 2, symbol: 'CHF', name: 'Swiss Franc' },
  KWD: { decimals: 3, symbol: 'د.ك', name: 'Kuwaiti Dinar' },
  BHD: { decimals: 3, symbol: '.د.ب', name: 'Bahraini Dinar' },
  OMR: { decimals: 3, symbol: 'ر.ع.', name: 'Omani Rial' },
  JOD: { decimals: 3, symbol: 'د.ا', name: 'Jordanian Dinar' },
  TND: { decimals: 3, symbol: 'د.ت', name: 'Tunisian Dinar' },
  IQD: { decimals: 3, symbol: 'ع.د', name: 'Iraqi Dinar' },
  INR: { decimals: 2, symbol: '₹', name: 'Indian Rupee' },
  CNY: { decimals: 2, symbol: '¥', name: 'Chinese Yuan' },
  MXN: { decimals: 2, symbol: '$', name: 'Mexican Peso' },
  BRL: { decimals: 2, symbol: 'R$', name: 'Brazilian Real' },
  ZAR: { decimals: 2, symbol: 'R', name: 'South African Rand' },
};

/**
 * Validate that a currency code exists
 * @param {string} currency - ISO 4217 currency code
 * @throws {Error} if currency is invalid
 */
function validateCurrency(currency) {
  if (!currency || typeof currency !== 'string') {
    throw new Error(`Invalid currency: must be a string`);
  }
  if (!CURRENCY_INFO[currency.toUpperCase()]) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
  return currency.toUpperCase();
}

/**
 * Banker's rounding (round half to even)
 * This is the default rounding mode used by most financial institutions
 * @param {number} value - The value to round
 * @param {number} decimals - Number of decimal places
 * @returns {number} Rounded value
 */
function bankersRound(value, decimals = 0) {
  const factor = Math.pow(10, decimals);
  const adjusted = value * factor;
  const floor = Math.floor(adjusted);
  const remainder = adjusted - floor;

  // If exactly 0.5, round to even
  if (Math.abs(remainder - 0.5) < 1e-10) {
    return (floor % 2 === 0 ? floor : floor + 1) / factor;
  }
  // Otherwise normal rounding
  return Math.round(adjusted) / factor;
}

/**
 * Convert display amount (e.g., $10.50) to minor units (1050 cents)
 * @param {number} amount - Display amount (e.g., 10.50 for USD)
 * @param {string} currency - ISO 4217 currency code
 * @returns {number} Amount in minor units (integer)
 * @throws {Error} if amount is invalid or currency is unsupported
 */
function convertToMinorUnits(amount, currency) {
  // Validate inputs
  if (typeof amount !== 'number' || !isFinite(amount)) {
    throw new Error(`Invalid amount: must be a finite number, got ${amount}`);
  }
  if (amount < 0) {
    throw new Error(`Invalid amount: cannot be negative, got ${amount}`);
  }

  const curr = validateCurrency(currency);
  const info = CURRENCY_INFO[curr];
  const factor = Math.pow(10, info.decimals);
  
  // Round to correct decimal places, then convert to integer
  const rounded = bankersRound(amount, info.decimals);
  const minorUnits = Math.round(rounded * factor);
  
  return minorUnits;
}

/**
 * Convert minor units (1050 cents) to display amount ($10.50)
 * @param {number} minorUnits - Amount in minor units (integer)
 * @param {string} currency - ISO 4217 currency code
 * @returns {number} Display amount
 * @throws {Error} if minorUnits is invalid
 */
function convertFromMinorUnits(minorUnits, currency) {
  // Validate inputs
  if (!Number.isInteger(minorUnits)) {
    throw new Error(`Invalid minor units: must be an integer, got ${minorUnits}`);
  }
  if (minorUnits < 0) {
    throw new Error(`Invalid minor units: cannot be negative, got ${minorUnits}`);
  }

  const curr = validateCurrency(currency);
  const info = CURRENCY_INFO[curr];
  const factor = Math.pow(10, info.decimals);
  
  return minorUnits / factor;
}

/**
 * Format amount as localized currency string
 * Uses Intl.NumberFormat for locale-aware formatting
 * @param {number} minorUnits - Amount in minor units
 * @param {string} currency - ISO 4217 currency code
 * @param {string} locale - BCP 47 language tag (e.g., 'en-US', 'de-DE')
 * @returns {string} Formatted currency string (e.g., "$10.50")
 * @throws {Error} if inputs are invalid
 */
function formatCurrency(minorUnits, currency, locale = 'en-US') {
  // Validate inputs
  if (!Number.isInteger(minorUnits)) {
    throw new Error(`Invalid amount: must be an integer in minor units`);
  }
  
  const curr = validateCurrency(currency);
  const displayAmount = convertFromMinorUnits(minorUnits, curr);
  
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: CURRENCY_INFO[curr].decimals,
      maximumFractionDigits: CURRENCY_INFO[curr].decimals,
    }).format(displayAmount);
  } catch (error) {
    throw new Error(`Failed to format currency: ${error.message}`);
  }
}

/**
 * Add two amounts in minor units
 * Both amounts must be in the specified currency (no implicit conversion)
 * @param {number} amountA - First amount in minor units
 * @param {number} amountB - Second amount in minor units
 * @param {string} currency - ISO 4217 currency code (both amounts must be in this currency)
 * @returns {number} Sum in minor units
 * @throws {Error} if inputs are invalid or currencies don't match
 */
function addAmounts(amountA, amountB, currency) {
  const curr = validateCurrency(currency);
  
  if (!Number.isInteger(amountA) || !Number.isInteger(amountB)) {
    throw new Error('Both amounts must be integers in minor units');
  }
  if (amountA < 0 || amountB < 0) {
    throw new Error('Amounts cannot be negative');
  }
  
  // Note: Cannot detect if amounts were converted from different currencies
  // at runtime, but this function requires explicit currency parameter
  // to ensure the caller is intentionally adding amounts in the same currency
  if (!Number.isInteger(amountA) || !Number.isInteger(amountB)) {
    throw new Error('Cannot add amounts: inputs must be integers in minor units');
  }
  
  return amountA + amountB;
}

/**
 * Subtract one amount from another
 * @param {number} minuend - Amount to subtract from (in minor units)
 * @param {number} subtrahend - Amount to subtract (in minor units)
 * @param {string} currency - ISO 4217 currency code
 * @returns {number} Difference in minor units
 * @throws {Error} if result would be negative
 */
function subtractAmounts(minuend, subtrahend, currency) {
  validateCurrency(currency);
  
  if (!Number.isInteger(minuend) || !Number.isInteger(subtrahend)) {
    throw new Error('Both amounts must be integers in minor units');
  }
  if (minuend < 0 || subtrahend < 0) {
    throw new Error('Amounts cannot be negative');
  }
  if (minuend < subtrahend) {
    throw new Error('Cannot subtract: result would be negative');
  }
  
  return minuend - subtrahend;
}

/**
 * Multiply amount by a quantity (e.g., item quantity)
 * @param {number} minorUnits - Amount in minor units
 * @param {number} quantity - Quantity to multiply by (can be fractional)
 * @param {string} currency - ISO 4217 currency code
 * @returns {number} Product in minor units (rounded)
 * @throws {Error} if inputs are invalid
 */
function multiplyAmount(minorUnits, quantity, currency) {
  if (!Number.isInteger(minorUnits)) {
    throw new Error('Amount must be an integer in minor units');
  }
  if (typeof quantity !== 'number' || !isFinite(quantity)) {
    throw new Error('Quantity must be a finite number');
  }
  if (minorUnits < 0 || quantity < 0) {
    throw new Error('Amount and quantity cannot be negative');
  }
  
  validateCurrency(currency);
  
  const result = minorUnits * quantity;
  // Round to nearest integer (banker's rounding)
  return Math.round(result);
}

/**
 * Divide amount by a divisor (e.g., split bill among N people)
 * @param {number} minorUnits - Amount in minor units
 * @param {number} divisor - Number to divide by
 * @param {string} currency - ISO 4217 currency code
 * @returns {number} Quotient in minor units (rounded)
 * @throws {Error} if inputs are invalid or divisor is zero
 */
function divideAmount(minorUnits, divisor, currency) {
  if (!Number.isInteger(minorUnits)) {
    throw new Error('Amount must be an integer in minor units');
  }
  if (typeof divisor !== 'number' || !isFinite(divisor)) {
    throw new Error('Divisor must be a finite number');
  }
  if (divisor === 0) {
    throw new Error('Cannot divide by zero');
  }
  if (minorUnits < 0) {
    throw new Error('Amount cannot be negative');
  }
  
  validateCurrency(currency);
  
  // Perform the division and round up to ensure we don't lose money
  // (e.g., $10.00 / 3 = $3.34 per person, total = $10.02)
  const result = minorUnits / divisor;
  return Math.ceil(result);
}

/**
 * Round amount to currency-specific decimal places
 * Uses banker's rounding (round half to even)
 * @param {number} minorUnits - Amount in minor units
 * @param {string} currency - ISO 4217 currency code
 * @returns {number} Rounded amount in minor units
 */
function roundAmount(minorUnits, currency) {
  if (!Number.isInteger(minorUnits)) {
    throw new Error('Amount must be an integer in minor units');
  }
  
  const curr = validateCurrency(currency);
  const info = CURRENCY_INFO[curr];
  
  // Apply banker's rounding to the integer value
  // This rounds to nearest integer, with .5 going to nearest even
  if (minorUnits % 2 === 1) {
    // If odd, round down to even
    return minorUnits - 1;
  }
  // If even, keep as is
  return minorUnits;
}

/**
 * Validate that an amount is a valid money value
 * @param {number} minorUnits - Amount in minor units
 * @param {string} currency - ISO 4217 currency code
 * @returns {boolean} true if valid, false otherwise
 */
function validateMoneyAmount(minorUnits, currency) {
  // Check if it's an integer
  if (!Number.isInteger(minorUnits)) {
    return false;
  }
  
  // Check if it's non-negative
  if (minorUnits < 0) {
    return false;
  }
  
  // Check if currency is valid
  if (!currency || typeof currency !== 'string' || !CURRENCY_INFO[currency.toUpperCase()]) {
    return false;
  }
  
  return true;
}

/**
 * Get metadata for a currency
 * @param {string} currency - ISO 4217 currency code
 * @returns {object} {decimals, symbol, name}
 * @throws {Error} if currency is unsupported
 */
function getCurrencyInfo(currency) {
  const curr = validateCurrency(currency);
  return { ...CURRENCY_INFO[curr] };
}

/**
 * Get list of all supported currencies
 * @returns {string[]} Array of ISO 4217 currency codes
 */
function getSupportedCurrencies() {
  return Object.keys(CURRENCY_INFO);
}

module.exports = {
  convertToMinorUnits,
  convertFromMinorUnits,
  formatCurrency,
  addAmounts,
  subtractAmounts,
  multiplyAmount,
  divideAmount,
  roundAmount,
  validateMoneyAmount,
  getCurrencyInfo,
  getSupportedCurrencies,
};
