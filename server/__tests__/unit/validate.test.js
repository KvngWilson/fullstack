const {
  validateEmail,
  validatePassword,
  validateRegistration,
  validateLogin,
  validateAddress,
  validateProduct,
} = require('../../shared/utils/validate');

describe('Validation Utils - Unit Tests', () => {
  describe('validateEmail', () => {
    it('should return true for valid email addresses', () => {
      expect(validateEmail('user@example.com')).toBe(true);
      expect(validateEmail('test.user+tag@domain.co.uk')).toBe(true);
      expect(validateEmail('name_123@test-domain.com')).toBe(true);
    });

    it('should return false for invalid email addresses', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('user@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
      expect(validateEmail('user @domain.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null)).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should return error for passwords shorter than 6 characters', () => {
      const result = validatePassword('12345');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('at least 6 characters');
    });

    it('should return error for passwords longer than 100 characters', () => {
      const longPassword = 'a'.repeat(101);
      const result = validatePassword(longPassword);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('maximum 100 characters');
    });

    it('should return valid for passwords within range', () => {
      expect(validatePassword('password123').valid).toBe(true);
      expect(validatePassword('securePass!').valid).toBe(true);
      expect(validatePassword('a'.repeat(50)).valid).toBe(true);
    });

    it('should handle null or undefined passwords', () => {
      expect(validatePassword(null).valid).toBe(false);
      expect(validatePassword(undefined).valid).toBe(false);
      expect(validatePassword('').valid).toBe(false);
    });
  });

  describe('validateRegistration', () => {
    it('should pass validation for valid registration data', () => {
      const data = {
        email: 'user@example.com',
        password: 'securePass123',
      };
      const { error } = validateRegistration(data);
      expect(error).toBeUndefined();
    });

    it('should fail validation for missing email', () => {
      const data = { password: 'securePass123' };
      const { error } = validateRegistration(data);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('email');
    });

    it('should fail validation for invalid email format', () => {
      const data = {
        email: 'invalid-email',
        password: 'securePass123',
      };
      const { error } = validateRegistration(data);
      expect(error).toBeDefined();
    });

    it('should fail validation for short password', () => {
      const data = {
        email: 'user@example.com',
        password: '12345',
      };
      const { error } = validateRegistration(data);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain('password');
    });
  });

  describe('validateLogin', () => {
    it('should pass validation for valid login data', () => {
      const data = {
        email: 'user@example.com',
        password: 'password123',
      };
      const { error } = validateLogin(data);
      expect(error).toBeUndefined();
    });

    it('should fail validation for missing credentials', () => {
      const { error: errorNoEmail } = validateLogin({ password: 'test' });
      expect(errorNoEmail).toBeDefined();

      const { error: errorNoPassword } = validateLogin({ email: 'test@test.com' });
      expect(errorNoPassword).toBeDefined();
    });
  });

  describe('validateAddress', () => {
    const validAddress = {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      postal_code: '10001',
      country: 'US',
    };

    it('should pass validation for complete address', () => {
      const { error } = validateAddress(validAddress);
      expect(error).toBeUndefined();
    });

    it('should fail validation for missing required fields', () => {
      const { error } = validateAddress({ street: '123 Main St' });
      expect(error).toBeDefined();
    });

    it('should fail validation for invalid postal code', () => {
      const address = { ...validAddress, postal_code: '' };
      const { error } = validateAddress(address);
      expect(error).toBeDefined();
    });
  });

  describe('validateProduct', () => {
    const validProduct = {
      name: 'Test Product',
      brand: 'Test Brand',
      base_price: 99.99,
      description: 'Test description',
    };

    it('should pass validation for valid product', () => {
      const { error } = validateProduct(validProduct);
      expect(error).toBeUndefined();
    });

    it('should fail validation for missing required fields', () => {
      const { error } = validateProduct({ name: 'Product' });
      expect(error).toBeDefined();
    });

    it('should fail validation for negative price', () => {
      const product = { ...validProduct, base_price: -10 };
      const { error } = validateProduct(product);
      expect(error).toBeDefined();
    });

    it('should fail validation for zero price', () => {
      const product = { ...validProduct, base_price: 0 };
      const { error } = validateProduct(product);
      expect(error).toBeDefined();
    });

    it('should allow optional fields', () => {
      const product = {
        ...validProduct,
        material: 'Cotton',
        care_instructions: 'Machine wash cold',
      };
      const { error } = validateProduct(product);
      expect(error).toBeUndefined();
    });
  });
});
