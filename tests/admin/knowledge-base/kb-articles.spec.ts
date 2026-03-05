import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Knowledge Base Articles CRUD', () => {
  let kbId: string;
  let catId: string;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create parent Knowledge Base
    const kbResponse = await workerApiContext.post('/knowledge_bases', {
      data: { name: `E2E Articles Test KB ${Date.now()}`, isActive: true },
    });
    const kb = await kbResponse.json();
    kbId = kb.id;

    // Create parent Category
    const catResponse = await workerApiContext.post('/knowledge_base_categories', {
      data: {
        name: `E2E Articles Test Category ${Date.now()}`,
        isActive: true,
        knowledgeBase: `/knowledge_bases/${kbId}`
      },
    });
    const cat = await catResponse.json();
    catId = cat.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup - delete the KB (cascades to categories and articles)
    await workerApiContext.delete(`/knowledge_bases/${kbId}`);
  });

  test('should display articles for category', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`${API_URL}/knowledge_base_articles`) && response.status() === 200
    );

    await page.goto(`/admin/knowledge-base/${kbId}/categories/${catId}/articles`, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /articles/i })).toBeVisible();

    await responsePromise;
  });

  test('should navigate to create article form', async ({ page }) => {
    await page.goto(`/admin/knowledge-base/${kbId}/categories/${catId}/articles`, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /create|add/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/knowledge-base/${kbId}/categories/${catId}/articles/new`));
    await expect(page.getByRole('heading', { name: /create article/i })).toBeVisible();
  });

  test('should create new article', async ({ page, apiContext }) => {
    const testTitle = `E2E Test Article ${Date.now()}`;

    await page.goto(`/admin/knowledge-base/${kbId}/categories/${catId}/articles/new`, { waitUntil: 'networkidle' });

    // Fill form
    await page.getByRole('textbox', { name: /title/i }).fill(testTitle);
    await page.getByRole('textbox', { name: /excerpt/i }).fill('Test excerpt');
    await page.getByRole('textbox', { name: /content/i }).fill('<p>Test article content</p>');

    // Select status
    const statusSelect = page.getByRole('button', { name: /status/i });
    await statusSelect.click();
    await page.getByRole('option', { name: /published/i }).click();

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/knowledge_base_articles`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create article/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.title).toBe(testTitle);
    expect(created.status).toBe('published');

    // Verify redirect
    await expect(page).toHaveURL(new RegExp(`/admin/knowledge-base/${kbId}/categories/${catId}/articles$`));

    // Cleanup
    await apiContext.delete(`/knowledge_base_articles/${created.id}`);
  });

  test('should edit existing article', async ({ page, apiContext }) => {
    // Create a test article first
    const createResponse = await apiContext.post('/knowledge_base_articles', {
      data: {
        title: `E2E Edit Article ${Date.now()}`,
        content: '<p>Original content</p>',
        status: 'draft',
        category: `/knowledge_base_categories/${catId}`
      },
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/knowledge-base/${kbId}/categories/${catId}/articles/${created.id}/edit`, { waitUntil: 'networkidle' });

      const updatedTitle = `Updated Article ${Date.now()}`;
      await page.getByRole('textbox', { name: /title/i }).clear();
      await page.getByRole('textbox', { name: /title/i }).fill(updatedTitle);

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/knowledge_base_articles/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.title).toBe(updatedTitle);
    } finally {
      await apiContext.delete(`/knowledge_base_articles/${created.id}`);
    }
  });

  test('should delete article', async ({ page, apiContext }) => {
    // Create a test article first
    const createResponse = await apiContext.post('/knowledge_base_articles', {
      data: {
        title: `E2E Delete Article ${Date.now()}`,
        status: 'draft',
        category: `/knowledge_base_categories/${catId}`
      },
    });
    const created = await createResponse.json();

    await page.goto(`/admin/knowledge-base/${kbId}/categories/${catId}/articles`, { waitUntil: 'networkidle' });

    // Find and click delete button
    const row = page.getByRole('row', { name: new RegExp(created.title, 'i') });
    await row.getByRole('button', { name: /delete/i }).click();

    const deletePromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/knowledge_base_articles/${created.id}`) && r.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).last().click();

    const response = await deletePromise;
    expect(response.status()).toBe(204);

    await expect(page.getByRole('row', { name: new RegExp(created.title, 'i') })).not.toBeVisible();
  });

  test('should change article status', async ({ page, apiContext }) => {
    // Create a draft article
    const createResponse = await apiContext.post('/knowledge_base_articles', {
      data: {
        title: `E2E Status Article ${Date.now()}`,
        status: 'draft',
        category: `/knowledge_base_categories/${catId}`
      },
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/knowledge-base/${kbId}/categories/${catId}/articles/${created.id}/edit`, { waitUntil: 'networkidle' });

      // Change status to published
      const statusSelect = page.getByRole('button', { name: /status/i });
      await statusSelect.click();
      await page.getByRole('option', { name: /published/i }).click();

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/knowledge_base_articles/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.status).toBe('published');
    } finally {
      await apiContext.delete(`/knowledge_base_articles/${created.id}`);
    }
  });

  test('should create article with all fields', async ({ page, apiContext }) => {
    const testTitle = `E2E Full Article ${Date.now()}`;
    const testExcerpt = 'This is a test excerpt for the article';
    const testContent = '<h1>Heading</h1><p>Paragraph content</p>';

    await page.goto(`/admin/knowledge-base/${kbId}/categories/${catId}/articles/new`, { waitUntil: 'networkidle' });

    // Fill all fields
    await page.getByRole('textbox', { name: /title/i }).fill(testTitle);
    await page.getByRole('textbox', { name: /excerpt/i }).fill(testExcerpt);
    await page.getByRole('textbox', { name: /content/i }).fill(testContent);
    await page.getByRole('spinbutton', { name: /position/i }).fill('5');

    const statusSelect = page.getByRole('button', { name: /status/i });
    await statusSelect.click();
    await page.getByRole('option', { name: /draft/i }).click();

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/knowledge_base_articles`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create article/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.title).toBe(testTitle);
    expect(created.excerpt).toBe(testExcerpt);
    expect(created.content).toBe(testContent);
    expect(created.status).toBe('draft');
    expect(created.position).toBe(5);

    // Cleanup
    await apiContext.delete(`/knowledge_base_articles/${created.id}`);
  });
});
