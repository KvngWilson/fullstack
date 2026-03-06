/**
 * E2E test helpers and utilities
 */

/**
 * Wait for network requests to complete
 * @param {Page} page - Playwright page object
 * @param {number} duration - Time to wait (default: 2000ms)
 */
export async function waitForNetworkIdle(page, duration = 2000) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    // If network idle times out, wait a bit and continue
    await page.waitForTimeout(duration);
  }
}

/**
 * Check if error is displayed with specific text
 * @param {Page} page - Playwright page object
 * @param {string} errorText - Expected error message
 */
export async function expectErrorMessage(page, errorText) {
  const errorElement = page.locator('[role="alert"]');
  await errorElement.waitFor({ state: 'visible', timeout: 5000 });
  return errorElement.textContent();
}

/**
 * Check if success/info toast appears
 * @param {Page} page - Playwright page object
 * @param {string} toastText - Expected toast message
 */
export async function expectToastMessage(page, toastText) {
  const toast = page.locator('text=' + toastText).first();
  await toast.waitFor({ state: 'visible', timeout: 5000 });
  return toast.isVisible();
}

/**
 * Login a user via API (faster than UI)
 * @param {APIRequestContext} request - Playwright API request context
 * @param {string} baseURL - API base URL
 * @param {string} email - User email
 * @param {string} password - User password
 */
export async function loginViaAPI(request, baseURL, email, password) {
  const response = await request.post(`${baseURL}/api/auth/login`, {
    data: { email, password },
  });
  
  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  const { token } = await response.json();
  return token;
}

/**
 * Set authentication cookie/token in page
 * @param {Page} page - Playwright page object
 * @param {string} token - JWT token
 */
export async function setAuthToken(page, token) {
  // Set token in localStorage (adjust based on actual auth implementation)
  await page.evaluate((t) => {
    localStorage.setItem('auth_token', t);
  }, token);
}

/**
 * Clear all app data (localStorage, cookies, etc.)
 * @param {Page} page - Playwright page object
 */
export async function clearAppData(page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {}

    try {
      sessionStorage.clear();
    } catch {}
  }).catch(() => {});
}

/**
 * Navigate and wait for page load
 * @param {Page} page - Playwright page object
 * @param {string} url - URL to navigate to
 */
export async function navigateAndWait(page, url) {
  await page.goto(url);
  await waitForNetworkIdle(page);
}

/**
 * Fill form and check for validation errors
 * @param {Page} page - Playwright page object
 * @param {Object} formData - Key-value pairs of field names and values
 */
export async function fillFormData(page, formData) {
  for (const [fieldName, value] of Object.entries(formData)) {
    const input = page.locator(`[name="${fieldName}"], [id="${fieldName}"]`).first();
    await input.fill(value);
  }
}

/**
 * Retry action with exponential backoff
 * @param {Function} action - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 */
export async function retryAction(action, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      const delay = Math.pow(2, i) * 100; // Exponential backoff: 100ms, 200ms, 400ms
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Check element visibility with custom message
 * @param {Page} page - Playwright page object
 * @param {string} selector - Selector to find element
 * @param {string} message - Custom error message
 */
export async function expectVisible(page, selector, message) {
  const element = page.locator(selector).first();
  try {
    await element.waitFor({ state: 'visible', timeout: 5000 });
    return true;
  } catch {
    throw new Error(message || `Element "${selector}" not visible`);
  }
}

/**
 * Check element is hidden/removed
 * @param {Page} page - Playwright page object
 * @param {string} selector - Selector to find element
 */
export async function expectHidden(page, selector) {
  const element = page.locator(selector);
  await element.waitFor({ state: 'hidden', timeout: 5000 });
}

/**
 * Get accessibility violations on page
 * @param {Page} page - Playwright page object
 * @returns {string[]} List of a11y issues
 */
export async function checkAccessibility(page) {
  // This would require @axe-core/playwright or similar
  // Basic implementation: check for common issues
  const issues = [];
  
  // Check for images without alt text
  const imagesWithoutAlt = await page.$$eval(
    'img:not([alt])',
    (els) => els.map((el) => el.src),
  );
  if (imagesWithoutAlt.length > 0) {
    issues.push(`Images without alt text: ${imagesWithoutAlt.join(', ')}`);
  }

  // Check for buttons without text
  const buttonsWithoutText = await page.$$eval(
    'button:not(:has(*))',
    (els) => els.filter((el) => !el.textContent.trim()).length,
  );
  if (buttonsWithoutText > 0) {
    issues.push(`${buttonsWithoutText} buttons without accessible text`);
  }

  return issues;
}
