const request = require('supertest');
const express = require('express');
const productRoutes = require('../../routes/product');
const { pool } = require('../../config/db');
const jwt = require('jsonwebtoken');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/v1/products', productRoutes);

describe('Product API - Integration Tests', () => {
  let testProductId;
  let authToken;

  beforeAll(async () => {
    // Create test user and generate token
    const userResult = await pool.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
      [`producttest${Date.now()}@test.com`, 'hashedpassword']
    );
    
    authToken = jwt.sign(
      { id: userResult.rows[0].id, email: 'producttest@test.com' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  afterAll(async () => {
    // Clean up test data
    if (testProductId) {
      await pool.query('DELETE FROM products WHERE id = $1', [testProductId]);
    }
    await pool.query("DELETE FROM users WHERE email LIKE '%producttest%'");
    await pool.query("DELETE FROM products WHERE name LIKE '%Test Product%'");
  });

  describe('GET /api/v1/products', () => {
    it('should get paginated list of products', async () => {
      const response = await request(app)
        .get('/api/v1/products')
        .expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination parameters', async () => {
      const response = await request(app)
        .get('/api/v1/products?page=1&pageSize=5')
        .expect(200);

      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.pageSize).toBe(5);
    });
  });

  describe('POST /api/v1/products', () => {
    it('should create a new product', async () => {
      const productData = {
        name: 'Test Product for API',
        brand: 'Test Brand',
        base_price: 299.99,
        description: 'A test product',
      };

      const response = await request(app)
        .post('/api/v1/products')
        .send(productData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(productData.name);
      expect(response.body.base_price).toBe(productData.base_price);
      
      testProductId = response.body.id;
    });

    it('should reject product with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/products')
        .send({ name: 'Incomplete Product' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject product with invalid price', async () => {
      const response = await request(app)
        .post('/api/v1/products')
        .send({
          name: 'Invalid Price Product',
          brand: 'Test',
          base_price: -10,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/products/:productId', () => {
    beforeAll(async () => {
      // Ensure we have a product to test with
      if (!testProductId) {
        const result = await pool.query(
          'INSERT INTO products (name, brand, base_price) VALUES ($1, $2, $3) RETURNING id',
          ['Test Product Detail', 'Brand', 99.99]
        );
        testProductId = result.rows[0].id;
      }
    });

    it('should get product by ID', async () => {
      const response = await request(app)
        .get(`/api/v1/products/${testProductId}`)
        .expect(200);

      expect(response.body.id).toBe(testProductId);
      expect(response.body).toHaveProperty('name');
      expect(response.body).toHaveProperty('base_price');
    });

    it('should return 404 for non-existent product', async () => {
      await request(app)
        .get('/api/v1/products/99999')
        .expect(404);
    });

    it('should return 400 for invalid product ID format', async () => {
      await request(app)
        .get('/api/v1/products/invalid')
        .expect(400);
    });
  });

  describe('PUT /api/v1/products/:productId', () => {
    it('should update product completely', async () => {
      const updatedData = {
        name: 'Updated Product Name',
        brand: 'Updated Brand',
        base_price: 199.99,
        description: 'Updated description',
      };

      const response = await request(app)
        .put(`/api/v1/products/${testProductId}`)
        .send(updatedData)
        .expect(200);

      expect(response.body.name).toBe(updatedData.name);
      expect(response.body.base_price).toBe(updatedData.base_price);
    });
  });

  describe('PATCH /api/v1/products/:productId', () => {
    it('should partially update product', async () => {
      const response = await request(app)
        .patch(`/api/v1/products/${testProductId}`)
        .send({ base_price: 249.99 })
        .expect(200);

      expect(response.body.base_price).toBe(249.99);
    });
  });

  describe('DELETE /api/v1/products/:productId', () => {
    it('should delete product', async () => {
      // Create a product to delete
      const result = await pool.query(
        'INSERT INTO products (name, brand, base_price) VALUES ($1, $2, $3) RETURNING id',
        ['Product To Delete', 'Brand', 99.99]
      );
      const productToDelete = result.rows[0].id;

      await request(app)
        .delete(`/api/v1/products/${productToDelete}`)
        .expect(204);

      // Verify deletion
      const checkResult = await pool.query(
        'SELECT * FROM products WHERE id = $1',
        [productToDelete]
      );
      expect(checkResult.rows.length).toBe(0);
    });

    it('should return 404 when deleting non-existent product', async () => {
      await request(app)
        .delete('/api/v1/products/99999')
        .expect(404);
    });
  });
});
