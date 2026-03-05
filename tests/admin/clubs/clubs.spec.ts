/**
 * Clubs CRUD E2E Tests
 * Tests for the main clubs admin section
 */
import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Clubs', () => {
  test('should display clubs list page with header', async ({ page }) => {
    await page.goto('/admin/clubs', { waitUntil: 'networkidle' });

    // Verify page header (use first() to handle multiple matches)
    await expect(page.getByRole('heading', { name: 'Clubs', exact: true }).first()).toBeVisible();
  });

  test('should display clubs from API in table', async ({ page }) => {
    // Capture /clubs API response
    const clubsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/clubs') &&
        !response.url().includes('/clubs/') &&
        response.status() === 200 &&
        response.headers()['content-type']?.includes('json')
    );

    await page.goto('/admin/clubs', { waitUntil: 'networkidle' });

    // Verify /clubs API was called and returns expected data
    const clubsResponse = await clubsResponsePromise;
    const clubsData = await clubsResponse.json();

    // Check response structure - API Platform Hydra format
    expect(clubsData['@type']).toBe('Collection');

    // Get items from hydra:member or member
    const clubs = clubsData['hydra:member'] || clubsData.member || [];

    // Verify each club from API response is displayed in table
    for (const club of clubs.slice(0, 5)) {
      // Limit to first 5 to avoid timeout - use first() to handle duplicates
      await expect(page.getByRole('rowheader', { name: club.name }).first()).toBeVisible();
    }
  });

  test('should navigate to create club page', async ({ page }) => {
    await page.goto('/admin/clubs', { waitUntil: 'networkidle' });

    // Click create button (it's a button, not a link)
    await page.getByRole('button', { name: /create club/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL(/\/admin\/clubs\/new/);
    await expect(page.getByRole('heading', { name: 'Create Club', exact: true }).first()).toBeVisible();
  });

  test('should create a new club', async ({ page, apiContext }) => {
    const uniqueName = `E2E Test Club ${Date.now()}`;

    // Navigate to create page
    await page.goto('/admin/clubs/new', { waitUntil: 'networkidle' });

    // Fill in the form - use first() to avoid strict mode if multiple name fields
    await page.getByLabel(/name/i).first().fill(uniqueName);

    // Fill description using the rich text editor
    const descriptionEditor = page.locator('[data-testid="rich-text-editor"]').first();
    if (await descriptionEditor.isVisible()) {
      await descriptionEditor.click();
      await page.keyboard.type('Test club description for E2E testing');
    }

    // Toggle settings if visible
    const publicToggle = page.getByLabel(/public/i);
    if (await publicToggle.isVisible()) {
      // Leave as default
    }

    // Intercept the POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/clubs') &&
        response.request().method() === 'POST' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Submit the form
    await page.getByRole('button', { name: /create club/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    const createdClub = await createResponse.json();

    // Verify redirect to clubs list
    await expect(page).toHaveURL(/\/admin\/clubs$/);

    // Verify the new club appears in the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).toBeVisible();

    // Cleanup - delete the created club
    if (createdClub.id) {
      await apiContext.delete(`/clubs/${createdClub.id}`);
    }
  });

  test('should edit an existing club', async ({ page, apiContext }) => {
    // First create a club to edit
    const uniqueName = `E2E Edit Test Club ${Date.now()}`;
    const updatedName = `${uniqueName} Updated`;

    const createResponse = await apiContext.post('/clubs', {
      data: {
        name: uniqueName,
        description: 'Test club for editing',
        isPublic: true,
        isOpenForJoining: true,
        isOfficial: false,
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createdClub = await createResponse.json();
    const clubId = createdClub.id;

    try {
      // Navigate to the clubs list
      await page.goto('/admin/clubs', { waitUntil: 'networkidle' });

      // Search for the club to make sure it's visible
      const searchInput = page.getByPlaceholder(/search/i);
      if (await searchInput.isVisible()) {
        await searchInput.fill(uniqueName);
        await page.waitForTimeout(500); // Wait for search debounce
      }

      // Find and click the edit button for our club
      const row = page.getByRole('row').filter({ hasText: uniqueName });
      await expect(row).toBeVisible({ timeout: 10000 });
      await row.getByRole('button', { name: /edit/i }).click();

      // Verify we're on the edit page
      await expect(page).toHaveURL(new RegExp(`/admin/clubs/${clubId}/edit`));

      // Update the name - use first() to avoid strict mode if multiple name fields
      const nameInput = page.getByLabel(/name/i).first();
      await nameInput.clear();
      await nameInput.fill(updatedName);

      // Intercept the PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/clubs/${clubId}`) &&
          response.request().method() === 'PATCH' &&
          response.status() >= 200 &&
          response.status() < 300
      );

      // Submit the form
      await page.getByRole('button', { name: /save|update/i }).click();

      // Wait for API response
      await updateResponsePromise;

      // Verify redirect to clubs list
      await expect(page).toHaveURL(/\/admin\/clubs$/);

      // Verify the updated club name appears
      await expect(page.getByRole('rowheader', { name: updatedName })).toBeVisible();
    } finally {
      // Cleanup - delete the club
      await apiContext.delete(`/clubs/${clubId}`);
    }
  });

  test('should delete a club', async ({ page, apiContext }) => {
    // First create a club to delete
    const uniqueName = `E2E Delete Test Club ${Date.now()}`;

    const createResponse = await apiContext.post('/clubs', {
      data: {
        name: uniqueName,
        description: 'Test club for deletion',
        isPublic: true,
        isOpenForJoining: true,
        isOfficial: false,
      },
    });

    expect(createResponse.ok()).toBeTruthy();
    const createdClub = await createResponse.json();
    const clubId = createdClub.id;

    // Navigate to the clubs list
    await page.goto('/admin/clubs', { waitUntil: 'networkidle' });

    // Search for the club to make sure it's visible
    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill(uniqueName);
      await page.waitForTimeout(500); // Wait for search debounce
    }

    // Find and click the delete button for our club
    const row = page.getByRole('row').filter({ hasText: uniqueName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: /delete/i }).click();

    // Confirm deletion in dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();

    // Intercept the DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/clubs/${clubId}`) &&
        response.request().method() === 'DELETE' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Click confirm delete button
    await deleteDialog.getByRole('button', { name: /delete|confirm/i }).click();

    // Wait for API response
    await deleteResponsePromise;

    // Verify the club is removed from the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).not.toBeVisible();
  });

  test('should show validation error when creating club without name', async ({ page }) => {
    await page.goto('/admin/clubs/new', { waitUntil: 'networkidle' });

    // Try to submit without filling name
    await page.getByRole('button', { name: /create club/i }).click();

    // Verify validation error is shown (may be inline or in a toast)
    await expect(page.getByText(/name is required|required/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to club subpages', async ({ page, apiContext }) => {
    // First create a club to navigate to
    const uniqueName = `E2E Navigation Test Club ${Date.now()}`;

    const createResponse = await apiContext.post('/clubs', {
      data: {
        name: uniqueName,
        description: 'Test club for navigation',
        isPublic: true,
        isOpenForJoining: true,
        isOfficial: false,
      },
    });

    const createdClub = await createResponse.json();
    const clubId = createdClub.id;

    try {
      // Navigate to the clubs list
      await page.goto('/admin/clubs', { waitUntil: 'networkidle' });

      // Click on the club row to navigate to edit page (no members link in list view)
      const row = page.getByRole('row').filter({ hasText: uniqueName });
      await row.getByRole('button', { name: /edit/i }).click();

      // Verify we're on the edit page
      await expect(page).toHaveURL(new RegExp(`/admin/clubs/${clubId}/edit`));
    } finally {
      // Cleanup
      await apiContext.delete(`/clubs/${clubId}`);
    }
  });
});
