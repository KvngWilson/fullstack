# E-Commerce Full-Stack Application

A modern full-stack e-commerce platform built with Node.js, Express, PostgreSQL, and EJS templating.

## Features

- **Authentication & Authorization** - JWT + refresh tokens, email verification, account lockout, rate limiting
- **Product & Variants** - CRUD with variant-level pricing and stock
- **Shopping Cart** - Stock-aware cart with quantity validation
- **Order Processing** - Cart-to-order checkout with shipping address capture
- **Payments** - Paystack + Stripe checkout with idempotent webhooks
- **Shipping Integration** - Easyship rates; stores carrier/rate metadata per order
- **Inventory** - Stock deduction on payment with audit trail
- **Transactional Email** - Order confirmations, verification, password reset
- **User Dashboard** - Customer account management
- **Admin Panel** - Administrative controls (via subdomain)
- **API Documentation** - Swagger/OpenAPI docs at `/api-docs`
- **Server-Side Rendering** - EJS templates for HTML views

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js 5
- **Database**: PostgreSQL
- **Authentication**: Passport.js + JWT
- **Password Hashing**: Argon2
- **Validation**: Joi
- **API Docs**: Swagger UI

### Frontend
- **Template Engine**: EJS
- **CSS Framework**: Bootstrap 5
- **Icons**: Font Awesome 6

## Prerequisites

- Node.js >= 16.x
- PostgreSQL >= 12.x
- npm or yarn

## Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd fullstack/server
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Initialize database**
```bash
# Base schema
psql -U your_db_user -d your_db_name -f queries.sql

# Seed data (optional)
psql -U your_db_user -d your_db_name -f seed.sql
```

5. **Start the server**
```bash
# Development with auto-reload
npm run dev

# Production
npm start
```

The server will start on `http://localhost:5000`

## Project Structure

```
server/
├── config/           # Configuration files
│   ├── auth.js      # JWT middleware
│   ├── db.js        # Database connection
│   └── passport.js  # Passport strategies
├── controllers/     # Business logic
│   ├── cart.js
│   ├── orders.js
│   └── product.js
├── routes/          # API route definitions
│   ├── admin.js
│   ├── cart.js
│   ├── orders.js
│   ├── product.js
│   └── user.js
├── services/        # External service integrations
│   └── shipping.js  # Easyship integration
├── utils/           # Utility functions
│   ├── errors.js    # Custom error classes
│   ├── pagination.js
│   ├── response.js  # Response formatters
│   └── validate.js  # Validation helpers
├── views/           # EJS templates
│   ├── partials/
│   ├── 404.ejs
│   ├── about.ejs
│   ├── cart.ejs
│   ├── checkout.ejs
│   ├── dashboard.ejs
│   ├── login.ejs
│   ├── main.ejs
│   ├── product-detail.ejs
│   ├── products.ejs
│   └── register.ejs
├── public/          # Static assets
│   └── js/
│       └── main.js
├── index.js         # Main application entry
├── swagger.yml      # API documentation
└── package.json
```

## API Routes (Highlights)

### Public Routes
- `GET /` - Home page
- `GET /products` - Product listing
- `GET /product/:id` - Product details
- `GET /login` - Login page
- `GET /register` - Registration page
- `POST /api/v1/users/register` - Register new user
- `POST /api/v1/users/login` - User login

### Protected Routes (Require JWT)
- `GET /dashboard` - User dashboard
- `GET /api/v1/cart` - Get cart
- `POST /api/v1/cart/items` - Add to cart (stock validated)
- `PATCH /api/v1/cart/items/:id` - Update cart item (stock validated)
- `DELETE /api/v1/cart/items/:id` - Remove from cart
- `GET /api/v1/cart/count` - Get cart count
- `GET /api/v1/orders/my-orders` - Current user's orders (paginated)
- `GET /api/v1/orders/:id` - Get order details (owns-only unless admin)
- `POST /api/v1/orders` - Create order from cart + shipping address
- `POST /api/v1/payments` - Initialize payment (paystack | stripe)
- `GET /api/v1/payments/:id` - Payment details (owns-only)

### Admin Routes (Require Admin Role)
- Accessible via `admin.localhost` subdomain or `admin.*`
- `GET /orders` - List all orders
- `PATCH /orders/:id/status` - Update order status
- `GET /users` - List all users
- `PATCH /users/:id/role` - Update user role
- `DELETE /users/:id` - Delete user

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 5000 |
| `NODE_ENV` | Environment mode | development |
| `SESSION_SECRET` | Session secret for express-session | session-secret-key |
| `DB_USER` | PostgreSQL username | - |
| `DB_HOST` | PostgreSQL host | localhost |
| `DB_NAME` | Database name | - |
| `DB_PASSWORD` | Database password | - |
| `DB_PORT` | Database port | 5432 |
| `JWT_SECRET` | JWT signing secret | - |
| `APP_URL` | Public app base URL (used for callbacks) | http://localhost:5000 |
| `PAYSTACK_PUBLIC_KEY` | Paystack public key | - |
| `PAYSTACK_SECRET_KEY` | Paystack secret key | - |
| `STRIPE_SECRET_KEY` | Stripe secret key | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | - |
| `EASYSHIP_API_KEY` | Easyship API key | - |
| `EMAIL_HOST` | SMTP host | - |
| `EMAIL_PORT` | SMTP port | - |
| `EMAIL_USER` | SMTP username | - |
| `EMAIL_PASS` | SMTP password | - |
| `EMAIL_FROM` | From name/email for transactional mail | - |
| `REDIS_URL` | Redis connection string (optional; session store) | - |

### Payments

- `POST /api/v1/payments` supports `processor` = `paystack` (default) or `stripe`.
- Stripe webhook: `/api/v1/payments/webhook/stripe` (raw body required).
- Paystack webhook: `/api/v1/payments/webhook`.

### Email

- Order confirmation, verification, and password reset emails require SMTP variables above.

## Database Schema

Key tables:
- `users` - User accounts
- `products`, `variants` - Catalog and variant pricing/stock
- `carts`, `cart_items` - Shopping carts
- `orders`, `order_items` - Orders with shipping fields
- `payments` - Payment records
- `webhook_events` - Idempotency ledger for webhooks
- `inventory_transactions` - Inventory audit trail

## Security Features

- Password hashing with Argon2
- JWT access + refresh tokens
- Email verification flow
- Account lockout after repeated failures
- Rate limiting on auth/reset endpoints
- HTTP security headers (Helmet)
- CORS protection
- Input validation (Joi)
- SQL injection prevention (parameterized queries)
- XSS protection

## Testing

Comprehensive test suite with unit, integration, and E2E tests.

### Running Tests

```bash
# Install dependencies (including test dependencies)
npm install

# Run all tests
npm test

# Run with coverage report
npm test -- --coverage

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # End-to-end tests only

# Watch mode for development
npm run test:watch
```

### Test Coverage

The project maintains minimum coverage thresholds:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

### Test Structure

- **Unit Tests** (`__tests__/unit/`) - Test individual functions and utilities
- **Integration Tests** (`__tests__/integration/`) - Test API endpoints with database
- **E2E Tests** (`__tests__/e2e/`) - Test complete user workflows

## Development

### Running in Development Mode
```bash
npm run dev
```

### Code Style
- Use ES6+ features
- Follow async/await patterns
- Use proper error handling
- Document complex functions

### Adding New Routes
1. Create controller in `controllers/`
2. Define routes in `routes/`
3. Add route to `index.js`
4. Update Swagger docs in `swagger.yml`

## Testing

```bash
# Run tests (when implemented)
npm test
```

## API Documentation

Interactive API documentation is available at:
- Development: `http://localhost:5000/api-docs`
- Production: `https://your-domain.com/api-docs`

## Shipping Integration

The application integrates with Easyship for:
- Real-time shipping rate calculations
- Multiple courier options
- Delivery time estimates
- Address validation

Configure `EASYSHIP_API_KEY` in your `.env` file.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing documentation
- Review API docs at `/api-docs`

## Roadmap

- [x] Payment gateway integration (Paystack + Stripe)
- [x] Email notifications (verification, reset, order confirmation)
- [x] Inventory management with audit trail
- [ ] Order tracking
- [ ] Product reviews & ratings
- [ ] Wishlist functionality
- [ ] Advanced search & filters
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] Mobile app API

---

**Built with using Node.js and Express**
