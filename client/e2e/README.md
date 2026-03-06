# E2E Testing Guide

## Overview

This directory contains end-to-end (E2E) tests using Playwright. The tests cover critical user flows including:

- **Authentication**: Login, signup, password reset, session management
- **Shopping**: Product browsing, cart management, checkout flow
- **Error Handling**: Network errors, form validation, server errors, error recovery
- **Mobile Responsiveness**: Touch interactions, mobile layouts, different viewports

## Setup

### Prerequisites

- Node.js 18+ and npm
- Backend API running on `http://localhost:5000` (configurable)
- Frontend app running on `http://localhost:5173` (configurable)

### Installation

1. **Install Playwright browsers** (one-time setup):

```bash
npm run e2e:install
```

2. **Configure environment variables**:

```bash
cp .env.e2e.example .env.e2e
```

Edit `.env.e2e` with your test configuration:
- `API_URL`: Backend API URL
- `BASE_URL`: Frontend URL
- `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`: Test account credentials

### Starting Services

Before running tests, ensure the backend and frontend are running:

```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend (tests can start dev server automatically)
cd client
npm run dev  # Optional - dev server starts automatically via playwright config
```

## Running Tests

### Run all E2E tests

```bash
npm run e2e
```

### Run tests in UI mode (interactive)

```bash
npm run e2e:ui
```

This opens the Playwright Test UI where you can:
- Run individual tests
- Step through interactions
- Inspect elements
- Watch videos and screenshots

### Run tests in headed mode (see browser)

```bash
npm run e2e:headed
```

### Debug a specific test

```bash
npm run e2e:debug -- e2e/auth.spec.js
```

### View test report

After test run:

```bash
npm run e2e:report
```

Opens an HTML report with results, screenshots, and videos.

### Run specific test file

```bash
npx playwright test e2e/auth.spec.js
```

### Run tests matching a pattern

```bash
npx playwright test -g "should login successfully"
```

### Run on specific browsers

```bash
npx playwright test --project=chromium
npx playwright test --project="Mobile Chrome"
```

## Test Structure

### Files

- **`playwright.config.js`**: Playwright configuration
  - Base URL, timeouts, reporters
  - Browser/device targeting
  - Web server startup
  
- **`fixtures.js`**: Custom Playwright fixtures
  - `authenticatedPage`: Pre-logged-in session
  - `apiContext`: HTTP request context
  - `testData`: Mock data and test utilities
  - `TEST_USERS`: Test account definitions
  - `MOCK_PRODUCTS`: Mock product data

- **`helpers.js`**: Reusable test utilities
  - `waitForNetworkIdle()`: Wait for network requests
  - `expectErrorMessage()`: Check error display
  - `fillFormData()`: Fill form fields
  - `clearAppData()`: Clear localStorage/cookies
  - `retryAction()`: Retry with backoff
  - `checkAccessibility()`: A11y checks

- **Test files**:
  - `auth.spec.js`: Login, signup, password reset, session management
  - `checkout.spec.js`: Shopping cart, checkout flow
  - `errors.spec.js`: Network errors, form validation, error recovery
  - `mobile.spec.js`: Mobile viewport, touch interactions, responsive layout

## Test Data

### Test Users

Tests use mock test users defined in `fixtures.js`:

```javascript
TEST_USERS.customer    // Regular user account
TEST_USERS.admin       // Admin user account  
TEST_USERS.vendor      // Vendor user account
```

**Important**: Backend must have these test accounts seeded, or update credentials in `fixtures.js`.

### Mock Products

Mock product data for testing:

```javascript
MOCK_PRODUCTS  // Array of test products
MOCK_CATEGORIES // Array of test categories
```

## Environment Variables

Create `.env.e2e` (copy from `.env.e2e.example`):

```bash
# API Configuration
API_URL=http://localhost:3000
BASE_URL=http://localhost:5173

# Test Accounts
TEST_USER_EMAIL=test.customer@example.com
TEST_USER_PASSWORD=TestPass123!

# CI/Debug
CI=false
DEBUG=false
TIMEOUT=30000
```

## Configuration

### Playwright Config Key Settings

```javascript
// playwright.config.js

// Timeout per test step (default 30s)
use: {
  actionTimeout: 10000,
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}

// Retry failed tests (helpful in CI)
retries: process.env.CI ? 2 : 0,

// Run tests sequentially (avoid race conditions)
fullyParallel: false,

// Available projects
projects: [
  'chromium',
  'firefox',
  'webkit',
  'Mobile Chrome',
  'Mobile Safari'
]
```

## Common Patterns

### Check for visibility

```javascript
import { expectVisible } from './helpers.js';

await expectVisible(page, '.error-message', 'Error message should appear');
```

### Fill and submit form

```javascript
import { fillFormData, waitForNetworkIdle } from './helpers.js';

await fillFormData(page, {
  email: 'user@example.com',
  password: 'password123'
});

const submitBtn = page.locator('button:has-text("Login")');
await submitBtn.click();
await waitForNetworkIdle(page);
```

### Handle errors with retry

```javascript
import { expectErrorMessage } from './helpers.js';

// Simulated error
try {
  await expectErrorMessage(page, 'Invalid credentials');
} catch {
  // Handle error display
}

// Find retry button
const retryBtn = page.locator('button:has-text("Retry")');
await retryBtn.click();
```

### Test on mobile

```javascript
test('mobile specific test', async ({ page }) => {
  // Test runs on mobile viewport (375x667) by default
  await page.goto('/');
  
  // Mobile-specific interactions
  const menuBtn = page.locator('[aria-label="mobile menu"]');
  await menuBtn.click();
});
```

## Debugging

### Enable debug output

```bash
DEBUG=pw:api npm run e2e
```

### Use Playwright Inspector

```bash
npm run e2e:debug -- e2e/auth.spec.js
```

Step through test execution, inspect elements, modify selectors in real-time.

### View test artifacts

After each test run:

- **Screenshots**: `test-results/` directory
- **Videos**: `test-results/` directory  
- **HTML Report**: Run `npm run e2e:report`

### Take manual screenshots

```javascript
await page.screenshot({ path: 'debug.png' });
```

## Common Issues

### Tests timeout

**Problem**: Tests hang or timeout
- **Solution**: Increase timeout in `playwright.config.js`
- Ensure backend API is running and responsive

### Tests fail in CI but pass locally

**Problem**: Network/timing issues in CI
- **Solution**: 
  - Increase fixtures with `waitForNetworkIdle()`
  - Use `retryAction()` for flaky tests
  - Enable video recording: `video: 'on'`

### Can't find element

**Problem**: Selector not matching element
- **Solutions**:
  - Use Playwright Inspector: `npm run e2e:debug`
  - Check CSS classes/IDs match between code and tests
  - Use `page.waitForSelector()` for dynamic content
  - Check element visibility with `isVisible()`

### Auth token not persisting

**Problem**: Auth state lost between tests
- **Solutions**:
  - Save auth state and reuse in fixtures
  - Use `authenticatedPage` fixture
  - Check localStorage key names match backend

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run E2E Tests
  run: npm run e2e

- name: Upload test results
  if: failure()
  uses: actions/upload-artifact@v2
  with:
    name: playwright-report
    path: playwright-report/
```

### Pre-commit Hook

```bash
#!/bin/sh
npm run e2e -- --project=chromium || exit 1
```

## Best Practices

1. **Keep tests independent**: Each test should be able to run standalone
2. **Use fixtures over setup**: Use Playwright fixtures instead of `beforeAll()`
3. **Wait for network**: Use `waitForNetworkIdle()` after navigation
4. **Specific selectors**: Use role attributes when possible
5. **Meaningful assertions**: Check user-visible outcomes, not implementation details
6. **Test real flows**: Cover happy path, error scenarios, and edge cases
7. **Mobile testing**: Run tests on real mobile devices/viewports
8. **Manage test data**: Clear state between tests with `clearAppData()`

## Performance Considerations

- Tests run sequentially by default to avoid race conditions
- Parallel mode can be enabled with `fullyParallel: true` (requires proper isolation)
- Video recording adds overhead; disable unless needed: `video: 'off'`
- Screenshots on failures help with debugging

## Contributing

When adding new E2E tests:

1. Follow existing naming convention: `*.spec.js`
2. Use helper functions from `helpers.js`
3. Include descriptive test names
4. Test both happy path and error scenarios
5. Ensure tests work on mobile viewports
6. Update this README with new test coverage

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI Integration](https://playwright.dev/docs/ci)
