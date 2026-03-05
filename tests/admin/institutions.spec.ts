import { test, expect } from '../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Institutions CRUD', () => {
  test('should display institutions from API in table', async ({ page }) => {
    // Capture /institutions API response
    const institutionsResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/institutions`) && response.status() === 200
    );

    await page.goto('/admin/institutions', { waitUntil: 'networkidle' });

    // Verify header
    await expect(page.getByRole('heading', { name: /institutions/i })).toBeVisible();

    // Verify /institutions API was called and returns expected data
    const institutionsResponse = await institutionsResponsePromise;
    const institutionsData = await institutionsResponse.json();

    // Check response structure (supports both hydra:member and member)
    const institutions = institutionsData['hydra:member'] || institutionsData.member || [];
    expect(institutions.length).toBeGreaterThanOrEqual(0);

    // Verify each institution from API response is displayed in table
    for (const institution of institutions) {
      await expect(page.getByRole('rowheader', { name: institution.name })).toBeVisible();
    }
  });

  test('should create a new institution', async ({ page, apiContext }) => {
    const testName = `E2E Test Institution ${Date.now()}`;
    const testDescription = 'Test institution description';

    await page.goto('/admin/institutions/new', { waitUntil: 'networkidle' });

    // Verify create page loaded
    await expect(page.getByRole('heading', { name: /create institution/i })).toBeVisible();

    // Fill in the form - use more specific selectors
    await page.getByRole('textbox', { name: /^name/i }).fill(testName);
    await page.getByRole('textbox', { name: /description/i }).fill(testDescription);

    // Select type (school is default, using the select dropdown)
    // Note: Type selection uses a Select component - school is default

    // Set up response listener for POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`${API_URL}/institutions`) &&
        response.request().method() === 'POST'
    );

    // Submit form
    await page.getByRole('button', { name: /create institution/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const createdInstitution = await createResponse.json();
    expect(createdInstitution.name).toBe(testName);

    // Verify redirect to institutions list
    await expect(page).toHaveURL(/\/admin\/institutions$/);

    // Cleanup - delete the created institution
    const institutionId = createdInstitution.id || createdInstitution['@id']?.split('/').pop();
    if (institutionId) {
      await apiContext.delete(`/institutions/${institutionId}`);
    }
  });

  test('should update an existing institution', async ({ page, apiContext }) => {
    // Create an institution via API for testing
    const originalName = `Original Institution ${Date.now()}`;
    const updatedName = `Updated Institution ${Date.now()}`;

    const createResponse = await apiContext.post('/institutions', {
      data: {
        name: originalName,
        description: 'Original description',
        type: 'school',
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdInstitution = await createResponse.json();
    const institutionId = createdInstitution.id || createdInstitution['@id']?.split('/').pop();

    try {
      // Navigate to edit page
      await page.goto(`/admin/institutions/${institutionId}/edit`, { waitUntil: 'networkidle' });

      // Verify edit page loaded with existing data
      await expect(page.getByRole('textbox', { name: /^name/i })).toHaveValue(originalName);

      // Update the name
      await page.getByRole('textbox', { name: /^name/i }).clear();
      await page.getByRole('textbox', { name: /^name/i }).fill(updatedName);

      // Set up response listener for PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(institutionId) &&
          response.request().method() === 'PATCH'
      );

      // Submit form
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for API response
      const updateResponse = await updateResponsePromise;
      expect(updateResponse.status()).toBe(200);

      const updatedInstitution = await updateResponse.json();
      expect(updatedInstitution.name).toBe(updatedName);

      // Verify redirect to institutions list
      await expect(page).toHaveURL(/\/admin\/institutions$/);
    } finally {
      // Cleanup
      await apiContext.delete(`/institutions/${institutionId}`);
    }
  });

  test('should delete an institution', async ({ page, apiContext }) => {
    // Create an institution via API for testing
    const institutionName = `Institution to Delete ${Date.now()}`;

    const createResponse = await apiContext.post('/institutions', {
      data: {
        name: institutionName,
        description: 'Institution to be deleted',
        type: 'school',
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdInstitution = await createResponse.json();
    const institutionId = createdInstitution.id || createdInstitution['@id']?.split('/').pop();

    // Navigate to institutions list
    await page.goto('/admin/institutions', { waitUntil: 'networkidle' });

    // Find the row with our institution and click delete
    const row = page.getByRole('row', { name: new RegExp(institutionName, 'i') });
    await expect(row).toBeVisible();

    // Click delete button (desktop view shows inline buttons)
    await row.getByRole('button', { name: /delete/i }).click();

    // Set up response listener for DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(institutionId) &&
        response.request().method() === 'DELETE'
    );

    // Confirm deletion in dialog
    await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();

    // Wait for API response
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(204);

    // Verify institution is removed from the list
    await expect(page.getByRole('row', { name: new RegExp(institutionName, 'i') })).not.toBeVisible();
  });
});
