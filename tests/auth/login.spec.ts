import { test, expect } from '@playwright/test';
import { LoginPage } from '../../page-objects/login.page.js';

test.describe('Login', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await loginPage.navigate();
  });

  test('should display login form', async () => {
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();
    await expect(loginPage.submitButton).toBeVisible();
  });

  test('should show error for invalid credentials', async () => {
    await loginPage.login('invalid@example.com', 'wrongpassword');
    await loginPage.expectErrorMessage(/invalid|incorrect|failed/i);
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    const email = process.env.TEST_USER_EMAIL || 'test@example.com';
    const password = process.env.TEST_USER_PASSWORD || 'password123';

    await loginPage.login(email, password);

    await expect(page).toHaveURL(/\/(dashboard|home|user)/);
  });

  test('should require email field', async () => {
    await loginPage.passwordInput.fill('password123');
    await loginPage.submitButton.click();

    await loginPage.expectToBeOnLoginPage();
  });

  test('should require password field', async () => {
    await loginPage.emailInput.fill('test@example.com');
    await loginPage.submitButton.click();

    await loginPage.expectToBeOnLoginPage();
  });
});
