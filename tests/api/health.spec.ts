import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:8000';

test.describe('API Health Check', () => {
  test('should respond to API root endpoint', async ({ request }) => {
    const response = await request.get(`${API_URL}/`);
    expect(response.ok()).toBeTruthy();
  });

  test('should return JSON-LD context', async ({ request }) => {
    const response = await request.get(`${API_URL}/`, {
      headers: {
        Accept: 'application/ld+json',
      },
    });

    expect(response.ok()).toBeTruthy();
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/ld+json');
  });

  test('should return Hydra documentation', async ({ request }) => {
    const response = await request.get(`${API_URL}/docs`, {
      headers: {
        Accept: 'application/ld+json',
      },
    });

    expect(response.ok()).toBeTruthy();
  });
});
