// Jest Configuration Suite


module.exports = {
  displayName: 'Backend Tests',
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  
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
    '^@helpers/(.*)$': '<rootDir>/__tests__/helpers/$1',
    '^@factories/(.*)$': '<rootDir>/__tests__/factories/$1',
  },

  // Setup and teardown
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js',
    '!src/**/index.js',
  ],

  coverageThreshold: {
    global: {
      branches: 50,
      functions: 75,
      lines: 95,
      statements: 95,
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
