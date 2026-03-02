/**
 * Factory functions for creating test data
 * Use these to create consistent test fixtures
 */

export const createMockUser = (overrides = {}) => ({
  id: '123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'customer',
  createdAt: '2026-03-02T00:00:00Z',
  ...overrides,
});

export const createMockProduct = (overrides = {}) => ({
  id: '1',
  name: 'Test Product',
  description: 'A test product',
  price: 99.99,
  salePrice: 79.99,
  imageUrl: 'https://example.com/product.jpg',
  category: 'Electronics',
  stock: 10,
  rating: 4.5,
  reviews: 42,
  createdAt: '2026-03-02T00:00:00Z',
  ...overrides,
});

export const createMockCart = (overrides = {}) => ({
  id: '1',
  userId: '123',
  items: [],
  subtotal: 0,
  tax: 0,
  total: 0,
  createdAt: '2026-03-02T00:00:00Z',
  updatedAt: '2026-03-02T00:00:00Z',
  ...overrides,
});

export const createMockCartItem = (overrides = {}) => ({
  id: '1',
  cartId: '1',
  productId: '1',
  product: createMockProduct(),
  quantity: 1,
  price: 99.99,
  ...overrides,
});

export const createMockOrder = (overrides = {}) => ({
  id: '1',
  userId: '123',
  number: 'ORD-001',
  status: 'pending',
  items: [],
  subtotal: 0,
  tax: 0,
  shipping: 0,
  total: 0,
  shippingAddress: createMockAddress(),
  billingAddress: createMockAddress(),
  createdAt: '2026-03-02T00:00:00Z',
  updatedAt: '2026-03-02T00:00:00Z',
  ...overrides,
});

export const createMockAddress = (overrides = {}) => ({
  id: '1',
  firstName: 'Test',
  lastName: 'User',
  street: '123 Main St',
  city: 'Test City',
  state: 'TS',
  postalCode: '12345',
  country: 'US',
  phone: '555-1234',
  isDefault: false,
  ...overrides,
});

export const createMockAuthState = (overrides = {}) => ({
  user: createMockUser(),
  isAuthenticated: true,
  isLoading: false,
  error: null,
  ...overrides,
});

export const createMockProductsState = (overrides = {}) => ({
  ids: ['1', '2', '3'],
  entities: {
    '1': createMockProduct({ id: '1' }),
    '2': createMockProduct({ id: '2' }),
    '3': createMockProduct({ id: '3' }),
  },
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 3,
  },
  filters: {},
  ...overrides,
});
