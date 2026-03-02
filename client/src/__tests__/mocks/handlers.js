import { http, HttpResponse } from 'msw';
import { createMockUser, createMockProduct } from '../factories';

const baseURL = process.env.VITE_API_URL || 'http://localhost:5000/api/v1';

/**
 * Mock API handlers for MSW
 * These simulate API responses during testing
 */
export const handlers = [
  // Auth endpoints
  http.post(`${baseURL}/users/login`, async () => {
    return HttpResponse.json({
      success: true,
      user: createMockUser(),
    });
  }),

  http.post(`${baseURL}/users/register`, async () => {
    return HttpResponse.json({
      success: true,
      user: createMockUser(),
    });
  }),

  http.post(`${baseURL}/users/logout`, async () => {
    return HttpResponse.json({ success: true });
  }),

  http.get(`${baseURL}/users/me`, async () => {
    return HttpResponse.json({
      success: true,
      user: createMockUser(),
    });
  }),

  http.post(`${baseURL}/users/refresh-token`, async () => {
    return HttpResponse.json({
      success: true,
      user: createMockUser(),
    });
  }),

  // Products endpoints
  http.get(`${baseURL}/products`, async () => {
    return HttpResponse.json({
      success: true,
      data: {
        items: [
          createMockProduct({ id: '1' }),
          createMockProduct({ id: '2' }),
          createMockProduct({ id: '3' }),
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 3,
        },
      },
    });
  }),

  http.get(`${baseURL}/products/:id`, async ({ params }) => {
    return HttpResponse.json({
      success: true,
      data: createMockProduct({ id: params.id }),
    });
  }),

  // Cart endpoints
  http.get(`${baseURL}/cart`, async () => {
    return HttpResponse.json({
      success: true,
      data: {
        id: '1',
        userId: '123',
        items: [],
        subtotal: 0,
        tax: 0,
        total: 0,
      },
    });
  }),

  http.post(`${baseURL}/cart/items`, async () => {
    return HttpResponse.json({ success: true });
  }),

  http.patch(`${baseURL}/cart/items/:itemId`, async () => {
    return HttpResponse.json({ success: true });
  }),

  http.delete(`${baseURL}/cart/items/:itemId`, async () => {
    return HttpResponse.json({ success: true });
  }),
];
