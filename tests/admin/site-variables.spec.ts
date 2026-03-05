import { test, expect } from '../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Site Variables CRUD', () => {
  test('should display site variables from API in table', async ({ page }) => {
    // Capture /site_variables API response
    const variablesResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/site_variables`) && response.status() === 200
    );

    await page.goto('/admin/site-variables', { waitUntil: 'networkidle' });

    // Verify header
    await expect(page.getByRole('heading', { name: /site variables/i })).toBeVisible();

    // Verify /site_variables API was called and returns expected data
    const variablesResponse = await variablesResponsePromise;
    const variablesData = await variablesResponse.json();

    // Check response structure (supports both hydra:member and member)
    const variables = variablesData['hydra:member'] || variablesData.member || [];
    expect(variables.length).toBeGreaterThanOrEqual(0);

    // Verify each variable from API response is displayed in table
    for (const variable of variables) {
      // Site variables display name or key in the table
      const displayName = variable.name || variable.key;
      await expect(page.getByRole('rowheader', { name: displayName })).toBeVisible();
    }
  });

  test('should create a new site variable', async ({ page, apiContext }) => {
    const testKey = `test_var_${Date.now()}`;
    const testName = `Test Variable ${Date.now()}`;
    const testStringValue = 'Test value';

    await page.goto('/admin/site-variables/new', { waitUntil: 'networkidle' });

    // Verify create page loaded
    await expect(page.getByRole('heading', { name: /create site variable/i })).toBeVisible();

    // Fill in the form
    // Key input is a special field with {{var: prefix - find the actual input
    const keyInput = page.locator('input[placeholder*="head_admin"]');
    await keyInput.fill(testKey);

    await page.getByRole('textbox', { name: /^name/i }).fill(testName);

    // The string value field appears for string type (default)
    const stringValueField = page.getByRole('textbox', { name: /text value/i });
    if (await stringValueField.isVisible()) {
      await stringValueField.fill(testStringValue);
    }

    // Set up response listener for POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`${API_URL}/site_variables`) &&
        response.request().method() === 'POST'
    );

    // Submit form
    await page.getByRole('button', { name: /create variable/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const createdVariable = await createResponse.json();
    expect(createdVariable.key).toBe(testKey);

    // Verify redirect to site-variables list
    await expect(page).toHaveURL(/\/admin\/site-variables$/);

    // Cleanup - delete the created variable
    const variableId = createdVariable.id || createdVariable['@id']?.split('/').pop();
    if (variableId) {
      await apiContext.delete(`/site_variables/${variableId}`);
    }
  });

  test('should update an existing site variable', async ({ page, apiContext }) => {
    // Create a site variable via API for testing
    const originalKey = `original_var_${Date.now()}`;
    const originalName = `Original Variable ${Date.now()}`;
    const updatedName = `Updated Variable ${Date.now()}`;

    const createResponse = await apiContext.post('/site_variables', {
      data: {
        key: originalKey,
        name: originalName,
        type: 'string',
        stringValue: 'original value',
        allowedContexts: ['*'],
        enabled: true,
        sortOrder: 0,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdVariable = await createResponse.json();
    const variableId = createdVariable.id || createdVariable['@id']?.split('/').pop();

    try {
      // Navigate to edit page
      await page.goto(`/admin/site-variables/${variableId}/edit`, { waitUntil: 'networkidle' });

      // Verify edit page loaded with existing data
      await expect(page.getByRole('textbox', { name: /^name/i })).toHaveValue(originalName);

      // Update the name
      await page.getByRole('textbox', { name: /^name/i }).clear();
      await page.getByRole('textbox', { name: /^name/i }).fill(updatedName);

      // Set up response listener for PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(variableId) &&
          response.request().method() === 'PATCH'
      );

      // Submit form
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for API response
      const updateResponse = await updateResponsePromise;
      expect(updateResponse.status()).toBe(200);

      const updatedVariable = await updateResponse.json();
      expect(updatedVariable.name).toBe(updatedName);

      // Verify redirect to site-variables list
      await expect(page).toHaveURL(/\/admin\/site-variables$/);
    } finally {
      // Cleanup
      await apiContext.delete(`/site_variables/${variableId}`);
    }
  });

  test('should delete a site variable', async ({ page, apiContext }) => {
    // Create a site variable via API for testing
    const variableKey = `delete_var_${Date.now()}`;
    const variableName = `Variable to Delete ${Date.now()}`;

    const createResponse = await apiContext.post('/site_variables', {
      data: {
        key: variableKey,
        name: variableName,
        type: 'string',
        stringValue: 'value to delete',
        allowedContexts: ['*'],
        enabled: true,
        sortOrder: 0,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdVariable = await createResponse.json();
    const variableId = createdVariable.id || createdVariable['@id']?.split('/').pop();

    // Navigate to site-variables list
    await page.goto('/admin/site-variables', { waitUntil: 'networkidle' });

    // Find the row with our variable and click delete
    const row = page.getByRole('row', { name: new RegExp(variableName, 'i') });
    await expect(row).toBeVisible();

    // Click delete button (desktop view shows inline buttons)
    await row.getByRole('button', { name: /delete/i }).click();

    // Set up response listener for DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(variableId) &&
        response.request().method() === 'DELETE'
    );

    // Confirm deletion in dialog
    await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();

    // Wait for API response
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(204);

    // Verify variable is removed from the list
    await expect(page.getByRole('row', { name: new RegExp(variableName, 'i') })).not.toBeVisible();
  });
});
