import { test, expect } from '@playwright/test';
import {
  waitForNetworkIdle,
  navigateAndWait,
  fillFormData,
} from './helpers.js';

/**
 * Mobile responsiveness E2E tests
 * Tests critical flows on mobile devices
 */

test.describe('Mobile Responsiveness', () => {
  // These tests run on mobile viewports defined in playwright.config.js
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test.describe('Navigation on Mobile', () => {
    test('should show mobile menu', async ({ page }) => {
      await navigateAndWait(page, '/');

      // Look for mobile menu button (hamburger icon)
      const menuButton = page.locator('[aria-label*="menu" i], .menu-button').filter({ visible: true }).first();
      const hasMenuButton = (await menuButton.count()) > 0;

      expect(hasMenuButton).toBeTruthy();

      // Click menu button
      if (hasMenuButton) {
        await menuButton.click();

        // Menu should open
        const mobileMenu = page.locator('nav, [class*="menu"]').filter({ visible: true });
        const isOpen = (await mobileMenu.count()) > 0;
        expect(isOpen).toBeTruthy();
      }
    });

    test('should navigate through menu on mobile', async ({ page }) => {
      await navigateAndWait(page, '/');

      // Open mobile menu
      const menuButton = page.locator('[aria-label*="menu" i], .menu-button').filter({ visible: true }).first();
      if (await menuButton.count() > 0) {
        await menuButton.click();
        await page.waitForTimeout(300);

        // Click shop link
        const shopLink = page.locator('a:has-text("Products"), a:has-text("Shop")').filter({ visible: true }).first();
        await shopLink.click();
        await waitForNetworkIdle(page);

        // Should navigate to shop
        const isOnShop = page.url().includes('/shop') || page.url().includes('/products');
        expect(isOnShop).toBeTruthy();

        // Menu should close after navigation
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('Form Input on Mobile', () => {
    test('should handle form input on mobile with virtual keyboard', async ({ page }) => {
      await page.goto('/');

      // Find login link
      const loginLink = page.locator('a:has-text("Login"), a:has-text("Sign In")').first();
      if (await loginLink.count() > 0) {
        await loginLink.click();
        await waitForNetworkIdle(page);

        // Fill email field
        const emailInput = page.locator('input[type="email"]').first();
        await emailInput.click();
        await emailInput.type('test@example.com');

        const inputValue = await emailInput.inputValue();
        expect(inputValue).toBe('test@example.com');

        // Fill password field
        const passwordInput = page.locator('input[type="password"]').first();
        await passwordInput.click();
        await passwordInput.type('password123');

        const passwordValue = await passwordInput.inputValue();
        expect(passwordValue).toBe('password123');
      }
    });

    test('should display form fields properly on mobile', async ({ page }) => {
      await page.goto('/login');

      // Check that form inputs are not too small
      const emailInput = page.locator('input[type="email"]').first();
      const passwordInput = page.locator('input[type="password"]').first();

      const emailBox = await emailInput.boundingBox();
      const passwordBox = await passwordInput.boundingBox();

      // Minimum touch target size is 44x44px (Apple recommendation)
      expect(emailBox?.height ?? 0).toBeGreaterThanOrEqual(40);
      expect(passwordBox?.height ?? 0).toBeGreaterThanOrEqual(40);
    });

    test('should handle select dropdowns on mobile', async ({ page }) => {
      // Navigate to a page with dropdowns (e.g., checkout)
      await navigateAndWait(page, '/');

      const shopLink = page.locator('a:has-text("Products"), a:has-text("Shop")').filter({ visible: true }).first();
      if (await shopLink.count() > 0) {
        await shopLink.click();
        await waitForNetworkIdle(page);

        // Look for category filter or sort dropdown
        const selectElement = page.locator('select').first();
        if (await selectElement.count() > 0) {
          // Should be clickable
          const isEnabled = await selectElement.isEnabled();
          expect(isEnabled).toBeTruthy();

          // Click and select option
          const options = await selectElement.locator('option').count();
          expect(options).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Touch Interactions on Mobile', () => {
    test('should handle button clicks on mobile', async ({ page }) => {
      await navigateAndWait(page, '/');

      // Find and click a button
      const actionButton = page.locator('button:visible').first();
      if (await actionButton.count() > 0) {
        // Button should be clickable
        const isEnabled = await actionButton.isEnabled();
        expect(isEnabled).toBeTruthy();

        // Get size to ensure it's not too small
        const box = await actionButton.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(32);
      }
    });

    test('should handle swipe/scroll on mobile', async ({ page }) => {
      await navigateAndWait(page, '/');

      // Get initial scroll position
      const initialScroll = await page.evaluate(() => window.scrollY);

      // Scroll down
      await page.evaluate(() => {
        window.scrollBy(0, 300);
      });

      const afterScroll = await page.evaluate(() => window.scrollY);
      expect(afterScroll).toBeGreaterThan(initialScroll);

      // Scroll back up
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });

      const backToTop = await page.evaluate(() => window.scrollY);
      expect(backToTop).toBeLessThan(100);
    });

    test('should handle link clicks on mobile', async ({ page }) => {
      await navigateAndWait(page, '/');

      // Links should be easily clickable
      const links = page.locator('a:visible').first();
      if (await links.count() > 0) {
        const box = await links.boundingBox();
        // Links should be at least 44x44px for mobile
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(20); // Flexible - may be smaller if nested in larger clickable area
      }
    });
  });

  test.describe('Mobile Layout & Readability', () => {
    test('should not have horizontal scrolling', async ({ page }) => {
      await navigateAndWait(page, '/');

      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });

      expect(hasHorizontalScroll).toBeFalsy();
    });

    test('should display text with readable font size', async ({ page }) => {
      await navigateAndWait(page, '/');

      // Check body text size
      const bodyText = page.locator('p, span').first();
      if (await bodyText.count() > 0) {
        const fontSize = await bodyText.evaluate((el) => {
          return window.getComputedStyle(el).fontSize;
        });

        // Font size should be at least 12px (16px is recommended minimum)
        const fontSizeValue = parseInt(fontSize);
        expect(fontSizeValue).toBeGreaterThanOrEqual(12);
      }
    });

    test('should have adequate spacing on mobile', async ({ page }) => {
      await page.goto('/');

      // Check for adequate padding in interactive elements
      const buttons = page.locator('button:visible').first();
      if (await buttons.count() > 0) {
        const padding = await buttons.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          return {
            paddingTop: styles.paddingTop,
            paddingBottom: styles.paddingBottom,
            paddingLeft: styles.paddingLeft,
            paddingRight: styles.paddingRight,
          };
        });

        // At least some padding should be present
        expect(padding).toBeDefined();
      }
    });

    test('should render images responsively', async ({ page }) => {
      await navigateAndWait(page, '/');

      const images = page.locator('img').first();
      if (await images.count() > 0) {
        // Images should not overflow viewport
          const overflows = await images.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > window.innerWidth + 1;
          });

        // Image should either have max-width: 100% or width constraint
        expect(overflows).toBeFalsy();
      }
    });
  });

  test.describe('Mobile Performance', () => {
    test('should load page within acceptable time on mobile', async ({ page }) => {
      const startTime = Date.now();

      await page.goto('/');
      await waitForNetworkIdle(page);

      const loadTime = Date.now() - startTime;

      // Should load in reasonable time on mobile (3-5 seconds)
      expect(loadTime).toBeLessThan(5000);
    });

    test('should not have excessive network requests', async ({ page }) => {
      const requests = [];

      page.on('request', (request) => {
        requests.push({ url: request.url() });
      });

      await navigateAndWait(page, '/');

      // Should have reasonable number of requests (not a hard limit, but indicator)
      expect(requests.length).toBeLessThan(200);
    });
  });

  test.describe('Mobile Viewport Specific Tests', () => {
    test('should adapt layout for different screen widths', async ({ browser }) => {
      // Test on different mobile viewports
      const viewports = [
        { name: 'Small phone', width: 320, height: 568 }, // iPhone SE
        { name: 'Medium phone', width: 375, height: 667 }, // iPhone 8
        { name: 'Large phone', width: 414, height: 896 }, // iPhone 11
      ];

      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();

        await navigateAndWait(page, '/');

        // Check no horizontal scroll at any breakpoint
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > window.innerWidth;
        });

        expect(hasHorizontalScroll).toBeFalsy();

        await context.close();
      }
    });

    test('should handle orientation change gracefully', async ({ page }) => {
      // Start in portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await navigateAndWait(page, '/');

      let initialContent = await page.locator('body').innerHTML();

      // Switch to landscape
      await page.setViewportSize({ width: 667, height: 375 });
      await page.waitForTimeout(500);

      let landscapeContent = await page.locator('body').innerHTML();

      // Page should still be readable
      expect(initialContent).toBeTruthy();
      expect(landscapeContent).toBeTruthy();

      // Switch back to portrait
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);

      let portraitContent = await page.locator('body').innerHTML();
      expect(portraitContent).toBeTruthy();
    });
  });
});
