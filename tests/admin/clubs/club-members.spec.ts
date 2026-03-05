/**
 * Club Members CRUD E2E Tests
 * Tests for the club members admin section (nested under clubs)
 */
import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';
const API_HEADERS = {
  'Content-Type': 'application/ld+json',
  'X-Tenant-Domain': 'localhost'
};

test.describe('Admin Club Members', () => {
  let parentClubId: string;
  let parentRoleId: string;
  const parentClubName = `E2E Club Members Test ${Date.now()}`;
  const parentRoleName = `E2E Test Role ${Date.now()}`;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create a parent club for testing
    const clubResponse = await workerApiContext.post('/clubs', {
      data: {
        name: parentClubName,
        description: 'Test club for members E2E tests',
        isPublic: true,
        isOpenForJoining: true,
        isOfficial: false,
      },
    });
    const club = await clubResponse.json();
    parentClubId = club.id;

    // Create a role for the club (required for members)
    const roleResponse = await workerApiContext.post('/club_roles', {
      data: {
        name: parentRoleName,
        description: 'Test role for members',
        club: `/clubs/${parentClubId}`,
      },
    });
    const role = await roleResponse.json();
    parentRoleId = role.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup: delete the parent club (should cascade delete members and roles)
    if (parentClubId) {
      await workerApiContext.delete(`/clubs/${parentClubId}`);
    }
  });

  test('should display club members list page', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/members`, { waitUntil: 'networkidle' });

    // Verify page header contains club name - use first() to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /members/i }).first()).toBeVisible();
  });

  test('should display members from API in table', async ({ page }) => {
    // Capture /club_members API response
    const membersResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/club_members') &&
        response.url().includes(`club.id=${parentClubId}`) &&
        response.status() === 200
    );

    await page.goto(`/admin/clubs/${parentClubId}/members`, { waitUntil: 'networkidle' });

    // Verify /club_members API was called
    const membersResponse = await membersResponsePromise;
    const membersData = await membersResponse.json();

    // Check response structure
    expect(membersData['@type']).toBe('Collection');
  });

  test('should navigate to add member page', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/members`, { waitUntil: 'networkidle' });

    // Click add member button
    await page.getByRole('button', { name: /add member/i }).click();

    // Verify we're on the create page
    await expect(page).toHaveURL(new RegExp(`/admin/clubs/${parentClubId}/members/new`));
  });

  test('should add a new member to the club', async ({ page, apiContext }) => {
    // First get a user to add as member
    const usersResponse = await apiContext.get('/users?itemsPerPage=1');
    const usersData = await usersResponse.json();
    const users = usersData['hydra:member'] || usersData.member || [];

    if (users.length === 0) {
      test.skip(true, 'No users available for testing');
      return;
    }

    const testUser = users[0];
    const userIri = testUser['@id'] || `/users/${testUser.id}`;

    // Navigate to add member page
    await page.goto(`/admin/clubs/${parentClubId}/members/new`, { waitUntil: 'networkidle' });

    // Select user (using combobox/select)
    const userPicker = page.locator('[data-testid="user-picker"]').first();
    if (await userPicker.isVisible()) {
      await userPicker.click();
      // Wait for options and select first user
      await page.getByRole('option').first().click();
    } else {
      // Try alternative selector
      const userSelect = page.getByLabel(/user|member/i).first();
      if (await userSelect.isVisible()) {
        await userSelect.click();
        await page.getByRole('option').first().click();
      }
    }

    // Select role
    const rolePicker = page.locator('[data-testid="role-picker"]').first();
    if (await rolePicker.isVisible()) {
      await rolePicker.click();
      await page.getByRole('option', { name: new RegExp(parentRoleName, 'i') }).click();
    } else {
      const roleSelect = page.getByLabel(/role/i).first();
      if (await roleSelect.isVisible()) {
        await roleSelect.click();
        await page.getByRole('option').first().click();
      }
    }

    // Intercept the POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/club_members') &&
        response.request().method() === 'POST' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Submit the form
    const submitButton = page.getByRole('button', { name: /add member|create|save/i });
    await submitButton.click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    const createdMember = await createResponse.json();

    // Verify redirect to members list
    await expect(page).toHaveURL(new RegExp(`/admin/clubs/${parentClubId}/members`));

    // Cleanup - delete the created member
    if (createdMember.id) {
      await apiContext.delete(`/club_members/${createdMember.id}`);
    }
  });

  test('should remove a member from the club', async ({ page, apiContext }) => {
    // First get a user to add as member
    const usersResponse = await apiContext.get('/users?itemsPerPage=1');
    const usersData = await usersResponse.json();
    const users = usersData['hydra:member'] || usersData.member || [];

    if (users.length === 0) {
      test.skip(true, 'No users available for testing');
      return;
    }

    const testUser = users[0];
    const userIri = testUser['@id'] || `/users/${testUser.id}`;
    const roleIri = `/club_roles/${parentRoleId}`;

    // Create a member to delete
    const createResponse = await apiContext.post('/club_members', {
      data: {
        club: `/clubs/${parentClubId}`,
        user: userIri,
        role: roleIri,
      },
    });

    const createdMember = await createResponse.json();
    const memberId = createdMember.id;

    // Navigate to the members list
    await page.goto(`/admin/clubs/${parentClubId}/members`, { waitUntil: 'networkidle' });

    // Find and click the remove button for the member
    const row = page.getByRole('row').filter({ hasText: testUser.displayName || testUser.username || testUser.email });
    await row.getByRole('button', { name: /remove|delete/i }).click();

    // Confirm removal in dialog
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();

    // Intercept the DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/club_members/${memberId}`) &&
        response.request().method() === 'DELETE' &&
        response.status() >= 200 &&
        response.status() < 300
    );

    // Click confirm delete button
    await deleteDialog.getByRole('button', { name: /remove|delete|confirm/i }).click();

    // Wait for API response
    await deleteResponsePromise;
  });

  test('should navigate back to clubs list', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/members`, { waitUntil: 'networkidle' });

    // Click back to clubs button
    await page.getByRole('link', { name: /back to clubs/i }).click();

    // Verify we're on the clubs list
    await expect(page).toHaveURL(/\/admin\/clubs$/);
  });
});
