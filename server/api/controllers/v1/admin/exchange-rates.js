const { pool } = require("../../../../config/db");
const AdminAuthService = require("../../../../domain/admin/AdminAuthService");

const adminAuthService = new AdminAuthService();

function normalizeCurrency(code) {
  return String(code || "").trim().toUpperCase();
}

function normalizeRate(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error("Rate must be a positive number");
  }

  return Number(numeric.toFixed(8));
}

/**
 * Exchange Rates Controller
 * Manages currency exchange rates and historical data
 */

exports.listExchangeRates = async (req, res) => {
  try {
    const { from = "USD", to = null, active = true } = req.query;

    let query = `
      SELECT 
        id,
        from_currency,
        to_currency,
        rate,
        effective_date,
        expires_at,
        is_active,
        created_at,
        updated_at
      FROM exchange_rates
      WHERE 1=1
    `;

    const params = [];

    if (from) {
      query += ` AND from_currency = $${params.length + 1}`;
      params.push(normalizeCurrency(from));
    }

    if (to) {
      query += ` AND to_currency = $${params.length + 1}`;
      params.push(normalizeCurrency(to));
    }

    if (active === "true" || active === true) {
      query += ` AND is_active = true AND expires_at > NOW()`;
    }

    query += ` ORDER BY from_currency, to_currency, effective_date DESC`;

    const result = await pool.query(query, params);

    res.json({
      total: result.rows.length,
      rates: result.rows,
    });
  } catch (error) {
    console.error("Error listing exchange rates:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getExchangeRate = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id,
        from_currency,
        to_currency,
        rate,
        effective_date,
        expires_at,
        is_active,
        created_at,
        updated_at
      FROM exchange_rates
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Exchange rate not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error getting exchange rate:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getCurrentRate = async (req, res) => {
  try {
    const { from, to } = req.params;

    if (!from || !to) {
      return res.status(400).json({ error: "from and to currencies required" });
    }

    // Get the current effective rate
    const query = `
      SELECT 
        id,
        from_currency,
        to_currency,
        rate,
        effective_date,
        expires_at
      FROM exchange_rates
      WHERE 
        from_currency = $1 
        AND to_currency = $2
        AND is_active = true
        AND effective_date <= NOW()
        AND expires_at > NOW()
      ORDER BY effective_date DESC
      LIMIT 1
    `;

    const result = await pool.query(query, [normalizeCurrency(from), normalizeCurrency(to)]);
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: `No active exchange rate found for ${from}/${to}`,
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error getting current rate:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getRateHistory = async (req, res) => {
  try {
    const from = req.params.from;
    const to = req.params.to;
    const limit = req.query.limit || 30;

    if (!from || !to) {
      return res.status(400).json({
        error: "from and to path parameters required",
      });
    }

    const query = `
      SELECT 
        id,
        from_currency,
        to_currency,
        rate,
        effective_date,
        expires_at,
        is_active,
        created_at
      FROM exchange_rates
      WHERE 
        from_currency = $1 
        AND to_currency = $2
      ORDER BY effective_date DESC
      LIMIT $3
    `;

    const result = await pool.query(query, [
      normalizeCurrency(from),
      normalizeCurrency(to),
      Math.min(parseInt(limit, 10), 365), // Max 1 year of history
    ]);

    res.json({
      from: normalizeCurrency(from),
      to: normalizeCurrency(to),
      count: result.rows.length,
      history: result.rows,
    });
  } catch (error) {
    console.error("Error getting rate history:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createExchangeRate = async (req, res) => {
  try {
    const { fromCurrency, toCurrency, rate, effectiveDate, expiryDate, provider } = req.body;

    // Validation
    if (!fromCurrency || !toCurrency || rate === undefined) {
      return res.status(400).json({
        error: "fromCurrency, toCurrency, and rate are required",
      });
    }

    const normalizedRate = normalizeRate(rate);
    const normalizedFrom = normalizeCurrency(fromCurrency);
    const normalizedTo = normalizeCurrency(toCurrency);

    if (normalizedFrom === normalizedTo) {
      return res.status(400).json({
        error: "fromCurrency and toCurrency must be different",
      });
    }

    // Ensure effective date is valid
    const effDate = effectiveDate ? new Date(effectiveDate) : new Date();
    if (isNaN(effDate.getTime())) {
      return res.status(400).json({ error: "Invalid effective date" });
    }

    const expiresAt = expiryDate
      ? new Date(expiryDate)
      : new Date(effDate.getTime() + 24 * 60 * 60 * 1000);

    if (isNaN(expiresAt.getTime())) {
      return res.status(400).json({ error: "Invalid expiry date" });
    }

    if (expiresAt <= effDate) {
      return res.status(400).json({ error: "expiryDate must be after effectiveDate" });
    }

    // Check for existing rate on same effective date
    const existing = await pool.query(
      `SELECT id FROM exchange_rates 
       WHERE from_currency = $1 AND to_currency = $2 AND effective_date = $3`,
      [normalizedFrom, normalizedTo, effDate]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: `Rate already exists for ${fromCurrency}/${toCurrency} on ${effDate.toISOString().split("T")[0]}`,
      });
    }

    // Insert new rate
    const query = `
      INSERT INTO exchange_rates (from_currency, to_currency, rate, provider, effective_date, expires_at, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
      RETURNING id, from_currency, to_currency, rate, provider, effective_date, expires_at, is_active, created_at, updated_at
    `;

    const result = await pool.query(query, [
      normalizedFrom,
      normalizedTo,
      normalizedRate,
      provider || null,
      effDate,
      expiresAt,
    ]);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "exchange-rates:create",
      "exchange_rate",
      result.rows[0].id,
      {
        fromCurrency: normalizedFrom,
        toCurrency: normalizedTo,
        rate: normalizedRate,
        effectiveDate: effDate,
        expiresAt,
      }
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error creating exchange rate:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateExchangeRate = async (req, res) => {
  try {
    const { id } = req.params;
    const { rate, expiryDate, isActive } = req.body;

    // Check rate exists
    const existing = await pool.query(
      `SELECT from_currency, to_currency FROM exchange_rates WHERE id = $1`,
      [id]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Exchange rate not found" });
    }

    let updateQuery = "UPDATE exchange_rates SET updated_at = NOW()";
    const params = [];

    if (rate !== undefined) {
      const normalizedRate = normalizeRate(rate);
      updateQuery += `, rate = $${params.length + 1}`;
      params.push(normalizedRate);
    }

    if (expiryDate !== undefined) {
      const expDate = expiryDate ? new Date(expiryDate) : null;
      if (expiryDate && isNaN(expDate.getTime())) {
        return res.status(400).json({ error: "Invalid expiry date" });
      }
      updateQuery += `, expires_at = $${params.length + 1}`;
      params.push(expDate);
    }

    if (isActive !== undefined) {
      updateQuery += `, is_active = $${params.length + 1}`;
      params.push(isActive);
    }

    updateQuery += ` WHERE id = $${params.length + 1} RETURNING id, from_currency, to_currency, rate, effective_date, expires_at, is_active, updated_at`;
    params.push(id);

    const result = await pool.query(updateQuery, params);

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "exchange-rates:update",
      "exchange_rate",
      id,
      { changes: { rate, expiryDate, isActive } }
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating exchange rate:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deactivateRate = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      UPDATE exchange_rates 
      SET is_active = false, expires_at = NOW(), updated_at = NOW()
      WHERE id = $1
      RETURNING id, from_currency, to_currency, is_active, expires_at, updated_at
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Exchange rate not found" });
    }

    // Audit log
    await adminAuthService.auditLog(
      req.employee.id,
      "exchange-rates:deactivate",
      "exchange_rate",
      id,
      { deactivated: true }
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error deactivating rate:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
