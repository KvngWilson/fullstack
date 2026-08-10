# API Service Layer

This folder is the frontend boundary for backend communication.

## Rules

- Pages/components do not import `src/api/endpoints/*` directly.
- Pages/components/features import from `src/services/api/*`.
- Services should normalize responses and expose stable app-facing contracts.

## Available Services

- **authService**: Handles authentication (login, register, password reset, email verification, token refresh, user info, logout).
- **paymentsService**: Manages payments (create, list, verify status, fetch by ID, get latest for order).
- **shippingService**: Calculates shipping rates and retrieves checkout shipping rates.
- **profileService**: Manages user profile (get/update profile, change password, delete account, address and card management).
- **productsService**: Handles product data (fetch products, categories, search, featured, by category).
- **ordersService**: Manages orders (create, list, fetch by ID, cancel, track).
- **cartService**: Handles cart operations (get cart, add/update/remove items, clear cart, get count).
- **wishlistService**: Manages wishlist (get, add/remove/check/clear products).
- **guestSessionService**: Manages guest session tokens.
- **guestCheckoutService**: Handles guest checkout session and finalization.
