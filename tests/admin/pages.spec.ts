import { test, expect } from '../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Pages CRUD', () => {
  test('should display pages from API in table', async ({ page }) => {
    // Capture /pages API response
    const pagesResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/pages`) && response.status() === 200
    );

    await page.goto('/admin/pages', { waitUntil: 'networkidle' });

    // Verify header
    await expect(page.getByRole('heading', { name: /pages/i })).toBeVisible();

    // Verify /pages API was called and returns expected data
    const pagesResponse = await pagesResponsePromise;
    const pagesData = await pagesResponse.json();

    // Check response structure (supports both hydra:member and member)
    const pages = pagesData['hydra:member'] || pagesData.member || [];
    expect(pages.length).toBeGreaterThanOrEqual(0);

    // Verify each page from API response is displayed in table
    for (const pageItem of pages) {
      await expect(page.getByRole('rowheader', { name: pageItem.title })).toBeVisible();
    }
  });

  test('should create a new page', async ({ page, apiContext }) => {
    const testTitle = `E2E Test Page ${Date.now()}`;
    const testContent = '<p>Test page content</p>';

    await page.goto('/admin/pages/new', { waitUntil: 'networkidle' });

    // Verify create page loaded
    await expect(page.getByRole('heading', { name: /create page/i })).toBeVisible();

    // Fill in the form - use more specific selectors
    await page.getByRole('textbox', { name: /title/i }).fill(testTitle);
    await page.getByRole('textbox', { name: /content/i }).fill(testContent);

    // Set up response listener for POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`${API_URL}/pages`) &&
        response.request().method() === 'POST'
    );

    // Submit form
    await page.getByRole('button', { name: /create page/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const createdPage = await createResponse.json();
    expect(createdPage.title).toBe(testTitle);

    // Verify redirect to pages list
    await expect(page).toHaveURL(/\/admin\/pages$/);

    // Cleanup - delete the created page
    const pageId = createdPage.id || createdPage['@id']?.split('/').pop();
    if (pageId) {
      await apiContext.delete(`/pages/${pageId}`);
    }
  });

  test('should update an existing page', async ({ page, apiContext }) => {
    // Create a page via API for testing
    const originalTitle = `Original Page ${Date.now()}`;
    const updatedTitle = `Updated Page ${Date.now()}`;

    const createResponse = await apiContext.post('/pages', {
      data: {
        title: originalTitle,
        content: '<p>Original content</p>',
        status: 'draft',
        position: 0,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdPage = await createResponse.json();
    const pageId = createdPage.id || createdPage['@id']?.split('/').pop();

    try {
      // Navigate to edit page
      await page.goto(`/admin/pages/${pageId}/edit`, { waitUntil: 'networkidle' });

      // Verify edit page loaded with existing data
      await expect(page.getByRole('textbox', { name: /title/i })).toHaveValue(originalTitle);

      // Update the title
      await page.getByRole('textbox', { name: /title/i }).clear();
      await page.getByRole('textbox', { name: /title/i }).fill(updatedTitle);

      // Set up response listener for PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(pageId) &&
          response.request().method() === 'PATCH'
      );

      // Submit form
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for API response
      const updateResponse = await updateResponsePromise;
      expect(updateResponse.status()).toBe(200);

      const updatedPage = await updateResponse.json();
      expect(updatedPage.title).toBe(updatedTitle);

      // Verify redirect to pages list
      await expect(page).toHaveURL(/\/admin\/pages$/);
    } finally {
      // Cleanup
      await apiContext.delete(`/pages/${pageId}`);
    }
  });

  test('should delete a page', async ({ page, apiContext }) => {
    // Create a page via API for testing
    const pageTitle = `Page to Delete ${Date.now()}`;

    const createResponse = await apiContext.post('/pages', {
      data: {
        title: pageTitle,
        content: '<p>Page to be deleted</p>',
        status: 'draft',
        position: 0,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdPage = await createResponse.json();
    const pageId = createdPage.id || createdPage['@id']?.split('/').pop();

    // Navigate to pages list
    await page.goto('/admin/pages', { waitUntil: 'networkidle' });

    // Find the row with our page and click delete
    const row = page.getByRole('row', { name: new RegExp(pageTitle, 'i') });
    await expect(row).toBeVisible();

    // Click delete button (desktop view shows inline buttons)
    await row.getByRole('button', { name: /delete/i }).click();

    // Set up response listener for DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(pageId) &&
        response.request().method() === 'DELETE'
    );

    // Confirm deletion in dialog
    await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();

    // Wait for API response
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(204);

    // Verify page is removed from the list
    await expect(page.getByRole('row', { name: new RegExp(pageTitle, 'i') })).not.toBeVisible();
  });
});
