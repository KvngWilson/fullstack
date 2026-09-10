const router = require("express").Router();
const { protect, permission, anyPermission } = require("../../../decorators");
const onboarding = require("../../../controllers/v1/identity/onboarding");
const PERMISSIONS = require("../../../../shared/constants/permissions");

/**
 * POST /api/v1/onboarding
 * Create a new onboarding plan for an employee
 */
router.post(
  "/",
  ...protect(),
  ...permission(PERMISSIONS.ONBOARDING.CREATE),
  onboarding.createOnboarding,
);

/**
 * GET /api/v1/onboarding
 * List onboardings with optional status/manager filter
 */
router.get(
  "/",
  ...protect(),
  ...permission(PERMISSIONS.ONBOARDING.READ),
  onboarding.listOnboardings,
);

/**
 * GET /api/v1/onboarding/:id
 * Get onboarding detail with task list
 */
router.get(
  "/:id",
  ...protect(),
  ...permission(PERMISSIONS.ONBOARDING.READ),
  onboarding.getOnboarding,
);

/**
 * GET /api/v1/onboarding/:id/status
 * Get completion percentage and task counts by category
 */
router.get(
  "/:id/status",
  ...protect(),
  ...permission(PERMISSIONS.ONBOARDING.READ),
  onboarding.getOnboardingStatus,
);

/**
 * PUT /api/v1/onboarding/:id
 * Update budget or notes
 */
router.put(
  "/:id",
  ...protect(),
  ...permission(PERMISSIONS.ONBOARDING.UPDATE),
  onboarding.updateOnboarding,
);

/**
 * PUT /api/v1/onboarding/:id/start
 * Transition not_started → in_progress
 */
router.put(
  "/:id/start",
  ...protect(),
  ...permission(PERMISSIONS.ONBOARDING.UPDATE),
  onboarding.startOnboarding,
);

/**
 * PUT /api/v1/onboarding/:id/complete
 * Transition in_progress → completed
 */
router.put(
  "/:id/complete",
  ...protect(),
  ...permission(PERMISSIONS.ONBOARDING.UPDATE),
  onboarding.completeOnboarding,
);

/**
 * POST /api/v1/onboarding/:id/tasks
 * Add a task to an onboarding
 */
router.post(
  "/:id/tasks",
  ...protect(),
  ...permission(PERMISSIONS.ONBOARDING.UPDATE),
  onboarding.addTask,
);

/**
 * PUT /api/v1/onboarding/:id/tasks/:taskId/complete
 * Mark a task as completed
 */
router.put(
  "/:id/tasks/:taskId/complete",
  ...protect(),
  ...permission(PERMISSIONS.ONBOARDING.UPDATE),
  onboarding.completeTask,
);

/**
 * POST /api/v1/onboarding/:id/budget-override
 * HR-authorised budget override
 */
router.post(
  "/:id/budget-override",
  ...protect(),
  ...permission(PERMISSIONS.ONBOARDING.BUDGET_OVERRIDE),
  onboarding.applyBudgetOverride,
);

module.exports = router;
