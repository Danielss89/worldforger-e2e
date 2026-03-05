/**
 * Shop Items CRUD E2E Tests
 * Tests for the shop items admin section (nested under shops)
 */
import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Shop Items', () => {
  let parentShopId: string;
  let moneyTypeId: string;
  const parentShopName = `E2E Shop Items Test ${Date.now()}`;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create a parent shop for testing
    const shopResponse = await workerApiContext.post('/shops', {
      data: {
        name: parentShopName,
        description: 'Test shop for items E2E tests',
        hidden: false,
        open: true,
        showItemsWhenShopIsClosed: true,
      },
    });
    const shop = await shopResponse.json();
    parentShopId = shop.id;

    // Get a money type for item prices
    const moneyResponse = await workerApiContext.get('/money_types?itemsPerPage=1');
    const moneyData = await moneyResponse.json();
    const moneyTypes = moneyData['hydra:member'] || moneyData.member || [];
    if (moneyTypes.length > 0) {
      moneyTypeId = moneyTypes[0].id;
    }
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup: delete the parent shop (should cascade delete items)
    if (parentShopId) {
      await workerApiContext.delete(`/shops/${parentShopId}`);
    }
  });

  test('should display shop items list page', async ({ page }) => {
    await page.goto(`/admin/shops/${parentShopId}/items`, { waitUntil: 'networkidle' });

    // Verify page header contains items
    await expect(page.getByRole('heading', { name: /items/i })).toBeVisible();
  });

  test('should display items from API in table', async ({ page }) => {
    // Capture /items API response
    const itemsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/items') &&
        response.url().includes(`shop.id=${parentShopId}`) &&
        response.status() === 200
    );

    await page.goto(`/admin/shops/${parentShopId}/items`, { waitUntil: 'networkidle' });

    // Verify /items API was called
    const itemsResponse = await itemsResponsePromise;
    const itemsData = await itemsResponse.json();

    // Check response structure
    expect(itemsData['@type']).toBe('Collection');
  });

  test('should navigate to add item page', async ({ page }) => {
    await page.goto(`/admin/shops/${parentShopId}/items`, { waitUntil: 'networkidle' });

    // Click add item button
    await page.getByRole('link', { name: /add item/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL(new RegExp(`/admin/shops/${parentShopId}/items/new`));
  });

  test('should create a new shop item', async ({ page, apiContext }) => {
    if (!moneyTypeId) {
      test.skip(true, 'No money type available for testing');
      return;
    }

    const uniqueName = `E2E Test Item ${Date.now()}`;

    // Navigate to add item
    await page.goto(`/admin/shops/${parentShopId}/items/new`, { waitUntil: 'networkidle' });

    // Fill in the form
    await page.getByLabel(/name/i).fill(uniqueName);

    // Fill description if available
    const descriptionField = page.getByLabel(/description/i);
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Test item description');
    }

    // Fill price
    const priceField = page.getByLabel(/price/i);
    if (await priceField.isVisible()) {
      await priceField.fill('100');
    }

    // Select money type if available
    const moneyPicker = page.locator('[data-testid="money-picker"]').first();
    if (await moneyPicker.isVisible()) {
      await moneyPicker.click();
      await page.getByRole('option').first().click();
    }

    // Fill stock if available
    const stockField = page.getByLabel(/stock/i);
    if (await stockField.isVisible()) {
      await stockField.fill('10');
    }

    // Intercept the POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/items') &&
        response.request().method() === 'POST' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Submit the form
    await page.getByRole('button', { name: /add item|create|save/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    const createdItem = await createResponse.json();

    // Verify redirect to items list
    await expect(page).toHaveURL(new RegExp(`/admin/shops/${parentShopId}/items`));

    // Verify the new item appears in the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).toBeVisible();

    // Cleanup - delete the created item
    if (createdItem.id) {
      await apiContext.delete(`/items/${createdItem.id}`);
    }
  });

  test('should edit an existing shop item', async ({ page, apiContext }) => {
    if (!moneyTypeId) {
      test.skip(true, 'No money type available for testing');
      return;
    }

    const uniqueName = `E2E Edit Item ${Date.now()}`;
    const updatedName = `${uniqueName} Updated`;

    // Create an item to edit
    const createResponse = await apiContext.post('/items', {
      data: {
        name: uniqueName,
        description: 'Test item for editing',
        price: 100,
        stock: 10,
        shop: `/shops/${parentShopId}`,
        money: `/money_types/${moneyTypeId}`,
        giftable: true,
        autoRefill: false,
      },
    });

    const createdItem = await createResponse.json();
    const itemId = createdItem.id;

    try {
      // Navigate to the items list
      await page.goto(`/admin/shops/${parentShopId}/items`, { waitUntil: 'networkidle' });

      // Find and click the edit button for our item
      const row = page.getByRole('row').filter({ hasText: uniqueName });
      await row.getByRole('button').click(); // Open action menu
      await page.getByRole('menuitem', { name: /edit/i }).click();

      // Verify we're on the edit page
      await expect(page).toHaveURL(new RegExp(`/admin/shops/${parentShopId}/items/${itemId}/edit`));

      // Update the name
      const nameInput = page.getByLabel(/name/i);
      await nameInput.clear();
      await nameInput.fill(updatedName);

      // Intercept the PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/items/${itemId}`) &&
          response.request().method() === 'PATCH' &&
          response.status() >= 200 &&
          response.status() < 300
      );

      // Submit the form
      await page.getByRole('button', { name: /save|update/i }).click();

      // Wait for API response
      await updateResponsePromise;

      // Verify redirect to items list
      await expect(page).toHaveURL(new RegExp(`/admin/shops/${parentShopId}/items`));

      // Verify the updated item name appears
      await expect(page.getByRole('rowheader', { name: updatedName })).toBeVisible();
    } finally {
      // Cleanup
      await apiContext.delete(`/items/${itemId}`);
    }
  });

  test('should delete a shop item', async ({ page, apiContext }) => {
    if (!moneyTypeId) {
      test.skip(true, 'No money type available for testing');
      return;
    }

    const uniqueName = `E2E Delete Item ${Date.now()}`;

    // Create an item to delete
    const createResponse = await apiContext.post('/items', {
      data: {
        name: uniqueName,
        description: 'Test item for deletion',
        price: 100,
        stock: 5,
        shop: `/shops/${parentShopId}`,
        money: `/money_types/${moneyTypeId}`,
        giftable: false,
        autoRefill: false,
      },
    });

    const createdItem = await createResponse.json();
    const itemId = createdItem.id;

    // Navigate to the items list
    await page.goto(`/admin/shops/${parentShopId}/items`, { waitUntil: 'networkidle' });

    // Find and click the delete button for our item
    const row = page.getByRole('row').filter({ hasText: uniqueName });
    await row.getByRole('button').click(); // Open action menu
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // Confirm deletion in dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();

    // Intercept the DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/items/${itemId}`) &&
        response.request().method() === 'DELETE' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Click confirm delete button
    await deleteDialog.getByRole('button', { name: /delete|confirm/i }).click();

    // Wait for API response
    await deleteResponsePromise;

    // Verify the item is removed from the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).not.toBeVisible();
  });

  test('should navigate back to shops list', async ({ page }) => {
    await page.goto(`/admin/shops/${parentShopId}/items`, { waitUntil: 'networkidle' });

    // Click back to shops button
    await page.getByRole('link', { name: /back to shops/i }).click();

    // Verify we're on the shops list
    await expect(page).toHaveURL(/\/admin\/shops$/);
  });
});
