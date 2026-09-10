# API Endpoints

This is the current endpoint surface exposed by the backend.

## Public / browser-facing

### Auth
- `GET /api/v1/auth/csrf-token`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh-token`
- `GET /api/v1/auth/verify-email`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/change-password`
- `GET /api/v1/auth/sessions`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/logout-all`

### Catalog
- `GET /api/v1/catalog/products`
- `GET /api/v1/catalog/products/:productId`
- `GET /api/v1/catalog/categories`
- `GET /api/v1/catalog/products/featured`

### Ordering
- `GET /api/v1/ordering/cart`
- `POST /api/v1/ordering/cart`
- `PATCH /api/v1/ordering/cart/items/:itemId`
- `DELETE /api/v1/ordering/cart/items/:itemId`
- `GET /api/v1/ordering/orders/my-orders`
- `GET /api/v1/ordering/orders/:orderId`
- `DELETE /api/v1/ordering/orders/:orderId`
- `POST /api/v1/checkout/guest/init`
- `GET /api/v1/checkout/guest/session`
- `POST /api/v1/checkout/guest/session`
- `POST /api/v1/checkout/guest/finalize`
- `POST /api/v1/checkout/guest/convert`
- `GET /api/v1/guest/cart`
- `POST /api/v1/guest/cart/add`
- `PATCH /api/v1/guest/cart/:productVariantId`
- `DELETE /api/v1/guest/cart/:productVariantId`
- `POST /api/v1/guest/cart/validate`

### Payments
- `GET /api/v1/payments`
- `POST /api/v1/payments`
- `GET /api/v1/payments/:paymentId`
- `GET /api/v1/payments/verify/:reference`
- `POST /api/v1/payments/refunds`
- `GET /api/v1/payments/refunds/:refundId`

### Wishlist
- `GET /api/v1/wishlist`
- `POST /api/v1/wishlist`
- `GET /api/v1/wishlist/check/:product_id`
- `DELETE /api/v1/wishlist/:product_id`
- `DELETE /api/v1/wishlist`

### Vendor
- `POST /api/v1/vendors/applications`
- `GET /api/v1/vendors/onboarding`
- `POST /api/v1/vendors/verification`
- `GET /api/v1/vendors/earnings`
- `POST /api/v1/vendors/payouts`
- `GET /api/v1/vendors/payouts/history`

## Admin

### Admin auth and SSR
- `POST /api/v1/admin/auth/login`
- `POST /api/v1/admin/auth/logout`
- `GET /api/v1/admin/ssr/dashboard`
- `GET /api/v1/admin/ssr/hydration`
- `GET /api/v1/admin/ssr/ui-config`
- `POST /api/v1/admin/ssr/validate-resource`

### Admin operations
- `GET /api/v1/admin/jobs/status`
- `GET /api/v1/admin/jobs/:jobName/status`
- `POST /api/v1/admin/jobs/:jobName/trigger`
- `POST /api/v1/admin/jobs/exchange-rates/refresh`
- `GET /api/v1/admin/exchange-rates/current/:from/:to`
- `GET /api/v1/admin/permissions`
- `GET /api/v1/admin/roles`
- `POST /api/v1/admin/roles`
- `GET /api/v1/admin/audit-logs`
- `GET /api/v1/admin/employees`
- `POST /api/v1/admin/uploads`
- `GET /api/v1/admin/translations/languages`
- `GET /api/v1/admin/products/vendors`

## Health / ops

- `GET /health`
- `GET /health/detailed`
- `GET /health/ready`
- `GET /health/live`
- `GET /metrics`
- `GET /api-docs`

## WebSocket

- Socket.IO path: `/socket.io/`
- Events:
  - `subscribe:order`
  - `unsubscribe:order`
  - `subscribe:admin-dashboard`
  - `order:status-updated`
  - `admin:order-status-changed`

## Notes

- Browser auth uses httpOnly cookies.
- State-changing routes remain CSRF-protected.
- Exact route guards vary by controller and role.
