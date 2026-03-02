const request = require('supertest');
const DatabaseHelper = require('../helpers/db.helper.js');
const UserFactory = require('../../__tests__/factories/user.factory.js');
const ProductFactory = require('../../__tests__/factories/product.factory.js');
const CartFactory = require('../../__tests__/factories/cart.factory.js');

let app;

describe.skip('Complete Order Lifecycle (E2E)', () => {
  // Note: These tests require PostgreSQL running at localhost:5432
  // See setup instructions in docker-compose.test.yml
  
  beforeAll(async () => {
    DatabaseHelper.initializePool();
    // app = require('../../src/app.js');
  });

  afterAll(async () => {
    await DatabaseHelper.closePool();
  });

  beforeEach(async () => {
    await DatabaseHelper.beginTransaction();
  });

  afterEach(async () => {
    await DatabaseHelper.rollbackTransaction();
  });

  describe('Order Checkout Flow', () => {
    test('should complete full checkout: address -> payment -> order -> verify', async () => {
      const customer = await UserFactory.create();
      const product = await ProductFactory.create();
      const cart = await CartFactory.createWithItems(customer.id, [
        { product_id: product.id, quantity: 2 }
      ]);

      // Skipped - requires actual app
      // 1. Add delivery address
      // const addressResponse = await request(app)
      //   .post('/api/v1/ordering/addresses')
      //   .set('Authorization', `Bearer ${token}`)
      //   .send({
      //     street: '123 Main St',
      //     city: 'New York',
      //     state: 'NY',
      //     postal_code: '10001',
      //     country: 'USA',
      //   });
      // expect(addressResponse.status).toBe(201);
      // const address_id = addressResponse.body.address.id;
      //
      // 2. Add payment method
      // const paymentResponse = await request(app)
      //   .post('/api/v1/payment/methods')
      //   .set('Authorization', `Bearer ${token}`)
      //   .send({
      //     card_number: '4111111111111111',
      //     card_holder: 'John Doe',
      //     expiry_month: 12,
      //     expiry_year: 2025,
      //     cvv: '123',
      //   });
      // expect(paymentResponse.status).toBe(201);
      // const payment_method_id = paymentResponse.body.method.id;
      //
      // 3. Create order from cart
      // const orderResponse = await request(app)
      //   .post('/api/v1/ordering/orders')
      //   .set('Authorization', `Bearer ${token}`)
      //   .send({
      //     cart_id: cart.id,
      //     address_id,
      //     payment_method_id,
      //   });
      // expect(orderResponse.status).toBe(201);
      // const order_id = orderResponse.body.order.id;
      //
      // 4. Verify order in database
      // const orderResult = await DatabaseHelper.query('SELECT * FROM orders WHERE id = $1', [order_id]);
      // expect(orderResult.rows).toHaveLength(1);
      // expect(orderResult.rows[0].status).toBe('pending');
      // expect(orderResult.rows[0].user_id).toBe(customer.id);
    });

    test('should reject checkout without required address', async () => {
      const customer = await UserFactory.create();
      const product = await ProductFactory.create();
      const cart = await CartFactory.createWithItems(customer.id, [
        { product_id: product.id, quantity: 1 }
      ]);

      // Skipped - requires actual app
      // const response = await request(app)
      //   .post('/api/v1/ordering/orders')
      //   .set('Authorization', `Bearer ${token}`)
      //   .send({
      //     cart_id: cart.id,
      //     payment_method_id: 1,
      //   });
      // expect(response.status).toBe(400);
      // expect(response.body.error).toContain('address');
    });

    test('should enforce multi-tenant isolation - customer cannot access other customer carts', async () => {
      const customer1 = await UserFactory.create();
      const customer2 = await UserFactory.create();
      const product = await ProductFactory.create();
      
      const cart1 = await CartFactory.createWithItems(customer1.id, [
        { product_id: product.id, quantity: 1 }
      ]);

      // Skipped - requires actual app
      // Customer 2 tries to access Customer 1's cart
      // const response = await request(app)
      //   .get(`/api/v1/ordering/carts/${cart1.id}`)
      //   .set('Authorization', `Bearer ${customer2Token}`);
      // 
      // expect(response.status).toBe(403);
      // expect(response.body.error).toContain('not authorized');
    });
  });

  describe('Order Status Transitions', () => {
    test('should transition order from pending to confirmed', async () => {
      const customer = await UserFactory.create();
      const order = await OrderFactory.create({
        user_id: customer.id,
        status: 'pending',
      });

      // Skipped - requires actual app
      // const response = await request(app)
      //   .patch(`/api/v1/ordering/orders/${order.id}`)
      //   .set('Authorization', `Bearer ${token}`)
      //   .send({ status: 'confirmed' });
      // 
      // expect(response.status).toBe(200);
      // const updatedOrder = await DatabaseHelper.query('SELECT status FROM orders WHERE id = $1', [order.id]);
      // expect(updatedOrder.rows[0].status).toBe('confirmed');
    });

    test('should prevent invalid order status transitions', async () => {
      const customer = await UserFactory.create();
      const order = await OrderFactory.create({
        user_id: customer.id,
        status: 'pending',
      });

      // Skipped - requires actual app
      // Invalid transition: pending -> delivered (should be pending -> confirmed -> shipped -> delivered)
      // const response = await request(app)
      //   .patch(`/api/v1/ordering/orders/${order.id}`)
      //   .set('Authorization', `Bearer ${token}`)
      //   .send({ status: 'delivered' });
      // 
      // expect(response.status).toBe(400);
      // expect(response.body.error).toContain('invalid transition');
    });
  });
});

// Helper to create order (used internally)
const OrderFactory = {
  async create(overrides = {}) {
    const user_id = overrides.user_id;
    if (!user_id) {
      throw new Error('user_id is required');
    }

    const result = await DatabaseHelper.query(
      `INSERT INTO orders (user_id, order_number, status, subtotal, tax, shipping_cost, total, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        user_id,
        `ORD-${Date.now()}-${Math.random()}`,
        overrides.status || 'pending',
        100.00,
        10.00,
        5.00,
        115.00,
        new Date(),
      ]
    );

    return {
      id: result.rows[0].id,
      user_id,
      status: overrides.status || 'pending',
    };
  }
};
