# Database Schema

Current database structure is centered on PostgreSQL with Redis-backed session/cache support.

## Major table groups

### Identity
- `users`
- `roles`
- `permissions`
- `role_permissions`
- `employee_invitations`
- `employees`
- `vendor_staff`
- `revoked_tokens`
- `login_attempts`
- `security_audit_log`
- `password_history`

### Catalog
- `categories`
- `products`
- `product_variants`
- `variants` (legacy compatibility)
- `inventory`
- `reviews`
- `wishlists`

### Ordering and checkout
- `carts`
- `cart_items`
- `addresses`
- `orders`
- `order_items`
- `order_addresses`
- `payments`
- `saved_cards`
- `shipments`

### Multi-tenancy
- `tenants`
- `tenant_users`
- `tenant_invitations`

### Vendor / admin / platform
- `vendors`
- `vendor_commission_settings`
- `vendor_payouts`
- `analytics_metrics`
- `analytics_snapshots`
- `review_moderation_audit`
- `websocket_sessions`

### Reliability / safety
- `idempotency_keys`

## Important relationships

- `users` own carts, addresses, orders, reviews, payments, saved cards, and websocket sessions.
- `orders` link to `order_items`, `order_addresses`, payments, and shipment data.
- `products` belong to vendors and tenants; `product_variants` and `inventory` hang off products.
- `roles` and `permissions` are connected through `role_permissions`.
- `websocket_sessions` records active user socket connections for observability.

## Runtime notes

- The app uses Redis for sessions, CSRF token storage, token blacklisting, cache entries, and websocket adapter state.
- The current websocket layer does not add new database entities beyond `websocket_sessions`.
- Database changes should follow the existing migration numbering under [server/infrastructure/database/migrations/](/home/wilson/Desktop/fullstack/server/infrastructure/database/migrations).
