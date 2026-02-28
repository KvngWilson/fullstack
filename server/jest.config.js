module.exports = {
  testEnvironment: "node",
  coverageDirectory: "coverage",
  collectCoverageFrom: [
    "api/**/*.js",
    "core/**/*.js",
    "data/**/*.js",
    "!**/__tests__/**",
    "!**/node_modules/**",
  ],
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
  testMatch: ["**/__tests__/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.js"],
  testTimeout: 10000,
  moduleNameMapper: {
    "^uuid$": "<rootDir>/__tests__/mocks/uuid.js"
  }
};
