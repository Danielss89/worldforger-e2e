import { test, expect } from '../../../fixtures/api.fixture.js';

const API_URL = process.env.BACKEND_API_URL || 'http://localhost:8099';

test.describe('Money Denominations CRUD', () => {
  let moneyId: string;

  test.beforeAll(async ({ workerApiContext }) => {
    // Create parent Money type
    const response = await workerApiContext.post('/money', {
      data: { name: `E2E Denominations Test Money ${Date.now()}` },
    });
    const money = await response.json();
    moneyId = money.id;
  });

  test.afterAll(async ({ workerApiContext }) => {
    // Cleanup - delete the Money type (cascades to denominations)
    await workerApiContext.delete(`/money/${moneyId}`);
  });

  test('should display denominations for money type', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(`${API_URL}/denominations`) && response.status() === 200
    );

    await page.goto(`/admin/money/${moneyId}/denominations`, { waitUntil: 'networkidle' });

    await expect(page.getByRole('heading', { name: /denominations/i })).toBeVisible();

    await responsePromise;
  });

  test('should navigate to create denomination form', async ({ page }) => {
    await page.goto(`/admin/money/${moneyId}/denominations`, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: /add|create/i }).click();

    await expect(page).toHaveURL(new RegExp(`/admin/money/${moneyId}/denominations/new`));
    await expect(page.getByRole('heading', { name: /add denomination/i })).toBeVisible();
  });

  test('should create new denomination with symbol', async ({ page, apiContext }) => {
    const testName = `E2E Test Denomination ${Date.now()}`;

    await page.goto(`/admin/money/${moneyId}/denominations/new`, { waitUntil: 'networkidle' });

    // Fill form
    await page.getByRole('textbox', { name: /name/i }).fill(testName);
    await page.getByRole('spinbutton', { name: /value/i }).fill('100');
    await page.getByRole('textbox', { name: /text symbol/i }).fill('$');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/denominations`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create denomination/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toBe(testName);
    expect(created.value).toBe(100);
    expect(created.symbol).toBe('$');

    // Cleanup
    await apiContext.delete(`/denominations/${created.id}`);
  });

  test('should edit existing denomination', async ({ page, apiContext }) => {
    // Create a test denomination first
    const createResponse = await apiContext.post('/denominations', {
      data: {
        name: `E2E Edit Denomination ${Date.now()}`,
        value: 50,
        symbol: 'E',
        money: `/money/${moneyId}`
      },
    });
    const created = await createResponse.json();

    try {
      await page.goto(`/admin/money/${moneyId}/denominations/${created.id}/edit`, { waitUntil: 'networkidle' });

      const updatedName = `Updated Denomination ${Date.now()}`;
      await page.getByRole('textbox', { name: /name/i }).clear();
      await page.getByRole('textbox', { name: /name/i }).fill(updatedName);

      const updatePromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/denominations/${created.id}`) && r.request().method() === 'PATCH'
      );

      await page.getByRole('button', { name: /save|update/i }).click();

      const response = await updatePromise;
      expect(response.status()).toBe(200);

      const updated = await response.json();
      expect(updated.name).toBe(updatedName);
    } finally {
      await apiContext.delete(`/denominations/${created.id}`);
    }
  });

  test('should delete denomination', async ({ page, apiContext }) => {
    // Create a test denomination first
    const createResponse = await apiContext.post('/denominations', {
      data: {
        name: `E2E Delete Denomination ${Date.now()}`,
        value: 25,
        symbol: 'D',
        money: `/money/${moneyId}`
      },
    });
    const created = await createResponse.json();

    await page.goto(`/admin/money/${moneyId}/denominations`, { waitUntil: 'networkidle' });

    // Find and click delete button
    const row = page.getByRole('row', { name: new RegExp(created.name, 'i') });
    await row.getByRole('button', { name: /delete/i }).click();

    const deletePromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/denominations/${created.id}`) && r.request().method() === 'DELETE'
    );

    await page.getByRole('button', { name: /delete/i }).last().click();

    const response = await deletePromise;
    expect(response.status()).toBe(204);

    await expect(page.getByRole('row', { name: new RegExp(created.name, 'i') })).not.toBeVisible();
  });

  test('should create denomination with parent', async ({ page, apiContext }) => {
    // Create a parent denomination first
    const parentResponse = await apiContext.post('/denominations', {
      data: {
        name: `Parent Denomination ${Date.now()}`,
        value: 100,
        symbol: 'G',
        money: `/money/${moneyId}`
      },
    });
    const parent = await parentResponse.json();

    try {
      const childName = `Child Denomination ${Date.now()}`;

      await page.goto(`/admin/money/${moneyId}/denominations/new`, { waitUntil: 'networkidle' });

      await page.getByRole('textbox', { name: /name/i }).fill(childName);
      await page.getByRole('spinbutton', { name: /value/i }).fill('10');
      await page.getByRole('textbox', { name: /text symbol/i }).fill('S');

      // Select parent denomination
      const parentSelect = page.getByRole('button', { name: /parent denomination/i });
      await parentSelect.click();
      await page.getByRole('option', { name: new RegExp(parent.name, 'i') }).click();

      const createPromise = page.waitForResponse(
        (r) => r.url().includes(`${API_URL}/denominations`) && r.request().method() === 'POST'
      );

      await page.getByRole('button', { name: /create denomination/i }).click();

      const response = await createPromise;
      expect(response.status()).toBe(201);

      const created = await response.json();
      expect(created.name).toBe(childName);
      expect(created.parent).toContain(parent.id);

      // Cleanup child
      await apiContext.delete(`/denominations/${created.id}`);
    } finally {
      // Cleanup parent
      await apiContext.delete(`/denominations/${parent.id}`);
    }
  });

  test('should create denomination without symbol (base denomination)', async ({ page, apiContext }) => {
    const testName = `E2E Base Denomination ${Date.now()}`;

    await page.goto(`/admin/money/${moneyId}/denominations/new`, { waitUntil: 'networkidle' });

    // Fill form - only name and value, no symbol
    await page.getByRole('textbox', { name: /name/i }).fill(testName);
    await page.getByRole('spinbutton', { name: /value/i }).fill('1');

    const createPromise = page.waitForResponse(
      (r) => r.url().includes(`${API_URL}/denominations`) && r.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /create denomination/i }).click();

    const response = await createPromise;
    expect(response.status()).toBe(201);

    const created = await response.json();
    expect(created.name).toBe(testName);
    expect(created.value).toBe(1);

    // Cleanup
    await apiContext.delete(`/denominations/${created.id}`);
  });
});
