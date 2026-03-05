/**
 * Shop Schedules CRUD E2E Tests
 * Tests for the shop schedules admin section (nested under shops)
 */
import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Shop Schedules', () => {
  let parentShopId: string;
  const parentShopName = `E2E Shop Schedules Test ${Date.now()}`;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create a parent shop for testing
    const shopResponse = await workerApiContext.post('/shops', {
      data: {
        name: parentShopName,
        description: 'Test shop for schedules E2E tests',
        hidden: false,
        open: true,
        showItemsWhenShopIsClosed: true,
      },
    });
    const shop = await shopResponse.json();
    parentShopId = shop.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup: delete the parent shop (should cascade delete schedules)
    if (parentShopId) {
      await workerApiContext.delete(`/shops/${parentShopId}`);
    }
  });

  test('should display shop schedules list page', async ({ page }) => {
    await page.goto(`/admin/shops/${parentShopId}/schedules`, { waitUntil: 'networkidle' });

    // Verify page header contains schedules
    await expect(page.getByRole('heading', { name: /schedules/i })).toBeVisible();
  });

  test('should display schedules from API in table', async ({ page }) => {
    // Capture /shop_schedules API response
    const schedulesResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/shop_schedules') &&
        response.url().includes(`shop.id=${parentShopId}`) &&
        response.status() === 200
    );

    await page.goto(`/admin/shops/${parentShopId}/schedules`, { waitUntil: 'networkidle' });

    // Verify /shop_schedules API was called
    const schedulesResponse = await schedulesResponsePromise;
    const schedulesData = await schedulesResponse.json();

    // Check response structure
    expect(schedulesData['@type']).toBe('Collection');
  });

  test('should navigate to add schedule page', async ({ page }) => {
    await page.goto(`/admin/shops/${parentShopId}/schedules`, { waitUntil: 'networkidle' });

    // Click add schedule button
    await page.getByRole('link', { name: /add schedule/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL(new RegExp(`/admin/shops/${parentShopId}/schedules/new`));
  });

  test('should create a new shop schedule', async ({ page, apiContext }) => {
    const uniqueName = `E2E Test Schedule ${Date.now()}`;

    // Navigate to add schedule
    await page.goto(`/admin/shops/${parentShopId}/schedules/new`, { waitUntil: 'networkidle' });

    // Fill in the form
    await page.getByLabel(/name/i).fill(uniqueName);

    // Fill start time if available
    const startTimeField = page.getByLabel(/start time/i);
    if (await startTimeField.isVisible()) {
      await startTimeField.fill('09:00');
    }

    // Fill end time if available
    const endTimeField = page.getByLabel(/end time/i);
    if (await endTimeField.isVisible()) {
      await endTimeField.fill('17:00');
    }

    // Select days of week if available (checkboxes)
    const mondayCheckbox = page.getByLabel(/monday/i);
    if (await mondayCheckbox.isVisible()) {
      await mondayCheckbox.check();
    }

    const tuesdayCheckbox = page.getByLabel(/tuesday/i);
    if (await tuesdayCheckbox.isVisible()) {
      await tuesdayCheckbox.check();
    }

    // Set opens shop toggle if available
    const opensToggle = page.getByLabel(/opens shop/i);
    if (await opensToggle.isVisible()) {
      // Leave as default or toggle
    }

    // Set active toggle if available
    const activeToggle = page.getByLabel(/active/i);
    if (await activeToggle.isVisible()) {
      // Leave as default (active)
    }

    // Intercept the POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/shop_schedules') &&
        response.request().method() === 'POST' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Submit the form
    await page.getByRole('button', { name: /add schedule|create|save/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    const createdSchedule = await createResponse.json();

    // Verify redirect to schedules list
    await expect(page).toHaveURL(new RegExp(`/admin/shops/${parentShopId}/schedules`));

    // Verify the new schedule appears in the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).toBeVisible();

    // Cleanup - delete the created schedule
    if (createdSchedule.id) {
      await apiContext.delete(`/shop_schedules/${createdSchedule.id}`);
    }
  });

  test('should edit an existing shop schedule', async ({ page, apiContext }) => {
    const uniqueName = `E2E Edit Schedule ${Date.now()}`;
    const updatedName = `${uniqueName} Updated`;

    // Create a schedule to edit
    const createResponse = await apiContext.post('/shop_schedules', {
      data: {
        name: uniqueName,
        startTimeString: '09:00',
        endTimeString: '17:00',
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
        opensShop: true,
        active: true,
        shop: `/shops/${parentShopId}`,
      },
    });

    const createdSchedule = await createResponse.json();
    const scheduleId = createdSchedule.id;

    try {
      // Navigate to the schedules list
      await page.goto(`/admin/shops/${parentShopId}/schedules`, { waitUntil: 'networkidle' });

      // Find and click the edit button for our schedule
      const row = page.getByRole('row').filter({ hasText: uniqueName });
      await row.getByRole('button').click(); // Open action menu
      await page.getByRole('menuitem', { name: /edit/i }).click();

      // Verify we're on the edit page
      await expect(page).toHaveURL(
        new RegExp(`/admin/shops/${parentShopId}/schedules/${scheduleId}/edit`)
      );

      // Update the name
      const nameInput = page.getByLabel(/name/i);
      await nameInput.clear();
      await nameInput.fill(updatedName);

      // Intercept the PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/shop_schedules/${scheduleId}`) &&
          response.request().method() === 'PATCH' &&
          response.status() >= 200 &&
          response.status() < 300
      );

      // Submit the form
      await page.getByRole('button', { name: /save|update/i }).click();

      // Wait for API response
      await updateResponsePromise;

      // Verify redirect to schedules list
      await expect(page).toHaveURL(new RegExp(`/admin/shops/${parentShopId}/schedules`));

      // Verify the updated schedule name appears
      await expect(page.getByRole('rowheader', { name: updatedName })).toBeVisible();
    } finally {
      // Cleanup
      await apiContext.delete(`/shop_schedules/${scheduleId}`);
    }
  });

  test('should delete a shop schedule', async ({ page, apiContext }) => {
    const uniqueName = `E2E Delete Schedule ${Date.now()}`;

    // Create a schedule to delete
    const createResponse = await apiContext.post('/shop_schedules', {
      data: {
        name: uniqueName,
        startTimeString: '10:00',
        endTimeString: '18:00',
        daysOfWeek: [0, 6], // Sat-Sun
        opensShop: false,
        active: false,
        shop: `/shops/${parentShopId}`,
      },
    });

    const createdSchedule = await createResponse.json();
    const scheduleId = createdSchedule.id;

    // Navigate to the schedules list
    await page.goto(`/admin/shops/${parentShopId}/schedules`, { waitUntil: 'networkidle' });

    // Find and click the delete button for our schedule
    const row = page.getByRole('row').filter({ hasText: uniqueName });
    await row.getByRole('button').click(); // Open action menu
    await page.getByRole('menuitem', { name: /delete/i }).click();

    // Confirm deletion in dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();

    // Intercept the DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/shop_schedules/${scheduleId}`) &&
        response.request().method() === 'DELETE' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Click confirm delete button
    await deleteDialog.getByRole('button', { name: /delete|confirm/i }).click();

    // Wait for API response
    await deleteResponsePromise;

    // Verify the schedule is removed from the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).not.toBeVisible();
  });

  test('should navigate back to shops list', async ({ page }) => {
    await page.goto(`/admin/shops/${parentShopId}/schedules`, { waitUntil: 'networkidle' });

    // Click back to shops button
    await page.getByRole('link', { name: /back to shops/i }).click();

    // Verify we're on the shops list
    await expect(page).toHaveURL(/\/admin\/shops$/);
  });
});
