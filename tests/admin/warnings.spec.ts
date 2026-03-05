import { test, expect } from '../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Warnings CRUD', () => {
  test('should display warnings list page', async ({ page }) => {
    const warningsResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/user_warnings`) && response.status() === 200
    );

    await page.goto('/admin/warnings', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /warnings/i })).toBeVisible();

    const warningsResponse = await warningsResponsePromise;
    const warningsData = await warningsResponse.json();
    const warnings = warningsData['hydra:member'] || warningsData.member || [];
    expect(warnings.length).toBeGreaterThanOrEqual(0);
  });

  test('should create a new warning', async ({ page, apiContext }) => {
    // First, get a user to warn
    const usersResponse = await apiContext.get('/users?itemsPerPage=1');
    const usersData = await usersResponse.json();
    const users = usersData['hydra:member'] || usersData.member || [];
    expect(users.length).toBeGreaterThan(0);

    const testUser = users[0];

    await page.goto('/admin/warnings/new', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /issue warning/i })).toBeVisible();

    // Search and select user
    const userPicker = page.getByRole('combobox', { name: /user/i });
    await userPicker.fill(testUser.displayName || testUser.username || '');
    // Wait for suggestions to load
    await page.waitForTimeout(500);
    // Select first option
    const option = page.getByRole('option').first();
    if (await option.isVisible()) {
      await option.click();
    }

    // Fill reason
    await page.getByRole('textbox', { name: /reason/i }).fill('E2E Test Warning - automated test');

    // Set up response listener for POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`${API_URL}/user_warnings`) &&
        response.request().method() === 'POST'
    );

    // Submit form
    await page.getByRole('button', { name: /issue warning/i }).click();

    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const createdWarning = await createResponse.json();
    const warningId = createdWarning.id || createdWarning['@id']?.split('/').pop();

    // Verify redirect to warnings list
    await expect(page).toHaveURL(/\/admin\/warnings$/);

    // Cleanup
    if (warningId) {
      await apiContext.delete(`/user_warnings/${warningId}`);
    }
  });

  test('should view warning detail', async ({ page, apiContext }) => {
    // Create a warning via API
    const usersResponse = await apiContext.get('/users?itemsPerPage=1');
    const usersData = await usersResponse.json();
    const users = usersData['hydra:member'] || usersData.member || [];
    const testUser = users[0];

    const createResponse = await apiContext.post('/user_warnings', {
      data: {
        user: `/users/${testUser.id}`,
        reason: 'E2E Test Detail Warning',
        severity: 'moderate',
        visibleToUser: true,
      },
    });
    const created = await createResponse.json();
    const warningId = created.id || created['@id']?.split('/').pop();

    try {
      await page.goto(`/admin/warnings/${warningId}`, { waitUntil: 'networkidle' });

      await expect(page.getByRole('heading', { name: /warning details/i })).toBeVisible();
      await expect(page.getByText('E2E Test Detail Warning')).toBeVisible();
      await expect(page.getByText(/moderate/i)).toBeVisible();
    } finally {
      if (warningId) {
        await apiContext.delete(`/user_warnings/${warningId}`);
      }
    }
  });

  test('should revoke a warning', async ({ page, apiContext }) => {
    // Create a warning via API
    const usersResponse = await apiContext.get('/users?itemsPerPage=1');
    const usersData = await usersResponse.json();
    const users = usersData['hydra:member'] || usersData.member || [];
    const testUser = users[0];

    const createResponse = await apiContext.post('/user_warnings', {
      data: {
        user: `/users/${testUser.id}`,
        reason: 'E2E Test Revoke Warning',
        severity: 'minor',
        visibleToUser: true,
      },
    });
    const created = await createResponse.json();
    const warningId = created.id || created['@id']?.split('/').pop();

    try {
      await page.goto(`/admin/warnings/${warningId}`, { waitUntil: 'networkidle' });

      // Click revoke button
      await page.getByRole('button', { name: /revoke warning/i }).click();

      // Fill in revocation reason
      await page.getByPlaceholder(/reason for revoking/i).fill('E2E test revocation');

      // Set up response listener for revoke request
      const revokeResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(`/user_warnings/${warningId}/revoke`) &&
          response.request().method() === 'POST'
      );

      await page.getByRole('button', { name: /confirm revoke/i }).click();

      const revokeResponse = await revokeResponsePromise;
      expect(revokeResponse.status()).toBe(200);

      // Verify the warning now shows as revoked
      await expect(page.getByText(/revoked/i)).toBeVisible();
    } finally {
      if (warningId) {
        await apiContext.delete(`/user_warnings/${warningId}`);
      }
    }
  });

  test('should delete a warning', async ({ page, apiContext }) => {
    // Create a warning via API
    const usersResponse = await apiContext.get('/users?itemsPerPage=1');
    const usersData = await usersResponse.json();
    const users = usersData['hydra:member'] || usersData.member || [];
    const testUser = users[0];

    const createResponse = await apiContext.post('/user_warnings', {
      data: {
        user: `/users/${testUser.id}`,
        reason: 'E2E Test Delete Warning',
        severity: 'minor',
        visibleToUser: true,
      },
    });
    const created = await createResponse.json();
    const warningId = created.id || created['@id']?.split('/').pop();

    await page.goto(`/admin/warnings/${warningId}`, { waitUntil: 'networkidle' });

    // Click delete button
    await page.getByRole('button', { name: /delete/i }).click();

    // Confirm in dialog
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(warningId) &&
        response.request().method() === 'DELETE'
    );

    await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();

    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(204);

    // Verify redirect to warnings list
    await expect(page).toHaveURL(/\/admin\/warnings$/);
  });

  test('should filter warnings by status', async ({ page }) => {
    await page.goto('/admin/warnings', { waitUntil: 'networkidle' });

    // Click Active filter tab
    await page.getByRole('radio', { name: /active/i }).click();

    // Wait for filtered results
    await page.waitForResponse(
      (response) => response.url().includes('user_warnings') && response.status() === 200
    );

    // Click Revoked filter tab
    await page.getByRole('radio', { name: /revoked/i }).click();

    await page.waitForResponse(
      (response) => response.url().includes('user_warnings') && response.status() === 200
    );

    // Click All filter tab to reset
    await page.getByRole('radio', { name: /all/i }).click();

    await page.waitForResponse(
      (response) => response.url().includes('user_warnings') && response.status() === 200
    );
  });
});
