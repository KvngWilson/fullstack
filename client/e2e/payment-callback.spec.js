import { test, expect } from './fixtures.js';
import { clearAppData, navigateAndWait } from './helpers.js';

test.describe('Payment Callback & Order Confirmation', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);

    await page.addInitScript(() => {
      localStorage.setItem('mockAuthUser', JSON.stringify({
        id: 'e2e-callback-user',
        email: 'callback.user@example.com',
        role: 'customer',
      }));
    });
  });

  test('should show cancelled message when payment is cancelled', async ({ page }) => {
    await navigateAndWait(page, '/order-confirmation?status=cancelled&processor=stripe&order_id=123');

    await expect(page.getByRole('heading', { name: /order confirmation/i })).toBeVisible();
    await expect(page.locator('text=/cancelled|return to checkout/i')).toBeVisible();

    const checkoutLink = page.getByRole('link', { name: /back to checkout/i });
    await expect(checkoutLink).toBeVisible();
    await expect(checkoutLink).toHaveAttribute('href', '/checkout');
  });

  test('should verify payment and show status on successful callback', async ({ page }) => {
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/verify/')) {
        const isPreflight = route.request().method() === 'OPTIONS';
        await route.fulfill({
          status: isPreflight ? 204 : 200,
          contentType: 'application/json',
          headers: {
            'access-control-allow-origin': 'http://localhost:4173',
            'access-control-allow-credentials': 'true',
            'access-control-allow-methods': 'GET,OPTIONS',
            'access-control-allow-headers': 'content-type,x-csrf-token,accept-language,x-currency',
          },
          body: JSON.stringify({
            success: true,
            data: { status: 'succeeded', reference: 'REF-123' },
          }),
        });
        return;
      }

      await route.continue();
    });

    await navigateAndWait(page, '/order-confirmation?status=success&processor=stripe&order_id=123&reference=REF-123');

    await expect(page.getByRole('heading', { name: /order confirmation/i })).toBeVisible();
    await expect(page.getByText(/order id:\s*123/i)).toBeVisible();
    await expect(page.getByText(/processor:\s*stripe/i)).toBeVisible();
    await expect(page.getByText(/payment status:\s*succeeded/i)).toBeVisible();

    const orderLink = page.getByRole('link', { name: /view order/i });
    await expect(orderLink).toBeVisible();
    await expect(orderLink).toHaveAttribute('href', '/account/orders/123');
  });

  test('should fallback to pending status when verification fails', async ({ page }) => {
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('/payments/verify/')) {
        const isPreflight = route.request().method() === 'OPTIONS';
        await route.fulfill({
          status: isPreflight ? 204 : 500,
          contentType: 'application/json',
          headers: {
            'access-control-allow-origin': 'http://localhost:4173',
            'access-control-allow-credentials': 'true',
            'access-control-allow-methods': 'GET,OPTIONS',
            'access-control-allow-headers': 'content-type,x-csrf-token,accept-language,x-currency',
          },
          body: JSON.stringify({
            success: false,
            error: 'verification failed',
          }),
        });
        return;
      }

      await route.continue();
    });

    await navigateAndWait(page, '/order-confirmation?status=success&processor=stripe&order_id=987&reference=REF-FAIL');

    await expect(page.getByRole('heading', { name: /order confirmation/i })).toBeVisible();
    await expect(page.getByText(/payment status:\s*pending/i)).toBeVisible();
  });
});
