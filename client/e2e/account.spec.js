import { test, expect } from './fixtures.js';
import { clearAppData, navigateAndWait, waitForNetworkIdle } from './helpers.js';

const mockUser = {
  id: 'e2e-account-user',
  email: 'test.customer@example.com',
  role: 'customer',
};

const mockOrder = {
  id: 123,
  status: 'paid',
  total: 149.99,
  total_amount: 149.99,
  created_at: '2026-03-05T08:00:00.000Z',
  updated_at: '2026-03-05T08:30:00.000Z',
};

const mockTracking = {
  order_id: 123,
  status: 'in_transit',
  tracking_number: 'TRK-123456',
  tracking_url: 'https://tracking.example.com/TRK-123456',
  carrier: 'FastShip',
  updated_at: '2026-03-05T09:00:00.000Z',
};

const mockPayments = [
  {
    id: 501,
    order_id: 123,
    status: 'succeeded',
    amount: 149.99,
    stripe_payment_id: 'PAY-123-REF',
    created_at: '2026-03-05T08:40:00.000Z',
  },
];

async function seedAuthenticatedUser(page) {
  await page.addInitScript((user) => {
    localStorage.setItem('mockAuthUser', JSON.stringify(user));
  }, mockUser);
}

async function mockAccountApis(page) {
  await page.route('**/api/v1/ordering/orders/my-orders**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [mockOrder],
        meta: {
          page: 1,
          pageSize: 10,
          totalPages: 1,
        },
      }),
    });
  });

  await page.route('**/api/v1/ordering/orders/123/tracking', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: mockTracking,
      }),
    });
  });

  await page.route('**/api/v1/ordering/orders/123', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: mockOrder,
      }),
    });
  });

  await page.route('**/api/v1/payments**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          payments: mockPayments,
        },
        meta: {
          page: 1,
          pageSize: 20,
          totalPages: 1,
        },
      }),
    });
  });
}

test.describe('Account Orders Tracking & Payment Status', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
  });

  test('should redirect unauthenticated user from tracking route to login', async ({ page }) => {
    await page.goto('/account/orders/123/tracking');
    await page.waitForURL('**/login', { timeout: 10000 });
  });

  test('should render order list with payment status for authenticated user', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await mockAccountApis(page);

    await navigateAndWait(page, '/account/orders');

    await expect(page.locator('text=Order #123')).toBeVisible();
    await expect(page.locator('text=/Payment:\\s*succeeded/i')).toBeVisible();
    await expect(page.locator('text=/Track shipment at \/account\/orders\/123\/tracking/i')).toBeVisible();
  });

  test('should render dedicated tracking page with shipment details', async ({ page }) => {
    await seedAuthenticatedUser(page);
    await mockAccountApis(page);

    await navigateAndWait(page, '/account/orders/123/tracking');
    await waitForNetworkIdle(page);

    await expect(page.locator('h1:has-text("Order Tracking")')).toBeVisible();
    await expect(page.locator('text=Order #123')).toBeVisible();
    await expect(page.locator('text=/Tracking status:\\s*in_transit/i')).toBeVisible();
    await expect(page.locator('text=/Carrier:\\s*FastShip/i')).toBeVisible();
    await expect(page.locator('text=/Tracking #:\\s*TRK-123456/i')).toBeVisible();

    const trackingLink = page.locator('a:has-text("Open carrier tracking")').first();
    await expect(trackingLink).toHaveAttribute('href', 'https://tracking.example.com/TRK-123456');
  });
});
