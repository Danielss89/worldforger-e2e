import { test as base, expect, type APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';
const AUTH_FILE = '.auth/user.json';

export interface ApiFixtures {
  apiContext: APIRequestContext;
}

export interface ApiWorkerFixtures {
  workerApiContext: APIRequestContext;
}

/**
 * Get the access token from the stored auth file
 */
function getAccessToken(): string | null {
  try {
    const authPath = path.resolve(process.cwd(), AUTH_FILE);
    const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));

    // Find the localStorage entry for auth-storage
    for (const origin of authData.origins || []) {
      for (const storage of origin.localStorage || []) {
        if (storage.name === 'auth-storage') {
          const authStorage = JSON.parse(storage.value);
          return authStorage.state?.accessToken || null;
        }
      }
    }
  } catch (e) {
    console.warn('Could not read auth token:', e);
  }
  return null;
}

export const test = base.extend<ApiFixtures, ApiWorkerFixtures>({
  // Worker-scoped context for beforeAll/afterAll
  workerApiContext: [async ({ playwright }, use) => {
    const token = getAccessToken();

    const context = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: {
        'Content-Type': 'application/ld+json',
        'X-Tenant-Domain': 'localhost',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    await use(context);
    await context.dispose();
  }, { scope: 'worker' }],

  // Test-scoped context for individual tests
  apiContext: async ({ playwright }, use) => {
    const token = getAccessToken();

    const context = await playwright.request.newContext({
      baseURL: API_URL,
      extraHTTPHeaders: {
        'Content-Type': 'application/ld+json',
        'X-Tenant-Domain': 'localhost',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
    });

    await use(context);
    await context.dispose();
  },
});

export { expect };
