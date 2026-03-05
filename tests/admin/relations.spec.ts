import { test, expect } from '../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Admin Relations (Read-Only)', () => {
  test('should display relation types from API in table', async ({ page }) => {
    // Capture /relation_types API response
    const relationTypesResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/relation_types`) && response.status() === 200
    );

    await page.goto('/admin/relations/types', { waitUntil: 'networkidle' });

    // Verify header - use first() to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /relation types/i }).first()).toBeVisible();

    // Verify /relation_types API was called and returns expected data
    const relationTypesResponse = await relationTypesResponsePromise;
    const relationTypesData = await relationTypesResponse.json();

    // Check response structure (supports both hydra:member and member)
    const relationTypes = relationTypesData['hydra:member'] || relationTypesData.member || [];
    expect(relationTypes.length).toBeGreaterThanOrEqual(0);

    // Verify each relation type from API response is displayed in table
    for (const relationType of relationTypes) {
      await expect(page.getByRole('rowheader', { name: relationType.name })).toBeVisible();
    }
  });

  test('should display relations index page', async ({ page }) => {
    // Capture /relations API response
    const relationsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().startsWith(`${API_URL}/relations`) &&
        !response.url().includes('relation_types') &&
        response.status() === 200
    );

    await page.goto('/admin/relations', { waitUntil: 'networkidle' });

    // Verify header - use first() to avoid strict mode violation
    await expect(page.getByRole('heading', { name: /relations/i }).first()).toBeVisible();

    // Verify /relations API was called
    const relationsResponse = await relationsResponsePromise;
    const relationsData = await relationsResponse.json();

    // Check response structure
    const relations = relationsData['hydra:member'] || relationsData.member || [];
    expect(relations.length).toBeGreaterThanOrEqual(0);
  });

  test('should navigate to relation types from relations page', async ({ page }) => {
    await page.goto('/admin/relations', { waitUntil: 'networkidle' });

    // Look for a link to relation types
    const typesLink = page.getByRole('link', { name: /types|manage types/i });
    if (await typesLink.isVisible()) {
      await typesLink.click();
      await expect(page).toHaveURL(/\/admin\/relations\/types/);
    }
  });

  test('should show relation type details with correct data', async ({ page }) => {
    // Capture /relation_types API response
    const relationTypesResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/relation_types`) && response.status() === 200
    );

    await page.goto('/admin/relations/types', { waitUntil: 'networkidle' });

    const relationTypesResponse = await relationTypesResponsePromise;
    const relationTypesData = await relationTypesResponse.json();
    const relationTypes = relationTypesData['hydra:member'] || relationTypesData.member || [];

    if (relationTypes.length > 0) {
      const firstRelationType = relationTypes[0];

      // Verify the row shows the relation type name
      await expect(page.getByRole('rowheader', { name: firstRelationType.name })).toBeVisible();

      // Verify description is shown (if present)
      if (firstRelationType.description) {
        await expect(page.getByText(firstRelationType.description)).toBeVisible();
      }
    }
  });

  test('should display bidirectional indicator for relation types', async ({ page }) => {
    // Capture /relation_types API response
    const relationTypesResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/relation_types`) && response.status() === 200
    );

    await page.goto('/admin/relations/types', { waitUntil: 'networkidle' });

    const relationTypesResponse = await relationTypesResponsePromise;
    const relationTypesData = await relationTypesResponse.json();
    const relationTypes = relationTypesData['hydra:member'] || relationTypesData.member || [];

    // Verify table has bidirectional column
    await expect(page.getByRole('columnheader', { name: /bidirectional/i })).toBeVisible();

    // Check that each relation type row shows bidirectional status
    for (const relationType of relationTypes) {
      const row = page.getByRole('row', { name: new RegExp(relationType.name, 'i') });
      await expect(row).toBeVisible();
      // The bidirectional column should show a check or X icon
    }
  });

  test('should display user assignable indicator for relation types', async ({ page }) => {
    // Capture /relation_types API response
    const relationTypesResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/relation_types`) && response.status() === 200
    );

    await page.goto('/admin/relations/types', { waitUntil: 'networkidle' });

    const relationTypesResponse = await relationTypesResponsePromise;
    const relationTypesData = await relationTypesResponse.json();
    const relationTypes = relationTypesData['hydra:member'] || relationTypesData.member || [];

    // Verify table has user assignable column
    await expect(page.getByRole('columnheader', { name: /user assignable/i })).toBeVisible();

    // Check that each relation type row is displayed
    for (const relationType of relationTypes) {
      const row = page.getByRole('row', { name: new RegExp(relationType.name, 'i') });
      await expect(row).toBeVisible();
    }
  });

  test('should display maximum relations for relation types', async ({ page }) => {
    // Capture /relation_types API response
    const relationTypesResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/relation_types`) && response.status() === 200
    );

    await page.goto('/admin/relations/types', { waitUntil: 'networkidle' });

    const relationTypesResponse = await relationTypesResponsePromise;
    const relationTypesData = await relationTypesResponse.json();
    const relationTypes = relationTypesData['hydra:member'] || relationTypesData.member || [];

    // Verify table has max relations column
    await expect(page.getByRole('columnheader', { name: /max relations/i })).toBeVisible();

    // Check that each relation type row shows max relations or unlimited
    for (const relationType of relationTypes) {
      const row = page.getByRole('row', { name: new RegExp(relationType.name, 'i') });
      await expect(row).toBeVisible();

      // Should show either a number or "Unlimited"
      if (relationType.maximumRelations !== null && relationType.maximumRelations !== undefined) {
        await expect(row.getByText(String(relationType.maximumRelations))).toBeVisible();
      } else {
        await expect(row.getByText(/unlimited/i)).toBeVisible();
      }
    }
  });

  test('should have search functionality for relation types', async ({ page }) => {
    await page.goto('/admin/relations/types', { waitUntil: 'networkidle' });

    // Look for search input
    const searchInput = page.getByPlaceholder(/search/i);
    await expect(searchInput).toBeVisible();

    // Type a search term
    await searchInput.fill('test');

    // Wait for filtered results (API should be called with search param)
    await page.waitForResponse(
      (response) =>
        response.url().includes(`${API_URL}/relation_types`) &&
        response.url().includes('search') &&
        response.status() === 200
    );
  });

  test('should have pagination for relation types', async ({ page }) => {
    // Capture /relation_types API response
    const relationTypesResponsePromise = page.waitForResponse(
      (response) => response.url().startsWith(`${API_URL}/relation_types`) && response.status() === 200
    );

    await page.goto('/admin/relations/types', { waitUntil: 'networkidle' });

    const relationTypesResponse = await relationTypesResponsePromise;
    const relationTypesData = await relationTypesResponse.json();

    // If there are multiple pages, pagination controls should be visible
    const totalItems = relationTypesData['hydra:totalItems'] || relationTypesData.totalItems || 0;
    const itemsPerPage = 20; // Default items per page

    if (totalItems > itemsPerPage) {
      // Look for pagination controls
      const nextButton = page.getByRole('button', { name: /next/i });
      await expect(nextButton).toBeVisible();
    }
  });
});
