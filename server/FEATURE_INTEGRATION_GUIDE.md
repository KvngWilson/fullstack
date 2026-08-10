/**
 * Integration Guide for New Features
 * 
 * Complete setup instructions for implementing:
 * 1. WebSocket Order Tracking
 * 2. Product Reviews with Moderation
 * 3. Advanced Analytics Dashboard
 * 4. Vendor/Seller Management
 */

/**
 * STEP 1: Database Setup
 * =====================
 */

// Run migrations
// $ npm run migrate

// Or manually run:
// $ psql -U postgres -d your_db < migrations/2026-08-06-new-features.js

/**
 * STEP 2: Install Dependencies
 * =============================
 */

// Already installed via package.json:
// - socket.io: Real-time order tracking
// - socket.io-redis: Distributed WebSocket support
// - redis: Caching and session store

// Install if not already done:
// $ npm install

/**
 * STEP 3: Bootstrap WebSocket in Main App
 * ========================================
 */

// File: src/app.js (or src/index.js)

const express = require("express");
const { createServer } = require("http");
const WebSocketManager = require("./infrastructure/websocket/WebSocketManager");
const { setupFeatureRoutes } = require("./api/routes/featureRoutes");
const ReviewController = require("./api/controllers/ReviewController");
const AnalyticsController = require("./api/controllers/AnalyticsController");
const VendorController = require("./api/controllers/VendorController");

const app = express();
const httpServer = createServer(app);

// *** KEY: Initialize WebSocket before middleware ***
const wsManager = new WebSocketManager(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  },
  redisAdapter: {
    host: process.env.REDIS_HOST || "localhost",
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
  },
});

// Initialize controllers
const reviewController = new ReviewController(reviewService, reviewRepository);
const analyticsController = new AnalyticsController(salesAnalyticsService);
const vendorController = new VendorController(vendorOnboardingService, commissionService);

// Setup feature routes
setupFeatureRoutes(app, {
  ReviewController: reviewController,
  AnalyticsController: analyticsController,
  VendorController: vendorController,
});

// Start server
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

/**
 * STEP 4: Register Event Subscribers
 * ==================================
 */

// File: domain/subscribers/index.js

const OrderStatusChangedSubscriber = require("./OrderStatusChangedSubscriber");
const ReviewApprovedSubscriber = require("./ReviewApprovedSubscriber");

function registerSubscribers(eventBus, services) {
  // Register order tracking subscriber
  const orderStatusSubscriber = new OrderStatusChangedSubscriber(
    services.wsManager,
    services.emailQueue,
    services.auditLog
  );
  eventBus.subscribe("ordering.order.status_changed", orderStatusSubscriber.handle);

  // Register review moderation subscriber
  const reviewApprovedSubscriber = new ReviewApprovedSubscriber(
    services.reviewService,
    services.notificationService
  );
  eventBus.subscribe("reviews.review.approved", reviewApprovedSubscriber.handle);

  console.log("Event subscribers registered");
}

module.exports = { registerSubscribers };

/**
 * STEP 5: Environment Variables
 * ==============================
 */

// Add to .env:

// WebSocket Configuration
FRONTEND_URL=http://localhost:3000
WEBSOCKET_CORS_ORIGIN=http://localhost:3000,http://localhost:5000
WEBSOCKET_PATH=/socket.io

// Redis Configuration (for WebSocket adapter)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

// Analytics Configuration
ANALYTICS_CACHE_TTL=3600
ANALYTICS_SAMPLE_RATE=1

// Vendor Configuration
VENDOR_ONBOARDING_ENABLED=true
VENDOR_COMMISSION_DEFAULT=15
VENDOR_PAYOUT_MIN_AMOUNT=100
VENDOR_PAYOUT_DELAY_DAYS=7

// Review Configuration
REVIEW_MODERATION_REQUIRED=true
REVIEW_AUTO_APPROVE_AFTER_DAYS=7
REVIEW_MAX_LENGTH=2000

/**
 * STEP 6: Dependency Injection Setup
 * ===================================
 */

// File: infrastructure/di/container.js

const { createContainer, asClass, asValue } = require("awilix");
const ReviewRepository = require("../../domain/reviews/repositories/ReviewRepository");
const ReviewService = require("../../domain/reviews/services/ReviewService");
const SalesAnalyticsService = require("../../domain/analytics/services/SalesAnalyticsService");
const VendorOnboardingService = require("../../domain/vendor/services/VendorOnboardingService");
const CommissionService = require("../../domain/vendor/services/CommissionService");

const container = createContainer();

// Register repositories
container.register({
  reviewRepository: asClass(ReviewRepository).singleton(),
});

// Register services
container.register({
  reviewService: asClass(ReviewService).singleton(),
  salesAnalyticsService: asClass(SalesAnalyticsService).singleton(),
  vendorOnboardingService: asClass(VendorOnboardingService).singleton(),
  commissionService: asClass(CommissionService).singleton(),
});

// Register database connections
container.register({
  pool: asValue(require("./database").pool),
  redisClient: asValue(require("./redis").client),
});

module.exports = container;

/**
 * STEP 7: Testing WebSocket Connection
 * ====================================
 */

// Using curl:
curl -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     "http://localhost:5000/socket.io/?EIO=4&transport=websocket&token=YOUR_JWT_TOKEN"

// Using Node client:
const io = require("socket.io-client");

const socket = io("http://localhost:5000", {
  auth: {
    token: "YOUR_JWT_TOKEN",
  },
});

socket.on("connect", () => {
  console.log("Connected to WebSocket");
  socket.emit("subscribe:order", { orderId: 123 });
});

socket.on("order:status_updated", (data) => {
  console.log("Order updated:", data);
});

/**
 * STEP 8: API Testing
 * ===================
 */

// Submit a review
curl -X POST http://localhost:5000/api/v1/reviews \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "rating": 5,
    "comment": "Great product! Highly recommend."
  }'

// Get product reviews
curl http://localhost:5000/api/v1/products/1/reviews

// Get analytics dashboard (admin)
curl http://localhost:5000/api/v1/analytics/dashboard \
  -H "Authorization: Bearer ADMIN_TOKEN"

// Request payout (vendor)
curl -X POST http://localhost:5000/api/v1/vendor/payouts \
  -H "Authorization: Bearer VENDOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 5000,
    "bankAccountId": "bank_123"
  }'

/**
 * STEP 9: Monitoring and Logging
 * ==============================
 */

// WebSocket events are logged via Winston
// Review moderation events trigger domain events
// Analytics queries are cached; cache hits are logged

// Check logs:
tail -f logs/server.log | grep -E "WebSocket|Review|Analytics|Vendor"

/**
 * STEP 10: Performance Optimization
 * ==================================
 */

// Enable Redis caching for:
// - Analytics queries (1-hour expiry)
// - Commission rates (24-hour expiry)
// - Product ratings (1-hour expiry)

// Monitor with:
redis-cli KEYS "analytics:*"
redis-cli KEYS "commission:*"

// Clear cache if needed:
redis-cli FLUSHDB

/**
 * TROUBLESHOOTING
 * ===============
 */

// WebSocket connection fails:
// - Check FRONTEND_URL CORS configuration
// - Verify JWT token is valid
// - Check Redis connection: redis-cli ping

// Reviews not appearing:
// - Verify migration ran successfully: npm run migrate
// - Check moderation_status is not 'pending' for listing
// - Ensure ReviewApprovedSubscriber is registered

// Analytics showing no data:
// - Check that orders exist in database
// - Verify cache isn't stale: redis-cli FLUSHDB
// - Review SQL queries in SalesAnalyticsService logs

// Payouts stuck:
// - Check vendor_payouts table status field
// - Verify bank account ID is valid
// - Review CommissionService logs for payment processor errors

/**
 * ROLLBACK (if needed)
 * ====================
 */

// Undo migrations:
// $ npm run migrate:down

// Remove feature routes:
// Delete setupFeatureRoutes call from app.js

// Stop WebSocket:
// wsManager.shutdown()
// httpServer.close()

/**
 * DEPLOYMENT CHECKLIST
 * ====================
 */

// Before production:
// [ ] Run all migrations
// [ ] Configure Redis for horizontal scaling
// [ ] Set up monitoring for WebSocket connections
// [ ] Configure email service for review notifications
// [ ] Set up payment processor for payouts
// [ ] Enable rate limiting on review/rating endpoints
// [ ] Configure CORS properly for FRONTEND_URL
// [ ] Test WebSocket reconnection behavior
// [ ] Set up analytics cron jobs for periodic snapshots
// [ ] Configure backup strategy for vendor payout records
// [ ] Enable audit logging for all admin actions
// [ ] Set up alerting for failed payouts
// [ ] Load test WebSocket with concurrent users
// [ ] Verify JWT token expiration handling

module.exports = { setupWebSocket: true };
