import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Riddle Items CRUD', () => {
  let gameId: string;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create parent Riddle Game
    const response = await workerApiContext.post('/riddle_games', {
      data: {
        name: `E2E Riddle Items Test ${Date.now()}`,
        defaultTries: 3,
        cooldownMinutes: 60
      },
    });
    const game = await response.json();
    gameId = game.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup - delete the game (cascades to items)
    await workerApiContext.delete(`/riddle_games/${gameId}`);
  });

  test('should display riddles for game', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`${API_URL}/riddles`) && response.status() === 200
    );

    await page.goto(`/admin/minigames/riddles/${gameId}/items`, { waitUntil: 'networkidle' });

    await responsePromise;
  });

  test('should navigate to create riddle form', async ({ page }) => {
    await page.goto(`/admin/minigames/riddles/${gameId}/items`, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /add|create/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/minigames/riddles/${gameId}/items/new`));
  });

  test('should create new riddle', async ({ page, apiContext }) => {
    const testRiddle = 'What has hands but cannot clap?';
    const testAnswer = 'clock';

    await page.goto(`/admin/minigames/riddles/${gameId}/items/new`, { waitUntil: 'networkidle' });

    // Fill form
    await page.getByRole('textbox', { name: /riddle/i }).fill(testRiddle);
    await page.getByRole('textbox', { name: /answer/i }).fill(testAnswer);
    await page.getByRole('spinbutton', { name: /weight/i }).fill('80');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/riddles`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create riddle/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.riddle).toBe(testRiddle);
    expect(created.answer).toBe(testAnswer);
    expect(created.weight).toBe(80);

    // Verify redirect
    await expect(page).toHaveURL(new RegExp(`/admin/minigames/riddles/${gameId}/items$`));

    // Cleanup
    await apiContext.delete(`/riddles/${created.id}`);
  });

  test('should edit existing riddle', async ({ page, apiContext }) => {
    const createResponse = await apiContext.post('/riddles', {
      data: {
        riddle: 'Original riddle?',
        answer: 'original',
        weight: 100,
        riddleGame: `/riddle_games/${gameId}`
      },
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/minigames/riddles/${gameId}/items/${created.id}/edit`, { waitUntil: 'networkidle' });

      const updatedRiddle = 'Updated riddle question?';
      await page.getByRole('textbox', { name: /riddle/i }).clear();
      await page.getByRole('textbox', { name: /riddle/i }).fill(updatedRiddle);

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/riddles/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.riddle).toBe(updatedRiddle);
    } finally {
      await apiContext.delete(`/riddles/${created.id}`);
    }
  });

  test('should delete riddle', async ({ page, apiContext }) => {
    const createResponse = await apiContext.post('/riddles', {
      data: {
        riddle: 'Delete riddle?',
        answer: 'delete',
        weight: 100,
        riddleGame: `/riddle_games/${gameId}`
      },
    });
    const created = await createResponse.json();

    await page.goto(`/admin/minigames/riddles/${gameId}/items`, { waitUntil: 'networkidle' });

    // Find the row containing the riddle text
    const row = page.getByRole('row', { name: new RegExp('delete riddle', 'i') });
    await row.getByRole('button', { name: /delete/i }).click();

    const deletePromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/riddles/${created.id}`) && r.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).last().click();

    const response = await deletePromise;
    expect(response.status()).toBe(204);

    await expect(page.getByRole('row', { name: new RegExp('delete riddle', 'i') })).not.toBeVisible();
  });

  test('should create riddle with max tries override', async ({ page, apiContext }) => {
    const testRiddle = 'What comes once in a minute, twice in a moment?';

    await page.goto(`/admin/minigames/riddles/${gameId}/items/new`, { waitUntil: 'networkidle' });

    await page.getByRole('textbox', { name: /riddle/i }).fill(testRiddle);
    await page.getByRole('textbox', { name: /answer/i }).fill('M');
    await page.getByRole('spinbutton', { name: /weight/i }).fill('100');
    await page.getByRole('spinbutton', { name: /max tries/i }).fill('2');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/riddles`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create riddle/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.riddle).toBe(testRiddle);
    expect(created.maxTries).toBe(2);

    // Cleanup
    await apiContext.delete(`/riddles/${created.id}`);
  });

  test('should create riddle with all fields', async ({ page, apiContext }) => {
    const testRiddle = 'I speak without a mouth and hear without ears. What am I?';
    const testAnswer = 'echo';

    await page.goto(`/admin/minigames/riddles/${gameId}/items/new`, { waitUntil: 'networkidle' });

    await page.getByRole('textbox', { name: /riddle/i }).fill(testRiddle);
    await page.getByRole('textbox', { name: /answer/i }).fill(testAnswer);
    await page.getByRole('spinbutton', { name: /weight/i }).fill('150');
    await page.getByRole('spinbutton', { name: /max tries/i }).fill('4');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/riddles`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create riddle/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.riddle).toBe(testRiddle);
    expect(created.answer).toBe(testAnswer);
    expect(created.weight).toBe(150);
    expect(created.maxTries).toBe(4);

    // Cleanup
    await apiContext.delete(`/riddles/${created.id}`);
  });
});
