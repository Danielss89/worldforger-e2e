import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

/**
 * Helper to create a chat for testing (trivia games require a chat room)
 */
async function getOrCreateChat(apiContext: any): Promise<{ id: string; name: string }> {
  const listResponse = await apiContext.get('/chats?pagination=false');
  const listData = await listResponse.json();
  const chats = listData['hydra:member'] || listData.member || [];

  if (chats.length > 0) {
    return { id: chats[0].id, name: chats[0].name };
  }

  const createResponse = await apiContext.post('/chats', {
    data: { name: `E2E Chat ${Date.now()}` },
  });
  const created = await createResponse.json();
  return { id: created.id, name: created.name };
}

test.describe('Chat Trivia Games CRUD', () => {
  test('should display chat trivia games list', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`${API_URL}/chat_trivia_games`) && response.status() === 200
    );

    await page.goto('/admin/minigames/chat-trivia', { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: 'Chat Trivia Games', exact: true })).toBeVisible();

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
    await page.goto('/admin/minigames/chat-trivia', { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /create game/i }).click();

    await expect(page).toHaveURL(/\/admin\/minigames\/chat-trivia\/new/);
    await expect(page.getByRole('heading', { name: /create chat trivia game/i })).toBeVisible();
  });

  test('should create new chat trivia game', async ({ page, apiContext }) => {
    const chat = await getOrCreateChat(apiContext);
    const testName = `E2E Chat Trivia ${Date.now()}`;

    await page.goto('/admin/minigames/chat-trivia/new', { waitUntil: 'networkidle' });

    // Fill basic info
    await page.getByRole('textbox', { name: /^name$/i }).fill(testName);

    // Fill cron expression
    const cronInput = page.getByRole('textbox', { name: /cron expression/i });
    await cronInput.clear();
    await cronInput.fill('0 */6 * * *');

    // Fill success message
    const successInput = page.getByRole('textbox', { name: /success message/i });
    await successInput.clear();
    await successInput.fill('{winner.displayName} won!');

    // Select chat room
    const chatSelect = page.getByRole('combobox', { name: /chat room/i });
    await chatSelect.click();
    await page.getByRole('option', { name: chat.name }).click();

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/chat_trivia_games`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create game/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toBe(testName);

    // Cleanup
    await apiContext.delete(`/chat_trivia_games/${created.id}`);
  });

  test('should edit existing chat trivia game', async ({ page, apiContext }) => {
    const chat = await getOrCreateChat(apiContext);

    const createResponse = await apiContext.post('/chat_trivia_games', {
      data: {
        name: `E2E Edit Trivia ${Date.now()}`,
        chat: `/chats/${chat.id}`,
        cronExpression: '0 */6 * * *',
        scheduleMode: 'exact',
        winnerMode: 'fixed_count',
        winnerCount: 1,
        successMessage: '{winner.displayName} won!',
      },
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/minigames/chat-trivia/${created.id}/edit`, { waitUntil: 'networkidle' });

      const updatedName = `Updated Trivia ${Date.now()}`;
      await page.getByRole('textbox', { name: /^name$/i }).clear();
      await page.getByRole('textbox', { name: /^name$/i }).fill(updatedName);

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/chat_trivia_games/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.name).toBe(updatedName);
    } finally {
      await apiContext.delete(`/chat_trivia_games/${created.id}`);
    }
  });

  test('should delete chat trivia game', async ({ page, apiContext }) => {
    const chat = await getOrCreateChat(apiContext);

    const createResponse = await apiContext.post('/chat_trivia_games', {
      data: {
        name: `E2E Delete Trivia ${Date.now()}`,
        chat: `/chats/${chat.id}`,
        cronExpression: '0 */6 * * *',
        scheduleMode: 'exact',
        winnerMode: 'fixed_count',
        winnerCount: 1,
        successMessage: '{winner.displayName} won!',
      },
    });
    const created = await createResponse.json();

    await page.goto('/admin/minigames/chat-trivia', { waitUntil: 'networkidle' });

    const row = page.getByRole('row', { name: new RegExp(created.name, 'i') });
    await row.getByRole('button', { name: /delete/i }).click();

    const deletePromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/chat_trivia_games/${created.id}`) && r.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).last().click();

    const response = await deletePromise;
    expect([200, 204]).toContain(response.status());

    await expect(page.getByRole('row', { name: new RegExp(created.name, 'i') })).not.toBeVisible();
  });

  test('should navigate to questions page', async ({ page, apiContext }) => {
    const chat = await getOrCreateChat(apiContext);

    const createResponse = await apiContext.post('/chat_trivia_games', {
      data: {
        name: `E2E Questions Nav ${Date.now()}`,
        chat: `/chats/${chat.id}`,
        cronExpression: '0 */6 * * *',
        scheduleMode: 'exact',
        winnerMode: 'fixed_count',
        winnerCount: 1,
        successMessage: '{winner.displayName} won!',
      },
    });
    const created = await createResponse.json();

    try {
      await page.goto('/admin/minigames/chat-trivia', { waitUntil: 'networkidle' });

      const row = page.getByRole('row', { name: new RegExp(created.name, 'i') });
      await row.getByRole('link', { name: /questions|view/i }).click();

      await expect(page).toHaveURL(new RegExp(`/admin/minigames/chat-trivia/${created.id}/questions`));
    } finally {
      await apiContext.delete(`/chat_trivia_games/${created.id}`);
    }
  });
});
