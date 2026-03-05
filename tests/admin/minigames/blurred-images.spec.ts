import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Blurred Image Games CRUD', () => {
  test('should display blurred image games from API', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`${API_URL}/blurred_image_games`) && response.status() === 200
    );

    await page.goto('/admin/minigames/blurred-images', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Blurred Image Games', exact: true })).toBeVisible();

    const response = await responsePromise;
    const data = await response.json();
    const items = data['hydra:member'] || data.member || [];

    if (items.length > 0) {
      for (const item of items.slice(0, 5)) {
        await expect(page.getByText(item.name)).toBeVisible();
      }
    }
  });

  test('should navigate to create form', async ({ page }) => {
    await page.goto('/admin/minigames/blurred-images', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /create game/i }).click();

    await expect(page).toHaveURL(/\/admin\/minigames\/blurred-images\/new/);
    await expect(page.getByRole('heading', { name: /create blurred image game/i })).toBeVisible();
  });

  test('should create new blurred image game', async ({ page, apiContext }) => {
    const testName = `E2E Test Blurred Image Game ${Date.now()}`;

    await page.goto('/admin/minigames/blurred-images/new', { waitUntil: 'networkidle' });

    // Fill form
    await page.getByRole('textbox', { name: /name/i }).fill(testName);
    await page.getByRole('textbox', { name: /description/i }).fill('Test description');
    await page.getByRole('spinbutton', { name: /default tries/i }).fill('4');
    await page.getByRole('spinbutton', { name: /cooldown/i }).fill('45');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/blurred_image_games`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create game/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toBe(testName);
    expect(created.defaultTries).toBe(4);
    expect(created.cooldownMinutes).toBe(45);

    // Verify redirect
    await expect(page).toHaveURL(/\/admin\/minigames\/blurred-images$/);

    // Cleanup
    await apiContext.delete(`/blurred_image_games/${created.id}`);
  });

  test('should edit existing blurred image game', async ({ page, apiContext }) => {
    const createResponse = await apiContext.post('/blurred_image_games', {
      data: {
        name: `E2E Edit Blurred ${Date.now()}`,
        description: 'Original',
        defaultTries: 3,
        cooldownMinutes: 60
      }
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/minigames/blurred-images/${created.id}/edit`, { waitUntil: 'networkidle' });

      const updatedName = `Updated Blurred ${Date.now()}`;
      await page.getByRole('textbox', { name: /name/i }).clear();
      await page.getByRole('textbox', { name: /name/i }).fill(updatedName);

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/blurred_image_games/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.name).toBe(updatedName);
    } finally {
      await apiContext.delete(`/blurred_image_games/${created.id}`);
    }
  });

  test('should delete blurred image game', async ({ page, apiContext }) => {
    const createResponse = await apiContext.post('/blurred_image_games', {
      data: {
        name: `E2E Delete Blurred ${Date.now()}`,
        defaultTries: 3,
        cooldownMinutes: 60
      }
    });
    const created = await createResponse.json();

    await page.goto('/admin/minigames/blurred-images', { waitUntil: 'networkidle' });

    const row = page.getByRole('row', { name: new RegExp(created.name, 'i') });
    await row.getByRole('button', { name: /delete/i }).click();

    const deletePromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/blurred_image_games/${created.id}`) && r.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).last().click();

    const response = await deletePromise;
    expect(response.status()).toBe(204);

    await expect(page.getByRole('row', { name: new RegExp(created.name, 'i') })).not.toBeVisible();
  });

  test('should navigate to items page', async ({ page, apiContext }) => {
    const createResponse = await apiContext.post('/blurred_image_games', {
      data: {
        name: `E2E Items Test ${Date.now()}`,
        defaultTries: 3,
        cooldownMinutes: 60
      }
    });
    const created = await createResponse.json();

    try {
      await page.goto('/admin/minigames/blurred-images', { waitUntil: 'networkidle' });

      const row = page.getByRole('row', { name: new RegExp(created.name, 'i') });
      await row.getByRole('link', { name: /items|view/i }).click();

      await expect(page).toHaveURL(new RegExp(`/admin/minigames/blurred-images/${created.id}/items`));
    } finally {
      await apiContext.delete(`/blurred_image_games/${created.id}`);
    }
  });
});
