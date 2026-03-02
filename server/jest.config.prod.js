/**
 * Jest Configuration for Production-Grade Test Suite
 */

module.exports = {
  displayName: 'Backend Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/__tests__'],
  
  // Test matching patterns
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/e2e/**/*.test.js',
    '**/tests/security/**/*.test.js',
    '**/__tests__/**/*.test.js',
  ],

  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@config/(.*)$': '<rootDir>/config/$1',
    '^@helpers/(.*)$': '<rootDir>/tests/helpers/$1',
    '^@factories/(.*)$': '<rootDir>/tests/factories/$1',
  },

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js',
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Timeout and isolation
  testTimeout: 10000,
  maxWorkers: 1, // Run sequentially for test isolation
  detectOpenHandles: true,
  forceExit: true,

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results',
        outputName: 'junit.xml',
        usePathAsTestSuite: true,
      },
    ],
  ],

  // Transform configuration - skip node_modules with es6 modules
  transformIgnorePatterns: [
    'node_modules/(?!(uuid)/)',
  ],
};
