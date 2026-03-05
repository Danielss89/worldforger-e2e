import { test, expect } from '@playwright/test';

interface NetworkLog {
  url: string;
  method: string;
  status?: number;
  response?: string;
}

test.describe('Check unauthenticated user is redirected', () => {
  let consoleLogs: string[] = [];
  let networkLogs: NetworkLog[] = [];

  test.beforeEach(async ({ page }) => {
    consoleLogs = [];
    networkLogs = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
      }
    });

    page.on('response', async (response) => {
      const request = response.request();
      if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
        let body = '';
        try {
          body = await response.text();
        } catch {
          body = '[could not read body]';
        }
        networkLogs.push({
          url: request.url(),
          method: request.method(),
          status: response.status(),
          response: body.slice(0, 500),
        });
      }
    });
  });

  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== 'passed') {
      console.log('\n--- Console Errors ---');
      consoleLogs.forEach((log) => console.log(log));
      console.log('\n--- XHR/Fetch Calls ---');
      networkLogs.forEach((log) =>
        console.log(`${log.method} ${log.status} ${log.url}\n${log.response}\n`)
      );
    }
  });

  test('should redirect /admin to login with redirect param', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'networkidle' });

    await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 10000 });
    expect(page.url()).toContain('redirect=');
  });

  test('should redirect any admin subpath to login with redirect param', async ({ page }) => {
    await page.goto('/admin/chats', { waitUntil: 'networkidle' });

    await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 10000 });
  });
});
