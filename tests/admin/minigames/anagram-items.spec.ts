import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Anagram Items CRUD', () => {
  let gameId: string;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create parent Anagram Game
    const response = await workerApiContext.post('/anagram_games', {
      data: {
        name: `E2E Anagram Items Test ${Date.now()}`,
        defaultTries: 3,
        cooldownMinutes: 60
      }
    });
    const game = await response.json();
    gameId = game.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup - delete the game (cascades to items)
    await workerApiContext.delete(`/anagram_games/${gameId}`);
  });

  test('should display anagrams for game', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`${API_URL}/anagrams`) && response.status() === 200
    );

    await page.goto(`/admin/minigames/anagrams/${gameId}/items`, { waitUntil: 'networkidle' });

    await responsePromise;
  });

  test('should navigate to create anagram form', async ({ page }) => {
    await page.goto(`/admin/minigames/anagrams/${gameId}/items`, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /add|create/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/minigames/anagrams/${gameId}/items/new`));
  });

  test('should create new anagram', async ({ page, apiContext }) => {
    const testWord = 'TESTING';

    await page.goto(`/admin/minigames/anagrams/${gameId}/items/new`, { waitUntil: 'networkidle' });

    // Fill form
    await page.getByRole('textbox', { name: /word/i }).fill(testWord);
    await page.getByRole('textbox', { name: /hint/i }).fill('A process of verification');
    await page.getByRole('spinbutton', { name: /weight/i }).fill('50');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/anagrams`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create anagram/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.word).toBe(testWord);
    expect(created.weight).toBe(50);

    // Verify redirect
    await expect(page).toHaveURL(new RegExp(`/admin/minigames/anagrams/${gameId}/items$`));

    // Cleanup
    await apiContext.delete(`/anagrams/${created.id}`);
  });

  test('should edit existing anagram', async ({ page, apiContext }) => {
    const createResponse = await apiContext.post('/anagrams', {
      data: {
        word: 'ORIGINAL',
        hint: 'Original hint',
        weight: 100,
        anagramGame: `/anagram_games/${gameId}`
      }
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/minigames/anagrams/${gameId}/items/${created.id}/edit`, { waitUntil: 'networkidle' });

      const updatedWord = 'UPDATED';
      await page.getByRole('textbox', { name: /word/i }).clear();
      await page.getByRole('textbox', { name: /word/i }).fill(updatedWord);

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/anagrams/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.word).toBe(updatedWord);
    } finally {
      await apiContext.delete(`/anagrams/${created.id}`);
    }
  });

  test('should delete anagram', async ({ page, apiContext }) => {
    const createResponse = await apiContext.post('/anagrams', {
      data: {
        word: 'DELETE',
        weight: 100,
        anagramGame: `/anagram_games/${gameId}`
      }
    });
    const created = await createResponse.json();

    await page.goto(`/admin/minigames/anagrams/${gameId}/items`, { waitUntil: 'networkidle' });

    const row = page.getByRole('row', { name: new RegExp(created.word, 'i') });
    await row.getByRole('button', { name: /delete/i }).click();

    const deletePromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/anagrams/${created.id}`) && r.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).last().click();

    const response = await deletePromise;
    expect(response.status()).toBe(204);

    await expect(page.getByRole('row', { name: new RegExp(created.word, 'i') })).not.toBeVisible();
  });

  test('should create anagram with max tries override', async ({ page, apiContext }) => {
    const testWord = 'OVERRIDE';

    await page.goto(`/admin/minigames/anagrams/${gameId}/items/new`, { waitUntil: 'networkidle' });

    await page.getByRole('textbox', { name: /word/i }).fill(testWord);
    await page.getByRole('spinbutton', { name: /weight/i }).fill('100');
    await page.getByRole('spinbutton', { name: /max tries/i }).fill('5');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/anagrams`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create anagram/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.word).toBe(testWord);
    expect(created.maxTries).toBe(5);

    // Cleanup
    await apiContext.delete(`/anagrams/${created.id}`);
  });
});
