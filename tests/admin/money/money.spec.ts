import { test, expect } from '@playwright/test';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';
const API_HEADERS = {
  'Content-Type': 'application/ld+json',
  'X-Tenant-Domain': 'localhost'
};

test.describe('Money CRUD', () => {
  test('should display currencies from API', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`${API_URL}/money`) && response.status() === 200
    );

    await page.goto('/admin/money', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Money', exact: true })).toBeVisible();

    const response = await responsePromise;
    const data = await response.json();
    const items = data['hydra:member'] || data.member || [];

    // Money page uses card layout, verify items are displayed
    if (items.length > 0) {
      for (const item of items.slice(0, 5)) {
        await expect(page.getByText(item.name)).toBeVisible();
      }
    }
  });

  test('should navigate to create form', async ({ page }) => {
    await page.goto('/admin/money', { waitUntil: 'networkidle' });

    // Click create button
    await page.getByRole('button', { name: /create currency/i }).click();

    await expect(page).toHaveURL(/\/admin\/money\/new/);
    await expect(page.getByRole('heading', { name: /create currency/i })).toBeVisible();
  });

  test('should create new currency', async ({ page, request }) => {
    const testName = `E2E Test Currency ${Date.now()}`;

    await page.goto('/admin/money/new', { waitUntil: 'networkidle' });

    // Fill form
    await page.getByRole('textbox', { name: /name/i }).fill(testName);

    // Submit form
    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/money`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create currency/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toBe(testName);

    // Verify redirect to list
    await expect(page).toHaveURL(/\/admin\/money$/);

    // Cleanup
    await request.delete(`${API_URL}/money/${created.id}`, {
      headers: API_HEADERS
    });
  });

  test('should edit existing currency', async ({ page, request }) => {
    // Create a test currency first
    const createResponse = await request.post(`${API_URL}/money`, {
      data: { name: `E2E Edit Currency ${Date.now()}` },
      headers: API_HEADERS
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/money/${created.id}/edit`, { waitUntil: 'networkidle' });

      const updatedName = `Updated Currency ${Date.now()}`;
      await page.getByRole('textbox', { name: /name/i }).clear();
      await page.getByRole('textbox', { name: /name/i }).fill(updatedName);

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/money/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.name).toBe(updatedName);
    } finally {
      // Cleanup
      await request.delete(`${API_URL}/money/${created.id}`, {
        headers: API_HEADERS
      });
    }
  });

  test('should delete currency', async ({ page, request }) => {
    // Create a test currency first
    const createResponse = await request.post(`${API_URL}/money`, {
      data: { name: `E2E Delete Currency ${Date.now()}` },
      headers: API_HEADERS
    });
    const created = await createResponse.json();

    await page.goto('/admin/money', { waitUntil: 'networkidle' });

    // Find the currency card and click delete
    const card = page.locator('article, [class*="card"]').filter({ hasText: created.name });

    // Click the menu/delete button
    await card.getByRole('button', { name: /delete|menu|options/i }).first().click();

    // If it was a menu, now click delete
    const deleteMenuItem = page.getByRole('menuitem', { name: /delete/i });
    if (await deleteMenuItem.isVisible()) {
      await deleteMenuItem.click();
    }

    // Confirm deletion in dialog
    const deletePromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/money/${created.id}`) && r.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).last().click();

    const response = await deletePromise;
    expect(response.status()).toBe(204);

    // Verify item is no longer visible
    await expect(page.getByText(created.name)).not.toBeVisible();
  });

  test('should navigate to denominations page', async ({ page, request }) => {
    // Create a test currency first
    const createResponse = await request.post(`${API_URL}/money`, {
      data: { name: `E2E Denominations Test ${Date.now()}` },
      headers: API_HEADERS
    });
    const created = await createResponse.json();

    try {
      await page.goto('/admin/money', { waitUntil: 'networkidle' });

      // Find and click on the currency card to go to denominations
      const card = page.locator('article, [class*="card"]').filter({ hasText: created.name });
      await card.click();

      await expect(page).toHaveURL(new RegExp(`/admin/money/${created.id}/denominations`));
    } finally {
      await request.delete(`${API_URL}/money/${created.id}`, {
        headers: API_HEADERS
      });
    }
  });
});
