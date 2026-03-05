import { test as base, expect } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
}

export interface AuthFixtures {
  testUser: TestUser;
}

export const test = base.extend<AuthFixtures>({
  testUser: async ({}, use) => {
    await use({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'password123',
    });
  },
});

export { expect };
