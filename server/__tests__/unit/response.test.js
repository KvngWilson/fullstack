const {
  successResponse,
  errorResponse,
  paginatedResponse,
} = require('../../utils/response');

describe('Response Utils - Unit Tests', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('successResponse', () => {
    it('should send success response with default status 200', () => {
      const data = { id: 1, name: 'Test' };
      successResponse(mockRes, data);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should send success response with custom status', () => {
      const data = { id: 1 };
      successResponse(mockRes, data, 201);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should send success response with message', () => {
      const data = { id: 1 };
      const message = 'Created successfully';
      successResponse(mockRes, data, 201, message);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        message,
      });
    });

    it('should handle null data', () => {
      successResponse(mockRes, null);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });
  });

  describe('errorResponse', () => {
    it('should send error response with default status 500', () => {
      const message = 'Internal server error';
      errorResponse(mockRes, message);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message,
        message,
      });
    });

    it('should send error response with custom status', () => {
      const message = 'Not found';
      errorResponse(mockRes, message, 404);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message,
        message,
      });
    });

    it('should include details if provided', () => {
      const message = 'Validation error';
      const details = ['Email is required', 'Password too short'];
      errorResponse(mockRes, message, 400, details);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message,
        message,
        details,
      });
    });

    it('should handle error object as message', () => {
      const error = new Error('Test error');
      errorResponse(mockRes, error);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Test error',
        message: 'Test error',
      });
    });
  });

  describe('paginatedResponse', () => {
    it('should send paginated response with all pagination info', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = {
        page: 1,
        pageSize: 20,
        total: 100,
      };

      paginatedResponse(mockRes, data, pagination);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination: {
          page: 1,
          pageSize: 20,
          total: 100,
          totalPages: 5,
          hasNext: true,
          hasPrev: false,
        },
      });
    });

    it('should calculate hasNext correctly on last page', () => {
      const data = [{ id: 1 }];
      const pagination = {
        page: 5,
        pageSize: 20,
        total: 100,
      };

      paginatedResponse(mockRes, data, pagination);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.pagination.hasNext).toBe(false);
      expect(response.pagination.hasPrev).toBe(true);
    });

    it('should handle empty data array', () => {
      const data = [];
      const pagination = {
        page: 1,
        pageSize: 20,
        total: 0,
      };

      paginatedResponse(mockRes, data, pagination);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data).toEqual([]);
      expect(response.pagination.totalPages).toBe(0);
      expect(response.pagination.hasNext).toBe(false);
    });

    it('should calculate totalPages correctly', () => {
      const data = [{ id: 1 }];
      const pagination = {
        page: 1,
        pageSize: 10,
        total: 25,
      };

      paginatedResponse(mockRes, data, pagination);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.pagination.totalPages).toBe(3);
    });
  });
});
