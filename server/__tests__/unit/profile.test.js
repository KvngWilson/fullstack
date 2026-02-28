/**
 * Profile API Unit Tests
 * Tests profile controller functions with mocked dependencies
 */

const {
  getProfile,
  updateProfile,
  changePassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  getSavedCards,
  addSavedCard,
  setPrimaryCard,
  deleteSavedCard,
} = require('../../api/controllers/profile');

// Mock dependencies
jest.mock('../../config/db', () => ({
  pool: {
    query: jest.fn(),
  },
}));
jest.mock('argon2');

const { pool } = require('../../config/db');
const argon2 = require('argon2');

describe('Profile Controller - Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 1, email: 'test@test.com', role: 'customer' },
      body: {},
      params: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('getProfile', () => {
    it('should return user profile successfully', async () => {
      const mockUser = {
        id: 1,
        email: 'test@test.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'customer',
        created_at: new Date(),
        last_login: new Date(),
      };

      pool.query = jest.fn().mockResolvedValue({
        rows: [mockUser],
      });

      await getProfile(req, res);

      expect(pool.query).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockUser,
        })
      );
    });

    it('should return 404 if user not found', async () => {
      pool.query = jest.fn().mockResolvedValue({ rows: [] });

      await getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should handle database errors', async () => {
      pool.query = jest.fn().mockRejectedValue(new Error('DB Error'));

      await getProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateProfile', () => {
    it('should update profile successfully', async () => {
      req.body = { first_name: 'Jane', last_name: 'Smith' };

      const mockUpdatedUser = {
        id: 1,
        email: 'test@test.com',
        first_name: 'Jane',
        last_name: 'Smith',
        role: 'customer',
        updated_at: new Date(),
      };

      pool.query = jest.fn().mockResolvedValue({
        rows: [mockUpdatedUser],
      });

      await updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            first_name: 'Jane',
            last_name: 'Smith',
          }),
        })
      );
    });

    it('should reject update with no fields', async () => {
      req.body = {};

      await updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('required'),
        })
      );
    });

    it('should reject duplicate email', async () => {
      req.body = { email: 'existing@test.com' };

      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ id: 2 }] }); // Email check returns existing user

      await updateProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('already in use'),
        })
      );
    });
  });

  describe('changePassword', () => {
    it('should change password with valid credentials', async () => {
      req.body = {
        current_password: 'oldpass123',
        new_password: 'newpass456',
      };

      pool.query = jest
        .fn()
        .mockResolvedValueOnce({ rows: [{ password_hash: 'hashed_old' }] })
        .mockResolvedValueOnce({ rows: [] }); // Update query

      argon2.verify = jest.fn().mockResolvedValue(true);
      argon2.hash = jest.fn().mockResolvedValue('hashed_new');

      await changePassword(req, res);

      expect(argon2.verify).toHaveBeenCalledWith('hashed_old', 'oldpass123');
      expect(argon2.hash).toHaveBeenCalledWith('newpass456');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should reject incorrect current password', async () => {
      req.body = {
        current_password: 'wrongpass',
        new_password: 'newpass456',
      };

      pool.query = jest.fn().mockResolvedValue({
        rows: [{ password_hash: 'hashed_old' }],
      });

      argon2.verify = jest.fn().mockResolvedValue(false);

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('incorrect'),
        })
      );
    });

    it('should validate password length', async () => {
      req.body = {
        current_password: 'oldpass',
        new_password: 'short',
      };

      await changePassword(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('8 characters'),
        })
      );
    });
  });

  describe('Address Management', () => {
    describe('getAddresses', () => {
      it('should return all user addresses', async () => {
        const mockAddresses = [
          {
            id: 1,
            type: 'shipping',
            street: '123 Test St',
            city: 'Test City',
            postal_code: '12345',
            country: 'US',
            is_primary: true,
          },
        ];

        pool.query = jest.fn().mockResolvedValue({ rows: mockAddresses });

        await getAddresses(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: mockAddresses,
          })
        );
      });
    });

    describe('addAddress', () => {
      it('should add address successfully', async () => {
        req.body = {
          type: 'shipping',
          street: '123 Test St',
          city: 'Test City',
          postal_code: '12345',
          country: 'US',
          is_primary: true,
        };

        const mockClient = {
          query: jest
            .fn()
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({}) // UPDATE primary
            .mockResolvedValueOnce({ rows: [{ id: 1, ...req.body }] }) // INSERT
            .mockResolvedValueOnce({}), // COMMIT
          release: jest.fn(),
        };

        pool.connect = jest.fn().mockResolvedValue(mockClient);

        await addAddress(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              street: '123 Test St',
            }),
          })
        );
        expect(mockClient.release).toHaveBeenCalled();
      });

      it('should validate required fields', async () => {
        req.body = { street: '123 Test St' }; // Missing other fields

        await addAddress(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should validate address type', async () => {
        req.body = {
          type: 'invalid',
          street: '123 Test St',
          city: 'Test City',
          postal_code: '12345',
          country: 'US',
        };

        await addAddress(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('shipping" or "billing'),
          })
        );
      });
    });

    describe('deleteAddress', () => {
      it('should delete address successfully', async () => {
        req.params.addressId = '1';

        pool.query = jest.fn().mockResolvedValue({ rows: [{ id: 1 }] });

        await deleteAddress(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should return 404 if address not found', async () => {
        req.params.addressId = '999';

        pool.query = jest.fn().mockResolvedValue({ rows: [] });

        await deleteAddress(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
      });
    });
  });

  describe('Saved Cards Management', () => {
    describe('getSavedCards', () => {
      it('should return all saved cards without sensitive data', async () => {
        const mockCards = [
          {
            id: 1,
            card_brand: 'Visa',
            last_four: '4242',
            exp_month: 12,
            exp_year: 2026,
            is_primary: true,
            created_at: new Date(),
          },
        ];

        pool.query = jest.fn().mockResolvedValue({ rows: mockCards });

        await getSavedCards(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: mockCards,
          })
        );
      });
    });

    describe('addSavedCard', () => {
      it('should add card successfully', async () => {
        req.body = {
          card_brand: 'Visa',
          last_four: '4242',
          exp_month: 12,
          exp_year: 2026,
          card_token: 'tok_test',
          authorization_code: 'auth_test',
          is_primary: true,
        };

        const mockClient = {
          query: jest
            .fn()
            .mockResolvedValueOnce({}) // BEGIN
            .mockResolvedValueOnce({}) // UPDATE primary
            .mockResolvedValueOnce({
              rows: [
                {
                  id: 1,
                  card_brand: 'Visa',
                  last_four: '4242',
                  exp_month: 12,
                  exp_year: 2026,
                  is_primary: true,
                  created_at: new Date(),
                },
              ],
            }) // INSERT
            .mockResolvedValueOnce({}), // COMMIT
          release: jest.fn(),
        };

        pool.connect = jest.fn().mockResolvedValue(mockClient);

        await addSavedCard(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            data: expect.objectContaining({
              last_four: '4242',
            }),
          })
        );
      });

      it('should validate required fields', async () => {
        req.body = { card_brand: 'Visa' };

        await addSavedCard(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
      });

      it('should validate exp_month range', async () => {
        req.body = {
          last_four: '4242',
          exp_month: 13,
          exp_year: 2026,
          card_token: 'tok_test',
        };

        await addSavedCard(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('between 1 and 12'),
          })
        );
      });

      it('should validate last_four length', async () => {
        req.body = {
          last_four: '12',
          exp_month: 12,
          exp_year: 2026,
          card_token: 'tok_test',
        };

        await addSavedCard(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('exactly 4 digits'),
          })
        );
      });
    });

    describe('deleteSavedCard', () => {
      it('should delete card successfully', async () => {
        req.params.cardId = '1';

        pool.query = jest.fn().mockResolvedValue({ rows: [{ id: 1 }] });

        await deleteSavedCard(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
      });

      it('should return 404 if card not found', async () => {
        req.params.cardId = '999';

        pool.query = jest.fn().mockResolvedValue({ rows: [] });

        await deleteSavedCard(req, res);

        expect(res.status).toHaveBeenCalledWith(404);
      });
    });
  });
});
