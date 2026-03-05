import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Blurred Image Items CRUD', () => {
  let gameId: string;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create parent Blurred Image Game
    const response = await workerApiContext.post('/blurred_image_games', {
      data: {
        name: `E2E Blurred Items Test ${Date.now()}`,
        defaultTries: 3,
        cooldownMinutes: 60
      },
    });
    const game = await response.json();
    gameId = game.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup - delete the game (cascades to items)
    await workerApiContext.delete(`/blurred_image_games/${gameId}`);
  });

  test('should display blurred images for game', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`${API_URL}/blurred_images`) && response.status() === 200
    );

    await page.goto(`/admin/minigames/blurred-images/${gameId}/items`, { waitUntil: 'networkidle' });

    await responsePromise;
  });

  test('should navigate to create blurred image form', async ({ page }) => {
    await page.goto(`/admin/minigames/blurred-images/${gameId}/items`, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /add|create/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/minigames/blurred-images/${gameId}/items/new`));
  });

  test('should create new blurred image', async ({ page, apiContext }) => {
    const testName = `E2E Test Image ${Date.now()}`;
    const testAnswer = 'cat';

    await page.goto(`/admin/minigames/blurred-images/${gameId}/items/new`, { waitUntil: 'networkidle' });

    // Fill form
    await page.getByRole('textbox', { name: /name/i }).fill(testName);
    await page.getByRole('textbox', { name: /answer/i }).fill(testAnswer);
    await page.getByRole('spinbutton', { name: /weight/i }).fill('75');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/blurred_images`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create image/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toBe(testName);
    expect(created.answer).toBe(testAnswer);
    expect(created.weight).toBe(75);

    // Verify redirect
    await expect(page).toHaveURL(new RegExp(`/admin/minigames/blurred-images/${gameId}/items$`));

    // Cleanup
    await apiContext.delete(`/blurred_images/${created.id}`);
  });

  test('should edit existing blurred image', async ({ page, apiContext }) => {
    const createResponse = await apiContext.post('/blurred_images', {
      data: {
        name: 'Original Image',
        answer: 'original',
        weight: 100,
        blurredImageGame: `/blurred_image_games/${gameId}`
      },
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/minigames/blurred-images/${gameId}/items/${created.id}/edit`, { waitUntil: 'networkidle' });

      const updatedName = `Updated Image ${Date.now()}`;
      await page.getByRole('textbox', { name: /name/i }).clear();
      await page.getByRole('textbox', { name: /name/i }).fill(updatedName);

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/blurred_images/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.name).toBe(updatedName);
    } finally {
      await apiContext.delete(`/blurred_images/${created.id}`);
    }
  });

  test('should delete blurred image', async ({ page, apiContext }) => {
    const createResponse = await apiContext.post('/blurred_images', {
      data: {
        name: 'Delete Image',
        answer: 'delete',
        weight: 100,
        blurredImageGame: `/blurred_image_games/${gameId}`
      },
    });
    const created = await createResponse.json();

    await page.goto(`/admin/minigames/blurred-images/${gameId}/items`, { waitUntil: 'networkidle' });

    const row = page.getByRole('row', { name: new RegExp(created.name, 'i') });
    await row.getByRole('button', { name: /delete/i }).click();

    const deletePromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/blurred_images/${created.id}`) && r.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).last().click();

    const response = await deletePromise;
    expect(response.status()).toBe(204);

    await expect(page.getByRole('row', { name: new RegExp(created.name, 'i') })).not.toBeVisible();
  });

  test('should create blurred image with max tries override', async ({ page, apiContext }) => {
    const testName = `E2E Override Image ${Date.now()}`;

    await page.goto(`/admin/minigames/blurred-images/${gameId}/items/new`, { waitUntil: 'networkidle' });

    await page.getByRole('textbox', { name: /name/i }).fill(testName);
    await page.getByRole('textbox', { name: /answer/i }).fill('test');
    await page.getByRole('spinbutton', { name: /weight/i }).fill('100');
    await page.getByRole('spinbutton', { name: /max tries/i }).fill('7');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/blurred_images`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create image/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toBe(testName);
    expect(created.maxTries).toBe(7);

    // Cleanup
    await apiContext.delete(`/blurred_images/${created.id}`);
  });
});
