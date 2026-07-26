const { DatabaseHelper } = require('../helpers/testHelpers');
const argon2 = require('argon2');

class UserFactory {
  static counter = 0;

  static async create(overrides = {}) {
    this.counter++;
    const timestamp = Date.now();
    
    const plainPassword = overrides.password || 'Test@Password123';
    const hashedPassword = await argon2.hash(plainPassword);

    const userData = {
      email: overrides.email || `user_${timestamp}_${this.counter}@test.local`,
      password_hash: hashedPassword,
      first_name: overrides.first_name || 'Test',
      last_name: overrides.last_name || 'User',
      phone_number: overrides.phone_number || `+1${timestamp}${this.counter}`.slice(0, 15),
      is_active: overrides.is_active !== undefined ? overrides.is_active : true,
      email_verified: overrides.email_verified !== undefined ? overrides.email_verified : false,
      created_at: new Date(),
    };

    const result = await DatabaseHelper.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone_number, is_active, email_verified, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [userData.email, userData.password_hash, userData.first_name, userData.last_name, userData.phone_number, userData.is_active, userData.email_verified, userData.created_at]
    );

    return {
      id: result.rows[0].id,
      email: userData.email,
      password: plainPassword,
      password_hash: userData.password_hash,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      is_active: userData.is_active,
      email_verified: userData.email_verified,
    };
  }

  static async createMany(count = 5, overrides = {}) {
    const users = [];
    for (let i = 0; i < count; i++) {
      const user = await this.create(overrides);
      users.push(user);
    }
    return users;
  }

  static resetCounter() {
    this.counter = 0;
  }
}

module.exports = UserFactory;
