/**
 * Club Pages CRUD E2E Tests
 * Tests for the club pages admin section (nested under clubs)
 */
import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Club Pages', () => {
  let parentClubId: string;
  const parentClubName = `E2E Club Pages Test ${Date.now()}`;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create a parent club for testing
    const clubResponse = await workerApiContext.post('/clubs', {
      data: {
        name: parentClubName,
        description: 'Test club for pages E2E tests',
        isPublic: true,
        isOpenForJoining: true,
        isOfficial: false,
      },
    });
    const club = await clubResponse.json();
    parentClubId = club.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup: delete the parent club (should cascade delete pages)
    if (parentClubId) {
      await workerApiContext.delete(`/clubs/${parentClubId}`);
    }
  });

  test('should display club pages list page', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/pages`, { waitUntil: 'networkidle' });

    // Verify page header contains pages - use first() to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /pages/i }).first()).toBeVisible();
  });

  test('should display pages from API in table', async ({ page }) => {
    // Capture /club_pages API response
    const pagesResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/club_pages') &&
        response.url().includes(`club.id=${parentClubId}`) &&
        response.status() === 200
    );

    await page.goto(`/admin/clubs/${parentClubId}/pages`, { waitUntil: 'networkidle' });

    // Verify /club_pages API was called
    const pagesResponse = await pagesResponsePromise;
    const pagesData = await pagesResponse.json();

    // Check response structure
    expect(pagesData['@type']).toBe('Collection');
  });

  test('should navigate to add page page', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/pages`, { waitUntil: 'networkidle' });

    // Click add page button
    await page.getByRole('button', { name: /add page/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL(new RegExp(`/admin/clubs/${parentClubId}/pages/new`));
  });

  test('should create a new club page', async ({ page, apiContext }) => {
    const uniqueTitle = `E2E Test Page ${Date.now()}`;

    // Navigate to add page
    await page.goto(`/admin/clubs/${parentClubId}/pages/new`, { waitUntil: 'networkidle' });

    // Fill in the form
    await page.getByLabel(/title/i).fill(uniqueTitle);

    // Fill content using the rich text editor if available
    const contentEditor = page.locator('[data-testid="rich-text-editor"]').first();
    if (await contentEditor.isVisible()) {
      await contentEditor.click();
      await page.keyboard.type('Test page content for E2E testing');
    } else {
      const contentArea = page.getByLabel(/content/i);
      if (await contentArea.isVisible()) {
        await contentArea.fill('Test page content for E2E testing');
      }
    }

    // Intercept the POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/club_pages') &&
        response.request().method() === 'POST' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Submit the form
    await page.getByRole('button', { name: /add page|create|save/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    const createdPage = await createResponse.json();

    // Verify redirect to pages list
    await expect(page).toHaveURL(new RegExp(`/admin/clubs/${parentClubId}/pages`));

    // Verify the new page appears in the list
    await expect(page.getByRole('rowheader', { name: uniqueTitle })).toBeVisible();

    // Cleanup - delete the created page
    if (createdPage.id) {
      await apiContext.delete(`/club_pages/${createdPage.id}`);
    }
  });

  test('should edit an existing club page', async ({ page, apiContext }) => {
    const uniqueTitle = `E2E Edit Page ${Date.now()}`;
    const updatedTitle = `${uniqueTitle} Updated`;

    // Create a page to edit
    const createResponse = await apiContext.post('/club_pages', {
      data: {
        title: uniqueTitle,
        content: '<p>Test page content</p>',
        club: `/clubs/${parentClubId}`,
      },
    });

    const createdPage = await createResponse.json();
    const pageId = createdPage.id;

    try {
      // Navigate to the pages list
      await page.goto(`/admin/clubs/${parentClubId}/pages`, { waitUntil: 'networkidle' });

      // Find and click the edit button for our page
      const row = page.getByRole('row').filter({ hasText: uniqueTitle });
      await row.getByRole('button', { name: /edit/i }).click();

      // Verify we're on the edit page
      await expect(page).toHaveURL(new RegExp(`/admin/clubs/${parentClubId}/pages/${pageId}/edit`));

      // Update the title
      const titleInput = page.getByLabel(/title/i);
      await titleInput.clear();
      await titleInput.fill(updatedTitle);

      // Intercept the PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/club_pages/${pageId}`) &&
          response.request().method() === 'PATCH' &&
          response.status() >= 200 &&
          response.status() < 300
      );

      // Submit the form
      await page.getByRole('button', { name: /save|update/i }).click();

      // Wait for API response
      await updateResponsePromise;

      // Verify redirect to pages list
      await expect(page).toHaveURL(new RegExp(`/admin/clubs/${parentClubId}/pages`));

      // Verify the updated page title appears
      await expect(page.getByRole('rowheader', { name: updatedTitle })).toBeVisible();
    } finally {
      // Cleanup
      await apiContext.delete(`/club_pages/${pageId}`);
    }
  });

  test('should delete a club page', async ({ page, apiContext }) => {
    const uniqueTitle = `E2E Delete Page ${Date.now()}`;

    // Create a page to delete
    const createResponse = await apiContext.post('/club_pages', {
      data: {
        title: uniqueTitle,
        content: '<p>Test page for deletion</p>',
        club: `/clubs/${parentClubId}`,
      },
    });

    const createdPage = await createResponse.json();
    const pageId = createdPage.id;

    // Navigate to the pages list
    await page.goto(`/admin/clubs/${parentClubId}/pages`, { waitUntil: 'networkidle' });

    // Find and click the delete button for our page
    const row = page.getByRole('row').filter({ hasText: uniqueTitle });
    await row.getByRole('button', { name: /delete/i }).click();

    // Confirm deletion in dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();

    // Intercept the DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/club_pages/${pageId}`) &&
        response.request().method() === 'DELETE' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Click confirm delete button
    await deleteDialog.getByRole('button', { name: /delete|confirm/i }).click();

    // Wait for API response
    await deleteResponsePromise;

    // Verify the page is removed from the list
    await expect(page.getByRole('rowheader', { name: uniqueTitle })).not.toBeVisible();
  });

  test('should navigate back to clubs list', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/pages`, { waitUntil: 'networkidle' });

    // Click back to clubs button
    await page.getByRole('link', { name: /back to clubs/i }).click();

    // Verify we're on the clubs list
    await expect(page).toHaveURL(/\/admin\/clubs$/);
  });
});
