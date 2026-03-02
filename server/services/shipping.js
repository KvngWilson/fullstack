const easyship = require('@api/easyship');

const DEFAULT_ORIGIN = {
  country_code: 'US',
  city: 'San Francisco',
  postal_code: '94102',
  state: 'CA',
};

function mapAddress(address = {}) {
  return {
    country_alpha2: address.country_code || address.country || 'US',
    city: address.city || '',
    postal_code: address.postal_code || '',
    state: address.state || '',
  };
}

function mapItem(item = {}) {
  return {
    description: item.description || 'Product Item',
    quantity: item.quantity || 1,
    actual_weight: item.weight ?? 0.5,
    declared_customs_value: item.value ?? 0,
    category: item.category || 'general',
    height: item.height ?? 10,
    width: item.width ?? 10,
    length: item.length ?? 10,
  };
}

async function calculateShippingRates(params = {}) {
  try {
    const destination = params.destination || {};
    const origin = params.origin || DEFAULT_ORIGIN;
    const items = Array.isArray(params.items) ? params.items : [];

    const payload = {
      destination_address: mapAddress(destination),
      origin_address: mapAddress(origin),
      parcels: [
        {
          box: null,
          items: items.map(mapItem),
        },
      ],
      incoterms: 'DDU',
    };

    if (typeof easyship.auth === 'function') {
      easyship.auth(process.env.EASYSHIP_API_KEY || 'test_key');
    }

    const response = await easyship.rates_request(payload);
    const rates = response?.data?.rates || [];

    return {
      success: true,
      rates,
      message: 'Shipping rates retrieved successfully',
    };
  } catch (error) {
    return {
      success: false,
      rates: [],
      message: error.message || 'Unable to calculate shipping rates',
    };
  }
}

async function getDeliveryEstimates(countryCode = 'US') {
  try {
    const normalizedCountry = countryCode || 'US';
    const estimates = [
      { method: 'standard', min_days: 5, max_days: 8, country: normalizedCountry },
      { method: 'express', min_days: 2, max_days: 4, country: normalizedCountry },
      { method: 'overnight', min_days: 1, max_days: 1, country: normalizedCountry },
    ];

    return { success: true, estimates };
  } catch (error) {
    return { success: false, estimates: [], message: error.message };
  }
}

async function validateAddress(address = {}) {
  const safeAddress = address && typeof address === 'object' ? address : {};
  const requiredFields = ['street', 'city', 'postal_code', 'country'];
  const missingFields = [];

  for (const field of requiredFields) {
    if (!safeAddress[field]) {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    return {
      valid: false,
      message: `Address validation failed: missing ${missingFields.join(', ')}`,
    };
  }

  return {
    valid: true,
    message: 'Address is valid',
  };
}

module.exports = {
  calculateShippingRates,
  getDeliveryEstimates,
  validateAddress,
};
