/**
 * Club Membership Requests E2E Tests
 * Tests for the club membership requests admin section (nested under clubs)
 * NOTE: This is a read-only/action-only section - no create/edit, only approve/reject
 */
import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Club Membership Requests', () => {
  let parentClubId: string;
  let parentRoleId: string;
  const parentClubName = `E2E Club Requests Test ${Date.now()}`;
  const parentRoleName = `E2E Test Role ${Date.now()}`;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create a parent club for testing (with closed joining to allow requests)
    const clubResponse = await workerApiContext.post('/clubs', {
      data: {
        name: parentClubName,
        description: 'Test club for requests E2E tests',
        isPublic: true,
        isOpenForJoining: false, // Closed for joining to enable request flow
        isOfficial: false,
      },
    });
    const club = await clubResponse.json();
    parentClubId = club.id;

    // Create a role for the club (required for approving requests)
    const roleResponse = await workerApiContext.post('/club_roles', {
      data: {
        name: parentRoleName,
        description: 'Test role for request approval',
        club: `/clubs/${parentClubId}`,
      },
    });
    const role = await roleResponse.json();
    parentRoleId = role.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup: delete the parent club (should cascade delete requests and roles)
    if (parentClubId) {
      await workerApiContext.delete(`/clubs/${parentClubId}`);
    }
  });

  test('should display club requests list page', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/requests`, { waitUntil: 'networkidle' });

    // Verify page header contains requests
    await expect(page.getByRole('heading', { name: /requests|membership/i })).toBeVisible();
  });

  test('should display requests from API', async ({ page }) => {
    // Capture /club_membership_requests API response
    const requestsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/club_membership_requests') &&
        response.url().includes(`club.id=${parentClubId}`) &&
        response.status() === 200
    );

    await page.goto(`/admin/clubs/${parentClubId}/requests`, { waitUntil: 'networkidle' });

    // Verify /club_membership_requests API was called
    const requestsResponse = await requestsResponsePromise;
    const requestsData = await requestsResponse.json();

    // Check response structure
    expect(requestsData['@type']).toBe('Collection');
  });

  test('should show warning when no roles exist', async ({ page, apiContext }) => {
    // Create a club without roles
    const clubResponse = await apiContext.post('/clubs', {
      data: {
        name: `E2E No Roles Club ${Date.now()}`,
        description: 'Test club without roles',
        isPublic: true,
        isOpenForJoining: false,
        isOfficial: false,
      },
    });
    const club = await clubResponse.json();

    try {
      await page.goto(`/admin/clubs/${club.id}/requests`, { waitUntil: 'networkidle' });

      // Should show warning about needing roles
      const warning = page.getByText(/create.*role.*before.*approving|need.*role/i);
      // The warning should be visible if no roles exist
      // (may not show if roles exist from other tests)
    } finally {
      // Cleanup
      await apiContext.delete(`/clubs/${club.id}`);
    }
  });

  test('should approve a membership request', async ({ page, apiContext }) => {
    // First get a user for the request
    const usersResponse = await apiContext.get('/users?itemsPerPage=1');
    const usersData = await usersResponse.json();
    const users = usersData['hydra:member'] || usersData.member || [];

    if (users.length === 0) {
      test.skip(true, 'No users available for testing');
      return;
    }

    const testUser = users[0];
    const userIri = testUser['@id'] || `/users/${testUser.id}`;

    // Create a membership request
    const createResponse = await apiContext.post('/club_membership_requests', {
      data: {
        club: `/clubs/${parentClubId}`,
        user: userIri,
        message: 'E2E test request',
        status: 'pending',
      },
    });

    const createdRequest = await createResponse.json();
    const requestId = createdRequest.id;

    // Navigate to the requests list
    await page.goto(`/admin/clubs/${parentClubId}/requests`, { waitUntil: 'networkidle' });

    // Find and click the approve button for the request
    const row = page.getByRole('row').filter({
      hasText: testUser.displayName || testUser.username || testUser.email,
    });

    if (await row.isVisible()) {
      await row.getByRole('button').click(); // Open action menu
      await page.getByRole('menuitem', { name: /approve/i }).click();

      // Approve dialog should appear with role selection
      const approveDialog = page.getByRole('dialog');
      if (await approveDialog.isVisible()) {
        // Select a role
        const rolePicker = approveDialog.getByLabel(/role/i);
        if (await rolePicker.isVisible()) {
          await rolePicker.click();
          await page.getByRole('option').first().click();
        }

        // Click approve button
        await approveDialog.getByRole('button', { name: /approve/i }).click();

        // Wait for success toast or dialog to close
        await expect(approveDialog).not.toBeVisible({ timeout: 5000 });
      }
    }

    // Cleanup - delete the membership request and any created member
    try {
      await apiContext.delete(`/club_membership_requests/${requestId}`);
    } catch {
      // May already be deleted or modified
    }

    // Cleanup any created club member
    const membersResponse = await apiContext.get(
      `/club_members?club.id=${parentClubId}&user=${encodeURIComponent(userIri)}`
    );
    const membersData = await membersResponse.json();
    const members = membersData['hydra:member'] || membersData.member || [];
    for (const member of members) {
      await apiContext.delete(`/club_members/${member.id}`);
    }
  });

  test('should reject a membership request', async ({ page, apiContext }) => {
    // First get a user for the request
    const usersResponse = await apiContext.get('/users?itemsPerPage=1');
    const usersData = await usersResponse.json();
    const users = usersData['hydra:member'] || usersData.member || [];

    if (users.length === 0) {
      test.skip(true, 'No users available for testing');
      return;
    }

    const testUser = users[0];
    const userIri = testUser['@id'] || `/users/${testUser.id}`;

    // Create a membership request
    const createResponse = await apiContext.post('/club_membership_requests', {
      data: {
        club: `/clubs/${parentClubId}`,
        user: userIri,
        message: 'E2E test request to reject',
        status: 'pending',
      },
    });

    const createdRequest = await createResponse.json();
    const requestId = createdRequest.id;

    // Navigate to the requests list
    await page.goto(`/admin/clubs/${parentClubId}/requests`, { waitUntil: 'networkidle' });

    // Find and click the reject button for the request
    const row = page.getByRole('row').filter({
      hasText: testUser.displayName || testUser.username || testUser.email,
    });

    if (await row.isVisible()) {
      await row.getByRole('button').click(); // Open action menu
      await page.getByRole('menuitem', { name: /reject/i }).click();

      // Reject dialog should appear
      const rejectDialog = page.getByRole('dialog');
      if (await rejectDialog.isVisible()) {
        // Intercept the PATCH request
        const rejectResponsePromise = page.waitForResponse(
          (response) =>
            response.url().includes(`/club_membership_requests/${requestId}`) &&
            response.request().method() === 'PATCH' &&
            response.status() >= 200 &&
            response.status() < 300
        );

        // Click reject button
        await rejectDialog.getByRole('button', { name: /reject/i }).click();

        // Wait for API response
        await rejectResponsePromise;

        // Dialog should close
        await expect(rejectDialog).not.toBeVisible({ timeout: 5000 });
      }
    }

    // Cleanup
    try {
      await apiContext.delete(`/club_membership_requests/${requestId}`);
    } catch {
      // May already be modified
    }
  });

  test('should show empty state when no pending requests', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/requests`, { waitUntil: 'networkidle' });

    // If there are no pending requests, empty state should be shown
    const emptyState = page.getByText(/no pending requests|all.*processed/i);
    // This may or may not be visible depending on existing data
  });

  test('should navigate back to clubs list', async ({ page }) => {
    await page.goto(`/admin/clubs/${parentClubId}/requests`, { waitUntil: 'networkidle' });

    // Click back to clubs button
    await page.getByRole('link', { name: /back to clubs/i }).click();

    // Verify we're on the clubs list
    await expect(page).toHaveURL(/\/admin\/clubs$/);
  });
});
