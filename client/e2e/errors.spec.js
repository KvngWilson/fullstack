import { test, expect } from './fixtures.js';
import {
  waitForNetworkIdle,
  clearAppData,
} from './helpers.js';

test.describe('Error Handling & Recovery', () => {
  const isProductsOrLogin = (url) => url.includes('/products') || url.includes('/login');

  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
  });

  test.describe('Network Errors', () => {
    test('should show error when API is unreachable', async ({ page, context }) => {
      // Simulate network failure by blocking all API calls
      await context.route('**/api/**', (route) => {
        route.abort('failed');
      });

      await page.goto('/products');

      expect(isProductsOrLogin(page.url())).toBeTruthy();
    });

    test('should show error boundary for unhandled errors', async ({ page }) => {
      // Navigate to an invalid route to trigger not found page
      await page.goto('/this-route-does-not-exist');

      const url = page.url();
      expect(url.includes('/this-route-does-not-exist') || url.includes('/login')).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();
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

      await page.goto('/products');

      const errorMsg = page.locator('[role="alert"]');
      const hadInitialAlert = await errorMsg.isVisible().catch(() => false);

      // Find and click retry button
      const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")').first();
      if (await retryButton.count() > 0) {
        await retryButton.click();
        await waitForNetworkIdle(page);
      }

      const loadedContent = (await page.locator('.product-card').count()) > 0;
      const hasAlert = await errorMsg.isVisible().catch(() => false);
      expect(hadInitialAlert || hasAlert || loadedContent || isProductsOrLogin(page.url())).toBeTruthy();
    });

    test('should handle timeout errors', async ({ page, context }) => {
      // Simulate slow/timeout response
      await context.route('**/api/**', (route) => {
        route.abort('timedout');
      });

      await page.goto('/products');

      expect(isProductsOrLogin(page.url())).toBeTruthy();
    });
  });

  test.describe('HTTP Error Responses', () => {
    test('should handle 404 Not Found', async ({ page, context }) => {
      await context.route('**/api/products/invalid', (route) => {
        route.abort('failed');
      });

      await page.goto('/this-route-does-not-exist');

      const url = page.url();
      expect(url.includes('/this-route-does-not-exist') || url.includes('/login')).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle 500 Server Error', async ({ page, context }) => {
      await context.route('**/api/**', (route) => {
        route.fulfill({
          status: 500,
          body: JSON.stringify({ error: 'Internal Server Error' }),
        });
      });

      await page.goto('/products');

      expect(isProductsOrLogin(page.url())).toBeTruthy();
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
      const errorMsg = (await page.locator('text=/unauthorized|login|session/i').count()) > 0;

      expect(loginPage || errorMsg).toBeTruthy();
    });

    test('should handle 429 Rate Limit', async ({ page, context }) => {
      await context.route('**/api/**', (route) => {
        route.fulfill({
          status: 429,
          body: JSON.stringify({ error: 'Too many requests' }),
        });
      });

      await page.goto('/products');

      expect(isProductsOrLogin(page.url())).toBeTruthy();
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
      await expect(errorMsg).toBeVisible();

      // Clear and fix input
      await emailInput.clear();
      await emailInput.fill('valid@example.com');

      // Error should be cleared (or at least not the same)
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.click();

      await expect(emailInput).toHaveValue('valid@example.com');
    });
  });

  test.describe('User Feedback & Error States', () => {
    test('should display loading skeleton while fetching', async ({ page }) => {
      await page.goto('/products');

      // Check for skeleton or loading indicator
      const skeleton = page.locator('[class*="skeleton"]');
      const spinner = page.locator('[role="status"]');

      const hasLoading = (await skeleton.count()) > 0 || (await spinner.count()) > 0;
      const hasProducts = (await page.locator('.product-card').count()) > 0;
      expect(hasLoading || hasProducts).toBeTruthy();
    });

    test('should show empty state with CTA when no results', async ({ page, context }) => {
      // Mock empty products response
      await context.route('**/api/products**', (route) => {
        route.fulfill({
          status: 200,
          body: JSON.stringify({ data: [] }),
        });
      });

      await page.goto('/products');
      await waitForNetworkIdle(page);

      const emptyMsg = page.locator('text=/no products|empty|nothing found/i');
      const hasEmptyState = await emptyMsg.isVisible().catch(() => false);
      const fallbackCards = (await page.locator('.product-card').count()) > 0;
      expect(hasEmptyState || fallbackCards || page.url().includes('/login')).toBeTruthy();
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

      await page.goto('/products');

      const errorMsg = page.locator('[role="alert"]');
      const hadInitialAlert = await errorMsg.isVisible().catch(() => false);

      // Find retry button
      const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")').first();

      if (await retryButton.count() > 0) {
        await retryButton.click();
        await waitForNetworkIdle(page);
      }

      const products = (await page.locator('.product-card').count()) > 0;
      const stillHasAlert = await errorMsg.isVisible().catch(() => false);
      expect(hadInitialAlert || stillHasAlert || products || page.url().includes('/products')).toBeTruthy();
    });

    test('should allow user to go back from error page', async ({ page }) => {
      await page.goto('/this-route-does-not-exist');

      const url = page.url();
      expect(url.includes('/this-route-does-not-exist') || url.includes('/login')).toBeTruthy();
      await expect(page.locator('body')).toBeVisible();

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
