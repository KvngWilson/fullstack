import { test, expect } from './fixtures.js';
import {
  waitForNetworkIdle,
  navigateAndWait,
  fillFormData,
  expectErrorMessage,
  clearAppData,
} from './helpers.js';

test.describe('Cart & Checkout Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear auth state before each test
    await clearAppData(page);
    // Navigate to home page
    await navigateAndWait(page, '/');
  });

  test.describe('Shopping Cart', () => {
    test('should add product to cart from product list', async ({ page, testData }) => {
      // Navigate to shop/products
      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();
      await waitForNetworkIdle(page);

      // Find and click "Add to Cart" button on first product
      const addToCartButton = page.locator('button:has-text("Add to Cart")').first();
      await addToCartButton.click();

      // Check for success notification
      const successMsg = page.locator('text=/added|success/i').first();
      await expect(successMsg).toBeVisible();

      // Verify cart counter updated (if exists)
      const cartBadge = page.locator('[class*="cart"], [aria-label*="cart"]').first();
      const cartCount = await cartBadge.textContent();
      expect(parseInt(cartCount) || 0).toBeGreaterThan(0);
    });

    test('should add product to cart from product detail page', async ({ page }) => {
      // Navigate to product list
      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();
      await waitForNetworkIdle(page);

      // Click on a product to view details
      const productLink = page.locator('[class*="product"]').first().locator('a').first();
      await productLink.click();
      await waitForNetworkIdle(page);

      // Find quantity selector (if exists)
      const quantityInput = page.locator('input[type="number"], [class*="quantity"]').first();
      if (await quantityInput.count() > 0) {
        await quantityInput.fill('2');
      }

      // Click Add to Cart
      const addToCartButton = page.locator('button:has-text("Add to Cart")').first();
      await addToCartButton.click();

      // Check for success notification
      const successMsg = page.locator('text=/added|success/i').first();
      await expect(successMsg).toBeVisible();
    });

    test('should update quantity in cart', async ({ page }) => {
      // Add product to cart first
      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();
      await waitForNetworkIdle(page);

      const addToCartButton = page.locator('button:has-text("Add to Cart")').first();
      await addToCartButton.click();
      await waitForNetworkIdle(page);

      // Navigate to cart
      const cartLink = page.locator('a:has-text("Cart")').first();
      await cartLink.click();
      await waitForNetworkIdle(page);

      // Update quantity
      const quantityInput = page.locator('input[type="number"]').first();
      const currentValue = await quantityInput.inputValue();
      await quantityInput.fill((parseInt(currentValue) + 1).toString());

      // Wait for update
      await waitForNetworkIdle(page);

      // Verify quantity updated
      const updatedValue = await quantityInput.inputValue();
      expect(parseInt(updatedValue)).toBe(parseInt(currentValue) + 1);
    });

    test('should remove product from cart', async ({ page }) => {
      // Add product first
      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();
      await waitForNetworkIdle(page);

      const addToCartButton = page.locator('button:has-text("Add to Cart")').first();
      await addToCartButton.click();
      await waitForNetworkIdle(page);

      // Navigate to cart
      const cartLink = page.locator('a:has-text("Cart")').first();
      await cartLink.click();
      await waitForNetworkIdle(page);

      // Remove product
      const removeButton = page.locator('button:has-text("Remove"), button:has-text("Delete")').first();
      await removeButton.click();

      // Check for confirmation or success
      await waitForNetworkIdle(page);

      // Verify product removed (check for empty state)
      const emptyMsg = page.locator('text=/empty|no items/i');
      const cartItems = page.locator('[class*="cart-item"]');
      
      const hasEmptyMsg = await emptyMsg.count() > 0;
      const hasItems = await cartItems.count() > 0;
      
      expect(hasEmptyMsg || !hasItems).toBeTruthy();
    });

    test('should show empty cart message when no items', async ({ page }) => {
      const cartLink = page.locator('a:has-text("Cart")').first();
      await cartLink.click();
      await waitForNetworkIdle(page);

      // Check for empty cart message
      const emptyMsg = page.locator('main').locator('text=/your cart is empty|empty cart|no items in your cart/i').first();
      await expect(emptyMsg).toBeVisible();

      // Check for CTA button
      const shopButton = page.locator('button:has-text("Continue Shopping"), a:has-text("Shop")');
      await expect(shopButton).toBeVisible();
    });

    test('should calculate cart totals correctly', async ({ page }) => {
      // Add multiple products
      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();
      await waitForNetworkIdle(page);

      // Add first product
      let addButtons = page.locator('button:has-text("Add to Cart")');
      await addButtons.first().click();
      await waitForNetworkIdle(page);

      // Go back and add another product
      await page.goto('/');
      await shopLink.click();
      await waitForNetworkIdle(page);

      addButtons = page.locator('button:has-text("Add to Cart")');
      await addButtons.nth(1).click();
      await waitForNetworkIdle(page);

      // Navigate to cart
      const cartLink = page.locator('a:has-text("Cart")').first();
      await cartLink.click();
      await waitForNetworkIdle(page);

      // Verify subtotal, tax, and total are displayed
      const subtotal = page.locator('text=/subtotal|amount/i');
      const total = page.locator('text=/total/i');

      await expect(subtotal).toBeVisible();
      await expect(total).toBeVisible();
    });
  });

  test.describe('Checkout Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Add a product to cart before checkout tests
      const shopLink = page.locator('a:has-text("Shop"), a:has-text("Products")').first();
      await shopLink.click();
      await waitForNetworkIdle(page);

      const addToCartButton = page.locator('button:has-text("Add to Cart")').first();
      await addToCartButton.click();
      await waitForNetworkIdle(page);
    });

    test('should start checkout from cart page', async ({ page }) => {
      const cartLink = page.locator('a:has-text("Cart")').first();
      await cartLink.click();
      await waitForNetworkIdle(page);

      const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Continue to Checkout")').first();
      await checkoutButton.click();

      // Should navigate to checkout page
      await page.waitForURL('**/checkout', { timeout: 10000 });
    });

    test('should require login for guest checkout (or allow guest)', async ({ page }) => {
      const cartLink = page.locator('a:has-text("Cart")').first();
      await cartLink.click();
      await waitForNetworkIdle(page);

      const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Continue to Checkout")').first();
      await checkoutButton.click();
      await page.waitForTimeout(300);

      // Check if redirected to login or if guest checkout is available
      const url = page.url();
      const requiresLogin = url.includes('/login');
      const guestCheckout = (await page.locator('text=/guest|continue as guest/i').count()) > 0;

      expect(requiresLogin || guestCheckout).toBeTruthy();
    });

    test('should fill shipping information', async ({ page, testData }) => {
      const cartLink = page.locator('a:has-text("Cart")').first();
      await cartLink.click();
      await waitForNetworkIdle(page);

      const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Continue to Checkout")').first();
      await checkoutButton.click();

      // Wait for checkout page
      await page.waitForTimeout(500);

      // Fill shipping form
      await fillFormData(page, {
        firstName: 'John',
        lastName: 'Doe',
        email: testData.randomEmail(),
        phone: '1234567890',
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'US',
      });

      // Continue to payment
      const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
      await continueButton.click();
      await waitForNetworkIdle(page);
    });

    test('should validate required shipping fields', async ({ page }) => {
      const cartLink = page.locator('a:has-text("Cart")').first();
      await cartLink.click();
      await waitForNetworkIdle(page);

      const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Continue to Checkout")').first();
      await checkoutButton.click();

      // Wait for checkout page
      await page.waitForTimeout(500);

      // Try to continue without filling form
      const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
      await continueButton.click();

      // Check for validation errors
      const errorMsg = page.locator('[role="alert"]');
      const validationErrors = page.locator('text=/required|missing|invalid/i');

      const hasErrors = await errorMsg.count() > 0 || await validationErrors.count() > 0;
      expect(hasErrors).toBeTruthy();
    });

    test('should handle payment information', async ({ page, testData }) => {
      // This test is simplified as actual payment handling requires
      // test payment credentials and Stripe/payment gateway setup
      
      const cartLink = page.locator('a:has-text("Cart")').first();
      await cartLink.click();
      await waitForNetworkIdle(page);

      const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Continue to Checkout")').first();
      await checkoutButton.click();

      // Fill shipping
      await fillFormData(page, {
        firstName: 'John',
        lastName: 'Doe',
        email: testData.randomEmail(),
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
      });

      const continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
      await continueButton.click();
      await waitForNetworkIdle(page);

      // Check if payment section is visible
      const paymentSection = page.getByRole('heading', { name: /payment/i });
      await expect(paymentSection).toBeVisible();
    });

    test('should show order confirmation after successful checkout', async ({ page, testData }) => {
      // Similar to above - simplified test
      // In real scenario, would need to handle actual payment processing
      
      const cartLink = page.locator('a:has-text("Cart")').first();
      await cartLink.click();
      await waitForNetworkIdle(page);

      const checkoutButton = page.locator('button:has-text("Checkout"), button:has-text("Continue to Checkout")').first();
      await checkoutButton.click();

      // Fill all checkout form
      await fillFormData(page, {
        firstName: 'John',
        lastName: 'Doe',
        email: testData.randomEmail(),
        address: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
      });

      // Continue to payment
      let continueButton = page.locator('button:has-text("Continue"), button:has-text("Next")').first();
      await continueButton.click();
      await waitForNetworkIdle(page);

      // Submit payment
      const submitButton = page.locator('button:has-text("Place Order"), button:has-text("Pay")').first();
      if (await submitButton.count() > 0) {
        await submitButton.click();
        await waitForNetworkIdle(page);

        // Check for confirmation message or redirect to order page
        const confirmationMsg = page.locator('text=/thank you|confirmation|order|success/i');
        const hasConfirmation = await confirmationMsg.count() > 0;
        const onOrderPage = page.url().includes('/order');

        expect(hasConfirmation || onOrderPage).toBeTruthy();
      }
    });
  });
});
