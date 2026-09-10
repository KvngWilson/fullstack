-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  is_admin BOOLEAN DEFAULT FALSE,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_is_admin ON users(is_admin);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2),
  quantity_in_stock INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_is_active ON products(is_active);

-- Addresses Table
CREATE TABLE IF NOT EXISTS addresses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  street VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100),
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- Payment Methods Table
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  card_number VARCHAR(19) NOT NULL,
  card_holder VARCHAR(255) NOT NULL,
  expiry_month INTEGER NOT NULL,
  expiry_year INTEGER NOT NULL,
  cvv VARCHAR(10),
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_methods_user_id ON payment_methods(user_id);

-- Carts Table
CREATE TABLE IF NOT EXISTS carts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_carts_user_id ON carts(user_id);

-- Cart Items Table
CREATE TABLE IF NOT EXISTS cart_items (
  id SERIAL PRIMARY KEY,
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  price_cents INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  address_id INTEGER REFERENCES addresses(id),
  status VARCHAR(50) DEFAULT 'pending',
  subtotal_cents INTEGER DEFAULT 0,
  tax_cents INTEGER DEFAULT 0,
  shipping_cents INTEGER DEFAULT 0,
  total_cents INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  payment_method_id INTEGER REFERENCES payment_methods(id),
  amount_cents INTEGER NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  webhook_event_id VARCHAR(255),
  transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_webhook_event_id ON payments(webhook_event_id);

-- Shipments Table
CREATE TABLE IF NOT EXISTS shipments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  carrier VARCHAR(100),
  tracking_number VARCHAR(100),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shipments_order_id ON shipments(order_id);

-- Shipment Tracking Table
CREATE TABLE IF NOT EXISTS shipment_tracking (
  id SERIAL PRIMARY KEY,
  shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status VARCHAR(50),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shipment_tracking_shipment_id ON shipment_tracking(shipment_id);
-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee Invitations Table
CREATE TABLE IF NOT EXISTS employee_invitations (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  invitation_token VARCHAR(255) NOT NULL UNIQUE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  invited_by_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_employee_invitations_email ON employee_invitations(email);
CREATE INDEX idx_employee_invitations_status ON employee_invitations(status);
CREATE INDEX idx_employee_invitations_expires_at ON employee_invitations(expires_at);
-- Employee Onboarding Tables
CREATE TABLE IF NOT EXISTS onboardings (
  id            SERIAL PRIMARY KEY,
  employee_id   INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  manager_id    INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  status        VARCHAR(20)    NOT NULL DEFAULT 'not_started',
  start_date    DATE           NOT NULL,
  end_date      DATE,
  budget        NUMERIC(10, 2) NOT NULL DEFAULT 5000 CHECK (budget >= 0),
  budget_spent  NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (budget_spent >= 0),
  budget_overridden       BOOLEAN NOT NULL DEFAULT false,
  budget_override_reason  TEXT,
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id             SERIAL PRIMARY KEY,
  onboarding_id  INTEGER      NOT NULL REFERENCES onboardings(id) ON DELETE CASCADE,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  category       VARCHAR(50)  NOT NULL DEFAULT 'general',
  due_day        SMALLINT,
  assigned_to    INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  is_completed   BOOLEAN NOT NULL DEFAULT false,
  completed_at   TIMESTAMP,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_onboardings_employee    ON onboardings(employee_id);
CREATE INDEX idx_onboardings_status      ON onboardings(status);
CREATE INDEX idx_onboarding_tasks_parent ON onboarding_tasks(onboarding_id);
