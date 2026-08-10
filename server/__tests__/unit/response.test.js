const {
  successResponse,
  errorResponse,
  paginatedResponse,
} = require('../../shared/utils/response');

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
      successResponse(mockRes, { data });

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should send success response with custom status', () => {
      const data = { id: 1 };
      successResponse(mockRes, { data, status: 201 });

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
      });
    });

    it('should send success response with message', () => {
      const data = { id: 1 };
      const message = 'Created successfully';
      successResponse(mockRes, { data, message, status: 201 });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        message,
      });
    });

    it('should handle null data', () => {
      successResponse(mockRes, { data: null });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: null,
      });
    });
  });

  describe('errorResponse', () => {
    it('should send error response with default status 500', () => {
      const message = 'Internal server error';
      errorResponse(mockRes, { message });

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message,
        message,
      });
    });

    it('should send error response with custom status', () => {
      const message = 'Not found';
      errorResponse(mockRes, { message, status: 404 });

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
      errorResponse(mockRes, { message, status: 400, details });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: message,
        message,
        details,
      });
    });

    it('should handle error object as message', () => {
      const error = new Error('Test error');
      errorResponse(mockRes, { message: error });

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

      paginatedResponse(mockRes, {
        data,
        page: 1,
        pageSize: 20,
        total: 100,
      });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data,
        meta: {
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

      paginatedResponse(mockRes, {
        data,
        page: 5,
        pageSize: 20,
        total: 100,
      });

      const response = mockRes.json.mock.calls[0][0];
      expect(response.meta.hasNext).toBe(false);
      expect(response.meta.hasPrev).toBe(true);
    });

    it('should handle empty data array', () => {
      const data = [];

      paginatedResponse(mockRes, {
        data,
        page: 1,
        pageSize: 20,
        total: 0,
      });

      const response = mockRes.json.mock.calls[0][0];
      expect(response.data).toEqual([]);
      expect(response.meta.totalPages).toBe(0);
      expect(response.meta.hasNext).toBe(false);
    });

    it('should calculate totalPages correctly', () => {
      const data = [{ id: 1 }];

      paginatedResponse(mockRes, {
        data,
        page: 1,
        pageSize: 10,
        total: 25,
      });

      const response = mockRes.json.mock.calls[0][0];
      expect(response.meta.totalPages).toBe(3);
    });
  });
});
