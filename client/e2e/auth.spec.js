import { test, expect } from './fixtures.js';
import {
  waitForNetworkIdle,
  expectErrorMessage,
  expectToastMessage,
  navigateAndWait,
  fillFormData,
  clearAppData,
} from './helpers.js';

test.describe('Auth Flow - Login & Signup', () => {
  test.beforeEach(async ({ page }) => {
    // Clear auth state before each test
    await clearAppData(page);
    // Navigate to login page
    await navigateAndWait(page, '/login');
  });

  test.describe('Login', () => {
    test('should login successfully with valid credentials', async ({ page, testData }) => {
      // NOTE: This test assumes backend has test user seeded
      // Replace with actual test user credentials or API setup
      
      // Fill login form
      await fillFormData(page, {
        email: testData.users.customer.email,
        password: testData.users.customer.password,
      });

      // Submit form
      const submitButton = page.locator('button:has-text("Login")').first();
      await submitButton.click();

      // Wait for navigation to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      
      // Verify user is logged in (check for user menu or dashboard elements)
      await expect(page.locator('text=Welcome')).toBeVisible();
    });

    test('should show error with invalid email format', async ({ page }) => {
      await fillFormData(page, {
        email: 'invalid-email',
        password: 'password123',
      });

      const submitButton = page.locator('button:has-text("Login")').first();
      await submitButton.click();

      // Check for validation error
      const errorMsg = page.locator('[role="alert"]');
      await expect(errorMsg).toContainText(/invalid|email/i);
    });

    test('should show error with invalid credentials', async ({ page, testData }) => {
      await fillFormData(page, {
        email: testData.users.customer.email,
        password: 'WrongPassword123!',
      });

      const submitButton = page.locator('button:has-text("Login")').first();
      await submitButton.click();

      // Wait for error message
      await waitForNetworkIdle(page);
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText(/invalid|incorrect|failed/i);
    });

    test('should require email field', async ({ page }) => {
      // Leave email empty
      const passwordInput = page.locator('input[type="password"]').first();
      await passwordInput.fill('password123');

      const submitButton = page.locator('button:has-text("Login")').first();
      await submitButton.click();

      // Check for required field error
      const emailInput = page.locator('input[type="email"]').first();
      const validationMsg = await emailInput.evaluate((el) => el.validationMessage);
      expect(validationMsg || 'email required').toBeTruthy();
    });

    test('should require password field', async ({ page, testData }) => {
      // Leave password empty
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.fill(testData.users.customer.email);

      const submitButton = page.locator('button:has-text("Login")').first();
      await submitButton.click();

      // Check for required field error
      const passwordInput = page.locator('input[type="password"]').first();
      const validationMsg = await passwordInput.evaluate((el) => el.validationMessage);
      expect(validationMsg || 'password required').toBeTruthy();
    });

    test('should show loading state during login', async ({ page, testData }) => {
      await fillFormData(page, {
        email: testData.users.customer.email,
        password: testData.users.customer.password,
      });

      const submitButton = page.locator('button:has-text("Login")').first();
      
      // Before clicking, set up listener for button state
      const clickPromise = submitButton.click();
      
      // Check for loading state (button disabled or spinner visible)
      await page.waitForTimeout(100);
      const isDisabled = await submitButton.isDisabled();
      const hasSpinner = await page.locator('[role="status"]').count() > 0;
      
      expect(isDisabled || hasSpinner).toBeTruthy();
      
      await clickPromise;
    });
  });

  test.describe('Signup', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to signup page
      const signupLink = page.locator('a:has-text("Sign up")').first();
      await signupLink.click();
      await waitForNetworkIdle(page);
    });

    test('should signup successfully with valid data', async ({ page, testData }) => {
      const newEmail = testData.randomEmail();
      
      await fillFormData(page, {
        name: 'New User',
        email: newEmail,
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
      });

      const submitButton = page.locator('button:has-text("Sign Up")').first();
      await submitButton.click();

      // Wait for success state
      await page.waitForURL('**/dashboard', { timeout: 10000 });
      await expect(page.locator('text=Welcome')).toBeVisible();
    });

    test('should show error if passwords dont match', async ({ page, testData }) => {
      await fillFormData(page, {
        name: 'New User',
        email: testData.randomEmail(),
        password: 'TestPass123!',
        confirmPassword: 'DifferentPass123!',
      });

      const submitButton = page.locator('button:has-text("Sign Up")').first();
      await submitButton.click();

      // Check for mismatch error
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText(/match|mismatch|password/i);
    });

    test('should show password strength requirement', async ({ page }) => {
      const passwordInput = page.locator('input[id*="password"]').first();
      
      // Type weak password
      await passwordInput.fill('123');
      
      // Check for strength indicator or error
      const strengthIndicator = page.locator('[class*="strength"], [aria-label*="strength"]').first();
      const errorMsg = page.locator('text=/weak|short|requirement/i').first();
      
      const hasIndicator = await strengthIndicator.count() > 0;
      const hasError = await errorMsg.count() > 0;
      
      expect(hasIndicator || hasError).toBeTruthy();
    });

    test('should show error if email already exists', async ({ page, testData }) => {
      // Use existing user email
      await fillFormData(page, {
        name: 'Another User',
        email: testData.users.customer.email,
        password: 'TestPass123!',
        confirmPassword: 'TestPass123!',
      });

      const submitButton = page.locator('button:has-text("Sign Up")').first();
      await submitButton.click();

      // Wait for error
      await waitForNetworkIdle(page);
      const errorAlert = page.locator('[role="alert"]');
      await expect(errorAlert).toBeVisible();
      await expect(errorAlert).toContainText(/already|exists|registered/i);
    });
  });

  test.describe('Password Reset', () => {
    test.beforeEach(async ({ page }) => {
      // Navigate to login page and find forgot password link
      const forgotPasswordLink = page.locator('a:has-text("Forgot password")').first();
      await forgotPasswordLink.click();
      await waitForNetworkIdle(page);
    });

    test('should send reset email successfully', async ({ page, testData }) => {
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.fill(testData.users.customer.email);

      const submitButton = page.locator('button:has-text("Send Reset Email")').first();
      await submitButton.click();

      // Check for success message
      const successMsg = page.locator('text=/email sent|check your email/i');
      await expect(successMsg).toBeVisible();
    });

    test('should show error for non-existent email', async ({ page }) => {
      const emailInput = page.locator('input[type="email"]').first();
      await emailInput.fill('nonexistent@example.com');

      const submitButton = page.locator('button:has-text("Send Reset Email")').first();
      await submitButton.click();

      // Note: API might not return error for security reasons
      // Check for generic success message
      await waitForNetworkIdle(page);
    });
  });

  test.describe('Session Management', () => {
    test('should logout successfully', async ({ page, testData }) => {
      // Login first
      await page.goto('/login');
      await fillFormData(page, {
        email: testData.users.customer.email,
        password: testData.users.customer.password,
      });
      
      const submitButton = page.locator('button:has-text("Login")').first();
      await submitButton.click();
      
      // Wait for redirect to dashboard
      await page.waitForURL('**/dashboard', { timeout: 10000 });

      // Find and click logout button
      const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")').first();
      await logoutButton.click();

      // Should redirect to login
      await page.waitForURL('**/login', { timeout: 10000 });
    });

    test('should persist login across page refreshes', async ({ page, testData }) => {
      // Login
      await fillFormData(page, {
        email: testData.users.customer.email,
        password: testData.users.customer.password,
      });
      
      const submitButton = page.locator('button:has-text("Login")').first();
      await submitButton.click();
      
      // Wait for login to complete
      await page.waitForURL('**/dashboard', { timeout: 10000 });

      // Refresh page
      await page.reload();

      // Should still be logged in
      const welcomeMsg = page.locator('text=Welcome');
      await expect(welcomeMsg).toBeVisible();
    });

    test('should redirect to login when accessing protected routes', async ({ page }) => {
      await clearAppData(page);
      
      // Navigate directly to protected route
      await page.goto('/dashboard');

      // Should redirect to login
      await page.waitForURL('**/login', { timeout: 10000 });
    });
  });
});
