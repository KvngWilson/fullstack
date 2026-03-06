# API Service Layer

This folder is the frontend boundary for backend communication.

## Rules

- Pages/components do not import `src/api/endpoints/*` directly.
- Pages/components/features import from `src/services/api/*`.
- Services should normalize responses and expose stable app-facing contracts.

## Current migration state

- Active facades: `authService`, `paymentsService`, `shippingService`.
- Remaining endpoint modules should be wrapped incrementally.
