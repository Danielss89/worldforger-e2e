import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Knowledge Base Categories CRUD', () => {
  let kbId: string;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create parent Knowledge Base
    const response = await workerApiContext.post('/knowledge_bases', {
      data: { name: `E2E Categories Test KB ${Date.now()}`, isActive: true },
    });
    const kb = await response.json();
    kbId = kb.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup - delete the KB (cascades to categories)
    await workerApiContext.delete(`/knowledge_bases/${kbId}`);
  });

  test('should display categories for knowledge base', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`${API_URL}/knowledge_base_categories`) && response.status() === 200
    );

    await page.goto(`/admin/knowledge-base/${kbId}/categories`, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /categories/i })).toBeVisible();

    await responsePromise;
  });

  test('should navigate to create category form', async ({ page }) => {
    await page.goto(`/admin/knowledge-base/${kbId}/categories`, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /create|add/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/knowledge-base/${kbId}/categories/new`));
    await expect(page.getByRole('heading', { name: /create category/i })).toBeVisible();
  });

  test('should create new category', async ({ page, apiContext }) => {
    const testName = `E2E Test Category ${Date.now()}`;

    await page.goto(`/admin/knowledge-base/${kbId}/categories/new`, { waitUntil: 'networkidle' });

    // Fill form
    await page.getByRole('textbox', { name: /name/i }).fill(testName);
    await page.getByRole('textbox', { name: /description/i }).fill('Test category description');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/knowledge_base_categories`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create category/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toBe(testName);

    // Verify redirect
    await expect(page).toHaveURL(new RegExp(`/admin/knowledge-base/${kbId}/categories$`));

    // Cleanup
    await apiContext.delete(`/knowledge_base_categories/${created.id}`);
  });

  test('should edit existing category', async ({ page, apiContext }) => {
    // Create a test category first
    const createResponse = await apiContext.post('/knowledge_base_categories', {
      data: {
        name: `E2E Edit Category ${Date.now()}`,
        description: 'Original',
        isActive: true,
        knowledgeBase: `/knowledge_bases/${kbId}`
      },
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/knowledge-base/${kbId}/categories/${created.id}/edit`, { waitUntil: 'networkidle' });

      const updatedName = `Updated Category ${Date.now()}`;
      await page.getByRole('textbox', { name: /name/i }).clear();
      await page.getByRole('textbox', { name: /name/i }).fill(updatedName);

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/knowledge_base_categories/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.name).toBe(updatedName);
    } finally {
      await apiContext.delete(`/knowledge_base_categories/${created.id}`);
    }
  });

  test('should delete category', async ({ page, apiContext }) => {
    // Create a test category first
    const createResponse = await apiContext.post('/knowledge_base_categories', {
      data: {
        name: `E2E Delete Category ${Date.now()}`,
        isActive: true,
        knowledgeBase: `/knowledge_bases/${kbId}`
      },
    });
    const created = await createResponse.json();

    await page.goto(`/admin/knowledge-base/${kbId}/categories`, { waitUntil: 'networkidle' });

    // Find and click delete button
    const row = page.getByRole('row', { name: new RegExp(created.name, 'i') });
    await row.getByRole('button', { name: /delete/i }).click();

    const deletePromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/knowledge_base_categories/${created.id}`) && r.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).last().click();

    const response = await deletePromise;
    expect(response.status()).toBe(204);

    await expect(page.getByRole('row', { name: new RegExp(created.name, 'i') })).not.toBeVisible();
  });

  test('should create nested category with parent', async ({ page, apiContext }) => {
    // Create a parent category first
    const parentResponse = await apiContext.post('/knowledge_base_categories', {
      data: {
        name: `Parent Category ${Date.now()}`,
        isActive: true,
        knowledgeBase: `/knowledge_bases/${kbId}`
      },
    });
    const parent = await parentResponse.json();

    try {
      const childName = `Child Category ${Date.now()}`;

      await page.goto(`/admin/knowledge-base/${kbId}/categories/new`, { waitUntil: 'networkidle' });

      await page.getByRole('textbox', { name: /name/i }).fill(childName);

      // Select parent category
      const parentSelect = page.getByRole('button', { name: /parent category/i });
      await parentSelect.click();
      await page.getByRole('option', { name: new RegExp(parent.name, 'i') }).click();

      const createPromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/knowledge_base_categories`) && r.request().method() === 'POST'
      );

      await page.getByRole('button', { name: /create category/i }).click();

      const response = await createPromise;
      expect(response.status()).toBe(201);

      const created = await response.json();
      expect(created.name).toBe(childName);
      expect(created.parent).toContain(parent.id);

      // Cleanup child
      await apiContext.delete(`/knowledge_base_categories/${created.id}`);
    } finally {
      // Cleanup parent
      await apiContext.delete(`/knowledge_base_categories/${parent.id}`);
    }
  });
});
