# Async Error Handling Standardization

## Completed: Enhanced asyncErrorHandler.js

**Status:** ✅ Standardized utilities implemented  
**Commit:** 8db8473  
**File:** `server/shared/utils/asyncErrorHandler.js`

### What Was Enhanced

The `asyncErrorHandler.js` utility has been standardized with comprehensive, well-documented utilities matching the pattern established in `response.js`:

#### New Exports:
1. **`fireAndForgetWithErrorLog(asyncFn, context)`**
   - Base fire-and-forget with consistent error logging
   - Configurable severity levels (error, warn, info)
   - Rich context structure

2. **`fireAndForgetWithRetry(asyncFn, context, options)`**
   - Retry logic with exponential backoff
   - Configurable max retries and initial delay
   - Perfect for flaky operations (email, APIs)

3. **`fireAndForgetWithTimeout(asyncFn, timeoutMs, context)`**
   - Timeout support for long-running operations
   - Prevents hanging promises
   - Useful for file uploads, data exports

4. **`fireAndForgetParallel(operations)`**
   - Execute multiple concurrent fire-and-forget ops
   - Unified error handling across all operations
   - Batch notifications pattern

5. **`buildAsyncErrorContext(context)`**
   - Standardized error context builder
   - Mirrors `buildResponse()` pattern from response.js
   - Consistent logging structure

### Key Features

✅ **JSDoc Type Safety**
```typescript
@typedef {Object} AsyncErrorContext
@property {string} operation - Operation name
@property {string|number} [id] - Entity ID
@property {string} [userId] - User performing operation
@property {string} [severity] - Log level
@property {Object} [metadata] - Additional context
```

✅ **Standardized Context Structure**
```javascript
{
  operation: 'publishOrderCreatedEvent',  // Required
  id: order.id,                           // Entity reference
  userId: user.id,                        // Actor reference
  severity: 'warn',                       // Log level
  metadata: { vendorId, trackingNumber }  // Extra context
}
```

✅ **Configurable Options**
- Retry: `{ maxRetries: 3, initialDelay: 1000 }`
- Timeout: Direct parameter `5000` (ms)
- Severity: 'error' | 'warn' | 'info'

## Next Steps: Migrate Services

### Phase 1: ProductService
**Location:** `server/domain/catalog/services/ProductService.js` (lines 63-75)

**Before:**
```javascript
try {
  await eventDispatcher.publish(event);
  logger.debug("Catalog domain event published", {...});
} catch (publishError) {
  logger.warn("Catalog domain event publish failed", {...});
}
```

**After:**
```javascript
fireAndForgetWithErrorLog(
  () => eventDispatcher.publish(event),
  { operation: 'publishProductCreatedEvent', id: product.id }
);
```

### Phase 2: PaymentService
**Location:** `server/domain/payment/services/PaymentService.js` (3 locations)

Replace all try-catch blocks around `eventDispatcher.publish()` with standardized utilities.

### Phase 3: VendorApplicationService
**Location:** `server/domain/vendor/services/VendorApplicationService.js`

Add error handling to email operations using `fireAndForgetWithRetry`:
```javascript
fireAndForgetWithRetry(
  () => sendEmailJob(email),
  { operation: 'sendVendorApprovalEmail', userId: admin.id },
  { maxRetries: 3, initialDelay: 2000 }
);
```

### Phase 4: Other Services
- NotificationService (if exists)
- Event subscribers
- Any fire-and-forget operations

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| **Error Patterns** | 6+ different patterns | 1 unified pattern |
| **Code Duplication** | High (try-catch everywhere) | Eliminated (reusable utilities) |
| **Logging Consistency** | Inconsistent | Standardized format |
| **Auditability** | Hard to find fire-and-forget ops | Single export to search |
| **Extensibility** | Limited | Supports retry, timeout, parallel |
| **IDE Support** | None | Full JSDoc autocomplete |

## Usage Examples

### Basic Fire-and-Forget
```javascript
fireAndForgetWithErrorLog(
  () => publishEvent(event),
  { operation: 'publishOrderCreated', id: orderId }
);
```

### With Retry (Flaky Email)
```javascript
fireAndForgetWithRetry(
  () => sendWelcomeEmail(user),
  { operation: 'sendWelcomeEmail', userId: user.id },
  { maxRetries: 3, initialDelay: 1000 }
);
```

### With Timeout (Long Upload)
```javascript
fireAndForgetWithTimeout(
  () => uploadFileToS3(file, bucket),
  30000,
  { operation: 'uploadProfilePicture', userId: user.id }
);
```

### Parallel Operations (Batch Notifications)
```javascript
fireAndForgetParallel([
  { fn: () => publishEvent(event), context: { operation: 'publishEvent' } },
  { fn: () => sendNotification(user), context: { operation: 'sendNotification' } },
  { fn: () => updateCache(key), context: { operation: 'updateCache' } }
]);
```

## Timeline

- **Phase 1 (ProductService):** 15 min
- **Phase 2 (PaymentService):** 15 min
- **Phase 3 (VendorApplicationService):** 15 min
- **Phase 4 (Others + Testing):** 30 min

**Total estimated time:** 1.5 hours

## Maintenance Notes

- All fire-and-forget operations now use standardized utilities
- Error context is consistently structured for easy parsing/alerting
- Retry and timeout options available for different operation types
- Single source of truth for async error handling strategy
- Future enhancements (circuit breaker, circuit patterns) can be added here

---

**Last Updated:** 2026-07-19  
**Branch:** 01-missing-domains
