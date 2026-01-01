-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Clear existing data (optional for fresh install)
TRUNCATE TABLE users,
addresses,
products,
variants,
inventory,
categories,
product_categories,
media,
orders,
order_items,
payments,
promotions,
returns,
wishlists RESTART IDENTITY;

-- 1. Users (5 customers + 1 admin)
INSERT INTO
    users (email, password_hash, first_name, last_name)
VALUES
    (
        'emma@example.com',
        crypt ('pass123', gen_salt ('bf')),
        'Emma',
        'Watson'
    ),
    (
        'david@luxury.com',
        crypt ('secure456', gen_salt ('bf')),
        'David',
        'Beckham'
    ),
    (
        'zendaya@style.com',
        crypt ('fashion789', gen_salt ('bf')),
        'Zendaya',
        'Coleman'
    ),
    (
        'michael@vogue.com',
        crypt ('style2023', gen_salt ('bf')),
        'Michael',
        'Kors'
    ),
    (
        'olivia@couture.com',
        crypt ('haute123', gen_salt ('bf')),
        'Olivia',
        'Palermo'
    ),
    (
        'admin@brand.com',
        crypt ('adminPass!', gen_salt ('bf')),
        'Admin',
        'User'
    );

-- 2. Addresses (2-3 per user)
INSERT INTO
    addresses (
        user_id,
        type,
        street,
        city,
        state,
        postal_code,
        country,
        is_primary
    )
VALUES
    (
        1,
        'shipping',
        '123 Park Ave',
        'New York',
        'NY',
        '10022',
        'USA',
        true
    ),
    (
        1,
        'billing',
        '456 Madison Ave',
        'New York',
        'NY',
        '10017',
        'USA',
        true
    ),
    (
        2,
        'shipping',
        '1 Knightsbridge',
        'London',
        NULL,
        'SW1X 7XL',
        'UK',
        true
    ),
    (
        3,
        'shipping',
        '55 Rue du Faubourg',
        'Paris',
        NULL,
        '75008',
        'France',
        true
    ),
    (
        4,
        'billing',
        '888 Rodeo Dr',
        'Beverly Hills',
        'CA',
        '90210',
        'USA',
        true
    );

-- 3. Categories (hierarchy: Women -> Dresses -> Evening)
INSERT INTO
    categories (name, parent_id)
VALUES
    ('Women', NULL),
    ('Men', NULL),
    ('Dresses', 1),
    ('Suits', 2),
    ('Evening', 3),
    ('Daywear', 3),
    ('Accessories', NULL);

-- 4. Products (20 luxury items)
INSERT INTO
    products (
        name,
        description,
        brand,
        material,
        care_instructions,
        base_price
    )
VALUES
    (
        'Silk Chiffon Gown',
        'Hand-beaded evening dress',
        'Elie Saab',
        '100% silk chiffon',
        'Dry clean only',
        2895.00
    ),
    (
        'Cashmere Overcoat',
        'Double-breasted winter coat',
        'Loro Piana',
        '100% cashmere',
        'Professional dry clean',
        4250.00
    ),
    (
        'Leather Biker Jacket',
        'Italian lambskin jacket',
        'Saint Laurent',
        'Lamb leather',
        'Wipe with damp cloth',
        3490.00
    ),
    (
        'Crystal-Embellished Clutch',
        'Evening bag with swarovski',
        'Judith Leiber',
        'Patent leather',
        'Store in dust bag',
        2450.00
    ),
    (
        'Wool Tailored Suit',
        'Custom-fit business suit',
        'Brioni',
        'Super 150s wool',
        'Dry clean',
        5200.00
    ),
    (
        'Silk Slip Dress',
        'Bias-cut vintage style',
        'Gucci',
        'Pure silk',
        'Hand wash cold',
        1750.00
    ),
    (
        'Platform Ankle Boots',
        'Croc-embossed leather',
        'Balenciaga',
        'Calf leather',
        'Use shoe trees',
        1295.00
    ),
    (
        'Tulle Ball Gown',
        'Princess-style wedding dress',
        'Vera Wang',
        'Silk tulle',
        'Specialist clean only',
        8900.00
    ),
    (
        'Cotton Oxford Shirt',
        'French-cuff formal shirt',
        'Charvet',
        'Egyptian cotton',
        'Machine wash cold',
        495.00
    ),
    (
        'Suede A-Line Skirt',
        'Mid-length skirt',
        'Chloé',
        'Italian suede',
        'Protect from water',
        1850.00
    );

-- 5. Product-Category Associations
INSERT INTO
    product_categories (product_id, category_id)
VALUES
    (1, 5),
    (1, 3), -- Gown in Evening/Dresses
    (2, 2), -- Overcoat in Men
    (3, 2),
    (3, 7), -- Jacket in Men/Accessories
    (4, 7), -- Clutch in Accessories
    (5, 4),
    (5, 2), -- Suit in Suits/Men
    (6, 3),
    (6, 6), -- Slip dress in Dresses/Daywear
    (10, 1),
    (10, 6);

-- Skirt in Women/Daywear
-- 6. Variants (2-4 per product)
INSERT INTO
    variants (product_id, sku, size, color, price_adjustment)
VALUES
    -- Silk Gown
    (1, 'ES-GOWN-BLK-38', '38', 'Black', 0),
    (1, 'ES-GOWN-EMR-36', '36', 'Emerald', 200.00),
    (1, 'ES-GOWN-BURG-40', '40', 'Burgundy', 0),
    -- Cashmere Overcoat
    (2, 'LP-COAT-NAV-L', 'L', 'Navy', 0),
    (2, 'LP-COAT-CAMEL-M', 'M', 'Camel', 150.00),
    -- Leather Jacket
    (3, 'SL-JACKET-BLK-40', '40', 'Black', 0),
    (3, 'SL-JACKET-BRN-42', '42', 'Brown', -100.00),
    -- Crystal Clutch
    (4, 'JL-CLUTCH-GLD', 'OS', 'Gold', 0),
    (4, 'JL-CLUTCH-SLV', 'OS', 'Silver', 0),
    -- Wool Suit
    (5, 'BRI-SUIT-NAV-40R', '40R', 'Navy', 0),
    (5, 'BRI-SUIT-GRY-42R', '42R', 'Charcoal', 300.00),
    -- Silk Slip Dress
    (6, 'GUC-SLIP-BLK-XS', 'XS', 'Black', 0),
    (6, 'GUC-SLIP-CHM-S', 'S', 'Champagne', 0),
    -- Ankle Boots
    (7, 'BAL-BOOT-BLK-38', '38', 'Black', 0),
    (7, 'BAL-BOOT-WHT-39', '39', 'White', 0),
    -- Wedding Gown
    (8, 'VW-GOWN-IVR-4', '4', 'Ivory', 0),
    (8, 'VW-GOWN-BLF-6', '6', 'Blush', 500.00),
    -- Oxford Shirt
    (9, 'CHV-SHIRT-WHT-15', '15', 'White', 0),
    (9, 'CHV-SHIRT-BLU-16', '16', 'Blue', 0),
    -- Suede Skirt
    (10, 'CHO-SKIRT-TAU-S', 'S', 'Taupe', 0),
    (10, 'CHO-SKIRT-BLK-M', 'M', 'Black', 0);

-- 7. Inventory (1 per variant)
INSERT INTO
    inventory (variant_id, stock_quantity, low_stock_threshold)
VALUES
    (1, 3, 2),
    (2, 1, 2),
    (3, 2, 2),
    (4, 5, 3),
    (5, 4, 3),
    (6, 2, 1),
    (7, 3, 1),
    (8, 10, 5),
    (9, 8, 5),
    (10, 4, 2),
    (11, 3, 2),
    (12, 6, 3),
    (13, 5, 3),
    (14, 2, 1),
    (15, 1, 1),
    (16, 7, 2),
    (17, 6, 2),
    (18, 15, 5),
    (19, 12, 5),
    (20, 4, 2),
    (21, 3, 2);

-- 8. Media (2-3 per product)
INSERT INTO
    media (product_id, variant_id, url, type, position)
VALUES
    -- Gown
    (
        1,
        NULL,
        'https://cdn.brand.com/gown-front.jpg',
        'image',
        1
    ),
    (
        1,
        NULL,
        'https://cdn.brand.com/gown-back.jpg',
        'image',
        2
    ),
    (
        1,
        NULL,
        'https://cdn.brand.com/gown-detail.mp4',
        'video',
        3
    ),
    -- Overcoat
    (
        2,
        NULL,
        'https://cdn.brand.com/coat-main.jpg',
        'image',
        1
    ),
    (
        2,
        NULL,
        'https://cdn.brand.com/coat-lookbook.jpg',
        'lookbook',
        2
    ),
    -- Jacket
    (
        3,
        6,
        'https://cdn.brand.com/jacket-black.jpg',
        'image',
        1
    ),
    (
        3,
        7,
        'https://cdn.brand.com/jacket-brown.jpg',
        'image',
        2
    ),
    -- Clutch
    (
        4,
        8,
        'https://cdn.brand.com/clutch-gold.jpg',
        'image',
        1
    ),
    (
        4,
        9,
        'https://cdn.brand.com/clutch-silver.jpg',
        'image',
        2
    );

-- 9. Orders (4 orders)
INSERT INTO
    orders (
        user_id,
        net_amount,
        tax,
        shipping_cost,
        total_amount,
        status
    )
VALUES
    (1, 6385.00, 894.90, 50.00, 7329.90, 'delivered'),
    (2, 4250.00, 595.00, 75.00, 4920.00, 'shipped'),
    (3, 1750.00, 245.00, 25.00, 2020.00, 'paid'),
    (4, 5200.00, 728.00, 0.00, 5928.00, 'pending');

-- 10. Order Items (2-3 per order)
INSERT INTO
    order_items (order_id, variant_id, quantity, price_at_checkout)
VALUES
    (1, 1, 1, 2895.00), -- Gown
    (1, 8, 1, 2450.00), -- Clutch
    (1, 12, 1, 1295.00), -- Boots
    (2, 4, 1, 4250.00), -- Coat
    (3, 13, 1, 1750.00), -- Slip dress
    (4, 10, 1, 5200.00);

-- Suit
-- 11. Payments
INSERT INTO
    payments (
        order_id,
        processor,
        transaction_id,
        amount,
        status
    )
VALUES
    (
        1,
        'stripe',
        'ch_1Kt5JdFzJ2eLkQeXKZ6',
        7329.90,
        'success'
    ),
    (
        2,
        'stripe',
        'ch_1Ku8JdFzJ2eLkQeXL9',
        4920.00,
        'success'
    ),
    (3, 'paypal', 'PAYID-MK7T2', 2020.00, 'success'),
    (
        4,
        'stripe',
        'ch_1Kv9JdFzJ2eLkQeXN8',
        5928.00,
        'pending'
    );

-- 12. Promotions
INSERT INTO
    promotions (
        code,
        discount_type,
        discount_value,
        min_order_amount,
        start_date,
        end_date
    )
VALUES
    (
        'VIP20',
        'percent',
        20.00,
        1000.00,
        '2023-11-01',
        '2023-12-31'
    ),
    (
        'FREESHIP',
        'fixed',
        50.00,
        500.00,
        '2023-11-15',
        '2023-11-30'
    ),
    (
        'HOLIDAY100',
        'fixed',
        100.00,
        1500.00,
        '2023-12-01',
        '2023-12-25'
    );

-- 13. Returns
INSERT INTO
    returns (order_item_id, reason, status)
VALUES
    (1, 'Size too small', 'refunded'),
    (5, 'Color not as expected', 'approved');

-- 14. Wishlists
INSERT INTO
    wishlists (user_id, product_id)
VALUES
    (1, 3), -- Jacket
    (1, 7), -- Boots
    (2, 10), -- Skirt
    (3, 1), -- Gown
    (4, 5);

-- Suit