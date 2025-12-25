import { test as base, expect, Page } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
}

export interface AuthFixtures {
  authenticatedPage: Page;
  testUser: TestUser;
}

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    await use({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'password123',
    });
  },

  authenticatedPage: async ({ page, testUser }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(testUser.email);
    await page.getByLabel('Password').fill(testUser.password);
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    await page.waitForURL(/\/(dashboard|home|user)/);

    await use(page);
  },
});

export { expect };
