/**
 * Employee Entity Unit Tests
 * Tests the Employee entity validation and state management
 */

describe('Employee Entity', () => {
  class Employee {
    constructor(data = {}) {
      this.id = data.id;
      this.firstName = data.firstName;
      this.lastName = data.lastName;
      this.email = data.email;
      this.department = data.department;
      this.position = data.position;
      this.manager_id = data.manager_id;
      this.hire_date = data.hire_date;
      this.employment_type = data.employment_type || 'full_time';
      this.status = data.status || 'pending';
      this.created_at = data.created_at;
      this.updated_at = data.updated_at;
    }

    validate() {
      if (!this.firstName || this.firstName.trim() === '') {
        throw new Error('First name is required');
      }
      if (!this.lastName || this.lastName.trim() === '') {
        throw new Error('Last name is required');
      }
      if (!this.email || !this.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        throw new Error('Valid email is required');
      }
      if (!this.department) {
        throw new Error('Department is required');
      }
      if (!this.position) {
        throw new Error('Position is required');
      }
      return true;
    }

    getFullName() {
      return `${this.firstName} ${this.lastName}`;
    }

    isActive() {
      return this.status === 'active';
    }
  }

  describe('Employee constructor', () => {
    it('should create employee with required fields', () => {
      const employeeData = {
        id: 1,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        department: 'Engineering',
        position: 'Software Engineer',
        hire_date: new Date('2024-01-15'),
      };

      const employee = new Employee(employeeData);

      expect(employee.id).toBe(1);
      expect(employee.firstName).toBe('John');
      expect(employee.lastName).toBe('Doe');
      expect(employee.email).toBe('john@example.com');
      expect(employee.department).toBe('Engineering');
      expect(employee.position).toBe('Software Engineer');
    });

    it('should set default employment type to full_time', () => {
      const employee = new Employee({
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        department: 'HR',
        position: 'HR Manager',
      });

      expect(employee.employment_type).toBe('full_time');
    });

    it('should set default status to pending', () => {
      const employee = new Employee({
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob@example.com',
        department: 'Sales',
        position: 'Sales Rep',
      });

      expect(employee.status).toBe('pending');
    });

    it('should allow custom employment type', () => {
      const employee = new Employee({
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice@example.com',
        department: 'Consulting',
        position: 'Consultant',
        employment_type: 'contract',
      });

      expect(employee.employment_type).toBe('contract');
    });
  });

  describe('validate()', () => {
    it('should validate successful employee creation', () => {
      const employee = new Employee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        department: 'Engineering',
        position: 'Developer',
      });

      expect(employee.validate()).toBe(true);
    });

    it('should reject missing first name', () => {
      const employee = new Employee({
        lastName: 'Doe',
        email: 'john@example.com',
        department: 'Engineering',
        position: 'Developer',
      });

      expect(() => employee.validate()).toThrow('First name is required');
    });

    it('should reject empty first name', () => {
      const employee = new Employee({
        firstName: '   ',
        lastName: 'Doe',
        email: 'john@example.com',
        department: 'Engineering',
        position: 'Developer',
      });

      expect(() => employee.validate()).toThrow('First name is required');
    });

    it('should reject missing last name', () => {
      const employee = new Employee({
        firstName: 'John',
        email: 'john@example.com',
        department: 'Engineering',
        position: 'Developer',
      });

      expect(() => employee.validate()).toThrow('Last name is required');
    });

    it('should reject invalid email format', () => {
      const employee = new Employee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'invalid-email',
        department: 'Engineering',
        position: 'Developer',
      });

      expect(() => employee.validate()).toThrow('Valid email is required');
    });

    it('should accept valid email formats', () => {
      const validEmails = [
        'user@example.com',
        'first.last@company.co.uk',
        'user+tag@example.org',
      ];

      validEmails.forEach((email) => {
        const employee = new Employee({
          firstName: 'John',
          lastName: 'Doe',
          email,
          department: 'Engineering',
          position: 'Developer',
        });

        expect(employee.validate()).toBe(true);
      });
    });

    it('should reject missing department', () => {
      const employee = new Employee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        position: 'Developer',
      });

      expect(() => employee.validate()).toThrow('Department is required');
    });

    it('should reject missing position', () => {
      const employee = new Employee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        department: 'Engineering',
      });

      expect(() => employee.validate()).toThrow('Position is required');
    });
  });

  describe('getFullName()', () => {
    it('should return concatenated first and last name', () => {
      const employee = new Employee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        department: 'Engineering',
        position: 'Developer',
      });

      expect(employee.getFullName()).toBe('John Doe');
    });

    it('should handle names with special characters', () => {
      const employee = new Employee({
        firstName: "O'Brien",
        lastName: 'García-López',
        email: 'obrien@example.com',
        department: 'Engineering',
        position: 'Developer',
      });

      expect(employee.getFullName()).toBe("O'Brien García-López");
    });
  });

  describe('isActive()', () => {
    it('should return true when status is active', () => {
      const employee = new Employee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        department: 'Engineering',
        position: 'Developer',
        status: 'active',
      });

      expect(employee.isActive()).toBe(true);
    });

    it('should return false when status is pending', () => {
      const employee = new Employee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        department: 'Engineering',
        position: 'Developer',
        status: 'pending',
      });

      expect(employee.isActive()).toBe(false);
    });

    it('should return false when status is inactive', () => {
      const employee = new Employee({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        department: 'Engineering',
        position: 'Developer',
        status: 'inactive',
      });

      expect(employee.isActive()).toBe(false);
    });
  });
});
