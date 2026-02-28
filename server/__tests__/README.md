# Testing Documentation

## Overview
This project uses **Jest** as the testing framework with **Supertest** for API integration testing. The test suite is organized into three categories: Unit Tests, Integration Tests, and End-to-End (E2E) Tests.

## Test Structure

```
__tests__/
├── setup.js                        # Global test configuration
├── unit/                           # Unit tests for utilities and helpers
│   ├── validate.test.js           # Validation utilities
│   ├── errors.test.js             # Error handling classes
│   ├── response.test.js           # Response formatters
│   └── pagination.test.js         # Pagination helpers
├── integration/                    # API endpoint integration tests
│   ├── auth.test.js               # Authentication endpoints
│   ├── cart.test.js               # Shopping cart API
│   ├── products.test.js           # Product CRUD operations
│   └── orders.test.js             # Order management
└── e2e/                           # End-to-end workflow tests
    └── shopping-flow.test.js      # Complete user shopping journey
```

## Running Tests

### Install Dependencies
```bash
npm install
```

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm test -- --coverage
```

### Run Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# E2E tests only
npm run test:e2e
```

### Watch Mode (for development)
```bash
npm run test:watch
```

### Run Specific Test File
```bash
npm test -- __tests__/unit/validate.test.js
```

## Test Environment Setup

### Database Configuration
The tests use a separate test database to avoid affecting production data:

1. Create test database:
```sql
CREATE DATABASE ecommerce_test;
```

2. Run schema on test database:
```bash
psql -U postgres -d ecommerce_test -f queries.sql
```

3. Configure `.env.test`:
```env
NODE_ENV=test
DB_NAME=ecommerce_test
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=test-secret-key
```

## Test Categories

### Unit Tests
Test individual functions and utilities in isolation without external dependencies.

**Coverage:**
- Validation functions (email, password, registration, login)
- Error classes (AppError, ValidationError, etc.)
- Response formatters (success, error, paginated)
- Pagination helpers

**Example:**
```javascript
describe('validateEmail', () => {
  it('should return true for valid email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });
});
```

### Integration Tests
Test API endpoints with real database interactions and HTTP requests.

**Coverage:**
- User registration and authentication
- Product CRUD operations
- Shopping cart management
- Order processing

**Example:**
```javascript
describe('POST /api/v1/users/register', () => {
  it('should register a new user', async () => {
    const response = await request(app)
      .post('/api/v1/users/register')
      .send({ email: 'test@test.com', password: 'password123' })
      .expect(201);
    
    expect(response.body).toHaveProperty('token');
  });
});
```

### End-to-End Tests
Test complete user workflows from registration to checkout.

**Workflow Tested:**
1. User Registration
2. User Login
3. Browse Products
4. View Product Details
5. Add Item to Cart
6. View Cart
7. Update Cart Quantity
8. Check Cart Count
9. View Orders
10. Authentication Protection

## Coverage Thresholds

The project maintains the following minimum coverage requirements:
- Branches: 70%
- Functions: 70%
- Lines: 70%
- Statements: 70%

## Writing New Tests

### Unit Test Template
```javascript
const { functionToTest } = require('../../path/to/module');

describe('Module Name - Unit Tests', () => {
  describe('functionToTest', () => {
    it('should do something specific', () => {
      const result = functionToTest(input);
      expect(result).toBe(expected);
    });
    
    it('should handle edge cases', () => {
      expect(functionToTest(null)).toBeDefined();
    });
  });
});
```

### Integration Test Template
```javascript
const request = require('supertest');
const app = require('../../app'); // Your Express app

describe('API Endpoint - Integration Tests', () => {
  beforeAll(async () => {
    // Setup test data
  });
  
  afterAll(async () => {
    // Cleanup test data
    await pool.end();
  });
  
  it('should respond correctly', async () => {
    const response = await request(app)
      .get('/api/endpoint')
      .expect(200);
    
    expect(response.body).toMatchObject({ /* expected */ });
  });
});
```

## Best Practices

### 1. Test Isolation
- Each test should be independent
- Clean up test data in `afterEach` or `afterAll` hooks
- Don't rely on execution order

### 2. Descriptive Test Names
```javascript
// Good
it('should return 404 when product does not exist')

// Bad
it('test product endpoint')
```

### 3. Use Proper Assertions
```javascript
// Use specific matchers
expect(result).toBe(5);
expect(array).toHaveLength(3);
expect(object).toHaveProperty('key');

// Avoid vague assertions
expect(result).toBeTruthy(); // less specific
```

### 4. Mock External Services
```javascript
jest.mock('../../services/shipping', () => ({
  calculateShippingRates: jest.fn(() => Promise.resolve({
    success: true,
    rates: []
  }))
}));
```

### 5. Test Error Paths
Always test both success and failure scenarios:
```javascript
it('should handle valid input');
it('should reject invalid input');
it('should handle missing data');
it('should handle database errors');
```

## Debugging Tests

### Run Single Test
```bash
npm test -- -t "test name pattern"
```

### Show Console Output
```bash
npm test -- --verbose
```

### Debug Mode
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

## Common Issues

### Database Connection
If tests fail with connection errors:
1. Verify test database exists
2. Check `.env.test` configuration
3. Ensure PostgreSQL is running

### Port Conflicts
If server port is in use:
1. Change PORT in `.env.test`
2. Ensure no other server instance is running

### Timeout Errors
For slow tests, increase timeout:
```javascript
jest.setTimeout(10000); // 10 seconds
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:14
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
```

## Coverage Reports

After running tests with coverage:
```bash
npm test -- --coverage
```

View HTML coverage report:
```bash
open coverage/lcov-report/index.html
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://testingjavascript.com/)

## Contributing

When adding new features:
1. Write tests first (TDD approach recommended)
2. Ensure all tests pass
3. Maintain coverage thresholds
4. Document complex test scenarios
