import { test, expect } from '../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Chats CRUD', () => {
  test('should display chats from API in table', async ({ page }) => {
    // Capture /chats API response
    const chatsResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/chats`) && response.status() === 200
    );

    await page.goto('/admin/chats', { waitUntil: 'networkidle' });

    // Verify header
    await expect(page.getByRole('heading', { name: /chats/i })).toBeVisible();

    // Verify /chats API was called and returns expected data
    const chatsResponse = await chatsResponsePromise;
    const chatsData = await chatsResponse.json();

    // Check response structure (supports both hydra:member and member)
    const chats = chatsData['hydra:member'] || chatsData.member || [];
    expect(chats.length).toBeGreaterThanOrEqual(0);

    // Verify each chat from API response is displayed in table
    for (const chat of chats) {
      await expect(page.getByRole('rowheader', { name: chat.name })).toBeVisible();
    }
  });

  test('should create a new chat', async ({ page, apiContext }) => {
    const testChatName = `E2E Test Chat ${Date.now()}`;

    await page.goto('/admin/chats/new', { waitUntil: 'networkidle' });

    // Verify create page loaded
    await expect(page.getByRole('heading', { name: /create chat/i })).toBeVisible();

    // Fill in the form - use more specific selector for name input
    await page.getByRole('textbox', { name: /^name/i }).fill(testChatName);

    // Set up response listener for POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`${API_URL}/chats`) &&
        response.request().method() === 'POST'
    );

    // Submit form
    await page.getByRole('button', { name: /create chat/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const createdChat = await createResponse.json();
    expect(createdChat.name).toBe(testChatName);

    // Verify redirect to chats list
    await expect(page).toHaveURL(/\/admin\/chats$/);

    // Cleanup - delete the created chat
    const chatId = createdChat.id || createdChat['@id']?.split('/').pop();
    if (chatId) {
      await apiContext.delete(`/chats/${chatId}`);
    }
  });

  test('should update an existing chat', async ({ page, apiContext }) => {
    // Create a chat via API for testing
    const originalName = `Original Chat ${Date.now()}`;
    const updatedName = `Updated Chat ${Date.now()}`;

    const createResponse = await apiContext.post('/chats', {
      data: { name: originalName },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdChat = await createResponse.json();
    const chatId = createdChat.id || createdChat['@id']?.split('/').pop();

    try {
      // Navigate to edit page
      await page.goto(`/admin/chats/${chatId}/edit`, { waitUntil: 'networkidle' });

      // Verify edit page loaded with existing data - use more specific selector
      await expect(page.getByRole('textbox', { name: /^name/i })).toHaveValue(originalName);

      // Update the name
      await page.getByRole('textbox', { name: /^name/i }).clear();
      await page.getByRole('textbox', { name: /^name/i }).fill(updatedName);

      // Set up response listener for PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(chatId) &&
          response.request().method() === 'PATCH'
      );

      // Submit form
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for API response
      const updateResponse = await updateResponsePromise;
      expect(updateResponse.status()).toBe(200);

      const updatedChat = await updateResponse.json();
      expect(updatedChat.name).toBe(updatedName);

      // Verify redirect to chats list
      await expect(page).toHaveURL(/\/admin\/chats$/);
    } finally {
      // Cleanup
      await apiContext.delete(`/chats/${chatId}`);
    }
  });

  test('should delete a chat', async ({ page, apiContext }) => {
    // Create a chat via API for testing
    const chatName = `Chat to Delete ${Date.now()}`;

    const createResponse = await apiContext.post('/chats', {
      data: { name: chatName },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdChat = await createResponse.json();
    const chatId = createdChat.id || createdChat['@id']?.split('/').pop();

    // Navigate to chats list
    await page.goto('/admin/chats', { waitUntil: 'networkidle' });

    // Find the row with our chat and click delete
    const row = page.getByRole('row', { name: new RegExp(chatName, 'i') });
    await expect(row).toBeVisible();

    // Click delete button (desktop view shows inline buttons)
    await row.getByRole('button', { name: /delete/i }).click();

    // Set up response listener for DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(chatId) &&
        response.request().method() === 'DELETE'
    );

    // Confirm deletion in dialog
    await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();

    // Wait for API response
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(204);

    // Verify chat is removed from the list
    await expect(page.getByRole('row', { name: new RegExp(chatName, 'i') })).not.toBeVisible();
  });
});
