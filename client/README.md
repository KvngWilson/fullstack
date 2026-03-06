# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Frontend E2E Quick Commands

Run the focused critical regression suite (Chromium):

```bash
npm run e2e:critical
```

This runs:

- `e2e/account.spec.js`
- `e2e/rbac.spec.js`
- `e2e/checkout.spec.js`
- `e2e/errors.spec.js`
- `e2e/mobile.spec.js`
- `e2e/payment-callback.spec.js`

The payment callback suite validates `/order-confirmation` flows for:

- successful callback + verification,
- failed verification fallback to pending,
- cancelled payment return.

## Coverage Gates

Generate unit-test coverage:

```bash
npm run test:coverage
```

Run the standard coverage gate:

```bash
npm run ci:coverage
```

Run the policy gate (80% global + 100% critical module coverage):

```bash
npm run ci:coverage:policy
```

Current critical module enforced at 100% statements:

- `src/api/requestCache.js`

## RBAC Route Matrix (Frontend)

Current route-level RBAC expectations implemented in routing:

- `super_admin`: full admin and vendor operational access.
- `admin`: full admin and vendor operational access.
- `manager`: admin dashboard/orders/shipping and vendor dashboard/products/orders/inventory/analytics.
- `support`: admin support/orders and vendor orders.
- `warehouse`: admin shipping and vendor inventory.

Verification is covered by:

- `e2e/rbac.spec.js` (allow/deny matrix assertions)
- `npm run e2e:critical` (critical regression gate)

## Stability Notes

- `src/api/requestCache.js` deduplication now resolves/rejects queued duplicate GET requests correctly.
- This prevents async hangs where UI could remain stuck in loading states (for example, payment verification at order confirmation).
