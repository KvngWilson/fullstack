import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';

process.env.VITE_API_URL = 'http://localhost:5000';

// Cleanup after each test
afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  jest.restoreAllMocks();
  process.env.NODE_ENV = 'test';
  process.env.DEV = 'true';
  process.env.PROD = '';
});

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.DEV = 'true';
  process.env.PROD = '';
});

const noop = () => {};

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: noop,
    removeListener: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dispatchEvent: noop,
  }),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
};

// Suppress console errors in tests (optional)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
