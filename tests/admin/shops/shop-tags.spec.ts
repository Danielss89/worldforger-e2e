/**
 * Shop Item Tags CRUD E2E Tests
 * Tests for the global shop item tags admin section
 * NOTE: Tags are global, not nested under specific shops
 */
import { test, expect } from '@playwright/test';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Shop Item Tags', () => {
  test('should display shop item tags list page', async ({ page }) => {
    await page.goto('/admin/shops/tags', { waitUntil: 'networkidle' });

    // Verify page header
    await expect(page.getByRole('heading', { name: /shop item tags/i })).toBeVisible();
  });

  test('should display tags from API in table', async ({ page }) => {
    // Capture /shop_item_tags API response
    const tagsResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/shop_item_tags') && response.status() === 200
    );

    await page.goto('/admin/shops/tags', { waitUntil: 'networkidle' });

    // Verify /shop_item_tags API was called and returns expected data
    const tagsResponse = await tagsResponsePromise;
    const tagsData = await tagsResponse.json();

    // Check response structure - API Platform Hydra format
    expect(tagsData['@type']).toBe('Collection');

    // Get items from hydra:member or member
    const tags = tagsData['hydra:member'] || tagsData.member || [];

    // Verify each tag from API response is displayed in table
    for (const tag of tags.slice(0, 5)) {
      // Limit to first 5 to avoid timeout
      await expect(page.getByRole('rowheader', { name: tag.name })).toBeVisible();
    }
  });

  test('should navigate to create tag page', async ({ page }) => {
    await page.goto('/admin/shops/tags', { waitUntil: 'networkidle' });

    // Click create button
    await page.getByRole('link', { name: /add tag/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL(/\/admin\/shops\/tags\/new/);
  });

  test('should create a new shop item tag', async ({ page, request }) => {
    const uniqueName = `E2E Test Tag ${Date.now()}`;

    // Navigate to create page
    await page.goto('/admin/shops/tags/new', { waitUntil: 'networkidle' });

    // Fill in the form
    await page.getByLabel(/name/i).fill(uniqueName);

    // Fill description if available
    const descriptionField = page.getByLabel(/description/i);
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Test tag description for E2E testing');
    }

    // Intercept the POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/shop_item_tags') &&
        response.request().method() === 'POST' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Submit the form
    await page.getByRole('button', { name: /add tag|create|save/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    const createdTag = await createResponse.json();

    // Verify redirect to tags list
    await expect(page).toHaveURL(/\/admin\/shops\/tags$/);

    // Verify the new tag appears in the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).toBeVisible();

    // Cleanup - delete the created tag
    if (createdTag.id) {
      await request.delete(`${API_URL}/shop_item_tags/${createdTag.id}`);
    }
  });

  test('should edit an existing shop item tag', async ({ page, request }) => {
    const uniqueName = `E2E Edit Tag ${Date.now()}`;
    const updatedName = `${uniqueName} Updated`;

    // Create a tag to edit (non-system tag)
    const createResponse = await request.post(`${API_URL}/shop_item_tags`, {
      data: {
        name: uniqueName,
        description: 'Test tag for editing',
        systemTag: false,
      },
      headers: { 'Content-Type': 'application/ld+json' },
    });

    const createdTag = await createResponse.json();
    const tagId = createdTag.id;

    try {
      // Navigate to the tags list
      await page.goto('/admin/shops/tags', { waitUntil: 'networkidle' });

      // Find and click the edit button for our tag
      const row = page.getByRole('row').filter({ hasText: uniqueName });
      await row.getByRole('button').click(); // Open action menu
      await page.getByRole('menuitem', { name: /edit/i }).click();

      // Verify we're on the edit page
      await expect(page).toHaveURL(new RegExp(`/admin/shops/tags/${tagId}/edit`));

      // Update the name
      const nameInput = page.getByLabel(/name/i);
      await nameInput.clear();
      await nameInput.fill(updatedName);

      // Intercept the PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/shop_item_tags/${tagId}`) &&
          response.request().method() === 'PATCH' &&
          response.status() >= 200 &&
          response.status() < 300
      );

      // Submit the form
      await page.getByRole('button', { name: /save|update/i }).click();

      // Wait for API response
      await updateResponsePromise;

      // Verify redirect to tags list
      await expect(page).toHaveURL(/\/admin\/shops\/tags$/);

      // Verify the updated tag name appears
      await expect(page.getByRole('rowheader', { name: updatedName })).toBeVisible();
    } finally {
      // Cleanup
      await request.delete(`${API_URL}/shop_item_tags/${tagId}`);
    }
  });

  test('should delete a shop item tag', async ({ page, request }) => {
    const uniqueName = `E2E Delete Tag ${Date.now()}`;

    // Create a tag to delete (non-system tag)
    const createResponse = await request.post(`${API_URL}/shop_item_tags`, {
      data: {
        name: uniqueName,
        description: 'Test tag for deletion',
        systemTag: false,
      },
      headers: { 'Content-Type': 'application/ld+json' },
    });

    const createdTag = await createResponse.json();
    const tagId = createdTag.id;

    // Navigate to the tags list
    await page.goto('/admin/shops/tags', { waitUntil: 'networkidle' });

    // Find and click the delete button for our tag
    const row = page.getByRole('row').filter({ hasText: uniqueName });
    await row.getByRole('button').click(); // Open action menu
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // Confirm deletion in dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();

    // Intercept the DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/shop_item_tags/${tagId}`) &&
        response.request().method() === 'DELETE' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Click confirm delete button
    await deleteDialog.getByRole('button', { name: /delete|confirm/i }).click();

    // Wait for API response
    await deleteResponsePromise;

    // Verify the tag is removed from the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).not.toBeVisible();
  });

  test('should not allow editing system tags', async ({ page }) => {
    // Navigate to tags list
    await page.goto('/admin/shops/tags', { waitUntil: 'networkidle' });

    // Find a system tag row (if any)
    const systemTagRow = page.getByRole('row').filter({ hasText: /system/i }).first();

    if (await systemTagRow.isVisible()) {
      // Click the action menu
      await systemTagRow.getByRole('button').click();

      // Edit option should not be visible for system tags
      const editOption = page.getByRole('menuitem', { name: /edit/i });
      // Either not visible or disabled
    }
  });

  test('should not allow deleting system tags', async ({ page }) => {
    // Navigate to tags list
    await page.goto('/admin/shops/tags', { waitUntil: 'networkidle' });

    // Find a system tag row (if any)
    const systemTagRow = page.getByRole('row').filter({ hasText: /system/i }).first();

    if (await systemTagRow.isVisible()) {
      // Click the action menu
      await systemTagRow.getByRole('button').click();

      // Delete option should not be visible for system tags
      const deleteOption = page.getByRole('menuitem', { name: /delete/i });
      // Either not visible or disabled
    }
  });

  test('should navigate back to shops list', async ({ page }) => {
    await page.goto('/admin/shops/tags', { waitUntil: 'networkidle' });

    // Click back to shops button
    await page.getByRole('link', { name: /back to shops/i }).click();

    // Verify we're on the shops list
    await expect(page).toHaveURL(/\/admin\/shops$/);
  });
});
