import { test as base } from '@playwright/test';
import { loginViaAPI, setAuthToken, clearAppData } from './helpers.js';

/**
 * Fixtures for E2E tests
 * Provides authenticated users, API context, and test data
 */

// Test user accounts (replace with real test accounts from backend)
export const TEST_USERS = {
  customer: {
    email: 'test.customer@example.com',
    password: 'TestPass123!',
    name: 'Test Customer',
  },
  admin: {
    email: 'test.admin@example.com',
    password: 'AdminPass123!',
    name: 'Test Admin',
  },
  vendor: {
    email: 'test.vendor@example.com',
    password: 'VendorPass123!',
    name: 'Test Vendor',
  },
};

// Mock product data for testing
export const MOCK_PRODUCTS = [
  {
    id: '1',
    name: 'Premium Wireless Headphones',
    price: 149.99,
    description: 'High-quality noise-canceling headphones',
    category: 'electronics',
  },
  {
    id: '2',
    name: 'Organic Coffee Beans',
    price: 12.99,
    description: 'Fair-trade organic coffee beans',
    category: 'food',
  },
  {
    id: '3',
    name: 'Yoga Mat',
    price: 39.99,
    description: 'Non-slip exercises yoga mat',
    category: 'sports',
  },
];

// Mock category data
export const MOCK_CATEGORIES = [
  { id: '1', name: 'Electronics', description: 'Electronic products' },
  { id: '2', name: 'Food', description: 'Food and beverages' },
  { id: '3', name: 'Sports', description: 'Sports equipment' },
];

/**
 * Fixture: Custom page with auth setup
 */
export const test = base.extend({
  /**
   * Authenticated page - user is already logged in
   */
  authenticatedPage: async ({ page, context }, use) => {
    // Clear any existing auth data
    await clearAppData(page);

    // Navigate to app to initialize
    await page.goto('/');

    // Simulate login (in real scenario, login via API)
    // For now, we'll navigate to login and fill credentials
    // This will be refined based on actual auth implementation
    
    await use(page);

    // Cleanup
    await clearAppData(page);
  },

  /**
   * API context for making authenticated API calls
   */
  apiContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    const request = context.request;

    // In real scenario, obtain auth token
    // const token = await loginViaAPI(request, 'http://localhost:3000', 
    //   TEST_USERS.customer.email, TEST_USERS.customer.password);

    await use(request);
    await context.close();
  },

  /**
   * Test data including mock products and categories
   */
  testData: async ({}, use) => {
    const data = {
      products: MOCK_PRODUCTS,
      categories: MOCK_CATEGORIES,
      users: TEST_USERS,
      // Helper to generate random email
      randomEmail: () => `test_${Date.now()}@example.com`,
      // Helper to generate random product name
      randomProductName: () => `Test Product ${Date.now()}`,
    };

    await use(data);
  },
});

export { expect } from '@playwright/test';
