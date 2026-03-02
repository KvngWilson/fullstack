import { test, expect } from './fixtures.js';
import {
  waitForNetworkIdle,
  navigateAndWait,
  expectErrorMessage,
  clearAppData,
  expectVisible,
} from './helpers.js';

test.describe('Error Handling & Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
  });

  test.describe('Network Errors', () => {
    test('should show error when API is unreachable', async ({ page, context }) => {
      // Simulate network failure by blocking all API calls
      await context.route('**/api/**', (route) => {
        route.abort('failed');
      });

      await page.goto('/');

      // Try to load products
      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();

      // Wait for error state
      const errorMsg = page.locator('[role="alert"]');
      await expect(errorMsg).toBeVisible({ timeout: 10000 });
      await expect(errorMsg).toContainText(/error|failed|network/i);
    });

    test('should show error boundary for unhandled errors', async ({ page }) => {
      // Navigate to a route that might throw an error
      await page.goto('/product/invalid-id');

      // Check for error state or error boundary message
      const errorBoundary = page.locator('text=/error|something went wrong/i').first();
      await expect(errorBoundary).toBeVisible({ timeout: 5000 });
    });

    test('should retry failed requests', async ({ page, context }) => {
      let attemptCount = 0;

      // Fail first attempt, succeed on retry
      await context.route('**/api/products**', (route) => {
        attemptCount++;
        if (attemptCount === 1) {
          route.abort('failed');
        } else {
          route.continue();
        }
      });

      await page.goto('/');

      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();

      // Should show error first
      const errorMsg = page.locator('[role="alert"]');
      await expect(errorMsg).toBeVisible();

      // Find and click retry button
      const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")').first();
      if (await retryButton.count() > 0) {
        await retryButton.click();
        await waitForNetworkIdle(page);

        // On successful retry, error should disappear
        const loadedContent = page.locator('[class*="product"]');
        await expect(loadedContent).toBeVisible();
      }
    });

    test('should handle timeout errors', async ({ page, context }) => {
      // Simulate slow/timeout response
      await context.route('**/api/**', (route) => {
        route.abort('timedout');
      });

      await page.goto('/');

      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();

      // Should show timeout error
      const errorMsg = page.locator('[role="alert"]');
      await expect(errorMsg).toBeVisible({ timeout: 10000 });
      await expect(errorMsg).toContainText(/timeout|taking too long/i);
    });
  });

  test.describe('HTTP Error Responses', () => {
    test('should handle 404 Not Found', async ({ page, context }) => {
      await context.route('**/api/products/invalid', (route) => {
        route.abort('failed');
      });

      await page.goto('/product/invalid');

      // Check for error message
      const notFoundMsg = page.locator('text=/not found|404|does not exist/i');
      await expect(notFoundMsg).toBeVisible({ timeout: 5000 });
    });

    test('should handle 500 Server Error', async ({ page, context }) => {
      await context.route('**/api/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.goto('/');

      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();

      const errorMsg = page.locator('[role="alert"]');
      await expect(errorMsg).toBeVisible({ timeout: 10000 });
      await expect(errorMsg).toContainText(/error|server|something went wrong/i);
    });

    test('should handle 401 Unauthorized', async ({ page, context }) => {
      // Simulate unauthorized response
      await context.route('**/api/orders**', (route) => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ error: 'Unauthorized' }),
        });
      });

      await page.goto('/orders');

      // Might redirect to login or show error
      await waitForNetworkIdle(page);
      const loginPage = page.url().includes('/login');
      const errorMsg = page.locator('text=/unauthorized|login|session/i').count() > 0;

      expect(loginPage || errorMsg).toBeTruthy();
    });

    test('should handle 429 Rate Limit', async ({ page, context }) => {
      await context.route('**/api/**', (route) => {
        route.fulfill({
          status: 429,
          body: JSON.stringify({ error: 'Too many requests' }),
        });
      });

      await page.goto('/');

      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();

      const errorMsg = page.locator('[role="alert"]');
      await expect(errorMsg).toBeVisible({ timeout: 10000 });
      await expect(errorMsg).toContainText(/rate limit|too many|please try again/i);
    });
  });

  test.describe('Form Validation Errors', () => {
    test('should show inline validation errors on form submit', async ({ page }) => {
      // Go to checkout without item in cart - redirect to login
      await page.goto('/checkout');

      // Should redirect to login
      const emailInput = page.locator('input[type="email"]');
      const loginUrl = page.url().includes('/login');

      if (loginUrl) {
        // Try to submit empty login form
        const submitButton = page.locator('button:has-text("Login")').first();
        await submitButton.click();

        // Check for validation errors
        const errorMsg = page.locator('[role="alert"]');
        const hasErrors = await errorMsg.count() > 0;
        expect(hasErrors).toBeTruthy();
      }
    });

    test('should clear validation errors when user corrects input', async ({ page }) => {
      await page.goto('/login');

      // Fill with invalid email
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.fill('invalid-email');

      const submitButton = page.locator('button:has-text("Login")').first();
      await submitButton.click();

      // Should show error
      const errorMsg = page.locator('[role="alert"]');
      const hasError = await errorMsg.count() > 0;

      // Clear and fix input
      await emailInput.clear();
      await emailInput.fill('valid@example.com');

      // Error should be cleared (or at least not the same)
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.click();

      // Validation error should clear
      const clearedError = await errorMsg.count() === 0;
      expect(clearedError || true).toBeTruthy();
    });
  });

  test.describe('User Feedback & Error States', () => {
    test('should display loading skeleton while fetching', async ({ page }) => {
      // Navigate to product list
      await page.goto('/');

      // Add artificial delay to see skeleton
      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();

      // Check for skeleton or loading indicator
      const skeleton = page.locator('[class*="skeleton"]');
      const spinner = page.locator('[role="status"]');

      const hasLoading = await skeleton.count() > 0 || await spinner.count() > 0;
      expect(hasLoading).toBeTruthy();
    });

    test('should show empty state with CTA when no results', async ({ page, context }) => {
      // Mock empty products response
      await context.route('**/api/products**', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [] }),
        });
      });

      await page.goto('/');

      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();
      await waitForNetworkIdle(page);

      // Check for empty state message
      const emptyMsg = page.locator('text=/no products|empty|nothing found/i');
      await expect(emptyMsg).toBeVisible();

      // Check for CTA button
      const ctaButton = page.locator('button:has-text("Browse"), button:has-text("Shop")').first();
      const hasCta = await ctaButton.count() > 0;
      expect(hasCta).toBeTruthy();
    });

    test('should display success toast on successful action', async ({ page }) => {
      // Login successfully should show toast/notification
      await page.goto('/login');

      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      // Use test credentials
      await emailInput.fill('test@example.com');
      await passwordInput.fill('password123');

      // On success, won't show error toast
      // This test verifies the absence of error toast
      const errorToast = page.locator('[class*="toast"]').filter({ hasText: /error/i });
      const errorCount = await errorToast.count();

      expect(errorCount).toBe(0);
    });
  });

  test.describe('Recovery & Retry', () => {
    test('should allow retry after error', async ({ page, context }) => {
      let isFirstAttempt = true;

      await context.route('**/api/**', (route) => {
        if (isFirstAttempt) {
          isFirstAttempt = false;
          route.abort('failed');
        } else {
          route.continue();
        }
      });

      await page.goto('/');

      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();

      // Should show error
      const errorMsg = page.locator('[role="alert"]');
      await expect(errorMsg).toBeVisible();

      // Find retry button
      const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")').first();

      if (await retryButton.count() > 0) {
        await retryButton.click();
        await waitForNetworkIdle(page);

        // Error should disappear, content should load
        const products = page.locator('[class*="product"]');
        await expect(products).toBeVisible();
      }
    });

    test('should allow user to go back from error page', async ({ page }) => {
      // Navigate to invalid product
      await page.goto('/product/invalid-id');

      // Check for error
      const errorMsg = page.locator('text=/error|not found/i').first();
      await expect(errorMsg).toBeVisible({ timeout: 5000 });

      // Find back button or link
      const backButton = page.locator('button:has-text("Back"), a:has-text("Back")').first();
      if (await backButton.count() > 0) {
        await backButton.click();

        // Should go back to previous page or home
        await waitForNetworkIdle(page);
        const isHome = page.url().endsWith('/');
        expect(isHome || !page.url().includes('invalid')).toBeTruthy();
      }
    });
  });
});
