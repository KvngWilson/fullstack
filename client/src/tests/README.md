# Frontend Test Structure

This folder standardizes centralized test suites that complement co-located feature tests.

- `unit/`: pure unit tests for isolated utilities and small modules.
- `integration/`: cross-module integration tests (state + services + UI interactions).
- `flows/`: end-to-end-like user journey tests at app composition level.

## Recommended split with co-located tests

- Co-locate tests inside features for fast TDD loops when changing a single feature.
- Keep this `tests/` folder for scenarios that span multiple features.

## Naming

- Unit: `*.unit.test.{js,jsx}`
- Integration: `*.integration.test.{js,jsx}`
- Flows: `*.flow.test.{js,jsx}`
