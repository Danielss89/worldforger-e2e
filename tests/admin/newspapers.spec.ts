import { test, expect } from '../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Newspapers CRUD', () => {
  test('should display newspapers from API in table', async ({ page }) => {
    // Capture /news_papers API response
    const newspapersResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/news_papers`) && response.status() === 200
    );

    await page.goto('/admin/newspapers', { waitUntil: 'networkidle' });

    // Verify header
    await expect(page.getByRole('heading', { name: /newspapers/i })).toBeVisible();

    // Verify /news_papers API was called and returns expected data
    const newspapersResponse = await newspapersResponsePromise;
    const newspapersData = await newspapersResponse.json();

    // Check response structure (supports both hydra:member and member)
    const newspapers = newspapersData['hydra:member'] || newspapersData.member || [];
    expect(newspapers.length).toBeGreaterThanOrEqual(0);

    // Verify each newspaper from API response is displayed in table
    for (const newspaper of newspapers) {
      await expect(page.getByRole('rowheader', { name: newspaper.title })).toBeVisible();
    }
  });

  test('should create a new newspaper', async ({ page, apiContext }) => {
    const testTitle = `E2E Test Newspaper ${Date.now()}`;
    const testDescription = 'Test newspaper description';

    await page.goto('/admin/newspapers/new', { waitUntil: 'networkidle' });

    // Verify create page loaded
    await expect(page.getByRole('heading', { name: /create newspaper/i })).toBeVisible();

    // Fill in the form - use more specific selectors
    await page.getByRole('textbox', { name: /title/i }).fill(testTitle);
    await page.getByRole('textbox', { name: /description/i }).fill(testDescription);

    // Set up response listener for POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`${API_URL}/news_papers`) &&
        response.request().method() === 'POST'
    );

    // Submit form
    await page.getByRole('button', { name: /create newspaper/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const createdNewspaper = await createResponse.json();
    expect(createdNewspaper.title).toBe(testTitle);

    // Verify redirect to newspapers list
    await expect(page).toHaveURL(/\/admin\/newspapers$/);

    // Cleanup - delete the created newspaper
    const newspaperId = createdNewspaper.id || createdNewspaper['@id']?.split('/').pop();
    if (newspaperId) {
      await apiContext.delete(`/news_papers/${newspaperId}`);
    }
  });

  test('should update an existing newspaper', async ({ page, apiContext }) => {
    // Create a newspaper via API for testing
    const originalTitle = `Original Newspaper ${Date.now()}`;
    const updatedTitle = `Updated Newspaper ${Date.now()}`;

    const createResponse = await apiContext.post('/news_papers', {
      data: {
        title: originalTitle,
        description: 'Original description',
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdNewspaper = await createResponse.json();
    const newspaperId = createdNewspaper.id || createdNewspaper['@id']?.split('/').pop();

    try {
      // Navigate to edit page
      await page.goto(`/admin/newspapers/${newspaperId}/edit`, { waitUntil: 'networkidle' });

      // Verify edit page loaded with existing data
      await expect(page.getByRole('textbox', { name: /title/i })).toHaveValue(originalTitle);

      // Update the title
      await page.getByRole('textbox', { name: /title/i }).clear();
      await page.getByRole('textbox', { name: /title/i }).fill(updatedTitle);

      // Set up response listener for PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(newspaperId) &&
          response.request().method() === 'PATCH'
      );

      // Submit form
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for API response
      const updateResponse = await updateResponsePromise;
      expect(updateResponse.status()).toBe(200);

      const updatedNewspaper = await updateResponse.json();
      expect(updatedNewspaper.title).toBe(updatedTitle);

      // Verify redirect to newspapers list
      await expect(page).toHaveURL(/\/admin\/newspapers$/);
    } finally {
      // Cleanup
      await apiContext.delete(`/news_papers/${newspaperId}`);
    }
  });

  test('should delete a newspaper', async ({ page, apiContext }) => {
    // Create a newspaper via API for testing
    const newspaperTitle = `Newspaper to Delete ${Date.now()}`;

    const createResponse = await apiContext.post('/news_papers', {
      data: {
        title: newspaperTitle,
        description: 'Newspaper to be deleted',
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdNewspaper = await createResponse.json();
    const newspaperId = createdNewspaper.id || createdNewspaper['@id']?.split('/').pop();

    // Navigate to newspapers list
    await page.goto('/admin/newspapers', { waitUntil: 'networkidle' });

    // Find the row with our newspaper and click delete
    const row = page.getByRole('row', { name: new RegExp(newspaperTitle, 'i') });
    await expect(row).toBeVisible();

    // Click delete button (desktop view shows inline buttons)
    await row.getByRole('button', { name: /delete/i }).click();

    // Set up response listener for DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(newspaperId) &&
        response.request().method() === 'DELETE'
    );

    // Confirm deletion in dialog
    await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();

    // Wait for API response
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(204);

    // Verify newspaper is removed from the list
    await expect(page.getByRole('row', { name: new RegExp(newspaperTitle, 'i') })).not.toBeVisible();
  });
});
