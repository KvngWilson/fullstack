const { TaxService } = require("../../../domain/ordering/services/TaxService");

describe("TaxService - Unit Tests", () => {
  const originalCountryRates = process.env.TAX_RATE_BY_COUNTRY_JSON;
  const originalStateRates = process.env.TAX_RATE_BY_US_STATE_JSON;

  afterEach(() => {
    if (originalCountryRates === undefined) {
      delete process.env.TAX_RATE_BY_COUNTRY_JSON;
    } else {
      process.env.TAX_RATE_BY_COUNTRY_JSON = originalCountryRates;
    }

    if (originalStateRates === undefined) {
      delete process.env.TAX_RATE_BY_US_STATE_JSON;
    } else {
      process.env.TAX_RATE_BY_US_STATE_JSON = originalStateRates;
    }
  });

  describe("getTaxRate", () => {
    it("uses explicit context taxRate when provided", () => {
      const service = new TaxService("0.08");

      expect(service.getTaxRate({ taxRate: 0.12 })).toBe(0.12);
    });

    it("uses US state rate before country and default", () => {
      process.env.TAX_RATE_BY_COUNTRY_JSON = JSON.stringify({ US: 0.07 });
      process.env.TAX_RATE_BY_US_STATE_JSON = JSON.stringify({ CA: 0.0925 });
      const service = new TaxService("0.08");

      expect(
        service.getTaxRate({ address: { country: "US", state: "CA" } }),
      ).toBe(0.0925);
    });

    it("uses country rate when state-specific rate is unavailable", () => {
      process.env.TAX_RATE_BY_COUNTRY_JSON = JSON.stringify({ CA: 0.05 });
      process.env.TAX_RATE_BY_US_STATE_JSON = JSON.stringify({ NY: 0.08875 });
      const service = new TaxService("0.08");

      expect(
        service.getTaxRate({ address: { country: "CA", state: "ON" } }),
      ).toBe(0.05);
    });

    it("falls back to default tax rate when no mapping matches", () => {
      process.env.TAX_RATE_BY_COUNTRY_JSON = JSON.stringify({ DE: 0.19 });
      process.env.TAX_RATE_BY_US_STATE_JSON = JSON.stringify({ NY: 0.08875 });
      const service = new TaxService("0.08");

      expect(
        service.getTaxRate({ address: { country: "BR", state: "SP" } }),
      ).toBe(0.08);
    });
  });

  describe("calculations", () => {
    it("calculates major-unit tax with 2-decimal rounding", () => {
      const service = new TaxService("0.0825");

      expect(service.calculateFromMajor(100, {})).toBe(8.25);
      expect(service.calculateFromMajor(19.99, {})).toBe(1.65);
    });

    it("calculates minor-unit tax as integer", () => {
      const service = new TaxService("0.0825");

      expect(service.calculateFromMinor(10000, {})).toBe(825);
      expect(service.calculateFromMinor(1999, {})).toBe(165);
    });
  });
});
