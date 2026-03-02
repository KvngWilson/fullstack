/**
 * Mock API module - uses MSW (Mock Service Worker)
 * To use in tests: import { server } from './__tests__/mocks/server'
 * 
 * Example:
 * import { server } from '@/__tests__/mocks/server';
 * 
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 */
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
