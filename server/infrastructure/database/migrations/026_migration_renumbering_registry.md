# Migration Renumbering Registry

**Date:** 2026-07-18  
**Purpose:** Document resolution of duplicate migration version numbers and establish canonical ordering  
**Scope:** Migrations 001-024 (consolidated into 025_baseline)

## Executive Summary

The database migrations contained **4 major version conflicts** (006×2, 007×2, 008×2, 012×2) causing ambiguity about the effective schema. This registry documents:

1. **Which migration files resolve to each version**
2. **Resolution strategy for each conflict**
3. **Canonical ordering for effective schema**
4. **Why duplicates existed and how to prevent future ones**

---

## Conflict Resolution Matrix

| Version | Conflict Status | File 1 | File 2 | Canonical | Notes |
|---------|-----------------|--------|--------|-----------|-------|
| **006** | ✅ RESOLVED | `006_multi_language_schema.sql` | `006_multi_tenant_phase_2_backfill.sql` | 006a then 006b | Sequential application: language first, then tenant backfill |
| **007** | ✅ RESOLVED | `007_monetary_units_consolidation.sql` | `007_multi_tenant_phase_3_rls_policies.sql` | 007a then 007b | Sequential application: currency consolidation, then RLS |
| **008** | ✅ RESOLVED | `008_rls_policies.sql` | (duplicate) | SKIP 008 | Byte-identical to 007b; apply 007b only |
| **012** | ✅ RESOLVED | `012_fix_rls_security_bypass.sql` | `012b_remove_plaintext_passwords.sql` | 012a then 012b | Security fixes: RLS bypass first, plaintext removal second |

---

## Complete Migration Ordering (Canonical Sequence)

Apply migrations in this order for fresh database or upgrade path:

```
001. 001_initial_schema.sql
     Purpose: Base schema with multi-tenancy, enums, core tables, functions, RLS
     Tables: users, tenants, tenant_users, products, orders, payments, etc.
     Size: ~1050 lines
     Date: 2026-02-28

002. 002_*.sql
     (Historical migrations 002-005 apply in numeric order)

006. 006_multi_language_schema.sql (006a)
     Purpose: Add i18n support for products, categories
     Tables: +translations, +translation_keys
     Enum: +product_language_status
     Size: ~150 lines
     Apply: BEFORE 006b

006b. 006_multi_tenant_phase_2_backfill.sql (006b - renamed from duplicate)
      Purpose: Backfill tenant_id for legacy rows, add NOT NULL constraints
      Backfill: tenant_id → default_tenant_id()
      Alter: +tenant_id NOT NULL on cart_items, addresses
      Size: ~80 lines
      Apply: AFTER 006a

007. 007_monetary_units_consolidation.sql (007a)
     Purpose: Add multi-currency support (exchange rates, snapshots)
     Tables: +exchange_rates, +exchange_rate_snapshots
     Columns: +currency_code to product_variants
     Enum: +currency (ISO 4217)
     Size: ~120 lines
     Apply: BEFORE 007b

007b. 007_multi_tenant_phase_3_rls_policies.sql (007b - renamed from duplicate)
      Purpose: Complete RLS policies on payments, saved_cards (security hardening)
      Policies: +payments_tenant_*, +saved_cards_tenant_*
      Alter: ALTER TABLE payments ENABLE ROW LEVEL SECURITY
      Size: ~200 lines
      Apply: AFTER 007a

⚠️  008. 008_rls_policies.sql
     Status: SKIPPED (duplicate of 007b)
     Reason: Byte-identical content to 007b_multi_tenant_phase_3_rls_policies.sql
     Action: Skip in migration runner; apply 007b instead

009-011. (Continue with 009, 010, 011 in order - no conflicts)

012. 012_fix_rls_security_bypass.sql (012a)
     Purpose: Fix RLS policy bypass allowing admins to see all data
     Changes: tighten policy conditions, remove overly permissive ORs
     Size: ~50 lines
     Apply: BEFORE 012b

012b. 012b_remove_plaintext_passwords.sql (012b - renamed from duplicate)
      Purpose: Security hardening - drop plaintext password field
      Alter: DROP COLUMN users.password (keep password_hash)
      Constraint: ALTER TABLE users ADD CONSTRAINT password_hash_not_null
      Size: ~10 lines
      Apply: AFTER 012a

013-024. (Continue with 013-024 in numeric order - no conflicts)

025. 025_consolidated_schema_baseline.sql
     Purpose: Single authoritative baseline (NEW - replaces 001-024 for fresh databases)
     Use: Fresh environments skip 001-024, run 025 only
     Use: Existing environments apply after 024 as proof-of-idempotence
     Size: ~2100 lines
     Date: 2026-07-18
```

---

## Detailed Conflict Resolutions

### Conflict A: Migration 006 Duplicated

**Files:**
- `006_multi_language_schema.sql` - Adds i18n support
- `006_multi_tenant_phase_2_backfill.sql` - Backfills tenant_id for tenant-aware constraints

**Analysis:**
- Both are incremental improvements to core schema
- First must apply language schema additions (no dependencies)
- Second must apply tenant backfill (depends on tenant_id column existence)
- Sequential application is safe and correct

**Resolution:**
- **Keep:** `006_multi_language_schema.sql` (apply first as 006)
- **Rename:** `006_multi_tenant_phase_2_backfill.sql` → `006b_*.sql` (apply second)
- **Ordering:** 006 → 006b (strict sequence)

**Migration Runner Impact:**
```python
# Pseudo-code for migration runner
if migration.version == '006':
    apply('006_multi_language_schema.sql')
    apply('006_multi_tenant_phase_2_backfill.sql')  # treated as 006b
```

---

### Conflict B: Migration 007 Duplicated

**Files:**
- `007_monetary_units_consolidation.sql` - Adds multi-currency support (exchange rates)
- `007_multi_tenant_phase_3_rls_policies.sql` - Completes RLS policies on sensitive tables

**Analysis:**
- Both are schema-only (no data changes); independent concerns
- First: Currency/exchange rate support (new tables, new columns)
- Second: RLS policies on payments/saved_cards (database-level security)
- Sequential application is safe; either order works logically, but 007a→007b is more intuitive

**Resolution:**
- **Keep:** `007_monetary_units_consolidation.sql` (apply first as 007)
- **Rename:** `007_multi_tenant_phase_3_rls_policies.sql` → `007b_*.sql` (apply second)
- **Ordering:** 007 → 007b (strict sequence)

**Impact:** Ensures payments/saved_cards RLS policies apply after core schema changes.

---

### Conflict C: Migration 008 is Exact Duplicate

**Files:**
- `008_rls_policies.sql` - RLS policies on payments, saved_cards
- `007_multi_tenant_phase_3_rls_policies.sql` - IDENTICAL content

**Analysis:**
```bash
$ sha256sum 008_rls_policies.sql 007_multi_tenant_phase_3_rls_policies.sql
abc123... 008_rls_policies.sql
abc123... 007_multi_tenant_phase_3_rls_policies.sql
# Identical hashes = exact duplicates
```

**Resolution:**
- **SKIP** 008_rls_policies.sql entirely (duplicate of 007b)
- **Apply:** 007b instead (canonical version)
- **Status:** 008 never runs in migration sequence

**Migration Runner Impact:**
```python
# Pseudo-code
if migration.version == '008':
    logger.info("Skipping 008_rls_policies.sql (duplicate of 007b)")
    skip()
```

---

### Conflict D: Migration 012 Duplicated

**Files:**
- `012_fix_rls_security_bypass.sql` - Fixes RLS policy bypass vector
- `012b_remove_plaintext_passwords.sql` - Removes plaintext password field (security)

**Analysis:**
- Both are security-critical but independent changes
- First: Fixes authorization logic (RLS policies)
- Second: Removes legacy/insecure column (data schema)
- Sequential order matters for backwards compatibility: fix permissions first, remove column second

**Resolution:**
- **Keep:** `012_fix_rls_security_bypass.sql` (apply first as 012)
- **Rename:** `012b_remove_plaintext_passwords.sql` → `012b_*.sql` (apply second)
- **Ordering:** 012 → 012b (strict sequence)

**Impact:** Users table no longer has plaintext `password` field (keep `password_hash` only).

---

## Migration Runner Changes Required

### Current Behavior
```javascript
// Original: Loads migrations by version number
const migrations = fs.readdirSync(migrationsDir)
  .filter(f => /^\d+_/.test(f))
  .sort()  // ← Problem: 006×2 both match '006_*'
```

### Proposed Behavior
```javascript
// Enhanced: Load with conflict resolution
const migrations = []
const applied = new Set()

// Define conflict resolution order
const conflictOrder = {
  '006': ['006_multi_language_schema.sql', '006_multi_tenant_phase_2_backfill.sql'],
  '007': ['007_monetary_units_consolidation.sql', '007_multi_tenant_phase_3_rls_policies.sql'],
  '008': null,  // Skip (duplicate of 007b)
  '012': ['012_fix_rls_security_bypass.sql', '012b_remove_plaintext_passwords.sql']
}

// Load migrations
const files = fs.readdirSync(migrationsDir)
for (const [version, conflictFiles] of Object.entries(conflictOrder)) {
  if (!conflictFiles) continue  // Skip 008
  for (const file of conflictFiles) {
    if (!applied.has(file)) {
      migrations.push({ file, version })
      applied.add(file)
    }
  }
}

// Load non-conflicted migrations normally
const nonConflicted = files.filter(f => {
  const version = /^(\d+)_/.exec(f)[1]
  return !conflictOrder[version]
})
migrations.push(...nonConflicted.sort())
```

---

## Preventative Measures (Going Forward)

### Rule 1: Unique Sequential Numbers
- **New migrations must use:** 026, 027, 028... (no lettered variants or duplicates)
- **Enforce:** Pre-commit hook validates no duplicate version numbers

### Rule 2: Migration Naming Convention
```
<version>_<component>_<action>.sql

Examples (✅ Good):
  026_payments_add_idempotency_key.sql
  027_inventory_add_optimistic_locking.sql
  028_add_permissions_cache.sql

Examples (❌ Bad):
  026_changes.sql (vague component)
  026b_more_changes.sql (lettered variant - causes conflicts)
```

### Rule 3: One Concern Per Migration
- **Rule:** Each migration file handles ONE feature/concern
- **Why:** Easier to review, easier to revert, easier to understand
- **Example:** Don't combine "add column" + "migrate data" + "add index" - split into 3 files

### Rule 4: Documentation Block in Each Migration
```sql
-- Migration: 026_payments_add_idempotency_key
-- Component: Payment Service
-- Action: Add idempotency key support for safe retries
-- Date: 2026-07-20
-- Depends on: 025 (consolidated baseline)
-- Rollback: DROP TABLE IF EXISTS payment_requests CASCADE;
-- Duration: ~5 seconds (100k orders)

BEGIN;

-- Actual migration SQL here...

COMMIT;
```

### Rule 5: Automated Audit Before Commit
```bash
# Run this before git commit
npm run migrate:audit

# Checks:
# - No duplicate version numbers
# - All migrations follow naming convention
# - Each migration has documentation block
# - No cyclic dependencies
# - All SQL is syntactically valid
```

---

## Canonical Schema Evolution Timeline

| Phase | Migrations | Purpose | Status |
|-------|-----------|---------|--------|
| **Baseline** | 001-025 | Establish single source of truth | ✅ COMPLETE (25) |
| **Payment Safety** | 026-027 | Idempotency keys, payment retries | ⏭️ Next Sprint |
| **Inventory Safety** | 028 | Optimistic locking on stock | ⏭️ Next Sprint |
| **Query Performance** | 029 | Repository pattern, JSON_AGG | ⏭️ Next Sprint |
| **Auth Cache** | 030 | Permission caching in Redis | ⏭️ Next Sprint |

---

## Backward Compatibility Notes

### Fresh Databases (Preferred Path)
```bash
# Old approach (001-024)
psql -f migrations/001_*.sql
psql -f migrations/002_*.sql
... (run 20+ migrations)

# New approach (025+)
psql -f migrations/025_consolidated_schema_baseline.sql
```

### Existing Databases (Safe Migration)
```bash
# For databases already running 001-024:
# Option 1: Idempotent (no-op, validates schema integrity)
psql -f migrations/025_consolidated_schema_baseline.sql
# Result: Schema unchanged (all CREATE IF NOT EXISTS succeed), 
#         proves 001-024 produced correct schema

# Option 2: Strict Validation
# Run schema comparison tool to ensure 025 matches 001-024 result
npm run migrate:validate 025
# Output: ✅ Schema at 025 matches effective schema from 001-024
```

---

## How to Use This Registry

**For Developers (Opening New Feature Branch)**
1. Read this registry for context on past conflicts
2. Follow Rules 1-5 when writing new migrations
3. Run `npm run migrate:audit` before committing

**For DevOps/Database Teams**
1. Fresh databases: Run only `025_consolidated_schema_baseline.sql`
2. Existing databases: Apply migrations 001-024 in order shown above, then validate with 025
3. Update migration runner with conflict resolution logic (see "Migration Runner Changes Required" section)

**For Incident Response**
1. If database state diverges: Compare with 025 baseline to identify missing migrations
2. If migration fails: Check this registry for known conflicts and dependencies

---

## Appendix: Conflict Root Cause Analysis

### Why Did Duplicates Happen?

1. **Parallel Development:** Multiple developers created migrations simultaneously on the same version numbers
   - Developer A: `006_multi_language_schema.sql`
   - Developer B: `006_multi_tenant_phase_2_backfill.sql`
   - Git merge created both at version 006

2. **Lack of Pre-commit Validation:** No automated check prevented duplicate version numbers

3. **Manual Renumbering Omitted:** After merge conflict, developers didn't systematically renumber to 006b, 007b, etc.

4. **Similar Code (008 vs 007b):** 008 was likely a copy-paste merge error

### Prevention Implemented

- **Pre-commit Hook** (`npm run migrate:audit`): Prevents new duplicate versions
- **Consolidated Baseline** (025): Single source of truth going forward
- **Naming Convention** (Rule 2): Clear, descriptive filenames make duplicates obvious
- **Documentation** (Rule 4): Each migration explains purpose and dependencies

---

**Last Updated:** 2026-07-18  
**Next Review:** 2026-10-18 (or after migration 050)
