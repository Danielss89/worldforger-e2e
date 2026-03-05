import { test, expect } from '../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Containers CRUD', () => {
  test('should display containers from API in table', async ({ page }) => {
    // Capture /containers API response
    const containersResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/containers`) && response.status() === 200
    );

    await page.goto('/admin/containers', { waitUntil: 'networkidle' });

    // Verify header
    await expect(page.getByRole('heading', { name: /containers/i })).toBeVisible();

    // Verify /containers API was called and returns expected data
    const containersResponse = await containersResponsePromise;
    const containersData = await containersResponse.json();

    // Check response structure (supports both hydra:member and member)
    const containers = containersData['hydra:member'] || containersData.member || [];
    expect(containers.length).toBeGreaterThanOrEqual(0);

    // Verify each container from API response is displayed in table
    for (const container of containers) {
      await expect(page.getByRole('rowheader', { name: container.name })).toBeVisible();
    }
  });

  test('should create a new container', async ({ page, apiContext }) => {
    const testContainerName = `E2E Test Container ${Date.now()}`;
    const testDescription = 'Test container description';
    const testCapacity = 50;

    await page.goto('/admin/containers/new', { waitUntil: 'networkidle' });

    // Verify create page loaded
    await expect(page.getByRole('heading', { name: /create container/i })).toBeVisible();

    // Fill in the form - use more specific selectors
    await page.getByRole('textbox', { name: /^name/i }).fill(testContainerName);
    await page.getByRole('textbox', { name: /description/i }).fill(testDescription);
    await page.getByRole('spinbutton', { name: /capacity/i }).fill(String(testCapacity));

    // Set up response listener for POST request
    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`${API_URL}/containers`) &&
        response.request().method() === 'POST'
    );

    // Submit form
    await page.getByRole('button', { name: /create container/i }).click();

    // Wait for API response
    const createResponse = await createResponsePromise;
    expect(createResponse.status()).toBe(201);

    const createdContainer = await createResponse.json();
    expect(createdContainer.name).toBe(testContainerName);

    // Verify redirect to containers list
    await expect(page).toHaveURL(/\/admin\/containers$/);

    // Cleanup - delete the created container
    const containerId = createdContainer.id || createdContainer['@id']?.split('/').pop();
    if (containerId) {
      await apiContext.delete(`/containers/${containerId}`);
    }
  });

  test('should update an existing container', async ({ page, apiContext }) => {
    // Create a container via API for testing
    const originalName = `Original Container ${Date.now()}`;
    const updatedName = `Updated Container ${Date.now()}`;

    const createResponse = await apiContext.post('/containers', {
      data: {
        name: originalName,
        description: 'Original description',
        maxCapacity: 100,
        defaultContainer: false,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdContainer = await createResponse.json();
    const containerId = createdContainer.id || createdContainer['@id']?.split('/').pop();

    try {
      // Navigate to edit page
      await page.goto(`/admin/containers/${containerId}/edit`, { waitUntil: 'networkidle' });

      // Verify edit page loaded with existing data
      await expect(page.getByRole('textbox', { name: /^name/i })).toHaveValue(originalName);

      // Update the name
      await page.getByRole('textbox', { name: /^name/i }).clear();
      await page.getByRole('textbox', { name: /^name/i }).fill(updatedName);

      // Set up response listener for PATCH request
      const updateResponsePromise = page.waitForResponse(
        (response) =>
          response.url().includes(containerId) &&
          response.request().method() === 'PATCH'
      );

      // Submit form
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for API response
      const updateResponse = await updateResponsePromise;
      expect(updateResponse.status()).toBe(200);

      const updatedContainer = await updateResponse.json();
      expect(updatedContainer.name).toBe(updatedName);

      // Verify redirect to containers list
      await expect(page).toHaveURL(/\/admin\/containers$/);
    } finally {
      // Cleanup
      await apiContext.delete(`/containers/${containerId}`);
    }
  });

  test('should delete a container', async ({ page, apiContext }) => {
    // Create a container via API for testing
    const containerName = `Container to Delete ${Date.now()}`;

    const createResponse = await apiContext.post('/containers', {
      data: {
        name: containerName,
        description: 'Container to be deleted',
        maxCapacity: 100,
        defaultContainer: false,
      },
    });
    expect(createResponse.ok()).toBeTruthy();

    const createdContainer = await createResponse.json();
    const containerId = createdContainer.id || createdContainer['@id']?.split('/').pop();

    // Navigate to containers list
    await page.goto('/admin/containers', { waitUntil: 'networkidle' });

    // Find the row with our container and click delete
    const row = page.getByRole('row', { name: new RegExp(containerName, 'i') });
    await expect(row).toBeVisible();

    // Click delete button (desktop view shows inline buttons)
    await row.getByRole('button', { name: /delete/i }).click();

    // Set up response listener for DELETE request
    const deleteResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(containerId) &&
        response.request().method() === 'DELETE'
    );

    // Confirm deletion in dialog
    await page.getByRole('dialog').getByRole('button', { name: /delete/i }).click();

    // Wait for API response
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(204);

    // Verify container is removed from the list
    await expect(page.getByRole('row', { name: new RegExp(containerName, 'i') })).not.toBeVisible();
  });
});
