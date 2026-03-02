# E-Commerce Full-Stack Application

A modern full-stack e-commerce platform with React frontend and Node.js/Express backend, featuring JWT authentication, product management, shopping cart, order processing, payment integration, and user account management.

## Features

### Frontend
- **Modern React UI** - Built with React 18, Redux Toolkit, and React Router v6
- **Design System** - Custom design tokens, Tailwind CSS, and semantic component styling
- **Product Catalog** - Browse, filter, and search products with detailed views
- **Shopping Cart** - Add/remove items, quantity adjustment, persistent storage
- **Wishlist** - Save favorite products, add to cart from wishlist
- **Checkout** - Multi-step checkout with saved addresses and payment methods
- **User Dashboard** - Manage profile, addresses, payment cards, and order history
- **Responsive Design** - Mobile-first approach with Tailwind CSS utilities
- **Nginx-Served** - Production-optimized delivery via Alpine Linux Nginx

### Backend API
- **Authentication & Authorization** - JWT + refresh tokens, email verification, account security
- **Product Management** - Full CRUD with variants, pricing, and stock tracking
- **Shopping Cart** - Stock-validated cart with quantity management
- **Wishlist Management** - Add/remove favorite products endpoint
- **Order Processing** - Cart-to-order conversion with address capture
- **Payment Processing** - Paystack and Stripe integration with idempotent webhooks
- **User Profiles** - Account management, address book, saved payment methods
- **Shipping Integration** - Easyship rates and carrier selection
- **Inventory Tracking** - Real-time stock management with audit trail
- **Transactional Email** - Order confirmations, verifications, password resets
- **API Documentation** - Interactive Swagger/OpenAPI docs
- **Admin Panel** - Subdomain-based administrative interface

## Tech Stack

### Frontend
- **Framework**: React 18 with TypeScript support
- **State Management**: Redux Toolkit
- **Routing**: React Router v6
- **Styling**: Tailwind CSS with custom design tokens
- **HTTP Client**: Axios with auth interceptors
- **Server**: Nginx 1.27-Alpine (production)
- **Build Tool**: Vite

### Backend
- **Runtime**: Node.js 20-Alpine
- **Framework**: Express.js 5
- **Database**: PostgreSQL 16-Alpine
- **Cache/Sessions**: Redis 7-Alpine
- **Authentication**: Passport.js + JWT
- **Password Hashing**: Argon2
- **Validation**: Joi
- **Email**: Nodemailer SMTP
- **API Docs**: Swagger UI
- **Testing**: Jest with layered test architecture (unit, integration, e2e, security)

### DevOps & Infrastructure
- **Containerization**: Docker & Docker Compose
- **Orchestration**: Docker Compose with health checks
- **Environment**: Multi-stage builds for production optimization
- **Networking**: Isolated Docker network for service communication
- **Persistence**: PostgreSQL and Redis data volumes

## Prerequisites

- **With Docker (Recommended)**:
  - Docker 20.10+
  - Docker Compose 2.0+
  
- **Local Development (Without Docker)**:
  - Node.js >= 18.x
  - PostgreSQL >= 16.x
  - Redis >= 7.x
  - npm or yarn

## Quick Start

### Option 1: Docker (Recommended)

1. **Clone and navigate to project**
```bash
git clone <repository-url>
cd fullstack
```

2. **Start all services**
```bash
docker compose up
```

The application will be available at:
- **Frontend**: `http://localhost:3000`
- **API**: `http://localhost:5000`
- **API Docs**: `http://localhost:5000/api-docs`
- **PostgreSQL**: `localhost:55432`
- **Redis**: `localhost:36379`

3. **View logs**
```bash
docker compose logs -f
```

4. **Stop services**
```bash
docker compose down
```



### Option 2: Local Development

1. **Clone the repository**
```bash
git clone <repository-url>
cd fullstack
```

2. **Install backend dependencies**
```bash
cd server
npm install
```

3. **Install frontend dependencies**
```bash
cd ../client
npm install
cd ..
```

4. **Set up environment variables**
```bash
# Server environment
cp server/.env.example server/.env
# Edit server/.env with your configuration

# Client environment
cp client/.env.example client/.env
# Edit client/.env with your API endpoint
```

5. **Initialize database**
```bash
# Create database and run migrations
cd server
npm run migrate
cd ..
```

6. **Start development servers (in separate terminals)**

**Backend (Terminal 1):**
```bash
cd server
npm run dev
```

**Frontend (Terminal 2):**
```bash
cd client
npm run dev
```

The application will be available at:
- **Frontend**: `http://localhost:5173` (Vite dev server)
- **API**: `http://localhost:5000`
- **API Docs**: `http://localhost:5000/api-docs`

## Project Structure

```
fullstack/
├── client/                      # React frontend application
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── components/          # Reusable React components
│   │   │   ├── common/          # Common components (Header, Footer)
│   │   │   ├── product/         # Product-related components
│   │   │   ├── cart/            # Shopping cart components
│   │   │   ├── checkout/        # Checkout flow components
│   │   │   ├── ui/              # UI building blocks
│   │   │   ├── layout/          # Layout components
│   │   │   └── vendor/          # Third-party components
│   │   ├── pages/               # Page components
│   │   ├── features/            # Redux features/slices
│   │   │   ├── auth/            # Authentication
│   │   │   ├── cart/            # Shopping cart
│   │   │   ├── products/        # Products
│   │   │   ├── orders/          # Orders
│   │   │   ├── user/            # User profile
│   │   │   └── wishlist/        # Wishlist
│   │   ├── hooks/               # Custom React hooks
│   │   ├── api/                 # API client configuration
│   │   ├── routes/              # Route definitions
│   │   ├── store/               # Redux store configuration
│   │   ├── styles/              # Global styles
│   │   ├── utils/               # Utility functions
│   │   └── main.jsx             # Application entry point
│   ├── Dockerfile               # Docker build configuration (multi-stage)
│   ├── vite.config.js           # Vite configuration
│   ├── postcss.config.js        # PostCSS configuration
│   ├── tailwind.config.js       # Tailwind CSS configuration
│   ├── nginx.conf               # Nginx server configuration
│   ├── package.json
│   └── .dockerignore
│
├── server/                      # Node.js/Express backend (Domain-Driven Design)
│   ├── src/
│   │   ├── index.js             # Application bootstrap and startup
│   │   ├── app.js               # Express app configuration, middleware, routes
│   │   └── setup.js             # Server initialization and graceful shutdown
│   ├── api/                     # HTTP API Layer
│   │   ├── controllers/         # Request handlers organized by domain
│   │   │   ├── health.js        # Health check endpoints
│   │   │   ├── v1/              # API v1 endpoints
│   │   │   │   ├── auth-platform.js
│   │   │   │   ├── catalog.js
│   │   │   │   ├── ordering.js
│   │   │   │   ├── payment.js
│   │   │   │   ├── shipping.js
│   │   │   │   └── admin.js
│   │   ├── middleware/          # Express middleware
│   │   │   ├── error.js         # Global error handler
│   │   │   ├── auth.js          # Authentication/authorization
│   │   │   ├── validation.js    # Request validation
│   │   │   ├── requestContext.js # Correlation ID, timing
│   │   │   ├── metrics.js       # Performance metrics
│   │   │   ├── rateLimit.js     # Rate limiting
│   │   │   └── logging.js       # Request/response logging
│   │   ├── routes/              # Endpoint definitions
│   │   │   ├── health.js
│   │   │   ├── v1/
│   │   │   │   ├── auth-platform.js
│   │   │   │   ├── catalog.js
│   │   │   │   ├── ordering.js
│   │   │   │   ├── payment.js
│   │   │   │   ├── shipping.js
│   │   │   │   └── admin.js
│   │   ├── decorators/          # Route/method decorators
│   │   └── validators/          # Request validation schemas
│   │       ├── auth.js
│   │       ├── catalog.js
│   │       ├── ordering.js
│   │       ├── payment.js
│   │       └── ...
│   ├── config/                  # Application configuration
│   │   ├── env.js               # Environment variable validation
│   │   ├── db.js                # PostgreSQL pool setup
│   │   ├── redis.js             # Redis client config
│   │   ├── auth.js              # Auth constants and config
│   │   ├── passport.js          # Passport strategies (JWT, local)
│   │   ├── session.js           # Express session middleware
│   │   ├── security.js          # CORS, Helmet, security headers
│   │   ├── permissions.js       # RBAC permissions matrix
│   │   └── swagger.js           # OpenAPI/Swagger config
│   ├── domain/                  # Business Logic (Domain-Driven Design)
│   │   ├── identity/            # Authentication & User Management
│   │   │   ├── entities/        # User, Role, Permission
│   │   │   ├── services/        # AuthService, ProfileService
│   │   │   ├── repositories/    # UserRepository, RoleRepository
│   │   │   ├── policies/        # Password, Account lockout
│   │   │   ├── events/          # UserCreated, UserDeleted
│   │   │   └── index.js
│   │   ├── catalog/             # Product Management
│   │   │   ├── entities/        # Product, Variant, Category
│   │   │   ├── services/        # ProductService, InventoryService
│   │   │   ├── repositories/    # ProductRepository, VariantRepository
│   │   │   ├── events/          # ProductCreated, StockUpdated
│   │   │   └── index.js
│   │   ├── ordering/            # Shopping Cart & Orders
│   │   │   ├── entities/        # Cart, Order, OrderItem
│   │   │   ├── services/        # CartService, OrderService
│   │   │   ├── repositories/    # CartRepository, OrderRepository
│   │   │   ├── events/          # OrderCreated, OrderCancelled
│   │   │   └── index.js
│   │   ├── payment/             # Payment Processing
│   │   │   ├── entities/        # Payment, Transaction
│   │   │   ├── services/        # PaymentService, PaystackService, StripeService
│   │   │   ├── repositories/    # PaymentRepository
│   │   │   ├── events/          # PaymentCreated, PaymentFailed
│   │   │   └── index.js
│   │   ├── shipping/            # Shipping Management
│   │   │   ├── services/        # ShippingService, EasyshipService
│   │   │   ├── repositories/    # ShippingRepository
│   │   │   └── index.js
│   │   ├── vendor/              # Vendor Management
│   │   │   └── index.js
│   │   ├── shared/              # Cross-Domain Utilities
│   │   │   ├── value-objects/   # Shared value types
│   │   │   ├── interfaces/      # Common interfaces
│   │   │   └── enums/           # Shared enumerations
│   │   └── index.js             # Domain facade
│   ├── infrastructure/          # External Services & Integrations
│   │   ├── cache/               # Redis caching layer
│   │   │   ├── decorators.js    # Cache decorators
│   │   │   └── manager.js
│   │   ├── database/            # PostgreSQL access
│   │   │   ├── connection.js    # Pool setup
│   │   │   └── migrations/      # Database schema migrations
│   │   ├── email/               # SMTP email service
│   │   │   ├── templates/       # Email templates
│   │   │   └── service.js
│   │   ├── jobs/                # Background job processing
│   │   │   └── worker.js
│   │   ├── logging/             # Winston structured logging
│   │   │   └── logger.js
│   │   ├── metrics/             # Performance monitoring
│   │   │   └── collector.js
│   │   ├── resilience/          # Retry, circuit breaker, timeouts
│   │   │   └── patterns.js
│   │   ├── security/            # Encryption, token utilities
│   │   │   └── crypto.js
│   │   ├── shipping/            # Carrier integrations
│   │   │   └── providers.js
│   │   └── tracing/             # Distributed tracing
│   │       └── tracer.js
│   ├── services/                # Application Services
│   │   ├── admin.js             # Admin operations
│   │   ├── invitation.js        # User invitations
│   │   └── shipping.js          # Shipping aggregation
│   ├── data/                    # Data Persistence Layer
│   │   ├── migrations/          # Database migration scripts
│   │   └── repositories/        # Data access objects
│   ├── initialization/          # Bootstrap & Setup
│   │   ├── database.js          # DB initialization
│   │   └── cache.js             # Cache setup
│   ├── shared/                  # Shared Utilities (deprecated, use domain/shared)
│   │   └── ...
│   ├── views/                   # EJS Templates (Admin SSR)
│   │   ├── admin/               # Admin dashboard pages
│   │   ├── auth/                # Auth pages
│   │   └── emails/              # Email templates
│   ├── public/                  # Static assets
│   ├── uploads/                 # User uploads (avatars, etc.)
│   ├── logs/                    # Application logs (development)
│   ├── test-results/            # Jest test reports
│   ├── coverage/                # Test coverage reports
│   ├── __tests__/               # Legacy test fixtures
│   │   ├── fixtures/            # Mock data snapshots
│   │   ├── config/              # Test database config
│   │   └── setup.js             # Jest setup
│   ├── tests/                   # Production Test Suite
│   │   ├── unit/                # Unit tests (services, utilities)
│   │   ├── integration/         # Integration tests (API endpoints)
│   │   │   ├── identity.test.js     # Auth, profiles, accounts
│   │   │   ├── catalog.test.js      # Products, categories
│   │   │   ├── ordering.test.js     # Cart, orders
│   │   │   ├── admin.test.js        # Admin operations
│   │   │   └── health.test.js       # Health checks
│   │   ├── e2e/                 # End-to-end workflow tests
│   │   ├── security/            # Security validation tests
│   │   │   ├── authentication.test.js
│   │   │   ├── authorization.test.js
│   │   │   └── injection.test.js
│   │   ├── factories/           # Test data factories
│   │   │   ├── user.factory.js
│   │   │   ├── product.factory.js
│   │   │   └── order.factory.js
│   │   ├── helpers/             # Test utilities
│   │   │   ├── database.js      # DB setup/teardown
│   │   │   └── api.js           # API testing helpers
│   │   ├── mocks/               # Mock implementations
│   │   └── setup.js             # Test environment setup
│   ├── Dockerfile               # Multi-stage Docker build
│   ├── docker-compose.yml       # Local dev compose (server only)
│   ├── docker-compose.test.yml  # Test environment compose
│   ├── jest.config.js           # Jest testing configuration
│   ├── jest.config.prod.js      # Jest production config
│   ├── swagger.yml              # OpenAPI/Swagger specification
│   ├── package.json             # Dependencies and scripts
│   ├── .env.example             # Environment variables template
│   └── .dockerignore
│
├── data/                        # Database seeds and queries
│   ├── queries.sql              # Initial schema
│   ├── seed.sql                 # Sample data
│   └── test_queries.sql         # Test queries
│
├── docker-compose.yml           # Main orchestration (USE THIS!)
├── .dockerignore                # Root docker ignore patterns
├── README.md                    # This file
└── tailwind.config.shared.js    # Shared Tailwind configuration
```

## Design System

The frontend includes a comprehensive design system located at `client/src/styles/globals.css` with:

- **Custom Fonts**: Outfit and Sora typefaces
- **Color Tokens**: Primary, secondary, accent, and semantic colors
- **Typography**: Heading, body, and caption scales
- **Spacing**: Consistent 4px-based spacing scale
- **Components**: Reusable component patterns (cards, buttons, forms)
- **Utilities**: Tailwind CSS with custom configuration

## Backend Architecture

The backend is structured using **Domain-Driven Design (DDD)** principles, organizing code around business domains rather than technical layers. This separation promotes maintainability, clear ownership, and testability.

### Core Architecture Layers

**1. Entry Points** (`src/`)
- `index.js` - Application bootstrap, environment validation, server startup
- `app.js` - Express application configuration, middleware setup, route registration
- `setup.js` - Server initialization with health checks and graceful shutdown

**2. API Layer** (`api/`)
- **Controllers** (`controllers/`) - Request handlers for each domain/feature
  - Validates input, delegates to services, formats responses
  - Organized by domain (v1/auth-platform, v1/catalog, etc.)
- **Routes** (`routes/`) - Endpoint definitions with middleware and validators
  - Version-namespaced routes (v1/)
  - Express Router instances with middleware chains
- **Middleware** (`middleware/`) - Request/response interceptors
  - Authentication, error handling, validation, logging, metrics
  - Request context (correlation ID, timing), rate limiting
- **Validators** (`validators/`) - Request schema validation using Joi
  - Reusable validation schemas for endpoints
  - Custom error messages and transformation

**3. Domain Layer** (`domain/`)
- **Identity** - User authentication, authorization, account management
  - Entities: User, Role, Permission
  - Services: AuthService, ProfileService, AccountService
  - Repositories: UserRepository, PermissionRepository
  - Policies: Password policies, account lockout
  - Events: UserCreated, UserDeleted, PasswordReset
- **Catalog** - Product management and browsing
  - Entities: Product, Variant, Category
  - Services: ProductService, InventoryService
  - Repositories: ProductRepository, VariantRepository, CategoryRepository
- **Ordering** - Shopping cart and order management
  - Entities: Cart, CartItem, Order, OrderItem
  - Services: CartService, OrderService
  - Repositories: CartRepository, OrderRepository
  - Events: OrderCreated, OrderCancelled, OrderShipped
- **Payment** - Payment processing and transaction management
  - Entities: Payment, Transaction, PaymentMethod
  - Services: PaymentService, PaystackService, StripeService
  - Repositories: PaymentRepository
  - Events: PaymentCreated, PaymentSucceeded, PaymentFailed
- **Shipping** - Shipping calculations and carrier integration
  - Services: ShippingService, EasyshipService
  - Repositories: ShippingRepository
- **Shared** - Cross-cutting domain utilities
  - Value objects, common interfaces, shared enums

**4. Configuration** (`config/`)
- `env.js` - Environment variable validation with schema
- `db.js` - PostgreSQL connection pool setup
- `redis.js` - Redis client initialization for caching/sessions
- `auth.js` - Authentication configuration and constants
- `passport.js` - Passport.js strategy setup (JWT, local, refresh token)
- `session.js` - Express session middleware with Redis store
- `security.js` - CORS, helmet, and security headers configuration
- `permissions.js` - Role-based access control (RBAC) definitions
- `swagger.js` - OpenAPI/Swagger documentation generation

**5. Infrastructure** (`infrastructure/`)
- **Cache** - Redis-based caching layer for performance
  - Cache decorators, invalidation strategies
  - Session management integration
- **Database** - PostgreSQL access and migrations
  - Connection pooling, query builders
  - Migration runner for schema changes
- **Email** - SMTP email service with templates
  - Transactional email delivery
  - Queue-based email processing
- **Jobs** - Background job processing
  - Scheduled tasks, async operations
  - Worker processes for long-running operations
- **Logging** - Winston-based structured logging
  - Log levels (debug, info, warn, error)
  - File and console transports
- **Metrics** - Application performance monitoring
  - Request/response metrics, error tracking
  - Prometheus-compatible metrics endpoint
- **Resilience** - Fault tolerance patterns
  - Retry logic, circuit breakers
  - Timeout and bulkhead patterns
- **Security** - Security utilities
  - Encryption/decryption for sensitive data
  - Token generation and management
- **Shipping** - Third-party shipping integrations
  - Easyship carrier rates and tracking
  - Carrier-agnostic abstraction
- **Tracing** - Distributed tracing support
  - Request correlation IDs
  - Performance profiling

**6. Data Access** (`data/`)
- **Repositories** - Data Access Objects (DAOs)
  - Domain entity repository implementations
  - Query methods following domain semantics
  - Transaction management
- **Migrations** - Database schema evolution
  - Versioned migration scripts
  - Rollback support
  - Initial schema setup

**7. Testing** (`__tests__/` and `tests/`)

**Legacy Structure** (`__tests__/`)
- `fixtures/` - Test data snapshots and mock data
- `config/` - Test database setup
- `setup.js` - Jest configuration

**Production Test Suite** (`tests/`)
- **Unit Tests** - Individual function/class testing
  - Services, utilities, validators
  - Isolated with mocks
- **Integration Tests** - Domain-focused API endpoint testing
  - Identity suite: auth, profile, accounts
  - Catalog suite: products, categories, search
  - Ordering suite: cart, orders, items
  - Admin suite: user management, reporting
  - Health suite: health checks, readiness
  - Database and cache interactions
- **E2E Tests** - Complete user workflow testing
  - Authentication flows
  - Shopping and checkout processes
  - Payment processing
  - Multi-step user journeys
- **Security Tests** - Authentication and authorization
  - Access control validation
  - RBAC enforcement
  - Data protection verification
  - Injection attack prevention
- **Factories** - Deterministic test data generation
  - User factory, product factory, order factory
  - Consistent test state across test runs
- **Helpers & Mocks** - Test utilities
  - Database setup/teardown
  - API testing utilities
  - Mock external services

### Key Technologies & Patterns

- **Framework**: Express.js 5 with middleware pipeline
- **Database**: PostgreSQL with connection pooling
- **Caching**: Redis for sessions and application cache
- **Authentication**: Passport.js with JWT strategies
- **Validation**: Joi schema validation
- **Logging**: Winston structured logging
- **Testing**: Jest with supertest for API testing
- **Documentation**: Swagger/OpenAPI with swagger-ui-express
- **Error Handling**: Custom error classes and centralized error middleware
- **Concurrency**: Promise-based async/await patterns

### Request Flow

```
HTTP Request
  ↓
Express Middleware (CORS, Security, Logging, etc.)
  ↓
Request Validator (Joi schema validation)
  ↓
Passport Authentication (if required)
  ↓
API Controller (business logic orchestration)
  ↓
Domain Services (core business rules)
  ↓
Repositories (data persistence)
  ↓
PostgreSQL / Redis
  ↓
Response Formatter
  ↓
HTTP Response
```

### Database Entities

**Core Domains**
- **Users & Identity**: users, roles, permissions, email_verifications, password_reset_tokens, sessions
- **Catalog**: products, categories, variants (SKU, pricing, stock)
- **Shopping**: carts, cart_items, wishlists
- **Ordering**: orders, order_items, shipments
- **Payments**: payments, transactions, payment_methods
- **Audit Trail**: inventory_transactions, webhook_events, audit_logs

## Backend API Documentation

The backend provides a comprehensive REST API with:

- **Base URL**: `/api/v1`
- **Authentication**: JWT Bearer tokens
- **Rate Limiting**: Applied to auth and sensitive endpoints
- **Documentation**: Interactive Swagger UI at `/api-docs`

### API Endpoints Summary

**Authentication**
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - User logout
- `POST /auth/request-reset` - Request password reset
- `POST /auth/reset-password` - Reset password with token

**Products**
- `GET /products` - List all products (paginated)
- `GET /products/:id` - Get product details
- `GET /products/categories` - List categories
- `GET /products/featured` - Get featured products

**Shopping Cart**
- `GET /cart` - Get user's cart
- `POST /cart/items` - Add item to cart
- `PATCH /cart/items/:id` - Update cart item quantity
- `DELETE /cart/items/:id` - Remove item from cart
- `DELETE /cart` - Clear entire cart

**Wishlist**
- `GET /wishlist` - Get user's wishlist
- `POST /wishlist` - Add product to wishlist
- `DELETE /wishlist/:productId` - Remove from wishlist
- `GET /wishlist/check/:productId` - Check if product in wishlist

**Orders**
- `POST /orders` - Create new order from cart
- `GET /orders` - List user's orders (paginated)
- `GET /orders/:id` - Get order details
- `POST /orders/:id/cancel` - Cancel order

**User Profile**
- `GET /profile` - Get profile information
- `PUT /profile` - Update profile
- `DELETE /profile` - Delete account
- `POST /profile/change-password` - Change password

**Addresses**
- `GET /profile/addresses` - List saved addresses
- `POST /profile/addresses` - Add new address
- `PUT /profile/addresses/:id` - Update address
- `DELETE /profile/addresses/:id` - Delete address

**Payment Cards**
- `GET /profile/cards` - List saved payment cards
- `POST /profile/cards` - Add new card
- `PUT /profile/cards/:id/primary` - Set as primary
- `DELETE /profile/cards/:id` - Delete card

**Admin Routes** (Require admin role)
- `GET /admin/users` - List all users
- `PATCH /admin/users/:id/role` - Update user role
- `DELETE /admin/users/:id` - Delete user
- `GET /admin/orders` - List all orders
- `PATCH /admin/orders/:id/status` - Update order status

Complete API documentation: `http://localhost:5000/api-docs`

## Environment Variables

### Backend Server (.env)

```
# Server Configuration
PORT=5000
NODE_ENV=production
LOG_LEVEL=info

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=ecommerce_db
DB_USER=postgres
DB_PASSWORD=your_secure_password

# Redis
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=your_redis_password

# Authentication
JWT_SECRET=your_64_character_hex_key_here_0123456789abcdef
JWT_EXPIRES_IN=7d
SESSION_SECRET=your_64_character_hex_key_here_abcdef0123456789

# Application URLs
APP_URL=http://localhost:5000

# Payment Processors
PAYSTACK_PUBLIC_KEY=your_paystack_public_key
PAYSTACK_SECRET_KEY=your_paystack_secret_key
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret

# Email (SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
EMAIL_FROM=noreply@example.com

# Shipping
EASYSHIP_API_KEY=your_easyship_api_key
```

### Frontend Client (.env)

```
VITE_API_URL=http://localhost:5000
VITE_API_VERSION=v1
```

### Docker Compose Override (.env in root)

```
# Database
DB_NAME=ecommerce_db
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_PASSWORD=redis_dev_password_1234567890

# Security
JWT_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
SESSION_SECRET=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789

# Deployment
NODE_ENV=production
VITE_API_URL=http://localhost:5000
VITE_API_VERSION=v1
```

## Testing

The project includes comprehensive test coverage with Jest organized into layered test architecture:

### Test Organization

**Unit Tests** (`tests/unit/`)
- Test individual functions and utility functions
- Isolated with mocks for dependencies
- Fast execution, no database required
- Examples: validation functions, utility helpers, service methods

**Integration Tests** (`tests/integration/`)
- Test API endpoints with real database
- Organized by domain: identity, catalog, ordering, admin, health
- Database setup/teardown via factories
- Test complete request-response cycles
- Examples: user registration flow, product browse, order creation

**End-to-End Tests** (`tests/e2e/`)
- Test complete user workflows
- Multiple requests in sequence
- Full business logic validation
- Examples: register → login → browse products → add to cart → checkout

**Security Tests** (`tests/security/`)
- Validate authentication mechanisms
- Test authorization/RBAC enforcement
- Check data access restrictions
- Test injection attack prevention
- Validate sensitive data protection

**Test Factories** (`tests/factories/`)
- Generate deterministic test data
- Consistent test state across runs
- Examples: `userFactory()`, `productFactory()`, `orderFactory()`

**Test Helpers** (`tests/helpers/`)
- Database setup and seeding
- API testing utilities
- Assertion helpers
- Mock generators

### Running Tests

```bash
cd server

# Run all tests with coverage
npm test

# Run specific test suite
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only
npm run test:security      # Security tests only

# Watch mode for development
npm run test:watch

# Debug mode with verbose output
npm run test:debug

# All tests with detailed coverage report
npm run test:coverage
```

### Test Environment Setup

Tests use separate PostgreSQL and Redis instances via Docker:

```bash
# Start test database (from server directory)
docker compose -f docker-compose.test.yml up -d

# Run full test suite
npm run test:all

# Stop test services
docker compose -f docker-compose.test.yml down
```

### Writing Tests

**Unit Test Example**
```javascript
// tests/unit/validateEmail.test.js
const { validateEmail } = require('../../api/validators/auth');

describe('validateEmail', () => {
  it('should validate correct email format', () => {
    const result = validateEmail('user@example.com');
    expect(result.valid).toBe(true);
  });
});
```

**Integration Test Example**
```javascript
// tests/integration/auth.test.js
const request = require('supertest');
const { createApp } = require('../../src/app');
const { userFactory } = require('../factories/user');

describe('Auth API', () => {
  it('should register new user', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send{
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'John',
        lastName: 'Doe'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.user.email).toBe('test@example.com');
  });
});
```

Integration, E2E, and security suites require PostgreSQL test setup (`docker-compose.test.yml`).

## Security Features

- **Password Security**: Argon2 hashing with salt
- **JWT Authentication**: Access + refresh token flow
- **Email Verification**: Required for account activation
- **Account Lockout**: After repeated failed login attempts
- **Rate Limiting**: Applied to auth and payment endpoints
- **CORS Protection**: Configurable cross-origin resource sharing
- **HTTP Security Headers**: Helmet.js integration
- **Input Validation**: Joi schema validation
- **SQL Injection Prevention**: Parameterized queries (node-postgres)
- **XSS Protection**: Helmet content security policy
- **Data Encryption**: Sensitive fields encrypted in database
- **Webhook Verification**: Signature verification for payment webhooks
- **HTTPS Ready**: Supports SSL/TLS termination

## Database Schema

Key entities:
- **users** - User accounts with authentication
- **products** - Product catalog
- **variants** - Product variants with pricing/stock
- **carts** - Shopping cart management
- **cart_items** - Cart line items
- **orders** - Customer orders
- **order_items** - Order line items
- **wishlist** - User favorite products
- **payments** - Payment records with processor details
- **profile_addresses** - User saved addresses
- **profile_cards** - User saved payment cards
- **inventory_transactions** - Stock audit trail
- **webhook_events** - Idempotency ledger for webhooks

Database migrations are automatically applied on first run.

## Development

### Backend Development

The backend uses a Domain-Driven Design architecture with modular domains for maintainability.

**Setup & Prerequisites**
```bash
cd server
npm install
```

**Development Server**
```bash
# Start backend with hot-reload (nodemon)
npm run dev

# Server runs at http://localhost:5000
# API docs available at http://localhost:5000/api-docs
```

**Database Setup**
```bash
# Run migrations to initialize database schema
npm run migrate

# Rollback migrations if needed
npm run migrate:rollback
```

**Key Commands**
```bash
# Testing
npm test                  # All tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e         # End-to-end tests only
npm run test:security    # Security validation tests
npm run test:watch       # Watch mode for development
npm run test:debug       # Debug mode with detailed output

# Database
npm run migrate           # Run pending migrations
npm run migrate:initial   # Initialize database from scratch
npm run migrate:rollback  # Rollback last migration
```

**Project Structure Navigation**
- **Add API Endpoint**: Create controller in `api/controllers/v1/`, route in `api/routes/v1/`, validator in `api/validators/`, and test in `tests/integration/`
- **Add Domain Logic**: Create service in `domain/{domain}/services/`, entity in `domain/{domain}/entities/`, repository in `domain/{domain}/repositories/`
- **Add Database Table**: Create migration in `data/migrations/`, repository in `domain/{domain}/repositories/`
- **Add Email Template**: Create template in `views/emails/`, register in `infrastructure/email/templates`
- **Add Job/Worker**: Create worker in `infrastructure/jobs/`, integrate with service

**Environment Variables**

Create `.env` file in server directory (see `.env.example` for template):
```bash
# Core
PORT=5000
NODE_ENV=development
LOG_LEVEL=debug

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ecommerce_db
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d
SESSION_SECRET=your_session_secret_here

# Payment
PAYSTACK_SECRET_KEY=your_key_here
STRIPE_SECRET_KEY=your_key_here

# Email
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Shipping
EASYSHIP_API_KEY=your_key_here
```

### Frontend Development



```bash
cd client
npm install
npm run dev
```

Vite dev server starts at `http://localhost:5173` with hot module replacement.

### Code Style & Standards

**Backend Standards**
- **Architecture**: Domain-Driven Design with clear layer separation
- **Language**: ES6+, async/await, Promises
- **Error Handling**: Custom error classes, try-catch blocks, centralized error middleware
- **Validation**: Joi schemas for all input validation
- **Logging**: Use Winston logger from `infrastructure/logging`
- **Documentation**: JSDoc comments on all public methods
- **File Structure**: Organize by domain, not by file type
- **Naming**: 
  - Services: `{Entity}Service.js` (e.g., `UserService.js`)
  - Repositories: `{Entity}Repository.js` (e.g., `UserRepository.js`)
  - Controllers: Lowercase with domain name (e.g., `auth.js`)
  - Files: camelCase for JS, UPPERCASE for constants

**Backend Best Practices**
- Keep controllers thin - delegate business logic to services
- Use repositories for all database access
- Validate all inputs at API boundary
- Implement proper error handling with custom error types
- Log important events and errors with context
- Use dependency injection for testability
- Write tests alongside implementation (TDD)
- Cache frequently accessed data (in-memory or Redis)
- Use transactions for operations affecting multiple entities
- Implement proper pagination for list endpoints
- Version your API routes (`/api/v1/`)

**Configuration Best Practices**
- Load config from environment on startup
- Validate configuration schema early
- Never commit secrets in code
- Use `.env.example` for documentation
- Environment-specific configs for dev/test/prod
- Use config for feature flags and toggles

**Security Best Practices**
- Hash passwords with Argon2
- Use JWT for stateless authentication
- Implement rate limiting on public endpoints
- Validate and sanitize all inputs
- Use parameterized queries (avoid SQL injection)
- Implement RBAC for authorization
- Log security events
- Use HTTPS in production
- Implement CSRF protection for forms
- Validate file uploads

**Frontend Standards**
- React hooks, functional components, Redux patterns
- Consistent indentation and naming conventions
- Component composition for reusability
- Input validation on client and server
- Proper error handling and user feedback

### Adding Features

#### Backend (Domain-Driven Approach)

**Adding a New API Endpoint**
1. Define validation schema in `api/validators/{domain}.js`
2. Create controller method in `api/controllers/v1/{domain}.js`
3. Register route in `api/routes/v1/{domain}.js`
4. Add tests in `tests/integration/{domain}.test.js`
5. Document in `swagger.yml`

**Adding a New Domain (Complex Feature)**
1. Create domain folder: `domain/{newDomain}/`
2. Define entities in `domain/{newDomain}/entities/`
3. Create repositories in `domain/{newDomain}/repositories/`
4. Implement services in `domain/{newDomain}/services/`
5. Add events if needed in `domain/{newDomain}/events/`
6. Create API layer (controller, routes, validators)
7. Add comprehensive tests (unit, integration, e2e)
8. Update Swagger documentation

**Adding Database Changes**
1. Create migration: `npm run migrate:initial`
2. Define entities/schema in migration file
3. Create repository for data access
4. Add domain service that uses repository
5. Write integration tests
6. Document in entity comments

**Example: Adding a Review Feature**
```
domain/reviews/                 # New domain
├── entities/
│   └── Review.js              # Review entity definition
├── repositories/
│   └── ReviewRepository.js     # Data access
├── services/
│   └── ReviewService.js        # Business logic
└── events/
    └── ReviewCreated.js        # Domain events

api/controllers/v1/
└── reviews.js                  # HTTP handlers

api/routes/v1/
└── reviews.js                  # Endpoints: POST /reviews, GET /reviews/:id

api/validators/
└── reviews.js                  # Schema validation

tests/integration/
└── reviews.test.js             # Comprehensive tests
```

#### Frontend
1. Create component in `client/src/components/`
2. Add Redux slice if needed in `client/src/features/`
3. Add API client method in `client/src/api/endpoints/`
4. Create pages in `client/src/pages/` if new route needed
5. Update route in `client/src/routes/index.jsx`
6. Add Tailwind styles using utility classes

### Debugging

**Backend**
```bash
# Enable debug logging
DEBUG=* npm run dev

# VSCode debugging configuration available in .vscode/launch.json
```

**Frontend**
```bash
# Use React DevTools and Redux DevTools extensions
# Debug console: http://localhost:5173 (Vite dev server)
```

## Documentation

Comprehensive documentation available in this README covering:
- Architecture and technology stack overview
- Installation and quick start guide
- API endpoint documentation with examples
- Environment configuration reference
- Security and best practices
- Testing and development guidelines

## Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork the repository**
```bash
git clone https://github.com/yourusername/fullstack.git
cd fullstack
```

2. **Create a feature branch**
```bash
git checkout -b feature/amazing-feature
```

3. **Make changes and commit**
```bash
git add .
git commit -m "Add amazing feature: detailed description"
```

4. **Push to your fork**
```bash
git push origin feature/amazing-feature
```

5. **Open a Pull Request**
- Describe the changes clearly
- Link to related issues
- Include testing evidence
- Update documentation if needed

### Code Review Checklist
- [ ] Code follows project style guidelines
- [ ] Tests added/updated for changes
- [ ] Documentation updated
- [ ] No breaking changes (or documented breaking changes)
- [ ] Environment variables documented
- [ ] API changes reflected in Swagger/OpenAPI docs

## License

MIT License - see LICENSE file for details

## Support & Resources

- **Issues**: [GitHub Issues](https://github.com/yourusername/fullstack/issues)
- **API Docs**: Interactive docs at `http://localhost:5000/api-docs`
- **Discussions**: Open GitHub Discussions for questions

## Roadmap

Current release includes:
- [x] React 18 frontend with Tailwind CSS design system
- [x] Express.js REST API with comprehensive endpoints
- [x] JWT authentication and email verification
- [x] PostgreSQL database with migrations
- [x] Redis caching and session management
- [x] Shopping cart and order management
- [x] Multiple payment processor integration (Paystack, Stripe)
- [x] Wishlist functionality with backend/frontend integration
- [x] User profile management (addresses, payment cards)
- [x] Docker containerization with docker-compose
- [x] Comprehensive layered test suite (Jest)
- [x] Swagger/OpenAPI documentation
- [x] Admin panel (EJS-based server-side rendering)

Planned features:
- [ ] Order tracking with real-time updates
- [ ] Product reviews and rating system
- [ ] Advanced search and filtering (Elasticsearch)
- [ ] Analytics dashboard
- [ ] Multi-language internationalization (i18n)
- [ ] Mobile app (React Native)
- [ ] Inventory analytics and forecasting
- [ ] Vendor management system
- [ ] Social media integration
- [ ] AI-powered product recommendations
- [ ] Progressive Web App (PWA) support

## Performance Metrics

- **API Response Time**: < 200ms average
- **Page Load Time**: < 2 seconds (with CDN)
- **Database Query Time**: < 100ms (with indexes)
- **Test Coverage**: Enforced by Jest thresholds in CI/CD
- **Security Score**: A+ (Helmet, CORS, Rate limiting)
- **Code Quality**: ESLint: 0 errors (strict config)

---

**Last Updated**: March 2026
**Status**: Active Development

**Built by the Development Team**
