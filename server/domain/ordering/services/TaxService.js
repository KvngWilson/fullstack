class TaxService {
  constructor(defaultTaxRate = process.env.DEFAULT_TAX_RATE || "0.08") {
    const parsedRate = Number.parseFloat(defaultTaxRate);
    this.defaultTaxRate =
      Number.isFinite(parsedRate) && parsedRate >= 0 ? parsedRate : 0;

    this.countryRates = this.parseRateMap(process.env.TAX_RATE_BY_COUNTRY_JSON);
    this.usStateRates = this.parseRateMap(
      process.env.TAX_RATE_BY_US_STATE_JSON,
    );
  }

  parseRateMap(rawMap) {
    if (!rawMap) {
      return {};
    }

    let parsed = rawMap;
    if (typeof rawMap === "string") {
      try {
        parsed = JSON.parse(rawMap);
      } catch (_error) {
        return {};
      }
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.entries(parsed).reduce((acc, [key, value]) => {
      const normalizedKey = String(key || "")
        .trim()
        .toUpperCase();
      const parsedRate = Number.parseFloat(value);

      if (normalizedKey && Number.isFinite(parsedRate) && parsedRate >= 0) {
        acc[normalizedKey] = parsedRate;
      }

      return acc;
    }, {});
  }

  getTaxRate(context = {}) {
    const contextRate = Number.parseFloat(context.taxRate);
    if (Number.isFinite(contextRate) && contextRate >= 0) {
      return contextRate;
    }

    const address = context.address || {};
    const country = String(
      context.country ||
        address.country ||
        address.country_code ||
        address.countryCode ||
        "",
    )
      .trim()
      .toUpperCase();

    const state = String(
      context.state || address.state || address.province || "",
    )
      .trim()
      .toUpperCase();

    if (country === "US" && state && this.usStateRates[state] !== undefined) {
      return this.usStateRates[state];
    }

    if (country && this.countryRates[country] !== undefined) {
      return this.countryRates[country];
    }

    return this.defaultTaxRate;
  }

  calculateFromMinor(subtotalMinorUnits, context = {}) {
    const amount = Number(subtotalMinorUnits) || 0;
    const rate = this.getTaxRate(context);
    return Math.round(amount * rate);
  }

  calculateFromMajor(subtotal, context = {}) {
    const amount = Number(subtotal) || 0;
    const rate = this.getTaxRate(context);
    return Number.parseFloat((amount * rate).toFixed(2));
  }
}

module.exports = new TaxService();
module.exports.TaxService = TaxService;
