module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.js"],
  testMatch: ["<rootDir>/src/**/*.{test,spec}.{js,jsx}"],
  transform: {
    "^.+\\.[jt]sx?$": "<rootDir>/jest.transform.cjs",
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  collectCoverageFrom: [
    "src/api/interceptors/requestCache.js",
    "src/components/common/ErrorBoundary.jsx",
    "src/features/auth/authSlice.js",
    "src/features/auth/authThunks.js",
    "src/features/auth/authSelectors.js",
    "src/utils/getErrorMessage.js",
  ],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/src/__tests__/",
    "/__mocks__/",
  ],
};
