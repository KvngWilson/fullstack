const request = require('supertest');
const { createApp } = require('../../src/app');
const pool = require('../../config/db');
const jwt = require('jsonwebtoken');
const argon2 = require('argon2');

describe('Profile API - Integration Tests', () => {
  const runId = Date.now();
  const baseProfileEmail = `profile-${runId}@test.com`;
  let authToken;
  let userId;

  beforeAll(async () => {
    // Create test user
    const hashedPassword = await argon2.hash('testpassword123');
    const userResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [`profileuser-${runId}`, baseProfileEmail, hashedPassword, 'John', 'Doe', 'customer']
    );
    userId = userResult.rows[0].id;

    // Generate JWT token
    authToken = jwt.sign(
      { id: userId, email: baseProfileEmail, role: 'customer' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '24h' }
    );
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    await pool.query('DELETE FROM saved_cards WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM addresses WHERE user_id = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  });

  describe('GET /api/v1/profile', () => {
    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(baseProfileEmail);
      expect(response.body.data.first_name).toBe('John');
      expect(response.body.data.last_name).toBe('Doe');
      expect(response.body.data).not.toHaveProperty('password_hash');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/profile')
        .expect(401);
    });
  });

  describe('PUT /api/v1/profile', () => {
    it('should update user profile', async () => {
      const response = await request(app)
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          first_name: 'Jane',
          last_name: 'Smith',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.first_name).toBe('Jane');
      expect(response.body.data.last_name).toBe('Smith');
    });

    it('should update email if not taken', async () => {
      const updatedEmail = `newemail-${runId}@test.com`;

      const response = await request(app)
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: updatedEmail,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(updatedEmail);

      // Revert for other tests
      await pool.query('UPDATE users SET email = $1 WHERE id = $2', [baseProfileEmail, userId]);
    });

    it('should reject duplicate email', async () => {
      const duplicateEmail = `other-${runId}@test.com`;

      // Create another user
      const otherUser = await pool.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [`otheruser-${runId}`, duplicateEmail, 'hash', 'customer']
      );

      const response = await request(app)
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: duplicateEmail,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already in use');

      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [otherUser.rows[0].id]);
    });

    it('should require at least one field', async () => {
      const response = await request(app)
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/profile/change-password', () => {
    it('should change password with correct current password', async () => {
      const response = await request(app)
        .post('/api/v1/profile/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          current_password: 'testpassword123',
          new_password: 'newpassword456',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Password changed');

      // Verify new password works
      const userResult = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
      const isValid = await argon2.verify(userResult.rows[0].password_hash, 'newpassword456');
      expect(isValid).toBe(true);

      // Reset password for other tests
      const originalHash = await argon2.hash('testpassword123');
      await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [originalHash, userId]);
    });

    it('should reject incorrect current password', async () => {
      const response = await request(app)
        .post('/api/v1/profile/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          current_password: 'wrongpassword',
          new_password: 'newpassword456',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('incorrect');
    });

    it('should require password length >= 8', async () => {
      const response = await request(app)
        .post('/api/v1/profile/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          current_password: 'testpassword123',
          new_password: 'short',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Address Management', () => {
    let addressId;

    describe('POST /api/v1/profile/addresses', () => {
      it('should add shipping address', async () => {
        const response = await request(app)
          .post('/api/v1/profile/addresses')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'shipping',
            street: '123 Test St',
            city: 'Test City',
            state: 'TC',
            postal_code: '12345',
            country: 'US',
            is_primary: true,
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.street).toBe('123 Test St');
        expect(response.body.data.is_primary).toBe(true);
        addressId = response.body.data.id;
      });

      it('should require type, street, city, postal_code, and country', async () => {
        const response = await request(app)
          .post('/api/v1/profile/addresses')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            street: '456 Test Ave',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should validate address type', async () => {
        const response = await request(app)
          .post('/api/v1/profile/addresses')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'invalid',
            street: '789 Test Blvd',
            city: 'Test City',
            postal_code: '12345',
            country: 'US',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('shipping" or "billing');
      });
    });

    describe('GET /api/v1/profile/addresses', () => {
      it('should get all user addresses', async () => {
        const response = await request(app)
          .get('/api/v1/profile/addresses')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0].street).toBe('123 Test St');
      });
    });

    describe('PUT /api/v1/profile/addresses/:addressId', () => {
      it('should update address', async () => {
        const response = await request(app)
          .put(`/api/v1/profile/addresses/${addressId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            street: '456 Updated St',
            city: 'New City',
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.street).toBe('456 Updated St');
        expect(response.body.data.city).toBe('New City');
      });

      it('should return 404 for non-existent address', async () => {
        const response = await request(app)
          .put('/api/v1/profile/addresses/999999')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            street: 'Test',
          })
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/v1/profile/addresses/:addressId', () => {
      it('should delete address', async () => {
        const response = await request(app)
          .delete(`/api/v1/profile/addresses/${addressId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify deleted
        const checkResponse = await request(app)
          .get('/api/v1/profile/addresses')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const deletedAddress = checkResponse.body.data.find(addr => addr.id === addressId);
        expect(deletedAddress).toBeUndefined();
      });

      it('should return 404 for non-existent address', async () => {
        const response = await request(app)
          .delete('/api/v1/profile/addresses/999999')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Saved Cards Management', () => {
    let cardId;

    describe('POST /api/v1/profile/cards', () => {
      it('should add saved card', async () => {
        const response = await request(app)
          .post('/api/v1/profile/cards')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            card_brand: 'Visa',
            last_four: '4242',
            exp_month: 12,
            exp_year: 2026,
            card_token: 'tok_test_visa_4242',
            authorization_code: 'auth_test_123',
            is_primary: true,
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.last_four).toBe('4242');
        expect(response.body.data.card_brand).toBe('Visa');
        expect(response.body.data.is_primary).toBe(true);
        expect(response.body.data).not.toHaveProperty('card_token');
        cardId = response.body.data.id;
      });

      it('should require last_four, exp_month, exp_year, and card_token', async () => {
        const response = await request(app)
          .post('/api/v1/profile/cards')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            card_brand: 'Mastercard',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should validate exp_month range', async () => {
        const response = await request(app)
          .post('/api/v1/profile/cards')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            last_four: '5555',
            exp_month: 13,
            exp_year: 2026,
            card_token: 'tok_test',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should validate last_four length', async () => {
        const response = await request(app)
          .post('/api/v1/profile/cards')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            last_four: '12',
            exp_month: 12,
            exp_year: 2026,
            card_token: 'tok_test',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/v1/profile/cards', () => {
      it('should get all saved cards', async () => {
        const response = await request(app)
          .get('/api/v1/profile/cards')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);
        expect(response.body.data[0]).not.toHaveProperty('card_token');
        expect(response.body.data[0]).not.toHaveProperty('authorization_code');
      });
    });

    describe('PUT /api/v1/profile/cards/:cardId/primary', () => {
      it('should set card as primary', async () => {
        // Add another card first
        const card2Response = await request(app)
          .post('/api/v1/profile/cards')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            card_brand: 'Mastercard',
            last_four: '5555',
            exp_month: 11,
            exp_year: 2027,
            card_token: 'tok_test_mc_5555',
            is_primary: false,
          })
          .expect(201);

        const card2Id = card2Response.body.data.id;

        // Set second card as primary
        const response = await request(app)
          .put(`/api/v1/profile/cards/${card2Id}/primary`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.is_primary).toBe(true);

        // Verify first card is no longer primary
        const allCardsResponse = await request(app)
          .get('/api/v1/profile/cards')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const firstCard = allCardsResponse.body.data.find(c => c.id === cardId);
        expect(firstCard.is_primary).toBe(false);

        // Cleanup
        await pool.query('DELETE FROM saved_cards WHERE id = $1', [card2Id]);
      });

      it('should return 404 for non-existent card', async () => {
        const response = await request(app)
          .put('/api/v1/profile/cards/999999/primary')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/v1/profile/cards/:cardId', () => {
      it('should delete saved card', async () => {
        const response = await request(app)
          .delete(`/api/v1/profile/cards/${cardId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify deleted
        const checkResponse = await request(app)
          .get('/api/v1/profile/cards')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const deletedCard = checkResponse.body.data.find(card => card.id === cardId);
        expect(deletedCard).toBeUndefined();
      });

      it('should return 404 for non-existent card', async () => {
        const response = await request(app)
          .delete('/api/v1/profile/cards/999999')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('DELETE /api/v1/profile', () => {
    it('should require password', async () => {
      const response = await request(app)
        .delete('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should reject incorrect password', async () => {
      const response = await request(app)
        .delete('/api/v1/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    // Note: We don't actually test account deletion in the test suite
    // as it would delete the user and break other tests
  });
});
