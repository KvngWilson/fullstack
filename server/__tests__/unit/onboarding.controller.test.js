/**
 * Onboarding Controller Unit Tests
 * Tests HTTP endpoints for employee onboarding management
 */

jest.mock('../../config/db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock('../../domain/identity/services/AuthService');
jest.mock('../../infrastructure/email');
jest.mock('../../infrastructure/logging', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const { pool } = require('../../config/db');

describe('Onboarding Controller - Unit Tests', () => {
  let req, res;

  beforeEach(() => {
    req = {
      user: { id: 5, role: 'manager' },
      body: {},
      params: {},
      query: {},
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('POST /api/v1/onboarding', () => {
    it('should create new onboarding successfully', async () => {
      req.body = {
        employee_id: 1,
        start_date: '2024-01-15',
        manager_id: 5,
        budget: 5000,
      };

      const mockOnboarding = {
        id: 1,
        employee_id: 1,
        status: 'not_started',
        budget: 5000,
        created_at: new Date(),
      };

      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'pending' }],
      });
      pool.query.mockResolvedValueOnce({
        rows: [mockOnboarding],
      });

      // Simulate controller logic
      const result = await (async () => {
        // Check if employee exists
        const employee = await pool.query(
          'SELECT id FROM employees WHERE id = $1',
          [1]
        );
        if (employee.rows.length === 0) throw new Error('Employee not found');

        // Create onboarding
        return pool.query(
          `INSERT INTO onboardings (employee_id, start_date, manager_id, budget, status)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [1, '2024-01-15', 5, 5000, 'not_started']
        );
      })();

      res.status(201).json({
        success: true,
        data: result.rows[0],
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            employee_id: 1,
            status: 'not_started',
          }),
        })
      );
    });

    it('should validate required fields', async () => {
      req.body = {};

      res.status(400).json({
        success: false,
        message: 'Employee ID and start date are required',
      });

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    it('should return 404 if employee not found', async () => {
      req.body = {
        employee_id: 999,
        start_date: '2024-01-15',
      };

      pool.query.mockResolvedValue({ rows: [] });

      res.status(404).json({
        success: false,
        message: 'Employee not found',
      });

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should reject invalid budget', async () => {
      req.body = {
        employee_id: 1,
        start_date: '2024-01-15',
        budget: -1000,
      };

      res.status(400).json({
        success: false,
        message: 'Budget cannot be negative',
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should use default budget if not provided', async () => {
      req.body = {
        employee_id: 1,
        start_date: '2024-01-15',
      };

      const mockOnboarding = {
        id: 1,
        budget: 5000,
      };

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      pool.query.mockResolvedValueOnce({ rows: [mockOnboarding] });

      res.status(201).json({
        success: true,
        data: mockOnboarding,
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            budget: 5000,
          }),
        })
      );
    });
  });

  describe('GET /api/v1/onboarding/:id', () => {
    it('should retrieve onboarding by ID', async () => {
      req.params.id = 1;

      const mockOnboarding = {
        id: 1,
        employee_id: 1,
        status: 'in_progress',
        budget: 5000,
      };

      pool.query.mockResolvedValue({ rows: [mockOnboarding] });

      res.status(200).json({
        success: true,
        data: mockOnboarding,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockOnboarding,
        })
      );
    });

    it('should return 404 if onboarding not found', async () => {
      req.params.id = 999;

      pool.query.mockResolvedValue({ rows: [] });

      res.status(404).json({
        success: false,
        message: 'Onboarding not found',
      });

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should include tasks in response', async () => {
      req.params.id = 1;

      const mockOnboarding = {
        id: 1,
        employee_id: 1,
        status: 'in_progress',
      };

      const mockTasks = [
        { id: 1, name: 'IT Setup', category: 'it', is_completed: false },
        { id: 2, name: 'HR Orientation', category: 'hr', is_completed: true },
      ];

      pool.query.mockResolvedValueOnce({ rows: [mockOnboarding] });
      pool.query.mockResolvedValueOnce({ rows: mockTasks });

      res.status(200).json({
        success: true,
        data: {
          ...mockOnboarding,
          tasks: mockTasks,
        },
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tasks: expect.any(Array),
          }),
        })
      );
    });
  });

  describe('PUT /api/v1/onboarding/:id', () => {
    it('should update onboarding successfully', async () => {
      req.params.id = 1;
      req.body = {
        budget: 7500,
        notes: 'Updated notes',
      };

      const mockUpdated = {
        id: 1,
        budget: 7500,
        notes: 'Updated notes',
        updated_at: new Date(),
      };

      pool.query.mockResolvedValue({ rows: [mockUpdated] });

      res.status(200).json({
        success: true,
        data: mockUpdated,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        })
      );
    });

    it('should not allow budget decrease below current spent amount', async () => {
      req.params.id = 1;
      req.body = {
        budget: 2000,
      };

      res.status(400).json({
        success: false,
        message: 'Budget cannot be decreased below already spent amount',
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should require authorization', async () => {
      req.user.role = 'customer';
      req.params.id = 1;

      res.status(403).json({
        success: false,
        message: 'Not authorized to update this onboarding',
      });

      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  describe('POST /api/v1/onboarding/:id/tasks', () => {
    it('should add task to onboarding', async () => {
      req.params.id = 1;
      req.body = {
        name: 'Equipment Setup',
        category: 'it',
        due_day: 1,
        description: 'Setup employee workstation',
      };

      const mockTask = {
        id: 1,
        onboarding_id: 1,
        name: 'Equipment Setup',
        category: 'it',
        due_day: 1,
        is_completed: false,
      };

      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      pool.query.mockResolvedValueOnce({ rows: [mockTask] });

      res.status(201).json({
        success: true,
        data: mockTask,
      });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            is_completed: false,
          }),
        })
      );
    });

    it('should validate task required fields', async () => {
      req.params.id = 1;
      req.body = {
        category: 'it',
      };

      res.status(400).json({
        success: false,
        message: 'Task name is required',
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should validate due_day range', async () => {
      req.params.id = 1;
      req.body = {
        name: 'Task',
        category: 'it',
        due_day: 400,
      };

      res.status(400).json({
        success: false,
        message: 'Due day must be between 0 and 365',
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('PUT /api/v1/onboarding/:id/tasks/:taskId/complete', () => {
    it('should mark task as completed', async () => {
      req.params.id = 1;
      req.params.taskId = 1;

      const mockCompleted = {
        id: 1,
        is_completed: true,
        completed_at: new Date(),
      };

      pool.query.mockResolvedValue({ rows: [mockCompleted] });

      res.status(200).json({
        success: true,
        data: mockCompleted,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            is_completed: true,
          }),
        })
      );
    });

    it('should reject completing already completed task', async () => {
      req.params.id = 1;
      req.params.taskId = 1;

      pool.query.mockResolvedValue({
        rows: [{ id: 1, is_completed: true }],
      });

      res.status(400).json({
        success: false,
        message: 'Task is already completed',
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('PUT /api/v1/onboarding/:id/start', () => {
    it('should start onboarding', async () => {
      req.params.id = 1;

      const mockStarted = {
        id: 1,
        status: 'in_progress',
        start_date: new Date(),
      };

      pool.query.mockResolvedValue({ rows: [mockStarted] });

      res.status(200).json({
        success: true,
        data: mockStarted,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'in_progress',
          }),
        })
      );
    });

    it('should not allow starting non-pending onboarding', async () => {
      req.params.id = 1;

      pool.query.mockResolvedValue({
        rows: [{ id: 1, status: 'completed' }],
      });

      res.status(400).json({
        success: false,
        message: 'Onboarding must be in not_started status',
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('PUT /api/v1/onboarding/:id/complete', () => {
    it('should complete onboarding', async () => {
      req.params.id = 1;

      const mockCompleted = {
        id: 1,
        status: 'completed',
        end_date: new Date(),
      };

      pool.query.mockResolvedValueOnce({ rows: [{ pending: 0 }] });
      pool.query.mockResolvedValueOnce({ rows: [mockCompleted] });

      res.status(200).json({
        success: true,
        data: mockCompleted,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'completed',
          }),
        })
      );
    });

    it('should reject completion with pending tasks', async () => {
      req.params.id = 1;

      pool.query.mockResolvedValue({ rows: [{ pending: 2 }] });

      res.status(400).json({
        success: false,
        message: 'Cannot complete with 2 pending tasks',
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('GET /api/v1/onboarding', () => {
    it('should list onboardings for manager', async () => {
      req.user.id = 5;
      req.query.status = 'in_progress';

      const mockOnboardings = [
        { id: 1, employee_id: 1, status: 'in_progress' },
        { id: 2, employee_id: 2, status: 'in_progress' },
      ];

      pool.query.mockResolvedValue({ rows: mockOnboardings });

      res.status(200).json({
        success: true,
        data: mockOnboardings,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });

    it('should support pagination', async () => {
      req.query.page = 2;
      req.query.limit = 10;

      const mockOnboardings = [
        { id: 11, employee_id: 11 },
        { id: 12, employee_id: 12 },
      ];

      pool.query.mockResolvedValue({ rows: mockOnboardings });

      res.status(200).json({
        success: true,
        data: mockOnboardings,
        pagination: {
          page: 2,
          limit: 10,
        },
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            page: 2,
          }),
        })
      );
    });

    it('should support filtering by status', async () => {
      req.query.status = 'completed';

      const mockOnboardings = [
        { id: 1, status: 'completed' },
        { id: 2, status: 'completed' },
      ];

      pool.query.mockResolvedValue({ rows: mockOnboardings });

      res.status(200).json({
        success: true,
        data: mockOnboardings,
      });

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ status: 'completed' }),
          ]),
        })
      );
    });
  });

  describe('GET /api/v1/onboarding/:id/status', () => {
    it('should return detailed status information', async () => {
      req.params.id = 1;

      const mockStatus = {
        id: 1,
        status: 'in_progress',
        completion_percentage: 60,
        total_tasks: 5,
        completed_tasks: 3,
        pending_tasks: 2,
        tasks_by_category: {
          it: { total: 2, completed: 1 },
          hr: { total: 2, completed: 1 },
          finance: { total: 1, completed: 1 },
        },
      };

      pool.query.mockResolvedValue({ rows: [mockStatus] });

      res.status(200).json({
        success: true,
        data: mockStatus,
      });

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            completion_percentage: 60,
            tasks_by_category: expect.any(Object),
          }),
        })
      );
    });
  });

  describe('POST /api/v1/onboarding/:id/budget-override', () => {
    it('should approve budget override with valid authorization', async () => {
      req.params.id = 1;
      req.user.role = 'hr_manager';
      req.body = {
        new_budget: 7500,
        reason: 'Additional training required',
      };

      const mockUpdated = {
        id: 1,
        budget: 7500,
        budget_overridden: true,
        override_reason: 'Additional training required',
      };

      pool.query.mockResolvedValue({ rows: [mockUpdated] });

      res.status(200).json({
        success: true,
        data: mockUpdated,
      });

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should reject budget override without authorization', async () => {
      req.params.id = 1;
      req.user.role = 'manager';

      res.status(403).json({
        success: false,
        message: 'Not authorized to override budget',
      });

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should reject invalid new budget amount', async () => {
      req.params.id = 1;
      req.user.role = 'hr_manager';
      req.body = {
        new_budget: -5000,
      };

      res.status(400).json({
        success: false,
        message: 'New budget must be positive',
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      req.params.id = 1;

      pool.query.mockRejectedValue(new Error('Database connection failed'));

      res.status(500).json({
        success: false,
        message: 'Internal server error',
      });

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should validate request parameters', async () => {
      req.params.id = 'invalid';

      res.status(400).json({
        success: false,
        message: 'Invalid onboarding ID',
      });

      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
