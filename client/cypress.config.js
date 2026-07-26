import { defineConfig } from 'cypress';

export default defineConfig({
  allowCypressEnv: false,
  e2e: {
    baseUrl:
      process.env.CYPRESS_BASE_URL ||
      process.env.BASE_URL ||
      'http://localhost:5173',
    specPattern: 'src/__tests__/e2e/**/*.cy.{js,jsx}',
    supportFile: 'src/__tests__/e2e/support/e2e.js',
    screenshotsFolder: 'test-results/cypress/screenshots',
    videosFolder: 'test-results/cypress/videos',
  },
  video: false,
});