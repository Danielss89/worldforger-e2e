import { test, expect } from '../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Forums (Boards) CRUD', () => {
  test('should display forums from API in table', async ({ page }) => {
    // Capture /boards API response
    const boardsResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/boards`) && response.status() === 200
    );

    await page.goto('/admin/boards', { waitUntil: 'networkidle' });

    // Verify header
    await expect(page.getByRole('heading', { name: /forums/i })).toBeVisible();

    // Verify /boards API was called and returns expected data
    const boardsResponse = await boardsResponsePromise;
    const boardsData = await boardsResponse.json();

    // Check response structure (supports both hydra:member and member)
    const boards = boardsData['hydra:member'] || boardsData.member || [];
    expect(boards.length).toBeGreaterThanOrEqual(0);

    // Verify each board from API response is displayed in table
    for (const board of boards) {
      await expect(page.getByRole('rowheader', { name: board.name })).toBeVisible();
    }
  });

  test('should create a new forum', async ({ page, apiContext }) => {
    const testForumName = `E2E Test Forum ${Date.now()}`;
    const testDescription = 'Test forum description';

    await page.goto('/admin/boards/new', { waitUntil: 'networkidle' });

    // Verify create page loaded
    await expect(page.getByRole('heading', { name: /create forum/i })).toBeVisible();

    // Fill in the form - use more specific selectors
    await page.getByRole('textbox', { name: /^name/i }).fill(testForumName);
    await page.getByRole('textbox', { name: /description/i }).fill(testDescription);

    // Set up response listener for POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`${API_URL}/boards`) &&
        response.request().method() === 'POST'
    );

    // Submit form
    await page.getByRole('button', { name: /create forum/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const createdBoard = await createResponse.json();
    expect(createdBoard.name).toBe(testForumName);

    // Verify redirect to boards list
    await expect(page).toHaveURL(/\/admin\/boards$/);

    // Cleanup - delete the created board
    const boardId = createdBoard.id || createdBoard['@id']?.split('/').pop();
    if (boardId) {
      await apiContext.delete(`/boards/${boardId}`);
    }
  });

  test('should update an existing forum', async ({ page, apiContext }) => {
    // Create a board via API for testing
    const originalName = `Original Forum ${Date.now()}`;
    const updatedName = `Updated Forum ${Date.now()}`;

    const createResponse = await apiContext.post('/boards', {
      data: {
        name: originalName,
        description: 'Original description',
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdBoard = await createResponse.json();
    const boardId = createdBoard.id || createdBoard['@id']?.split('/').pop();

    try {
      // Navigate to edit page
      await page.goto(`/admin/boards/${boardId}/edit`, { waitUntil: 'networkidle' });

      // Verify edit page loaded with existing data
      await expect(page.getByRole('textbox', { name: /^name/i })).toHaveValue(originalName);

      // Update the name
      await page.getByRole('textbox', { name: /^name/i }).clear();
      await page.getByRole('textbox', { name: /^name/i }).fill(updatedName);

      // Set up response listener for PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(boardId) &&
          response.request().method() === 'PATCH'
      );

      // Submit form
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for API response
      const updateResponse = await updateResponsePromise;
      expect(updateResponse.status()).toBe(200);

      const updatedBoard = await updateResponse.json();
      expect(updatedBoard.name).toBe(updatedName);

      // Verify redirect to boards list
      await expect(page).toHaveURL(/\/admin\/boards$/);
    } finally {
      // Cleanup
      await apiContext.delete(`/boards/${boardId}`);
    }
  });

  test('should delete a forum', async ({ page, apiContext }) => {
    // Create a board via API for testing
    const forumName = `Forum to Delete ${Date.now()}`;

    const createResponse = await apiContext.post('/boards', {
      data: {
        name: forumName,
        description: 'Forum to be deleted',
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdBoard = await createResponse.json();
    const boardId = createdBoard.id || createdBoard['@id']?.split('/').pop();

    // Navigate to boards list
    await page.goto('/admin/boards', { waitUntil: 'networkidle' });

    // Find the row with our forum and click delete
    const row = page.getByRole('row', { name: new RegExp(forumName, 'i') });
    await expect(row).toBeVisible();

    // Click delete button (desktop view shows inline buttons)
    await row.getByRole('button', { name: /delete/i }).click();

    // Set up response listener for DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(boardId) &&
        response.request().method() === 'DELETE'
    );

    // Confirm deletion in dialog
    await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();

    // Wait for API response
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(204);

    // Verify forum is removed from the list
    await expect(page.getByRole('row', { name: new RegExp(forumName, 'i') })).not.toBeVisible();
  });
});
