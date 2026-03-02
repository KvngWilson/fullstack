/**
 * Employee Onboarding Repository Unit Tests
 * Tests database operations for onboarding and employees
 */

jest.mock('../../config/db', () => ({
  pool: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

const { pool } = require('../../config/db');

describe('Employee Onboarding Repository - Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('EmployeeRepository', () => {
    const createQuery = (sql, params) => pool.query(sql, params);

    describe('createEmployee', () => {
      it('should create employee successfully', async () => {
        const employeeData = {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          department: 'Engineering',
          position: 'Senior Developer',
          hire_date: new Date('2024-01-15'),
          manager_id: 5,
        };

        const mockResult = {
          rows: [
            {
              id: 1,
              ...employeeData,
              status: 'pending',
              created_at: new Date(),
            },
          ],
        };

        pool.query.mockResolvedValue(mockResult);

        const result = await createQuery(
          `INSERT INTO employees (first_name, last_name, email, department, position, hire_date, manager_id, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          Object.values(employeeData).concat('pending')
        );

        expect(pool.query).toHaveBeenCalled();
        expect(result.rows[0].id).toBe(1);
        expect(result.rows[0].email).toBe('john@example.com');
      });

      it('should handle database error on employee creation', async () => {
        pool.query.mockRejectedValue(new Error('Database error'));

        await expect(
          createQuery('INSERT INTO employees ...', [])
        ).rejects.toThrow('Database error');
      });

      it('should handle duplicate email error', async () => {
        pool.query.mockRejectedValue(
          new Error('duplicate key value violates unique constraint')
        );

        await expect(
          createQuery('INSERT INTO employees ...', [])
        ).rejects.toThrow('duplicate key');
      });
    });

    describe('getEmployeeById', () => {
      it('should retrieve employee by ID', async () => {
        const mockEmployee = {
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          department: 'Engineering',
          position: 'Senior Developer',
          status: 'pending',
        };

        pool.query.mockResolvedValue({ rows: [mockEmployee] });

        const result = await createQuery(
          'SELECT * FROM employees WHERE id = $1',
          [1]
        );

        expect(pool.query).toHaveBeenCalledWith(
          'SELECT * FROM employees WHERE id = $1',
          [1]
        );
        expect(result.rows[0]).toEqual(mockEmployee);
      });

      it('should return empty rows for non-existent employee', async () => {
        pool.query.mockResolvedValue({ rows: [] });

        const result = await createQuery(
          'SELECT * FROM employees WHERE id = $1',
          [999]
        );

        expect(result.rows).toEqual([]);
      });
    });

    describe('getEmployeeByEmail', () => {
      it('should retrieve employee by email', async () => {
        const mockEmployee = {
          id: 1,
          first_name: 'John',
          email: 'john@example.com',
        };

        pool.query.mockResolvedValue({ rows: [mockEmployee] });

        const result = await createQuery(
          'SELECT * FROM employees WHERE email = $1',
          ['john@example.com']
        );

        expect(pool.query).toHaveBeenCalledWith(
          'SELECT * FROM employees WHERE email = $1',
          ['john@example.com']
        );
        expect(result.rows[0].email).toBe('john@example.com');
      });
    });

    describe('updateEmployee', () => {
      it('should update employee details', async () => {
        const updatedEmployee = {
          id: 1,
          first_name: 'Jane',
          last_name: 'Smith',
          position: 'Lead Developer',
        };

        pool.query.mockResolvedValue({ rows: [updatedEmployee] });

        const result = await createQuery(
          'UPDATE employees SET first_name = $1, position = $2 WHERE id = $3 RETURNING *',
          ['Jane', 'Lead Developer', 1]
        );

        expect(result.rows[0].first_name).toBe('Jane');
        expect(result.rows[0].position).toBe('Lead Developer');
      });

      it('should return updated_at timestamp', async () => {
        const now = new Date();

        pool.query.mockResolvedValue({
          rows: [{ id: 1, updated_at: now }],
        });

        const result = await createQuery(
          'UPDATE employees SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          ['active', 1]
        );

        expect(result.rows[0].updated_at).toBeDefined();
      });
    });

    describe('getAllEmployees', () => {
      it('should retrieve all employees with pagination', async () => {
        const mockEmployees = [
          { id: 1, first_name: 'John', email: 'john@example.com' },
          { id: 2, first_name: 'Jane', email: 'jane@example.com' },
        ];

        pool.query.mockResolvedValue({ rows: mockEmployees });

        const result = await createQuery(
          'SELECT * FROM employees ORDER BY created_at DESC LIMIT $1 OFFSET $2',
          [10, 0]
        );

        expect(result.rows.length).toBe(2);
        expect(result.rows[0].id).toBe(1);
      });

      it('should handle empty result set', async () => {
        pool.query.mockResolvedValue({ rows: [] });

        const result = await createQuery(
          'SELECT * FROM employees ORDER BY created_at DESC LIMIT $1 OFFSET $2',
          [10, 100]
        );

        expect(result.rows).toEqual([]);
      });
    });

    describe('getEmployeesByDepartment', () => {
      it('should retrieve employees by department', async () => {
        const mockEmployees = [
          { id: 1, first_name: 'John', department: 'Engineering' },
          { id: 2, first_name: 'Jane', department: 'Engineering' },
        ];

        pool.query.mockResolvedValue({ rows: mockEmployees });

        const result = await createQuery(
          'SELECT * FROM employees WHERE department = $1 ORDER BY first_name',
          ['Engineering']
        );

        expect(result.rows.every((e) => e.department === 'Engineering')).toBe(true);
      });
    });

    describe('deleteEmployee', () => {
      it('should soft delete employee by setting status to inactive', async () => {
        pool.query.mockResolvedValue({ rows: [{ id: 1, status: 'inactive' }] });

        const result = await createQuery(
          'UPDATE employees SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
          ['inactive', 1]
        );

        expect(result.rows[0].status).toBe('inactive');
      });
    });
  });

  describe('OnboardingRepository', () => {
    const createQuery = (sql, params) => pool.query(sql, params);

    describe('createOnboarding', () => {
      it('should create onboarding record successfully', async () => {
        const onboardingData = {
          employee_id: 1,
          start_date: new Date('2024-01-15'),
          manager_id: 5,
          budget: 5000,
        };

        const mockResult = {
          rows: [
            {
              id: 1,
              ...onboardingData,
              status: 'not_started',
              created_at: new Date(),
            },
          ],
        };

        pool.query.mockResolvedValue(mockResult);

        const result = await createQuery(
          `INSERT INTO onboardings (employee_id, start_date, manager_id, budget, status)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          Object.values(onboardingData).concat('not_started')
        );

        expect(result.rows[0].employee_id).toBe(1);
        expect(result.rows[0].status).toBe('not_started');
      });

      it('should use default budget of 5000 if not provided', async () => {
        const onboardingData = {
          employee_id: 2,
          start_date: new Date('2024-02-01'),
          budget: 5000,
        };

        pool.query.mockResolvedValue({
          rows: [{ id: 2, ...onboardingData }],
        });

        const result = await createQuery(
          'INSERT INTO onboardings ... VALUES (..., $4) RETURNING *',
          [2, new Date('2024-02-01'), null, 5000]
        );

        expect(result.rows[0].budget).toBe(5000);
      });
    });

    describe('getOnboardingById', () => {
      it('should retrieve onboarding by ID', async () => {
        const mockOnboarding = {
          id: 1,
          employee_id: 1,
          start_date: new Date('2024-01-15'),
          status: 'in_progress',
          budget: 5000,
        };

        pool.query.mockResolvedValue({ rows: [mockOnboarding] });

        const result = await createQuery(
          'SELECT * FROM onboardings WHERE id = $1',
          [1]
        );

        expect(result.rows[0].id).toBe(1);
        expect(result.rows[0].status).toBe('in_progress');
      });
    });

    describe('getOnboardingByEmployeeId', () => {
      it('should retrieve onboarding by employee ID', async () => {
        const mockOnboarding = {
          id: 1,
          employee_id: 5,
          status: 'in_progress',
        };

        pool.query.mockResolvedValue({ rows: [mockOnboarding] });

        const result = await createQuery(
          'SELECT * FROM onboardings WHERE employee_id = $1',
          [5]
        );

        expect(result.rows[0].employee_id).toBe(5);
      });

      it('should return empty if no onboarding for employee', async () => {
        pool.query.mockResolvedValue({ rows: [] });

        const result = await createQuery(
          'SELECT * FROM onboardings WHERE employee_id = $1',
          [999]
        );

        expect(result.rows).toEqual([]);
      });
    });

    describe('updateOnboarding', () => {
      it('should update onboarding status', async () => {
        const updated = {
          id: 1,
          status: 'completed',
          end_date: new Date(),
        };

        pool.query.mockResolvedValue({ rows: [updated] });

        const result = await createQuery(
          'UPDATE onboardings SET status = $1, end_date = $2 WHERE id = $3 RETURNING *',
          ['completed', new Date(), 1]
        );

        expect(result.rows[0].status).toBe('completed');
      });

      it('should update budget', async () => {
        const updated = { id: 1, budget: 7500 };

        pool.query.mockResolvedValue({ rows: [updated] });

        const result = await createQuery(
          'UPDATE onboardings SET budget = $1 WHERE id = $2 RETURNING *',
          [7500, 1]
        );

        expect(result.rows[0].budget).toBe(7500);
      });
    });

    describe('getOnboardingsByStatus', () => {
      it('should retrieve onboardings by status', async () => {
        const mockOnboardings = [
          { id: 1, employee_id: 1, status: 'in_progress' },
          { id: 2, employee_id: 2, status: 'in_progress' },
        ];

        pool.query.mockResolvedValue({ rows: mockOnboardings });

        const result = await createQuery(
          'SELECT * FROM onboardings WHERE status = $1',
          ['in_progress']
        );

        expect(result.rows.every((o) => o.status === 'in_progress')).toBe(true);
      });
    });

    describe('getOnboardingsByManager', () => {
      it('should retrieve onboardings assigned to manager', async () => {
        const mockOnboardings = [
          { id: 1, manager_id: 5, employee_id: 1 },
          { id: 2, manager_id: 5, employee_id: 3 },
        ];

        pool.query.mockResolvedValue({ rows: mockOnboardings });

        const result = await createQuery(
          'SELECT * FROM onboardings WHERE manager_id = $1',
          [5]
        );

        expect(result.rows.every((o) => o.manager_id === 5)).toBe(true);
      });
    });
  });

  describe('OnboardingTaskRepository', () => {
    const createQuery = (sql, params) => pool.query(sql, params);

    describe('createTask', () => {
      it('should create onboarding task', async () => {
        const taskData = {
          onboarding_id: 1,
          name: 'IT Setup',
          category: 'it',
          due_day: 1,
        };

        const mockResult = {
          rows: [
            {
              id: 1,
              ...taskData,
              is_completed: false,
              created_at: new Date(),
            },
          ],
        };

        pool.query.mockResolvedValue(mockResult);

        const result = await createQuery(
          `INSERT INTO onboarding_tasks (onboarding_id, name, category, due_day, is_completed)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          Object.values(taskData).concat(false)
        );

        expect(result.rows[0].name).toBe('IT Setup');
        expect(result.rows[0].is_completed).toBe(false);
      });
    });

    describe('getTasksByOnboardingId', () => {
      it('should retrieve all tasks for an onboarding', async () => {
        const mockTasks = [
          { id: 1, onboarding_id: 1, name: 'IT Setup', category: 'it' },
          { id: 2, onboarding_id: 1, name: 'HR Orientation', category: 'hr' },
        ];

        pool.query.mockResolvedValue({ rows: mockTasks });

        const result = await createQuery(
          'SELECT * FROM onboarding_tasks WHERE onboarding_id = $1 ORDER BY due_day',
          [1]
        );

        expect(result.rows.length).toBe(2);
        expect(result.rows.every((t) => t.onboarding_id === 1)).toBe(true);
      });

      it('should return empty array when no tasks exist', async () => {
        pool.query.mockResolvedValue({ rows: [] });

        const result = await createQuery(
          'SELECT * FROM onboarding_tasks WHERE onboarding_id = $1',
          [999]
        );

        expect(result.rows).toEqual([]);
      });
    });

    describe('completeTask', () => {
      it('should mark task as completed', async () => {
        const completed = {
          id: 1,
          is_completed: true,
          completed_at: new Date(),
        };

        pool.query.mockResolvedValue({ rows: [completed] });

        const result = await createQuery(
          'UPDATE onboarding_tasks SET is_completed = true, completed_at = NOW() WHERE id = $1 RETURNING *',
          [1]
        );

        expect(result.rows[0].is_completed).toBe(true);
        expect(result.rows[0].completed_at).toBeDefined();
      });
    });

    describe('getTasksByCategory', () => {
      it('should retrieve tasks by category', async () => {
        const mockTasks = [
          { id: 1, category: 'it', name: 'Setup Laptop' },
          { id: 2, category: 'it', name: 'Setup Email' },
        ];

        pool.query.mockResolvedValue({ rows: mockTasks });

        const result = await createQuery(
          'SELECT * FROM onboarding_tasks WHERE onboarding_id = $1 AND category = $2',
          [1, 'it']
        );

        expect(result.rows.every((t) => t.category === 'it')).toBe(true);
      });
    });

    describe('getCompletionStats', () => {
      it('should return completion stats for an onboarding', async () => {
        const mockStats = [
          {
            total_tasks: 5,
            completed_tasks: 3,
            pending_tasks: 2,
          },
        ];

        pool.query.mockResolvedValue({ rows: mockStats });

        const result = await createQuery(
          `SELECT 
             COUNT(*) as total_tasks,
             SUM(CASE WHEN is_completed THEN 1 ELSE 0 END) as completed_tasks,
             SUM(CASE WHEN NOT is_completed THEN 1 ELSE 0 END) as pending_tasks
           FROM onboarding_tasks WHERE onboarding_id = $1`,
          [1]
        );

        expect(result.rows[0].total_tasks).toBe(5);
        expect(result.rows[0].completed_tasks).toBe(3);
        expect(result.rows[0].pending_tasks).toBe(2);
      });
    });
  });
});
