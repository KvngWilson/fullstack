/**
 * Migration 016: Consolidate Variant Tables
 * 
 * Consolidates the old `variants` table into `product_variants`.
 * The schema has two variant tables:
 * - variants: Old table with size, color attributes (being deprecated)
 * - product_variants: New table with JSONB attributes (canonical table)
 * 
 * Referenced in:
 * - cart_items (variant_id -> product_variant_id)
 * - order_items (variant_id -> product_variant_id)
 * - inventory (variant_id only - no product_variant_id)
 * 
 * Strategy:
 * 1. Create mapping from old variants to product_variants
 * 2. Migrate cart_items.variant_id -> product_variant_id
 * 3. Migrate order_items.variant_id -> product_variant_id
 * 4. Remove variant_id from inventory (legacy data)
 * 5. Remove old foreign key constraints
 * 6. Back up variants table (archive table)
 * 7. Drop variants table
 */
BEGIN;

-- Step 1+2: Migrate legacy variant_id references only when legacy columns/tables still exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'variants')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cart_items' AND column_name = 'variant_id') THEN
    UPDATE cart_items
    SET product_variant_id = (
      SELECT pv.id
      FROM variants v
      JOIN product_variants pv
        ON v.product_id = pv.product_id
       AND v.sku = pv.sku
      WHERE v.id = cart_items.variant_id
    )
    WHERE cart_items.product_variant_id IS NULL
      AND cart_items.variant_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM variants v
        JOIN product_variants pv
          ON v.product_id = pv.product_id
         AND v.sku = pv.sku
        WHERE v.id = cart_items.variant_id
      );
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'variants')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'variant_id') THEN
    UPDATE order_items
    SET product_variant_id = (
      SELECT pv.id
      FROM variants v
      JOIN product_variants pv
        ON v.product_id = pv.product_id
       AND v.sku = pv.sku
      WHERE v.id = order_items.variant_id
    )
    WHERE order_items.product_variant_id IS NULL
      AND order_items.variant_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM variants v
        JOIN product_variants pv
          ON v.product_id = pv.product_id
         AND v.sku = pv.sku
        WHERE v.id = order_items.variant_id
      );
  END IF;
END $$;

-- Step 3: Remove foreign key constraints on variants
-- Drop cart_items.variant_id constraint
ALTER TABLE cart_items
DROP CONSTRAINT IF EXISTS cart_items_variant_id_fkey;

-- Drop order_items.variant_id constraint
ALTER TABLE order_items
DROP CONSTRAINT IF EXISTS order_items_variant_id_fkey;

-- Drop inventory.variant_id constraint
ALTER TABLE inventory
DROP CONSTRAINT IF EXISTS inventory_variant_id_fkey;

-- Step 4: Drop the old variants table
DROP TABLE IF EXISTS variants;

-- Step 5: Drop the old variant_id columns from referencing tables
ALTER TABLE cart_items DROP COLUMN IF EXISTS variant_id;
ALTER TABLE order_items DROP COLUMN IF EXISTS variant_id;
ALTER TABLE inventory DROP COLUMN IF EXISTS variant_id;

COMMIT;