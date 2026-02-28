const {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  asyncHandler,
  handleDatabaseError,
} = require('../../utils/errors');

describe('Error Utils - Unit Tests', () => {
  describe('AppError', () => {
    it('should create an error with message and status code', () => {
      const error = new AppError('Test error', 400);
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error).toBeInstanceOf(Error);
    });

    it('should default to status code 500', () => {
      const error = new AppError('Test error');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('ValidationError', () => {
    it('should create a validation error with 400 status', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('AuthenticationError', () => {
    it('should create an authentication error with 401 status', () => {
      const error = new AuthenticationError('Invalid credentials');
      expect(error.message).toBe('Invalid credentials');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('AuthorizationError', () => {
    it('should create an authorization error with 403 status', () => {
      const error = new AuthorizationError('Access denied');
      expect(error.message).toBe('Access denied');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('NotFoundError', () => {
    it('should create a not found error with 404 status', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.message).toBe('Resource not found');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('ConflictError', () => {
    it('should create a conflict error with 409 status', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.message).toBe('Resource already exists');
      expect(error.statusCode).toBe(409);
    });
  });

  describe('asyncHandler', () => {
    it('should wrap async function and call next on error', async () => {
      const mockNext = jest.fn();
      const error = new Error('Test error');
      
      const asyncFn = async () => {
        throw error;
      };
      
      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn({}, {}, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should not call next if no error occurs', async () => {
      const mockNext = jest.fn();
      const mockRes = { json: jest.fn() };
      
      const asyncFn = async (req, res) => {
        res.json({ success: true });
      };
      
      const wrappedFn = asyncHandler(asyncFn);
      await wrappedFn({}, mockRes, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('handleDatabaseError', () => {
    it('should handle unique constraint violation (23505)', () => {
      const dbError = { code: '23505', detail: 'Key (email)=(test@test.com) already exists.' };
      const error = handleDatabaseError(dbError);
      
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toContain('already exists');
    });

    it('should handle foreign key violation (23503)', () => {
      const dbError = { code: '23503' };
      const error = handleDatabaseError(dbError);
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain('Invalid reference');
    });

    it('should handle not null violation (23502)', () => {
      const dbError = { code: '23502', column: 'email' };
      const error = handleDatabaseError(dbError);
      
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toContain('email');
    });

    it('should return AppError for unknown database errors', () => {
      const dbError = { code: 'UNKNOWN', message: 'Unknown error' };
      const error = handleDatabaseError(dbError);
      
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe('Database error occurred');
    });

    it('should handle missing code property', () => {
      const dbError = { message: 'Some error' };
      const error = handleDatabaseError(dbError);
      
      expect(error).toBeInstanceOf(AppError);
    });
  });
});
