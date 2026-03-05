import { test, expect } from '@playwright/test';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';
const API_HEADERS = {
  'Content-Type': 'application/ld+json',
  'X-Tenant-Domain': 'localhost'
};

test.describe('Knowledge Base CRUD', () => {
  test('should display knowledge bases from API', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`${API_URL}/knowledge_bases`) && response.status() === 200
    );

    await page.goto('/admin/knowledge-base', { waitUntil: 'networkidle' });

    // Use exact match to avoid matching "No knowledge bases yet"
    await expect(page.getByRole('heading', { name: 'Knowledge Bases', exact: true })).toBeVisible();

    const response = await responsePromise;
    const data = await response.json();
    const items = data['hydra:member'] || data.member || [];

    // If there are items, verify they are displayed
    if (items.length > 0) {
      for (const item of items.slice(0, 5)) {
        await expect(page.getByText(item.name)).toBeVisible();
      }
    }
  });

  test('should navigate to create form', async ({ page }) => {
    await page.goto('/admin/knowledge-base', { waitUntil: 'networkidle' });

    // Click create button
    await page.getByRole('button', { name: /create knowledge base/i }).click();

    await expect(page).toHaveURL(/\/admin\/knowledge-base\/new/);
    await expect(page.getByRole('heading', { name: /create knowledge base/i })).toBeVisible();
  });

  test('should create new knowledge base', async ({ page, request }) => {
    const testName = `E2E Test KB ${Date.now()}`;

    await page.goto('/admin/knowledge-base/new', { waitUntil: 'networkidle' });

    // Fill form - use more specific selector
    await page.getByRole('textbox', { name: /name/i }).fill(testName);
    await page.getByRole('textbox', { name: /description/i }).fill('Test description for E2E');

    // Submit form
    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/knowledge_bases`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create knowledge base/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toBe(testName);

    // Verify redirect to list
    await expect(page).toHaveURL(/\/admin\/knowledge-base$/);

    // Cleanup
    await request.delete(`${API_URL}/knowledge_bases/${created.id}`, {
      headers: API_HEADERS
    });
  });

  test('should edit existing knowledge base', async ({ page, request }) => {
    // Create a test KB first
    const createResponse = await request.post(`${API_URL}/knowledge_bases`, {
      data: { name: `E2E Edit Test ${Date.now()}`, description: 'Original', isActive: true },
      headers: API_HEADERS
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/knowledge-base/${created.id}/edit`, { waitUntil: 'networkidle' });

      const updatedName = `Updated KB ${Date.now()}`;
      await page.getByRole('textbox', { name: /name/i }).clear();
      await page.getByRole('textbox', { name: /name/i }).fill(updatedName);

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/knowledge_bases/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.name).toBe(updatedName);
    } finally {
      // Cleanup
      await request.delete(`${API_URL}/knowledge_bases/${created.id}`, {
        headers: API_HEADERS
      });
    }
  });

  test('should delete knowledge base', async ({ page, request }) => {
    // Create a test KB first
    const createResponse = await request.post(`${API_URL}/knowledge_bases`, {
      data: { name: `E2E Delete Test ${Date.now()}`, description: 'To be deleted', isActive: true },
      headers: API_HEADERS
    });
    const created = await createResponse.json();

    await page.goto('/admin/knowledge-base', { waitUntil: 'networkidle' });

    // Find and click delete button for the created item
    const row = page.getByRole('row', { name: new RegExp(created.name, 'i') });
    await row.getByRole('button', { name: /delete/i }).click();

    // Confirm deletion in dialog
    const deletePromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/knowledge_bases/${created.id}`) && r.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).last().click();

    const response = await deletePromise;
    expect(response.status()).toBe(204);

    // Verify item is no longer visible
    await expect(page.getByRole('row', { name: new RegExp(created.name, 'i') })).not.toBeVisible();
  });

  test('should toggle active status', async ({ page, request }) => {
    // Create a test KB first
    const createResponse = await request.post(`${API_URL}/knowledge_bases`, {
      data: { name: `E2E Toggle Test ${Date.now()}`, isActive: true },
      headers: API_HEADERS
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/knowledge-base/${created.id}/edit`, { waitUntil: 'networkidle' });

      // Toggle active switch
      const activeToggle = page.getByRole('switch', { name: /active/i });
      await activeToggle.click();

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/knowledge_bases/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.isActive).toBe(false);
    } finally {
      await request.delete(`${API_URL}/knowledge_bases/${created.id}`, {
        headers: API_HEADERS
      });
    }
  });
});
