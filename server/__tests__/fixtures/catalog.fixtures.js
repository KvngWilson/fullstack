/**
 * Catalog Domain Test Fixtures
 * Provides pre-configured test data and factories for product/catalog testing
 */

const testHelpers = require("../helpers/testHelpers");

// ===== FIXTURE DEFAULTS =====

const BASIC_PRODUCT_DEFAULTS = {
  name: "Basic Test Product",
  description: "A basic test product",
  brand: "TestBrand",
  base_price: 19.99,
  is_active: true,
  category_id: null,
};

const PREMIUM_PRODUCT_DEFAULTS = {
  name: "Premium Test Product",
  description: "A premium test product with high value",
  brand: "PremiumBrand",
  base_price: 99.99,
  is_active: true,
  category_id: null,
};

const VARIANT_DEFAULTS = {
  sku: "SKU-DEFAULT",
  size: "M",
  color: "Blue",
  price_adjustment: 0,
  stock: 100,
};

// ===== FIXTURE FACTORIES =====

/**
 * Create basic product for testing
 */
async function createBasicProduct(overrides = {}) {
  return testHelpers.createTestProduct({
    ...BASIC_PRODUCT_DEFAULTS,
    ...overrides,
  });
}

/**
 * Create premium/high-value product
 */
async function createPremiumProduct(overrides = {}) {
  return testHelpers.createTestProduct({
    ...PREMIUM_PRODUCT_DEFAULTS,
    ...overrides,
  });
}

/**
 * Create multiple products
 */
async function createMultipleProducts(count = 3, overrides = {}) {
  const products = [];
  for (let i = 0; i < count; i++) {
    const product = await createBasicProduct({
      name: `Test Product ${i + 1}`,
      ...overrides,
    });
    products.push(product);
  }
  return products;
}

/**
 * Create product with variants
 */
async function createProductWithVariants(variantCount = 2, overrides = {}) {
  const product = await createBasicProduct(overrides);

  const variants = [];
  const colors = ["Red", "Blue", "Green"];
  const sizes = ["XS", "S", "M", "L", "XL"];

  for (let i = 0; i < Math.min(variantCount, colors.length); i++) {
    const variant = await testHelpers.createTestVariant(product.id, {
      color: colors[i],
      size: sizes[i],
      stock: 50 + i * 10,
    });
    variants.push(variant);
  }

  return {
    ...product,
    variants,
  };
}

/**
 * Create product with low stock
 */
async function createLowStockProduct(overrides = {}) {
  const product = await createBasicProduct({
    base_price: 9.99,
    ...overrides,
  });

  const variant = await testHelpers.createTestVariant(product.id, {
    stock: 2, // Low stock
  });

  return {
    ...product,
    variants: [variant],
  };
}

/**
 * Create out-of-stock product
 */
async function createOutOfStockProduct(overrides = {}) {
  const product = await createBasicProduct(overrides);

  const variant = await testHelpers.createTestVariant(product.id, {
    stock: 0, // Out of stock
  });

  return {
    ...product,
    variants: [variant],
  };
}

// ===== FIXTURE PRESETS =====

/**
 * Preset: Basic product for general tests
 */
const basicProductPreset = {
  factory: createBasicProduct,
  defaults: BASIC_PRODUCT_DEFAULTS,
};

/**
 * Preset: Premium product for pricing tests
 */
const premiumProductPreset = {
  factory: createPremiumProduct,
  defaults: PREMIUM_PRODUCT_DEFAULTS,
};

/**
 * Preset: Product with multiple variants
 */
const productWithVariantsPreset = {
  factory: createProductWithVariants,
  defaults: { variantCount: 3 },
};

/**
 * Preset: Low stock product for inventory tests
 */
const lowStockProductPreset = {
  factory: createLowStockProduct,
  defaults: { stock: 2 },
};

/**
 * Preset: Out of stock product
 */
const outOfStockProductPreset = {
  factory: createOutOfStockProduct,
  defaults: { stock: 0 },
};

// ===== MOCK DATA FOR TESTING =====

/**
 * Valid product creation payload
 */
const validProductPayload = {
  name: "New Test Product",
  description: "Product description",
  brand: "TestBrand",
  base_price: 49.99,
  is_active: true,
};

/**
 * Invalid product payloads for validation tests
 */
const invalidProductPayloads = {
  missingName: {
    description: "Product description",
    brand: "TestBrand",
    base_price: 49.99,
  },
  missingPrice: {
    name: "New Product",
    description: "Product description",
    brand: "TestBrand",
  },
  invalidPrice: {
    name: "New Product",
    description: "Product description",
    brand: "TestBrand",
    base_price: -10, // Invalid: negative price
  },
  zeroPrice: {
    name: "New Product",
    description: "Product description",
    brand: "TestBrand",
    base_price: 0, // Invalid for most products
  },
};

/**
 * Valid variant creation payload
 */
const validVariantPayload = {
  sku: "NEW-SKU-001",
  size: "L",
  color: "Red",
  price_adjustment: 5.0,
  stock: 50,
};

/**
 * Invalid variant payloads for validation tests
 */
const invalidVariantPayloads = {
  missingSku: {
    size: "L",
    color: "Red",
    stock: 50,
  },
  invalidStock: {
    sku: "NEW-SKU-001",
    size: "L",
    color: "Red",
    stock: -5, // Invalid: negative stock
  },
  missingStock: {
    sku: "NEW-SKU-001",
    size: "L",
    color: "Red",
  },
};

/**
 * Product catalog scenarios for testing
 */
const catalogScenarios = {
  // Inventory scenarios
  inStock: {
    stock: 100,
    expectedAvailable: true,
  },
  lowStock: {
    stock: 2,
    expectedAvailable: true,
    isLow: true,
  },
  outOfStock: {
    stock: 0,
    expectedAvailable: false,
  },

  // Pricing scenarios
  regularPrice: {
    base_price: 19.99,
    priceAdjustment: 0,
    expectedPrice: 19.99,
  },
  premiumPrice: {
    base_price: 99.99,
    priceAdjustment: 0,
    expectedPrice: 99.99,
  },
  variantPremium: {
    base_price: 49.99,
    priceAdjustment: 10.0,
    expectedPrice: 59.99,
  },
  budgetVariant: {
    base_price: 49.99,
    priceAdjustment: -5.0,
    expectedPrice: 44.99,
  },

  // Availability scenarios
  activeProduct: {
    is_active: true,
    expectedListable: true,
  },
  inactiveProduct: {
    is_active: false,
    expectedListable: false,
  },
};

/**
 * Sample product names for testing
 */
const sampleProductNames = [
  "Wireless Bluetooth Headphones",
  "USB-C Charging Cable",
  "Laptop Stand",
  "Mechanical Keyboard",
  "Wireless Mouse",
  "Phone Case",
  "Screen Protector",
  "Power Bank",
  "USB Hub",
  "Monitor Arm",
];

/**
 * Sample brands
 */
const sampleBrands = [
  "TechPro",
  "ElectroMax",
  "GadgetHub",
  "SmartTech",
  "ProGear",
  "DigitalEdge",
  "CloudCore",
  "SpeedNet",
];

/**
 * Sample colors
 */
const sampleColors = [
  "Black",
  "White",
  "Silver",
  "Gold",
  "Red",
  "Blue",
  "Green",
  "Purple",
];

/**
 * Sample sizes
 */
const sampleSizes = ["XS", "S", "M", "L", "XL", "XXL", "One Size"];

module.exports = {
  // Factories
  createBasicProduct,
  createPremiumProduct,
  createMultipleProducts,
  createProductWithVariants,
  createLowStockProduct,
  createOutOfStockProduct,

  // Presets
  basicProductPreset,
  premiumProductPreset,
  productWithVariantsPreset,
  lowStockProductPreset,
  outOfStockProductPreset,

  // Mock data
  validProductPayload,
  invalidProductPayloads,
  validVariantPayload,
  invalidVariantPayloads,

  // Scenarios
  catalogScenarios,

  // Sample data
  sampleProductNames,
  sampleBrands,
  sampleColors,
  sampleSizes,

  // Constants
  BASIC_PRODUCT_DEFAULTS,
  PREMIUM_PRODUCT_DEFAULTS,
  VARIANT_DEFAULTS,
};
