/**
 * Shop Categories CRUD E2E Tests
 * Tests for the shop categories admin section (nested under shops)
 */
import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Shop Categories', () => {
  let parentShopId: string;
  const parentShopName = `E2E Shop Categories Test ${Date.now()}`;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create a parent shop for testing
    const shopResponse = await workerApiContext.post('/shops', {
      data: {
        name: parentShopName,
        description: 'Test shop for categories E2E tests',
        hidden: false,
        open: true,
        showItemsWhenShopIsClosed: true,
      },
    });
    const shop = await shopResponse.json();
    parentShopId = shop.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup: delete the parent shop (should cascade delete categories)
    if (parentShopId) {
      await workerApiContext.delete(`/shops/${parentShopId}`);
    }
  });

  test('should display shop categories list page', async ({ page }) => {
    await page.goto(`/admin/shops/${parentShopId}/categories`, { waitUntil: 'networkidle' });

    // Verify page header contains categories
    await expect(page.getByRole('heading', { name: /categories/i })).toBeVisible();
  });

  test('should display categories from API in table', async ({ page }) => {
    // Capture /shop_categories API response
    const categoriesResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/shop_categories') &&
        response.url().includes(`shop.id=${parentShopId}`) &&
        response.status() === 200
    );

    await page.goto(`/admin/shops/${parentShopId}/categories`, { waitUntil: 'networkidle' });

    // Verify /shop_categories API was called
    const categoriesResponse = await categoriesResponsePromise;
    const categoriesData = await categoriesResponse.json();

    // Check response structure
    expect(categoriesData['@type']).toBe('Collection');
  });

  test('should navigate to add category page', async ({ page }) => {
    await page.goto(`/admin/shops/${parentShopId}/categories`, { waitUntil: 'networkidle' });

    // Click add category button
    await page.getByRole('link', { name: /add category/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL(new RegExp(`/admin/shops/${parentShopId}/categories/new`));
  });

  test('should create a new shop category', async ({ page, apiContext }) => {
    const uniqueName = `E2E Test Category ${Date.now()}`;

    // Navigate to add category
    await page.goto(`/admin/shops/${parentShopId}/categories/new`, { waitUntil: 'networkidle' });

    // Fill in the form
    await page.getByLabel(/name/i).fill(uniqueName);

    // Fill description if available
    const descriptionField = page.getByLabel(/description/i);
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Test category description');
    }

    // Fill position if available
    const positionField = page.getByLabel(/position/i);
    if (await positionField.isVisible()) {
      await positionField.fill('1');
    }

    // Set hidden toggle if available
    const hiddenToggle = page.getByLabel(/hidden/i);
    if (await hiddenToggle.isVisible()) {
      // Leave as default (visible)
    }

    // Intercept the POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/shop_categories') &&
        response.request().method() === 'POST' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Submit the form
    await page.getByRole('button', { name: /add category|create|save/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    const createdCategory = await createResponse.json();

    // Verify redirect to categories list
    await expect(page).toHaveURL(new RegExp(`/admin/shops/${parentShopId}/categories`));

    // Verify the new category appears in the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).toBeVisible();

    // Cleanup - delete the created category
    if (createdCategory.id) {
      await apiContext.delete(`/shop_categories/${createdCategory.id}`);
    }
  });

  test('should edit an existing shop category', async ({ page, apiContext }) => {
    const uniqueName = `E2E Edit Category ${Date.now()}`;
    const updatedName = `${uniqueName} Updated`;

    // Create a category to edit
    const createResponse = await apiContext.post('/shop_categories', {
      data: {
        name: uniqueName,
        description: 'Test category for editing',
        position: 1,
        hidden: false,
        shop: `/shops/${parentShopId}`,
      },
    });

    const createdCategory = await createResponse.json();
    const categoryId = createdCategory.id;

    try {
      // Navigate to the categories list
      await page.goto(`/admin/shops/${parentShopId}/categories`, { waitUntil: 'networkidle' });

      // Find and click the edit button for our category
      const row = page.getByRole('row').filter({ hasText: uniqueName });
      await row.getByRole('button').click(); // Open action menu
      await page.getByRole('menuitem', { name: /edit/i }).click();

      // Verify we're on the edit page
      await expect(page).toHaveURL(
        new RegExp(`/admin/shops/${parentShopId}/categories/${categoryId}/edit`)
      );

      // Update the name
      const nameInput = page.getByLabel(/name/i);
      await nameInput.clear();
      await nameInput.fill(updatedName);

      // Intercept the PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/shop_categories/${categoryId}`) &&
          response.request().method() === 'PATCH' &&
          response.status() >= 200 &&
          response.status() < 300
      );

      // Submit the form
      await page.getByRole('button', { name: /save|update/i }).click();

      // Wait for API response
      await updateResponsePromise;

      // Verify redirect to categories list
      await expect(page).toHaveURL(new RegExp(`/admin/shops/${parentShopId}/categories`));

      // Verify the updated category name appears
      await expect(page.getByRole('rowheader', { name: updatedName })).toBeVisible();
    } finally {
      // Cleanup
      await apiContext.delete(`/shop_categories/${categoryId}`);
    }
  });

  test('should delete a shop category', async ({ page, apiContext }) => {
    const uniqueName = `E2E Delete Category ${Date.now()}`;

    // Create a category to delete
    const createResponse = await apiContext.post('/shop_categories', {
      data: {
        name: uniqueName,
        description: 'Test category for deletion',
        position: 1,
        hidden: false,
        shop: `/shops/${parentShopId}`,
      },
    });

    const createdCategory = await createResponse.json();
    const categoryId = createdCategory.id;

    // Navigate to the categories list
    await page.goto(`/admin/shops/${parentShopId}/categories`, { waitUntil: 'networkidle' });

    // Find and click the delete button for our category
    const row = page.getByRole('row').filter({ hasText: uniqueName });
    await row.getByRole('button').click(); // Open action menu
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // Confirm deletion in dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();

    // Intercept the DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/shop_categories/${categoryId}`) &&
        response.request().method() === 'DELETE' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Click confirm delete button
    await deleteDialog.getByRole('button', { name: /delete|confirm/i }).click();

    // Wait for API response
    await deleteResponsePromise;

    // Verify the category is removed from the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).not.toBeVisible();
  });

  test('should navigate back to shops list', async ({ page }) => {
    await page.goto(`/admin/shops/${parentShopId}/categories`, { waitUntil: 'networkidle' });

    // Click back to shops button
    await page.getByRole('link', { name: /back to shops/i }).click();

    // Verify we're on the shops list
    await expect(page).toHaveURL(/\/admin\/shops$/);
  });
});
