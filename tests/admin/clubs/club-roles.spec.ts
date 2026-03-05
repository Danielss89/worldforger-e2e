/**
 * Club Roles CRUD E2E Tests
 * Tests for the club roles admin section (nested under clubs)
 */
import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Club Roles', () => {
  let parentClubId: string;
  const parentClubName = `E2E Club Roles Test ${Date.now()}`;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create a parent club for testing
    const clubResponse = await workerApiContext.post('/clubs', {
      data: {
        name: parentClubName,
        description: 'Test club for roles E2E tests',
        isPublic: true,
        isOpenForJoining: true,
        isOfficial: false,
      },
    });
    const club = await clubResponse.json();
    parentClubId = club.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup: delete the parent club (should cascade delete roles)
    if (parentClubId) {
      await workerApiContext.delete(`/clubs/${parentClubId}`);
    }
  });

  test('should display club roles list page', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/roles`, { waitUntil: 'networkidle' });

    // Verify page header contains roles
    await expect(page.getByRole('heading', { name: /roles/i })).toBeVisible();
  });

  test('should display roles from API in table', async ({ page }) => {
    // Capture /club_roles API response
    const rolesResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/club_roles') &&
        response.url().includes(`club.id=${parentClubId}`) &&
        response.status() === 200
    );

    await page.goto(`/admin/clubs/${parentClubId}/roles`, { waitUntil: 'networkidle' });

    // Verify /club_roles API was called
    const rolesResponse = await rolesResponsePromise;
    const rolesData = await rolesResponse.json();

    // Check response structure
    expect(rolesData['@type']).toBe('Collection');
  });

  test('should navigate to add role page', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/roles`, { waitUntil: 'networkidle' });

    // Click add role button
    await page.getByRole('button', { name: /add role/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL(new RegExp(`/admin/clubs/${parentClubId}/roles/new`));
  });

  test('should create a new club role', async ({ page, apiContext }) => {
    const uniqueName = `E2E Test Role ${Date.now()}`;

    // Navigate to add role
    await page.goto(`/admin/clubs/${parentClubId}/roles/new`, { waitUntil: 'networkidle' });

    // Fill in the form
    await page.getByLabel(/name/i).fill(uniqueName);

    // Fill description if available
    const descriptionField = page.getByLabel(/description/i);
    if (await descriptionField.isVisible()) {
      await descriptionField.fill('Test role description for E2E testing');
    }

    // Intercept the POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/club_roles') &&
        response.request().method() === 'POST' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Submit the form
    await page.getByRole('button', { name: /add role|create|save/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    const createdRole = await createResponse.json();

    // Verify redirect to roles list
    await expect(page).toHaveURL(new RegExp(`/admin/clubs/${parentClubId}/roles`));

    // Verify the new role appears in the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).toBeVisible();

    // Cleanup - delete the created role
    if (createdRole.id) {
      await apiContext.delete(`/club_roles/${createdRole.id}`);
    }
  });

  test('should edit an existing club role', async ({ page, apiContext }) => {
    const uniqueName = `E2E Edit Role ${Date.now()}`;
    const updatedName = `${uniqueName} Updated`;

    // Create a role to edit
    const createResponse = await apiContext.post('/club_roles', {
      data: {
        name: uniqueName,
        description: 'Test role for editing',
        club: `/clubs/${parentClubId}`,
      },
    });

    const createdRole = await createResponse.json();
    const roleId = createdRole.id;

    try {
      // Navigate to the roles list
      await page.goto(`/admin/clubs/${parentClubId}/roles`, { waitUntil: 'networkidle' });

      // Find and click the edit button for our role
      const row = page.getByRole('row').filter({ hasText: uniqueName });
      await expect(row).toBeVisible({ timeout: 10000 });
      await row.getByRole('button', { name: /edit/i }).click();

      // Verify we're on the edit page
      await expect(page).toHaveURL(new RegExp(`/admin/clubs/${parentClubId}/roles/${roleId}/edit`));

      // Update the name
      const nameInput = page.getByLabel(/name/i);
      await nameInput.clear();
      await nameInput.fill(updatedName);

      // Intercept the PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/club_roles/${roleId}`) &&
          response.request().method() === 'PATCH' &&
          response.status() >= 200 &&
          response.status() < 300
      );

      // Submit the form
      await page.getByRole('button', { name: /save|update/i }).click();

      // Wait for API response
      await updateResponsePromise;

      // Verify redirect to roles list
      await expect(page).toHaveURL(new RegExp(`/admin/clubs/${parentClubId}/roles`));

      // Verify the updated role name appears
      await expect(page.getByRole('rowheader', { name: updatedName })).toBeVisible();
    } finally {
      // Cleanup
      await apiContext.delete(`/club_roles/${roleId}`);
    }
  });

  test('should delete a club role', async ({ page, apiContext }) => {
    const uniqueName = `E2E Delete Role ${Date.now()}`;

    // Create a role to delete
    const createResponse = await apiContext.post('/club_roles', {
      data: {
        name: uniqueName,
        description: 'Test role for deletion',
        club: `/clubs/${parentClubId}`,
      },
    });

    const createdRole = await createResponse.json();
    const roleId = createdRole.id;

    // Navigate to the roles list
    await page.goto(`/admin/clubs/${parentClubId}/roles`, { waitUntil: 'networkidle' });

    // Find and click the delete button for our role
    const row = page.getByRole('row').filter({ hasText: uniqueName });
    await expect(row).toBeVisible({ timeout: 10000 });
    await row.getByRole('button', { name: /delete/i }).click();

    // Confirm deletion in dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();

    // Intercept the DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/club_roles/${roleId}`) &&
        response.request().method() === 'DELETE' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Click confirm delete button
    await deleteDialog.getByRole('button', { name: /delete|confirm/i }).click();

    // Wait for API response
    await deleteResponsePromise;

    // Verify the role is removed from the list
    await expect(page.getByRole('rowheader', { name: uniqueName })).not.toBeVisible();
  });

  test('should navigate back to clubs list', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/roles`, { waitUntil: 'networkidle' });

    // Click back to clubs button
    await page.getByRole('link', { name: /back to clubs/i }).click();

    // Verify we're on the clubs list
    await expect(page).toHaveURL(/\/admin\/clubs$/);
  });
});
