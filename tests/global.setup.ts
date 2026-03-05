import { test as setup, expect } from '@playwright/test';

const authFile = '.auth/user.json';
const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL || 'danielss89@gmail.com';
  const password = process.env.TEST_USER_PASSWORD || 'hankat89';

  // Capture /me API response from backend
  const meResponsePromise = page.waitForResponse(
    (response) => response.url() === `${API_URL}/me` && response.status() === 200
  );

  await page.goto('/login');

  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in|log in|login/i }).click();

  // Verify redirect to dashboard
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });

  // Verify /me API call returns correct email
  const meResponse = await meResponsePromise;
  expect(meResponse.url()).toContain(`${API_URL}/me`);
  const meData = await meResponse.json();
  expect(meData.email).toBe(email);

  await page.context().storageState({ path: authFile });
});
