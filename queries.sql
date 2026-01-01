CREATE TABLE
    users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW (),
        updated_at TIMESTAMP DEFAULT NOW (),
        last_login TIMESTAMP
    );

CREATE TABLE
    addresses (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users (id) ON DELETE CASCADE,
        type VARCHAR(8) CHECK (type IN ('shipping', 'billing')),
        street TEXT NOT NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(50),
        postal_code VARCHAR(20) NOT NULL,
        country VARCHAR(50) NOT NULL,
        is_primary BOOLEAN DEFAULT false
    );

CREATE TABLE
    products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        price DECIMAL(10, 2),
        description TEXT,
        brand VARCHAR(100) NOT NULL,
        material TEXT,
        care_instructions TEXT,
        base_price NUMERIC(10, 2) NOT NULL CHECK (base_price > 0),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW (),
        updated_at TIMESTAMP DEFAULT NOW ()
    );

CREATE TABLE
    variants (
        id SERIAL PRIMARY KEY,
        product_id INT REFERENCES products (id) ON DELETE CASCADE,
        sku VARCHAR(50) UNIQUE NOT NULL,
        size VARCHAR(20) NOT NULL, -- e.g. 'S', 'M', 'L
        color VARCHAR(50) NOT NULL, -- e.g. 'Red'
        price_adjustment NUMERIC(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW ()
    );

CREATE TABLE
    inventory (
        inventory_id SERIAL PRIMARY KEY,
        variant_id INT REFERENCES variants (id) ON DELETE CASCADE,
        stock_quantity INT NOT NULL CHECK (stock_quantity >= 0),
        low_stock_threshold INT DEFAULT 5,
        last_restocked TIMESTAMP
    );

CREATE TABLE
    categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        parent_id INT REFERENCES categories (id) ON DELETE SET NULL
    );

CREATE TABLE
    product_categories (
        product_id INT REFERENCES products (id) ON DELETE CASCADE,
        category_id INT REFERENCES categories (id) ON DELETE CASCADE,
        PRIMARY KEY (product_id, category_id)
    );

CREATE TABLE
    media (
        id SERIAL PRIMARY KEY,
        product_id INT REFERENCES products (id) ON DELETE CASCADE,
        variant_id INT REFERENCES variants (id) ON DELETE SET NULL,
        url TEXT NOT NULL, -- CDN path
        type VARCHAR(10) CHECK (type IN ('image', 'video', 'lookbook')),
        position SMALLINT -- Order in gallery
    );

CREATE TABLE
    orders (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users (id) ON DELETE SET NULL,
        net_amount DECIMAL(10, 2) NOT NULL,
        tax DECIMAL(10, 2) NOT NULL,
        shipping_cost DECIMAL(10, 2) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) CHECK (
            status IN (
                'pending',
                'paid',
                'shipped',
                'delivered',
                'returned'
            )
        ),
        created_at TIMESTAMP DEFAULT NOW ()
    );

CREATE TABLE
    order_items (
        order_item_id SERIAL PRIMARY KEY,
        order_id INT REFERENCES orders (id) ON DELETE CASCADE,
        variant_id INT REFERENCES variants (id),
        quantity SMALLINT NOT NULL CHECK (quantity > 0),
        price_at_checkout DECIMAL(10, 2) NOT NULL -- Snapshot of price
    );

CREATE TABLE
    payments (
        id SERIAL PRIMARY KEY,
        order_id INT REFERENCES orders (id) ON DELETE CASCADE,
        processor VARCHAR(20) CHECK (processor IN ('stripe', 'paypal')),
        transaction_id TEXT UNIQUE NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) CHECK (
            status IN ('success', 'failed', 'pending', 'refunded')
        ),
        created_at TIMESTAMP DEFAULT NOW ()
    );

CREATE TABLE
    promotions (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE,
        discount_type VARCHAR(10) CHECK (discount_type IN ('percent', 'fixed')),
        discount_value DECIMAL(10, 2) NOT NULL,
        min_order_amount DECIMAL(10, 2),
        start_date TIMESTAMP,
        end_date TIMESTAMP
    );

CREATE TABLE
    returns (
        id SERIAL PRIMARY KEY,
        order_item_id INT REFERENCES order_items (order_item_id),
        reason TEXT,
        status VARCHAR(20) CHECK (
            status IN ('requested', 'approved', 'rejected', 'refunded')
        ),
        created_at TIMESTAMP DEFAULT NOW ()
    );

CREATE TABLE
    wishlists (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users (id) ON DELETE CASCADE,
        product_id INT REFERENCES products (id) ON DELETE CASCADE,
        added_at TIMESTAMP DEFAULT NOW (),
        UNIQUE (user_id, product_id) -- Prevent duplicates
    );