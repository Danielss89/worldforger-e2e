/**
 * Shops CRUD E2E Tests
 * Tests for the main shops admin section
 */
import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Shops', () => {
  test('should display shops list page with header', async ({ page }) => {
    await page.goto('/admin/shops', { waitUntil: 'networkidle' });

    // Verify page header (use first() to handle multiple matches)
    await expect(page.getByRole('heading', { name: 'Shops', exact: true }).first()).toBeVisible();
  });

  test('should display shops from API in table', async ({ page }) => {
    // Capture /shops API response
    const shopsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/shops') &&
        !response.url().includes('/shops/') &&
        response.status() === 200 &&
        response.headers()['content-type']?.includes('json')
    );

    await page.goto('/admin/shops', { waitUntil: 'networkidle' });

    // Verify /shops API was called and returns expected data
    const shopsResponse = await shopsResponsePromise;
    const shopsData = await shopsResponse.json();

    // Check response structure - API Platform Hydra format
    expect(shopsData['@type']).toBe('Collection');

    // Get items from hydra:member or member
    const shops = shopsData['hydra:member'] || shopsData.member || [];

    // Verify each shop from API response is displayed in table
    for (const shop of shops.slice(0, 5)) {
      // Limit to first 5 to avoid timeout
      await expect(page.getByRole('rowheader', { name: shop.name })).toBeVisible();
    }
  });

  test('should navigate to create shop page', async ({ page }) => {
    await page.goto('/admin/shops', { waitUntil: 'networkidle' });

    // Click create button
    await page.getByRole('link', { name: /add shop/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL(/\/admin\/shops\/new/);
    await expect(page.getByRole('heading', { name: 'Create Shop', exact: true }).first()).toBeVisible();
  });

  test('should create a new shop', async ({ page, apiContext }) => {
    const uniqueName = `E2E Test Shop ${Date.now()}`;

    // Navigate to create page
    await page.goto('/admin/shops/new', { waitUntil: 'networkidle' });

    // Fill in the form
    await page.getByLabel(/name/i).fill(uniqueName);

    // Fill description if available
    const descriptionField = page.getByLabel(/description/i);
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Test shop description for E2E testing');
    }

    // Toggle settings - these may be toggles
    const openToggle = page.getByLabel(/open for business/i);
    if (await openToggle.isVisible()) {
      // Leave as default (should be open)
    }

    // Intercept the POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/shops') &&
        response.request().method() === 'POST' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Submit the form
    await page.getByRole('button', { name: /create shop/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    const createdShop = await createResponse.json();

    // Verify redirect to shops list
    await expect(page).toHaveURL(/\/admin\/shops$/);

    // Verify the new shop appears in the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).toBeVisible();

    // Cleanup - delete the created shop
    if (createdShop.id) {
      await apiContext.delete(`/shops/${createdShop.id}`);
    }
  });

  test('should edit an existing shop', async ({ page, apiContext }) => {
    // First create a shop to edit
    const uniqueName = `E2E Edit Test Shop ${Date.now()}`;
    const updatedName = `${uniqueName} Updated`;

    const createResponse = await apiContext.post('/shops', {
      data: {
        name: uniqueName,
        description: 'Test shop for editing',
        hidden: false,
        open: true,
        showItemsWhenShopIsClosed: true,
      },
          });

    const createdShop = await createResponse.json();
    const shopId = createdShop.id;

    try {
      // Navigate to the shops list
      await page.goto('/admin/shops', { waitUntil: 'networkidle' });

      // Find and click the edit button for our shop
      const row = page.getByRole('row').filter({ hasText: uniqueName });
      await row.getByRole('button').click(); // Open action menu
      await page.getByRole('menuitem', { name: /edit/i }).click();

      // Verify we're on the edit page
      await expect(page).toHaveURL(new RegExp(`/admin/shops/${shopId}/edit`));

      // Update the name
      const nameInput = page.getByLabel(/name/i);
      await nameInput.clear();
      await nameInput.fill(updatedName);

      // Intercept the PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/shops/${shopId}`) &&
          response.request().method() === 'PATCH' &&
          response.status() >= 200 &&
          response.status() < 300
      );

      // Submit the form
      await page.getByRole('button', { name: /save|update/i }).click();

      // Wait for API response
      await updateResponsePromise;

      // Verify redirect to shops list
      await expect(page).toHaveURL(/\/admin\/shops$/);

      // Verify the updated shop name appears
      await expect(page.getByRole('rowheader', { name: updatedName })).toBeVisible();
    } finally {
      // Cleanup - delete the shop
      await apiContext.delete(`/shops/${shopId}`);
    }
  });

  test('should delete a shop', async ({ page, apiContext }) => {
    // First create a shop to delete
    const uniqueName = `E2E Delete Test Shop ${Date.now()}`;

    const createResponse = await apiContext.post('/shops', {
      data: {
        name: uniqueName,
        description: 'Test shop for deletion',
        hidden: false,
        open: true,
        showItemsWhenShopIsClosed: true,
      },
          });

    const createdShop = await createResponse.json();
    const shopId = createdShop.id;

    // Navigate to the shops list
    await page.goto('/admin/shops', { waitUntil: 'networkidle' });

    // Find and click the delete button for our shop
    const row = page.getByRole('row').filter({ hasText: uniqueName });
    await row.getByRole('button').click(); // Open action menu
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // Confirm deletion in dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();

    // Intercept the DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/shops/${shopId}`) &&
        response.request().method() === 'DELETE' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Click confirm delete button
    await deleteDialog.getByRole('button', { name: /delete|confirm/i }).click();

    // Wait for API response
    await deleteResponsePromise;

    // Verify the shop is removed from the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).not.toBeVisible();
  });

  test('should navigate to shop item tags', async ({ page }) => {
    await page.goto('/admin/shops', { waitUntil: 'networkidle' });

    // Click shop item tags button
    await page.getByRole('button', { name: /shop item tags/i }).click();

    // Verify we're on the tags page
    await expect(page).toHaveURL(/\/admin\/shops\/tags/);
  });

  test('should navigate to give items page', async ({ page }) => {
    await page.goto('/admin/shops', { waitUntil: 'networkidle' });

    // Click give items button
    await page.getByRole('button', { name: /give items/i }).click();

    // Verify we're on the give items page
    await expect(page).toHaveURL(/\/admin\/shops\/give-items/);
  });

  test('should navigate to shop subpages', async ({ page, apiContext }) => {
    // First create a shop to navigate to
    const uniqueName = `E2E Navigation Test Shop ${Date.now()}`;

    const createResponse = await apiContext.post('/shops', {
      data: {
        name: uniqueName,
        description: 'Test shop for navigation',
        hidden: false,
        open: true,
        showItemsWhenShopIsClosed: true,
      },
          });

    const createdShop = await createResponse.json();
    const shopId = createdShop.id;

    try {
      // Navigate to the shops list
      await page.goto('/admin/shops', { waitUntil: 'networkidle' });

      // Click on the shop row to open action menu
      const row = page.getByRole('row').filter({ hasText: uniqueName });
      await row.getByRole('button').click(); // Open action menu

      // Check items link
      const itemsLink = page.getByRole('menuitem', { name: /items/i });
      if (await itemsLink.isVisible()) {
        await itemsLink.click();
        await expect(page).toHaveURL(new RegExp(`/admin/shops/${shopId}/items`));
        await page.goBack();
        await page.waitForLoadState('networkidle');
      }

      // Check categories link
      await row.getByRole('button').click();
      const categoriesLink = page.getByRole('menuitem', { name: /categories/i });
      if (await categoriesLink.isVisible()) {
        await categoriesLink.click();
        await expect(page).toHaveURL(new RegExp(`/admin/shops/${shopId}/categories`));
        await page.goBack();
        await page.waitForLoadState('networkidle');
      }

      // Check schedules link
      await row.getByRole('button').click();
      const schedulesLink = page.getByRole('menuitem', { name: /schedules/i });
      if (await schedulesLink.isVisible()) {
        await schedulesLink.click();
        await expect(page).toHaveURL(new RegExp(`/admin/shops/${shopId}/schedules`));
      }
    } finally {
      // Cleanup
      await apiContext.delete(`/shops/${shopId}`);
    }
  });
});
