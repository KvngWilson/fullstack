import { test, expect } from './fixtures.js';
import { clearAppData } from './helpers.js';

async function seedAuthenticatedRole(page, role) {
  await page.addInitScript((mockUser) => {
    localStorage.setItem('mockAuthUser', JSON.stringify(mockUser));
  }, {
    id: `e2e-${role}-user`,
    email: `${role}@example.com`,
    role,
  });
}

async function expectRouteAccess(page, routePath, shouldAllow) {
  await page.goto(routePath);

  if (shouldAllow) {
    await page.waitForURL(`**${routePath}`, { timeout: 10000 });
    expect(page.url()).toContain(routePath);
    return;
  }

  await page.waitForURL('**/unauthorized', { timeout: 10000 });
  await expect(page.getByRole('heading', { name: /unauthorized/i })).toBeVisible();
}

test.describe('RBAC Route Matrix', () => {
  test.beforeEach(async ({ page }) => {
    await clearAppData(page);
  });

  test('should redirect unauthenticated users to login for protected admin route', async ({ page }) => {
    await page.goto('/admin/orders');
    await page.waitForURL('**/login', { timeout: 10000 });
  });

  test('manager should access admin orders/shipping but not admin users/settings', async ({ page }) => {
    await seedAuthenticatedRole(page, 'manager');

    await expectRouteAccess(page, '/admin/orders', true);
    await expectRouteAccess(page, '/admin/shipping', true);
    await expectRouteAccess(page, '/admin/users', false);
    await expectRouteAccess(page, '/admin/settings', false);
  });

  test('support should access support+orders but not shipping/users', async ({ page }) => {
    await seedAuthenticatedRole(page, 'support');

    await expectRouteAccess(page, '/admin/support', true);
    await expectRouteAccess(page, '/admin/orders', true);
    await expectRouteAccess(page, '/admin/shipping', false);
    await expectRouteAccess(page, '/admin/users', false);
  });

  test('warehouse should access shipping and vendor inventory but not admin support', async ({ page }) => {
    await seedAuthenticatedRole(page, 'warehouse');

    await expectRouteAccess(page, '/admin/shipping', true);
    await expectRouteAccess(page, '/vendor/inventory', true);
    await expectRouteAccess(page, '/admin/support', false);
  });

  test('super_admin should access all admin routes', async ({ page }) => {
    await seedAuthenticatedRole(page, 'super_admin');

    await expectRouteAccess(page, '/admin/users', true);
    await expectRouteAccess(page, '/admin/settings', true);
    await expectRouteAccess(page, '/admin/orders', true);
    await expectRouteAccess(page, '/admin/shipping', true);
  });
});
